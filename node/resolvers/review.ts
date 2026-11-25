import { NotFoundError, UserInputError } from '@vtex/api'

import { reviewerFromToken } from '../domain/actor'
import { toOrganizationInput } from '../domain/organization'
import { latestDecision, verificationOutcome } from '../domain/kycOutcome'
import type {
  Application,
  ApplicationStatus,
  DocumentRef,
  KycCheckKind,
  RevealableIdentifier,
} from '../domain/types'
import type { Decision } from '../domain/workflow'
import {
  completeApproval,
  currentStage,
  decide,
  decideKycCheck,
  documentStatus,
  failedApproval,
  fullHistory,
  maskedIndia,
  recordVerification,
  revealIdentifier,
  reviewDocument,
  verificationStage,
} from '../domain/workflow'
import { runKycChecks } from '../verification/kyc'
import {
  appSettings,
  applyTransition,
  documentStore,
  kycProvider,
  loadApplication,
  repository,
  stageConfig,
  toUserError,
  userError,
  verifier,
} from './shared'

const STATUSES: ApplicationStatus[] = ['IN_REVIEW', 'APPROVED', 'REJECTED']
const KYC_KINDS: KycCheckKind[] = ['PAN', 'IEC', 'UDYAM', 'BANK_ACCOUNT']
const REVEALABLE: RevealableIdentifier[] = ['PAN', 'BANK_ACCOUNT']

function actor(ctx: Context) {
  return reviewerFromToken(ctx.vtex.adminUserAuthToken)
}

/** Creates and approves the organization through B2B Organizations. */
async function approve(ctx: Context, app: Application, note: unknown) {
  const b2b = ctx.clients.b2bOrganizations
  const repo = repository(ctx)
  const who = actor(ctx)

  try {
    // Reuse the request if an earlier attempt created it, so a retry never
    // creates a second organization.
    let requestId = app.organizationRequestId

    if (!requestId) {
      requestId = await b2b.createRequest(toOrganizationInput(app))
      app = { ...app, organizationRequestId: requestId }
      await repo.save(app)
    }

    if ((await b2b.requestStatus(requestId)) !== 'approved') {
      await b2b.approveRequest(
        requestId,
        `Approved in B2B onboarding, application ${app.reference}`
      )
    }

    // B2B Organizations gives the new organization the request's ID.
    return await applyTransition(
      ctx,
      app,
      completeApproval(
        app,
        { requestId, organizationId: requestId },
        { note },
        who,
        new Date()
      )
    )
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)

    ctx.vtex.logger.error({
      message: 'Organization approval failed',
      error: message,
      application: app.id,
    })
    await applyTransition(
      ctx,
      app,
      failedApproval(app, message, who, new Date())
    )

    throw userError(
      "B2B Organizations couldn't create the organization. The application stays at its stage, so you can try again.",
      'APPROVAL_FAILED'
    )
  }
}

export const reviewQueries = {
  onboardingApplications: async (
    _: unknown,
    args: { status?: ApplicationStatus; page?: number; pageSize?: number },
    ctx: Context
  ) => {
    if (args.status && !STATUSES.includes(args.status)) {
      throw new UserInputError('Invalid status')
    }

    const result = await repository(ctx).list({
      status: args.status,
      page: args.page ?? 1,
      pageSize: args.pageSize ?? 20,
    })

    return {
      items: result.data,
      pagination: result.pagination,
    }
  },

  onboardingApplication: (_: unknown, { id }: { id: string }, ctx: Context) =>
    loadApplication(ctx, id),

  onboardingStages: async (_: unknown, __: unknown, ctx: Context) => {
    // One settings read for both
    const settings = await appSettings(ctx)
    const [stages, kyc] = await Promise.all([
      stageConfig(ctx, settings),
      kycProvider(ctx, settings),
    ])

    // A bad KYC provider setting is reported with the stage problems, so
    // admins see it on the review screen.
    return {
      ...stages,
      problems: kyc.problem
        ? [...stages.problems, kyc.problem]
        : stages.problems,
    }
  },

  /**
   * A document's file for the review screen, as base64. Files are at most
   * 5 MB, so this stays small enough for one response. Only reviewers reach
   * it (@auth), and the storage ID never leaves the server.
   */
  onboardingDocument: async (
    _: unknown,
    { id, kind }: { id: string; kind: string },
    ctx: Context
  ) => {
    const app = await loadApplication(ctx, id)
    const doc = (app.documents ?? []).find((d) => d.kind === kind)

    if (!doc) {
      throw new NotFoundError('Document not found')
    }

    const file = await documentStore(ctx).get(doc.storageId)

    return {
      kind: doc.kind,
      fileName: doc.fileName,
      // Our own record of the type, checked on upload, not the stored header
      contentType: doc.contentType,
      size: file.data.length,
      dataBase64: file.data.toString('base64'),
    }
  },
}

