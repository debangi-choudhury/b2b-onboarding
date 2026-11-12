import type {
  Actor,
  Application,
  ApplicationEvent,
  ApplicationInput,
  Stage,
  VerificationResult,
} from './types'
import { cleanNote, cleanReason } from './validation'

export type Decision = 'PASS' | 'REJECT'

export type WorkflowErrorCode =
  | 'NOT_IN_REVIEW'
  | 'STAGE_MISMATCH'
  | 'NOT_VERIFICATION_STAGE'
  | 'VERIFICATION_REQUIRED'
  | 'VERIFICATION_FAILED'
  | 'REASON_REQUIRED'

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

/** Records the outcome of an eligibility check on the verification stage. */
export function recordVerification(
  app: Application,
  stageId: string,
  result: VerificationResult,
  actor: Actor,
  now: Date
): Transition {
  const stage = verificationStage(app, stageId)
  const at = now.toISOString()

  return {
    patch: { verification: result, updatedAt: at },
    events: [
      {
        ...stageEvent(stage, actor, at),
        type: 'VERIFICATION_RUN',
        details: JSON.stringify({
          status: result.status,
          code: result.code,
          message: result.message,
          provider: result.provider,
          reference: result.reference,
        }),
      },
    ],
    effect: 'NONE',
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

  if (stage.type === 'VERIFICATION') {
    if (!app.verification) {
      throw new WorkflowError(
        'VERIFICATION_REQUIRED',
        'Run the verification before passing this stage'
      )
    }

    if (app.verification.status !== 'PASSED') {
      throw new WorkflowError(
        'VERIFICATION_FAILED',
        'The verification failed, so this stage can only be rejected'
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
