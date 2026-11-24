import { maskAccount, maskPan } from './indiaIdentifiers'
import { toKycCheck, verificationOutcome } from './kycOutcome'
import type {
  Actor,
  Application,
  ApplicationEvent,
  ApplicationInput,
  DocumentRef,
  DocumentStatus,
  KycCheckKind,
  KycResult,
  RevealableIdentifier,
  Stage,
  VerificationResult,
} from './types'
import { cleanDecisionNote, cleanNote, cleanReason } from './validation'

export type Decision = 'PASS' | 'REJECT'

export type WorkflowErrorCode =
  | 'NOT_IN_REVIEW'
  | 'STAGE_MISMATCH'
  | 'NOT_VERIFICATION_STAGE'
  | 'NOT_REVIEW_STAGE'
  | 'DOCUMENT_NOT_FOUND'
  | 'DOCUMENTS_NOT_ACCEPTED'
  | 'VERIFICATION_REQUIRED'
  | 'VERIFICATION_FAILED'
  | 'REASON_REQUIRED'
  | 'KYC_DECISION_REQUIRED'
  | 'KYC_CHECK_NOT_FOUND'
  | 'KYC_CHECK_NOT_UNDECIDED'
  | 'NOTE_REQUIRED'
  | 'IDENTIFIER_NOT_FOUND'

export class WorkflowError extends Error {
  constructor(public readonly code: WorkflowErrorCode, message: string) {
    super(message)
    this.name = 'WorkflowError'
  }
}

/** What to write after a step: fields to change, and events for the history */
export interface Transition {
  patch: Partial<Application>
  events: Array<Omit<ApplicationEvent, 'applicationId'>>
  /** CREATE_ORGANIZATION: the caller must create the organization next */
  effect: 'NONE' | 'CREATE_ORGANIZATION'
}

function stageEvent(stage: Stage, actor: Actor, at: string) {
  return {
    stageId: stage.id,
    stageLabel: stage.label,
    actorType: actor.type,
    actor: actor.id,
    createdAt: at,
  }
}

export function documentStatus(doc: DocumentRef): DocumentStatus {
  const latest = doc.reviews?.[doc.reviews.length - 1]

  return latest ? latest.decision : 'NEEDS_REVIEW'
}

export function currentStage(app: Application): Stage {
  const stage = app.stages[app.currentStageIndex]

  if (!stage) {
    throw new WorkflowError(
      'NOT_IN_REVIEW',
      'The application has no current stage'
    )
  }

  return stage
}

export function newApplication(
  input: ApplicationInput,
  stages: Stage[],
  ids: { reference: string; tokenHash: string },
  now: Date
): {
  application: Omit<Application, 'id'>
  event: Omit<ApplicationEvent, 'applicationId'>
} {
  const at = now.toISOString()

  return {
    application: {
      ...input,
      reference: ids.reference,
      tokenHash: ids.tokenHash,
      status: 'IN_REVIEW',
      stages,
      currentStageIndex: 0,
      currentStageId: stages[0].id,
      verification: null,
      kycChecks: null,
      kycDecisions: [],
      identifierReveals: [],
      documents: [],
      rejectionReason: null,
      organizationRequestId: null,
      organizationId: null,
      submittedAt: at,
      updatedAt: at,
      decidedAt: null,
    },
    event: {
      type: 'SUBMITTED',
      stageId: stages[0].id,
      stageLabel: stages[0].label,
      actorType: 'APPLICANT',
      actor: 'applicant',
      createdAt: at,
    },
  }
}

function assertActionable(app: Application, stageId: string): Stage {
  if (app.status !== 'IN_REVIEW') {
    throw new WorkflowError(
      'NOT_IN_REVIEW',
      `The application is already ${app.status.toLowerCase()}`
    )
  }

  const stage = currentStage(app)

  // The reviewer acted on what they saw. If someone else moved the
  // application meanwhile, refuse rather than act on the wrong stage.
  if (stage.id !== stageId) {
    throw new WorkflowError(
      'STAGE_MISMATCH',
      `The application is now at "${stage.label}". Reload and try again.`
    )
  }

  return stage
}

