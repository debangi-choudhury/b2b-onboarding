import type { ApplicationEvent, DocumentRef } from '../domain/types'
import {
  decide,
  documentStatus,
  fullHistory,
  reviewDocument,
  WorkflowError,
} from '../domain/workflow'
import { application, NOW, REVIEWER } from './fixtures'

const doc = (kind: string): DocumentRef => ({
  kind,
  fileName: `${kind}.pdf`,
  contentType: 'application/pdf',
  size: 617,
  storageId: 'id/name.pdf',
  uploadedAt: NOW.toISOString(),
})

const withDocs = () =>
  application({
    documents: [doc('REGISTRATION_CERTIFICATE'), doc('TAX_CERTIFICATE')],
  })

const later = (seconds: number) => new Date(NOW.getTime() + seconds * 1000)

function errorCode(fn: () => unknown) {
  try {
    fn()
  } catch (e) {
    return e instanceof WorkflowError ? e.code : 'OTHER'
  }

  return 'NONE'
}

describe('reviewDocument', () => {
  it('records a decision on one document and leaves the others alone', () => {
    const t = reviewDocument(
      withDocs(),
      {
        stageId: 'document-review',
        kind: 'TAX_CERTIFICATE',
        decision: 'ACCEPTED',
        note: 'Valid until 2027',
      },
      REVIEWER,
      NOW
    )

    const [reg, tax] = t.patch.documents ?? []

    expect(documentStatus(reg)).toBe('NEEDS_REVIEW')
    expect(documentStatus(tax)).toBe('ACCEPTED')
    expect(tax.reviews).toEqual([
      {
        decision: 'ACCEPTED',
        stageId: 'document-review',
        stageLabel: 'Document review',
        actor: 'reviewer@example.com',
        note: 'Valid until 2027',
        at: NOW.toISOString(),
      },
    ])
    expect(t.events).toEqual([])
  })

  it('keeps every decision, and the latest one counts', () => {
    const first = reviewDocument(
      withDocs(),
      {
        stageId: 'document-review',
        kind: 'TAX_CERTIFICATE',
        decision: 'REJECTED',
      },
      REVIEWER,
      NOW
    )

    const app = { ...withDocs(), ...first.patch }
    const second = reviewDocument(
      app,
      {
        stageId: 'document-review',
        kind: 'TAX_CERTIFICATE',
        decision: 'ACCEPTED',
      },
      REVIEWER,
      later(60)
    )

    const tax = (second.patch.documents ?? [])[1]

    expect(tax.reviews?.map((r) => r.decision)).toEqual([
      'REJECTED',
      'ACCEPTED',
    ])
    expect(documentStatus(tax)).toBe('ACCEPTED')
  })

  it('only works on a review stage, for a document the application has', () => {
    const atCheck = {
      ...withDocs(),
      currentStageIndex: 1,
      currentStageId: 'compliance-check',
    }

    expect(
      errorCode(() =>
        reviewDocument(
          atCheck,
          {
            stageId: 'compliance-check',
            kind: 'TAX_CERTIFICATE',
            decision: 'ACCEPTED',
          },
          REVIEWER,
          NOW
        )
      )
    ).toBe('NOT_REVIEW_STAGE')

    expect(
      errorCode(() =>
        reviewDocument(
          withDocs(),
          {
            stageId: 'document-review',
            kind: 'PASSPORT',
            decision: 'ACCEPTED',
          },
          REVIEWER,
          NOW
        )
      )
    ).toBe('DOCUMENT_NOT_FOUND')

    expect(
      errorCode(() =>
        reviewDocument(
          withDocs(),
          {
            stageId: 'compliance-check',
            kind: 'TAX_CERTIFICATE',
            decision: 'ACCEPTED',
          },
          REVIEWER,
          NOW
        )
      )
    ).toBe('STAGE_MISMATCH')
  })
})

describe('passing a review stage', () => {
  const accept = (app: ReturnType<typeof withDocs>, kind: string) => ({
    ...app,
    ...reviewDocument(
      app,
      { stageId: 'document-review', kind, decision: 'ACCEPTED' },
      REVIEWER,
      NOW
    ).patch,
  })

  it('needs every document accepted', () => {
    const oneAccepted = accept(withDocs(), 'TAX_CERTIFICATE')

    expect(
      errorCode(() =>
        decide(oneAccepted, 'document-review', 'PASS', {}, REVIEWER, NOW)
      )
    ).toBe('DOCUMENTS_NOT_ACCEPTED')

    const allAccepted = accept(oneAccepted, 'REGISTRATION_CERTIFICATE')

    expect(
      decide(allAccepted, 'document-review', 'PASS', {}, REVIEWER, NOW).patch
        .currentStageId
    ).toBe('compliance-check')
  })

  it('can still reject the application with documents pending', () => {
    const t = decide(
      withDocs(),
      'document-review',
      'REJECT',
      { reason: 'The registration certificate is unreadable.' },
      REVIEWER,
      NOW
    )

    expect(t.patch.status).toBe('REJECTED')
  })
})

describe('fullHistory', () => {
  it('merges document reviews into the stored events in time order', () => {
    const reviewed = {
      ...withDocs(),
      ...reviewDocument(
        withDocs(),
        {
          stageId: 'document-review',
          kind: 'TAX_CERTIFICATE',
          decision: 'ACCEPTED',
        },
        REVIEWER,
        later(30)
      ).patch,
    }

    const stored: ApplicationEvent[] = [
      {
        applicationId: 'app-1',
        type: 'SUBMITTED',
        actorType: 'APPLICANT',
        actor: 'applicant',
        createdAt: NOW.toISOString(),
      },
      {
        applicationId: 'app-1',
        type: 'STAGE_PASSED',
        actorType: 'REVIEWER',
        actor: 'reviewer@example.com',
        createdAt: later(90).toISOString(),
      },
    ]

    const history = fullHistory(reviewed, stored)

    expect(history.map((e) => e.type)).toEqual([
      'SUBMITTED',
      'DOCUMENT_REVIEWED',
      'STAGE_PASSED',
    ])
    expect(JSON.parse(history[1].details as string)).toEqual({
      kind: 'TAX_CERTIFICATE',
      decision: 'ACCEPTED',
    })
  })
})