export const reviewMutations = {
  runVerification: async (
    _: unknown,
    { id, stageId }: { id: string; stageId: string },
    ctx: Context
  ) => {
    const app = await loadApplication(ctx, id)

    try {
      // Fail fast on the wrong stage before calling the provider
      verificationStage(app, stageId)

      const now = new Date()
      const { provider } = await kycProvider(ctx)
      const [registry, kyc] = await Promise.all([
        verifier.verify(app, now),
        runKycChecks(provider, app, now),
      ])

      return await applyTransition(
        ctx,
        app,
        recordVerification(app, stageId, { registry, kyc }, actor(ctx), now)
      )
    } catch (e) {
      return toUserError(e)
    }
  },

  reviewDocument: async (
    _: unknown,
    args: {
      id: string
      stageId: string
      kind: string
      decision: 'ACCEPT' | 'REJECT'
      note?: string
    },
    ctx: Context
  ) => {
    const app = await loadApplication(ctx, args.id)

    try {
      return await applyTransition(
        ctx,
        app,
        reviewDocument(
          app,
          {
            stageId: args.stageId,
            kind: args.kind,
            decision: args.decision === 'ACCEPT' ? 'ACCEPTED' : 'REJECTED',
            note: args.note,
          },
          actor(ctx),
          new Date()
        )
      )
    } catch (e) {
      return toUserError(e)
    }
  },

  decideKycCheck: async (
    _: unknown,
    args: {
      id: string
      stageId: string
      kind: KycCheckKind
      decision: 'ACCEPT' | 'REJECT'
      note: string
    },
    ctx: Context
  ) => {
    if (!KYC_KINDS.includes(args.kind)) {
      throw new UserInputError('Invalid check')
    }

    const app = await loadApplication(ctx, args.id)

    try {
      return await applyTransition(
        ctx,
        app,
        decideKycCheck(
          app,
          {
            stageId: args.stageId,
            kind: args.kind,
            decision: args.decision === 'ACCEPT' ? 'ACCEPTED' : 'REJECTED',
            note: args.note,
          },
          actor(ctx),
          new Date()
        )
      )
    } catch (e) {
      return toUserError(e)
    }
  },

  /** Returns one full identifier and records that this reviewer opened it */
  revealIdentifier: async (
    _: unknown,
    args: { id: string; field: RevealableIdentifier },
    ctx: Context
  ) => {
    if (!REVEALABLE.includes(args.field)) {
      throw new UserInputError('Invalid identifier')
    }

    const app = await loadApplication(ctx, args.id)

    try {
      const { value, transition } = revealIdentifier(
        app,
        args.field,
        actor(ctx),
        new Date()
      )

      // Record first: if recording fails, the value isn't returned
      await applyTransition(ctx, app, transition)

      return value
    } catch (e) {
      return toUserError(e)
    }
  },

  decideStage: async (
    _: unknown,
    args: {
      id: string
      stageId: string
      decision: Decision
      reason?: string
      note?: string
    },
    ctx: Context
  ) => {
    const app = await loadApplication(ctx, args.id)

    try {
      const transition = decide(
        app,
        args.stageId,
        args.decision,
        { reason: args.reason, note: args.note },
        actor(ctx),
        new Date()
      )

      if (transition.effect === 'CREATE_ORGANIZATION') {
        return await approve(ctx, app, args.note)
      }

      return await applyTransition(ctx, app, transition)
    } catch (e) {
      return toUserError(e)
    }
  },
}

export const applicationFields = {
  currentStage: (app: Application) =>
    app.status === 'IN_REVIEW' && app.stages?.length ? currentStage(app) : null,

  events: async (app: Application, _: unknown, ctx: Context) =>
    fullHistory(app, await repository(ctx).events(app.id)),

  // Never the raw record: the GraphQL type has no field for a full PAN or
  // account number, and this resolver doesn't pass them on either.
  india: (app: Application) => maskedIndia(app),

  kycChecks: (app: Application) =>
    app.kycChecks
      ? app.kycChecks.map((check) => ({
          ...check,
          decision: latestDecision(app, check),
        }))
      : null,

  verificationOutcome: (app: Application) => verificationOutcome(app),
}

export const documentFields = {
  status: (doc: DocumentRef) => documentStatus(doc),
  lastReview: (doc: DocumentRef) =>
    doc.reviews?.[doc.reviews.length - 1] ?? null,
}