/** Checks a verification can run now, before calling the provider. */
export function verificationStage(app: Application, stageId: string): Stage {
  const stage = assertActionable(app, stageId)

  if (stage.type !== 'VERIFICATION') {
    throw new WorkflowError(
      'NOT_VERIFICATION_STAGE',
      `"${stage.label}" doesn't run a verification`
    )
  }

  return stage
}

/**
 * A reviewer accepts or rejects one document on a REVIEW stage. They can
 * change their mind until the stage passes; every decision is kept.
 */
export function reviewDocument(
  app: Application,
  input: {
    stageId: string
    kind: string
    decision: 'ACCEPTED' | 'REJECTED'
    note?: unknown
  },
  actor: Actor,
  now: Date
): Transition {
  const stage = assertActionable(app, input.stageId)

  if (stage.type !== 'REVIEW') {
    throw new WorkflowError(
      'NOT_REVIEW_STAGE',
      `Documents are reviewed on review stages, not on "${stage.label}"`
    )
  }

  const documents = app.documents ?? []

  if (!documents.some((doc) => doc.kind === input.kind)) {
    throw new WorkflowError(
      'DOCUMENT_NOT_FOUND',
      'The application has no such document'
    )
  }

  const at = now.toISOString()
  const review = {
    decision: input.decision,
    stageId: stage.id,
    stageLabel: stage.label,
    actor: actor.id,
    note: cleanNote(input.note),
    at,
  }

  return {
    patch: {
      documents: documents.map((doc) =>
        doc.kind === input.kind
          ? { ...doc, reviews: [...(doc.reviews ?? []), review] }
          : doc
      ),
      updatedAt: at,
    },
    events: [],
    effect: 'NONE',
  }
}

/**
 * The full history, oldest first: stored events, plus document reviews, KYC
 * decisions and identifier reveals. Those live on the application record,
 * because the history entity's schema is hard to change once in use.
 */
export function fullHistory(
  app: Application,
  events: ApplicationEvent[]
): ApplicationEvent[] {
  const reviews: ApplicationEvent[] = (app.documents ?? []).flatMap((doc) =>
    (doc.reviews ?? []).map((review) => ({
      applicationId: app.id,
      type: 'DOCUMENT_REVIEWED' as const,
      stageId: review.stageId,
      stageLabel: review.stageLabel,
      actorType: 'REVIEWER' as const,
      actor: review.actor,
      note: review.note ?? null,
      details: JSON.stringify({ kind: doc.kind, decision: review.decision }),
      createdAt: review.at,
    }))
  )

  const decisions: ApplicationEvent[] = (app.kycDecisions ?? []).map(
    (decision) => ({
      applicationId: app.id,
      type: 'KYC_DECIDED' as const,
      stageId: decision.stageId,
      stageLabel: decision.stageLabel,
      actorType: 'REVIEWER' as const,
      actor: decision.actor,
      note: decision.note,
      details: JSON.stringify({
        kind: decision.kind,
        decision: decision.decision,
        reference: decision.checkReference,
      }),
      createdAt: decision.at,
    })
  )

  const reveals: ApplicationEvent[] = (app.identifierReveals ?? []).map(
    (reveal) => ({
      applicationId: app.id,
      type: 'IDENTIFIER_REVEALED' as const,
      actorType: 'REVIEWER' as const,
      actor: reveal.actor,
      details: JSON.stringify({ field: reveal.field }),
      createdAt: reveal.at,
    })
  )

  return [...events, ...reviews, ...decisions, ...reveals].sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt)
  )
}

/**
 * Records a verification run on the verification stage: the registry check,
 * and for India applications every KYC check with its name match. A new run
 * replaces the previous checks. Earlier decisions stay in the history but no
 * longer count, because they were about other results.
 */
