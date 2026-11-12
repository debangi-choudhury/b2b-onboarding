import { UserInputError } from '@vtex/api'

import { reviewerFromToken } from '../domain/actor'
import { toOrganizationInput } from '../domain/organization'
import type { Application, ApplicationStatus } from '../domain/types'
import type { Decision } from '../domain/workflow'
import {
  completeApproval,
  currentStage,
  decide,
  failedApproval,
  recordVerification,
  verificationStage,
} from '../domain/workflow'
import {
  applyTransition,
  loadApplication,
  repository,
  stageConfig,
  toUserError,
  verifier,
} from './shared'

const STATUSES: ApplicationStatus[] = ['IN_REVIEW', 'APPROVED', 'REJECTED']

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

    throw new UserInputError({
      message:
        "B2B Organizations couldn't create the organization. The application stays at its stage, so you can try again.",
      code: 'APPROVAL_FAILED',
    })
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

  onboardingStages: (_: unknown, __: unknown, ctx: Context) => stageConfig(ctx),
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
      const result = await verifier.verify(app, now)

      return await applyTransition(
        ctx,
        app,
        recordVerification(app, stageId, result, actor(ctx), now)
      )
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

  events: (app: Application, _: unknown, ctx: Context) =>
    repository(ctx).events(app.id),
}
