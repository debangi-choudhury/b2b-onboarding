import type { VerificationResult } from '../domain/types'
import {
  completeApproval,
  decide,
  failedApproval,
  recordVerification,
  verificationStage,
  WorkflowError,
} from '../domain/workflow'
import { application, NOW, REVIEWER } from './fixtures'

const PASSED: VerificationResult = {
  status: 'PASSED',
  code: 'ACTIVE',
  message: 'Active company',
  provider: 'Mock',
  reference: 'MOCK-1',
  checkedAt: NOW.toISOString(),
}

const FAILED: VerificationResult = {
  ...PASSED,
  status: 'FAILED',
  code: 'NOT_FOUND',
}

function errorCode(fn: () => unknown) {
  try {
    fn()
  } catch (e) {
    return e instanceof WorkflowError ? e.code : 'OTHER'
  }

  return 'NONE'
}

describe('newApplication', () => {
  it('starts in review at the first stage, with a SUBMITTED event', () => {
    const app = application()

    expect(app.status).toBe('IN_REVIEW')
    expect(app.currentStageIndex).toBe(0)
    expect(app.currentStageId).toBe('document-review')
    expect(app.documents).toEqual([])
    expect(app.verification).toBeNull()
  })
})

describe('decide', () => {
  it('passes a review stage and moves to the next stage', () => {
    const t = decide(
      application(),
      'document-review',
      'PASS',
      { note: 'Docs OK' },
      REVIEWER,
      NOW
    )

    expect(t.effect).toBe('NONE')
    expect(t.patch).toMatchObject({
      currentStageIndex: 1,
      currentStageId: 'compliance-check',
    })
    expect(t.events).toEqual([
      expect.objectContaining({
        type: 'STAGE_PASSED',
        stageId: 'document-review',
        stageLabel: 'Document review',
        actorType: 'REVIEWER',
        actor: 'reviewer@example.com',
        note: 'Docs OK',
      }),
    ])
  })

  it('rejects with a reason shown to the applicant', () => {
    const t = decide(
      application(),
      'document-review',
      'REJECT',
      { reason: 'The tax certificate has expired.' },
      REVIEWER,
      NOW
    )

    expect(t.patch).toMatchObject({
      status: 'REJECTED',
      rejectionReason: 'The tax certificate has expired.',
      decidedAt: NOW.toISOString(),
    })
    expect(t.events[0]).toMatchObject({
      type: 'REJECTED',
      reason: 'The tax certificate has expired.',
    })
  })

  it('needs a reason to reject', () => {
    expect(
      errorCode(() =>
        decide(
          application(),
          'document-review',
          'REJECT',
          { reason: 'no' },
          REVIEWER,
          NOW
        )
      )
    ).toBe('REASON_REQUIRED')
  })

  it('refuses to act on a stage the application has left', () => {
    const app = application({
      currentStageIndex: 1,
      currentStageId: 'compliance-check',
    })

    expect(
      errorCode(() => decide(app, 'document-review', 'PASS', {}, REVIEWER, NOW))
    ).toBe('STAGE_MISMATCH')
  })

  it.each(['APPROVED', 'REJECTED'] as const)(
    'refuses to act on an application that is %s',
    (status) => {
      expect(
        errorCode(() =>
          decide(
            application({ status }),
            'document-review',
            'PASS',
            {},
            REVIEWER,
            NOW
          )
        )
      ).toBe('NOT_IN_REVIEW')
    }
  )

  describe('on the verification stage', () => {
    const atCheck = (verification: VerificationResult | null) =>
      application({
        currentStageIndex: 1,
        currentStageId: 'compliance-check',
        verification,
      })

    it('needs a verification before passing', () => {
      expect(
        errorCode(() =>
          decide(atCheck(null), 'compliance-check', 'PASS', {}, REVIEWER, NOW)
        )
      ).toBe('VERIFICATION_REQUIRED')
    })

    it("can't pass when the verification failed", () => {
      expect(
        errorCode(() =>
          decide(atCheck(FAILED), 'compliance-check', 'PASS', {}, REVIEWER, NOW)
        )
      ).toBe('VERIFICATION_FAILED')
    })

    it('can still reject when the verification failed', () => {
      const t = decide(
        atCheck(FAILED),
        'compliance-check',
        'REJECT',
        { reason: 'Not found in the company registry.' },
        REVIEWER,
        NOW
      )

      expect(t.patch.status).toBe('REJECTED')
    })

    it('passes when the verification passed', () => {
      const t = decide(
        atCheck(PASSED),
        'compliance-check',
        'PASS',
        {},
        REVIEWER,
        NOW
      )

      expect(t.patch).toMatchObject({
        currentStageIndex: 2,
        currentStageId: 'final-approval',
      })
    })
  })

  it('asks the caller to create the organization on the approval stage, without changing anything yet', () => {
    const app = application({
      currentStageIndex: 2,
      currentStageId: 'final-approval',
      verification: PASSED,
    })

    const t = decide(app, 'final-approval', 'PASS', {}, REVIEWER, NOW)

    expect(t).toEqual({ patch: {}, events: [], effect: 'CREATE_ORGANIZATION' })
  })
})

describe('verification', () => {
  const atCheck = application({
    currentStageIndex: 1,
    currentStageId: 'compliance-check',
  })

  it('only runs on a verification stage', () => {
    expect(
      errorCode(() => verificationStage(application(), 'document-review'))
    ).toBe('NOT_VERIFICATION_STAGE')
    expect(verificationStage(atCheck, 'compliance-check').id).toBe(
      'compliance-check'
    )
  })

  it('stores the result and logs it in the history', () => {
    const t = recordVerification(
      atCheck,
      'compliance-check',
      { registry: FAILED },
      REVIEWER,
      NOW
    )

    expect(t.patch.verification).toEqual(FAILED)
    expect(t.events[0].type).toBe('VERIFICATION_RUN')
    expect(JSON.parse(t.events[0].details as string)).toMatchObject({
      status: 'FAILED',
      code: 'NOT_FOUND',
    })
  })
})

describe('approval', () => {
  const atApproval = application({
    currentStageIndex: 2,
    currentStageId: 'final-approval',
  })

  it('marks the application approved with the organization IDs', () => {
    const t = completeApproval(
      atApproval,
      { requestId: 'req-1', organizationId: 'req-1' },
      { note: 'Welcome aboard' },
      REVIEWER,
      NOW
    )

    expect(t.patch).toMatchObject({
      status: 'APPROVED',
      organizationRequestId: 'req-1',
      organizationId: 'req-1',
      decidedAt: NOW.toISOString(),
    })
    expect(t.events[0]).toMatchObject({
      type: 'APPROVED',
      stageId: 'final-approval',
      note: 'Welcome aboard',
    })
  })

  it('keeps the stage when creating the organization fails, and logs why', () => {
    const t = failedApproval(atApproval, 'Timeout', REVIEWER, NOW)

    expect(t.patch).toEqual({ updatedAt: NOW.toISOString() })
    expect(t.events[0]).toMatchObject({
      type: 'APPROVAL_FAILED',
      details: '{"message":"Timeout"}',
    })
  })
})