export function recordVerification(
  app: Application,
  stageId: string,
  results: { registry: VerificationResult; kyc?: KycResult[] },
  actor: Actor,
  now: Date
): Transition {
  const stage = verificationStage(app, stageId)
  const at = now.toISOString()
  const { registry } = results
  const kycChecks = app.india
    ? (results.kyc ?? []).map((result) => toKycCheck(result, app.companyName))
    : null

  return {
    patch: { verification: registry, kycChecks, updatedAt: at },
    events: [
      {
        ...stageEvent(stage, actor, at),
        type: 'VERIFICATION_RUN',
        // Compact, and without identifiers, to stay within the 2000
        // characters the history allows
        details: JSON.stringify({
          status: registry.status,
          code: registry.code,
          message: registry.message,
          provider: registry.provider,
          reference: registry.reference,
          ...(kycChecks
            ? {
                kyc: kycChecks.map((check) => ({
                  kind: check.kind,
                  status: check.effectiveStatus,
                  code: check.code,
                  reference: check.reference,
                  match: check.nameMatch?.band ?? null,
                })),
              }
            : {}),
        }),
      },
    ],
    effect: 'NONE',
  }
}

/**
 * A reviewer accepts or rejects a KYC check the provider or the name match
 * couldn't decide (MANUAL_REVIEW), with a note. They can change their mind
 * until the stage passes; every decision is kept.
 */
export function decideKycCheck(
  app: Application,
  input: {
    stageId: string
    kind: KycCheckKind
    decision: 'ACCEPTED' | 'REJECTED'
    note: unknown
  },
  actor: Actor,
  now: Date
): Transition {
  const stage = verificationStage(app, input.stageId)
  const check = (app.kycChecks ?? []).find((c) => c.kind === input.kind)

  if (!check) {
    throw new WorkflowError(
      'KYC_CHECK_NOT_FOUND',
      'The application has no such check. Run the verification first.'
    )
  }

  if (check.effectiveStatus !== 'MANUAL_REVIEW') {
    throw new WorkflowError(
      'KYC_CHECK_NOT_UNDECIDED',
      'Only checks that need a manual review can be accepted or rejected'
    )
  }

  const note = cleanDecisionNote(input.note)

  if (!note) {
    throw new WorkflowError(
      'NOTE_REQUIRED',
      'Explain the decision in a note of 10 to 1000 characters'
    )
  }

  const at = now.toISOString()

  return {
    patch: {
      kycDecisions: [
        ...(app.kycDecisions ?? []),
        {
          kind: check.kind,
          checkReference: check.reference,
          decision: input.decision,
          note,
          stageId: stage.id,
          stageLabel: stage.label,
          actor: actor.id,
          at,
        },
      ],
      updatedAt: at,
    },
    events: [],
    effect: 'NONE',
  }
}

/** India identifiers as reviewers see them: PAN and account number masked */
export function maskedIndia(app: Pick<Application, 'india'>) {
  if (!app.india) {
    return null
  }

  const { pan, importsOrExports, iec, udyam, bank } = app.india

  return {
    maskedPan: maskPan(pan),
    importsOrExports,
    iec: iec ?? null,
    udyam: udyam ?? null,
    maskedAccountNumber: maskAccount(bank.accountNumber),
    ifsc: bank.ifsc,
    accountHolderName: bank.holderName,
  }
}

/**
 * A reviewer opens a full PAN or account number. Allowed at any status, and
 * always recorded in the history.
 */
export function revealIdentifier(
  app: Application,
  field: RevealableIdentifier,
  actor: Actor,
  now: Date
): { value: string; transition: Transition } {
  const value =
    field === 'PAN' ? app.india?.pan : app.india?.bank?.accountNumber

  if (!value) {
    throw new WorkflowError(
      'IDENTIFIER_NOT_FOUND',
      'The application has no such identifier'
    )
  }

  const at = now.toISOString()

  return {
    value,
    transition: {
      patch: {
        identifierReveals: [
          ...(app.identifierReveals ?? []),
          { field, actor: actor.id, at },
        ],
        updatedAt: at,
      },
      events: [],
      effect: 'NONE',
    },
  }
}

/** A reviewer passes or rejects the current stage. */
export function decide(
  app: Application,
  stageId: string,
  decision: Decision,
  input: { reason?: unknown; note?: unknown },
  actor: Actor,
  now: Date
): Transition {
  const stage = assertActionable(app, stageId)
  const at = now.toISOString()
  const note = cleanNote(input.note)

  if (decision === 'REJECT') {
    const reason = cleanReason(input.reason)

    if (!reason) {
      throw new WorkflowError(
        'REASON_REQUIRED',
        'Give the applicant a reason of 10 to 500 characters'
      )
    }

    return {
      patch: {
        status: 'REJECTED',
        rejectionReason: reason,
        decidedAt: at,
        updatedAt: at,
      },
      events: [
        { ...stageEvent(stage, actor, at), type: 'REJECTED', reason, note },
      ],
      effect: 'NONE',
    }
  }

  if (stage.type === 'REVIEW') {
    const pending = (app.documents ?? []).filter(
      (doc) => documentStatus(doc) !== 'ACCEPTED'
    )

    if (pending.length > 0) {
      throw new WorkflowError(
        'DOCUMENTS_NOT_ACCEPTED',
        'Accept every document before passing this stage, or reject the application'
      )
    }
  }

  if (stage.type === 'VERIFICATION') {
    const outcome = verificationOutcome(app)

    if (outcome === 'NOT_RUN') {
      throw new WorkflowError(
        'VERIFICATION_REQUIRED',
        'Run the verification before passing this stage'
      )
    }

    if (outcome === 'BLOCKED') {
      throw new WorkflowError(
        'VERIFICATION_FAILED',
        'The verification failed, so this stage can only be rejected'
      )
    }

    if (outcome === 'NEEDS_DECISION') {
      throw new WorkflowError(
        'KYC_DECISION_REQUIRED',
        'Accept or reject every check that needs a manual review first'
      )
    }
  }

  if (stage.type === 'APPROVAL') {
    // Approval happens only once B2B Organizations has created the
    // organization. See completeApproval.
    return { patch: {}, events: [], effect: 'CREATE_ORGANIZATION' }
  }

  const nextIndex = app.currentStageIndex + 1
  const next = app.stages[nextIndex]

  return {
    patch: {
      currentStageIndex: nextIndex,
      currentStageId: next.id,
      updatedAt: at,
    },
    events: [{ ...stageEvent(stage, actor, at), type: 'STAGE_PASSED', note }],
    effect: 'NONE',
  }
}

/** After B2B Organizations created and approved the organization */
export function completeApproval(
  app: Application,
  organization: { requestId: string; organizationId: string },
  input: { note?: unknown },
  actor: Actor,
  now: Date
): Transition {
  const stage = currentStage(app)
  const at = now.toISOString()

  return {
    patch: {
      status: 'APPROVED',
      organizationRequestId: organization.requestId,
      organizationId: organization.organizationId,
      decidedAt: at,
      updatedAt: at,
    },
    events: [
      {
        ...stageEvent(stage, actor, at),
        type: 'APPROVED',
        note: cleanNote(input.note),
        details: JSON.stringify(organization),
      },
    ],
    effect: 'NONE',
  }
}

/** When creating the organization failed. The application stays at its stage. */
export function failedApproval(
  app: Application,
  message: string,
  actor: Actor,
  now: Date
): Transition {
  const stage = currentStage(app)
  const at = now.toISOString()

  return {
    patch: { updatedAt: at },
    events: [
      {
        ...stageEvent(stage, actor, at),
        type: 'APPROVAL_FAILED',
        details: JSON.stringify({ message: message.slice(0, 500) }),
      },
    ],
    effect: 'NONE',
  }
}
