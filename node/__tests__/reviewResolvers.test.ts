import { GraphQLError } from 'graphql'

import type {
  Application,
  ApplicationEvent,
  DocumentRef,
} from '../domain/types'
import {
  applicationFields,
  reviewMutations,
  reviewQueries,
} from '../resolvers/review'
import { APPLICATION_ENTITY, EVENT_ENTITY } from '../storage/schemas'
import { application, NOW } from './fixtures'

const COMPANY = 'TEST - KYC Demo Pvt Ltd'
const REVIEWER_EMAIL = 'reviewer@example.com'

/** A token with only the claims reviewerFromToken reads; never verified here */
const TOKEN = `x.${Buffer.from(
  JSON.stringify({ sub: REVIEWER_EMAIL })
).toString('base64url')}.y`

/**
 * Workflow refusals reach the Admin as a 400 UserInputError with the
 * workflow's message, and its code in extensions.code, where GraphQL sends it.
 */
function userError(message: string, code: string) {
  return expect.objectContaining({
    name: 'UserInputError',
    status: 400,
    message: expect.stringContaining(message),
    extensions: { code },
  })
}

const doc = (kind: string): DocumentRef => ({
  kind,
  fileName: `${kind}.pdf`,
  contentType: 'application/pdf',
  size: 5,
  storageId: `bd-${kind}/stored.pdf`,
  uploadedAt: NOW.toISOString(),
})

const accepted = (kind: string): DocumentRef => ({
  ...doc(kind),
  reviews: [
    {
      stageId: 'document-review',
      decision: 'ACCEPTED',
      stageLabel: 'Document review',
      actor: REVIEWER_EMAIL,
      at: NOW.toISOString(),
    },
  ],
})

const atStage = (index: number, overrides: Partial<Application> = {}) =>
  application({
    currentStageIndex: index,
    currentStageId: application().stages[index].id,
    ...overrides,
  })

/** An India application at Compliance check. Fake numbers that only satisfy the formats */
function indiaAtCheck(
  bank: { accountNumber: string; holderName: string },
  pan = 'ABCCD1231X'
) {
  return atStage(1, {
    companyName: COMPANY,
    address: { ...application().address, country: 'IND' },
    india: {
      pan,
      importsOrExports: true,
      iec: 'ABCDE12341',
      bank: { ...bank, ifsc: 'TEST0001234' },
    },
  })
}

/**
 * An in-memory stand-in for the Master Data client: applications by ID and
 * history events in order. The schemas always read as missing, so the
 * repository writes them once per test file.
 */
function fakeContext(
  apps: Application[] = [],
  b2b: Partial<
    Record<'createRequest' | 'requestStatus' | 'approveRequest', jest.Mock>
  > = {}
) {
  const store = new Map<string, Record<string, unknown>>()
  const events: ApplicationEvent[] = []

  for (const { id, ...fields } of apps) {
    store.set(id, fields)
  }

  const md = {
    getSchema: jest.fn().mockRejectedValue({ response: { status: 404 } }),
    putSchema: jest.fn().mockResolvedValue(undefined),
    getDocument: jest.fn(async (_entity: string, id: string) =>
      store.has(id) ? { id, ...store.get(id) } : null
    ),
    putDocument: jest.fn(
      async (_entity: string, id: string, fields: Record<string, unknown>) => {
        store.set(id, fields)
      }
    ),
    createDocument: jest.fn(
      async (_entity: string, event: ApplicationEvent) => {
        events.push(event)
      }
    ),
    search: jest.fn(
      async (
        entity: string,
        query: { where?: string; pagination: unknown }
      ) => {
        if (entity === EVENT_ENTITY) {
          const [, id] = (query.where ?? '').split('=')

          return {
            data: events.filter((e) => e.applicationId === id),
            total: 0,
          }
        }

        const all = [...store.entries()].map(([id, f]) => ({ id, ...f }))
        const data = query.where
          ? all.filter(
              (a) =>
                `status=${(a as { status?: string }).status}` === query.where
            )
          : all

        return { data, total: data.length }
      }
    ),
  }

  const b2bOrganizations = {
    createRequest: jest.fn().mockResolvedValue('org-request-1'),
    requestStatus: jest.fn().mockResolvedValue('pending'),
    approveRequest: jest.fn().mockResolvedValue(undefined),
    ...b2b,
  }

  const files = {
    download: jest.fn().mockResolvedValue({ data: Buffer.from('%PDF-') }),
  }

  const error = jest.fn()
  const ctx = {
    clients: {
      accountMasterData: md,
      b2bOrganizations,
      masterDataFiles: files,
      apps: { getAppSettings: jest.fn().mockResolvedValue({}) },
    },
    vtex: {
      adminUserAuthToken: TOKEN,
      logger: { warn: jest.fn(), error },
    },
  }

  return {
    ctx: ctx as never,
    stored: (id: string) => ({ id, ...store.get(id) } as Application),
    events,
    md,
    b2bOrganizations,
    files,
    error,
  }
}

describe('review queries', () => {
  it('lists applications, filtered by status, with default paging', async () => {
    const { ctx, md } = fakeContext([
      application({ id: 'a' }),
      application({ id: 'b', status: 'REJECTED' }),
    ])

    const all = await reviewQueries.onboardingApplications(null, {}, ctx)
    const rejected = await reviewQueries.onboardingApplications(
      null,
      { status: 'REJECTED' },
      ctx
    )

    expect(all.items.map((a) => a.id)).toEqual(['a', 'b'])
    expect(all.pagination).toEqual({ page: 1, pageSize: 20, total: 2 })
    expect(rejected.items.map((a) => a.id)).toEqual(['b'])
    expect(md.search).toHaveBeenCalledWith(
      APPLICATION_ENTITY,
      expect.objectContaining({ where: 'status=REJECTED' })
    )
  })

  it('refuses an unknown status before reading anything', async () => {
    const { ctx, md } = fakeContext()

    await expect(
      reviewQueries.onboardingApplications(
        null,
        { status: 'DELETED' as never },
        ctx
      )
    ).rejects.toThrow('Invalid status')
    expect(md.search).not.toHaveBeenCalled()
  })

  it('loads one application, and refuses a malformed or unknown ID', async () => {
    const { ctx, md } = fakeContext([application()])

    await expect(
      reviewQueries.onboardingApplication(null, { id: 'app-1' }, ctx)
    ).resolves.toMatchObject({ id: 'app-1', reference: 'APP-ABCDEFGH' })
    await expect(
      reviewQueries.onboardingApplication(null, { id: 'a/../b' }, ctx)
    ).rejects.toThrow('Invalid application ID')
    await expect(
      reviewQueries.onboardingApplication(null, { id: 'missing' }, ctx)
    ).rejects.toThrow('Application not found')
    expect(md.getDocument).not.toHaveBeenCalledWith(
      expect.anything(),
      'a/../b',
      expect.anything()
    )
  })

  it('reports the default stages, with no problems for empty settings', async () => {
    const { ctx } = fakeContext()

    const result = await reviewQueries.onboardingStages(null, null, ctx)

    expect(result.stages.map((s) => s.id)).toEqual([
      'document-review',
      'compliance-check',
      'final-approval',
    ])
    expect(result.problems).toEqual([])
  })

  it('adds a bad KYC provider setting to the stage problems', async () => {
    const { ctx } = fakeContext()

    ;(
      ctx as { clients: { apps: { getAppSettings: jest.Mock } } }
    ).clients.apps.getAppSettings.mockResolvedValue({
      kycProvider: 'no-such-provider',
    })

    const result = await reviewQueries.onboardingStages(null, null, ctx)

    expect(result.problems).toEqual([
      expect.stringContaining('no-such-provider'),
    ])
  })

  it('returns a document as base64, using our own record of its type', async () => {
    const { ctx, files } = fakeContext([
      application({ documents: [doc('TAX_CERTIFICATE')] }),
    ])

    const result = await reviewQueries.onboardingDocument(
      null,
      { id: 'app-1', kind: 'TAX_CERTIFICATE' },
      ctx
    )

    expect(result).toEqual({
      kind: 'TAX_CERTIFICATE',
      fileName: 'TAX_CERTIFICATE.pdf',
      contentType: 'application/pdf',
      size: 5,
      dataBase64: Buffer.from('%PDF-').toString('base64'),
    })
    expect(files.download).toHaveBeenCalledWith(
      'BD',
      'bd-TAX_CERTIFICATE',
      'file',
      'stored.pdf'
    )
    expect(JSON.stringify(result)).not.toContain('bd-TAX_CERTIFICATE')
  })

  it('refuses a document the application does not have', async () => {
    const { ctx, files } = fakeContext([application()])

    await expect(
      reviewQueries.onboardingDocument(
        null,
        { id: 'app-1', kind: 'TAX_CERTIFICATE' },
        ctx
      )
    ).rejects.toThrow('Document not found')
    expect(files.download).not.toHaveBeenCalled()
  })
})

describe('refusals in the GraphQL response', () => {
  it('carry the workflow code in extensions.code, where the Admin can read it', async () => {
    const { ctx } = fakeContext([application()])
    const thrown = await reviewMutations
      .decideStage(
        null,
        { id: 'app-1', stageId: 'final-approval', decision: 'PASS' },
        ctx
      )
      .catch((e: Error) => e)

    // How GraphQL wraps a resolver's error before @vtex/api formats it
    const wrapped = new GraphQLError(
      (thrown as Error).message,
      undefined,
      undefined,
      undefined,
      ['decideStage'],
      thrown as Error
    )

    expect(wrapped.extensions).toEqual({ code: 'STAGE_MISMATCH' })
  })
})

describe('document review and passing a stage', () => {
  it('accepts both documents, then passes Document review, saving and recording each step as the reviewer', async () => {
    const { ctx, stored, events } = fakeContext([
      application({
        documents: [doc('REGISTRATION_CERTIFICATE'), doc('TAX_CERTIFICATE')],
      }),
    ])

    for (const kind of ['REGISTRATION_CERTIFICATE', 'TAX_CERTIFICATE']) {
      // eslint-disable-next-line no-await-in-loop
      await reviewMutations.reviewDocument(
        null,
        { id: 'app-1', stageId: 'document-review', kind, decision: 'ACCEPT' },
        ctx
      )
    }

    const passed = await reviewMutations.decideStage(
      null,
      { id: 'app-1', stageId: 'document-review', decision: 'PASS' },
      ctx
    )

    expect(passed.currentStageId).toBe('compliance-check')
    expect(stored('app-1').currentStageId).toBe('compliance-check')
    // Document decisions are kept on the documents, not as history events
    expect(
      stored('app-1').documents.map((d) => d.reviews?.[0]?.decision)
    ).toEqual(['ACCEPTED', 'ACCEPTED'])
    expect(events.map((e) => e.type)).toEqual(['STAGE_PASSED'])
    expect(events.every((e) => e.applicationId === 'app-1')).toBe(true)
    expect(events.every((e) => e.actor === REVIEWER_EMAIL)).toBe(true)
  })

  it('maps REJECT to a rejected document', async () => {
    const { ctx, stored } = fakeContext([
      application({ documents: [doc('TAX_CERTIFICATE')] }),
    ])

    await reviewMutations.reviewDocument(
      null,
      {
        id: 'app-1',
        stageId: 'document-review',
        kind: 'TAX_CERTIFICATE',
        decision: 'REJECT',
        note: 'Expired certificate',
      },
      ctx
    )

    const [document] = stored('app-1').documents
    const review = document.reviews?.[document.reviews.length - 1]

    expect(review).toMatchObject({
      decision: 'REJECTED',
      note: 'Expired certificate',
    })
  })

  it('turns a workflow refusal into a user error, and saves nothing', async () => {
    const { ctx, md, events } = fakeContext([
      application({ documents: [doc('TAX_CERTIFICATE')] }),
    ])

    await expect(
      reviewMutations.decideStage(
        null,
        { id: 'app-1', stageId: 'document-review', decision: 'PASS' },
        ctx
      )
    ).rejects.toThrow(
      userError('Accept every document', 'DOCUMENTS_NOT_ACCEPTED')
    )
    await expect(
      reviewMutations.reviewDocument(
        null,
        {
          id: 'app-1',
          stageId: 'compliance-check',
          kind: 'TAX_CERTIFICATE',
          decision: 'ACCEPT',
        },
        ctx
      )
    ).rejects.toThrow(userError('The application is now at', 'STAGE_MISMATCH'))
    expect(md.putDocument).not.toHaveBeenCalled()
    expect(events).toEqual([])
  })

  it('rejects an application with a reason and records it', async () => {
    const { ctx, stored, events } = fakeContext([application()])

    const result = await reviewMutations.decideStage(
      null,
      {
        id: 'app-1',
        stageId: 'document-review',
        decision: 'REJECT',
        reason: 'Demo application, not a real business',
        note: 'Internal only',
      },
      ctx
    )

    expect(result.status).toBe('REJECTED')
    expect(stored('app-1').rejectionReason).toBe(
      'Demo application, not a real business'
    )
    expect(events).toEqual([
      expect.objectContaining({ type: 'REJECTED', note: 'Internal only' }),
    ])
  })

  it('refuses a rejection without a proper reason', async () => {
    const { ctx } = fakeContext([application()])

    await expect(
      reviewMutations.decideStage(
        null,
        {
          id: 'app-1',
          stageId: 'document-review',
          decision: 'REJECT',
          reason: 'no',
        },
        ctx
      )
    ).rejects.toThrow(
      userError('Give the applicant a reason', 'REASON_REQUIRED')
    )
  })

  it('refuses to act on an application that is already decided', async () => {
    const { ctx } = fakeContext([application({ status: 'APPROVED' })])

    await expect(
      reviewMutations.decideStage(
        null,
        { id: 'app-1', stageId: 'document-review', decision: 'PASS' },
        ctx
      )
    ).rejects.toThrow(userError('already approved', 'NOT_IN_REVIEW'))
  })
})

describe('verification and KYC decisions', () => {
  it('runs the registry and India checks, then lets the stage pass when all pass', async () => {
    const { ctx, stored, events } = fakeContext([
      indiaAtCheck({ accountNumber: '123456789011', holderName: COMPANY }),
    ])

    const result = await reviewMutations.runVerification(
      null,
      { id: 'app-1', stageId: 'compliance-check' },
      ctx
    )

    expect(result.verification?.status).toBe('PASSED')
    expect(result.kycChecks?.map((c) => [c.kind, c.effectiveStatus])).toEqual(
      expect.arrayContaining([
        ['PAN', 'VERIFIED'],
        ['IEC', 'VERIFIED'],
        ['BANK_ACCOUNT', 'VERIFIED'],
      ])
    )
    expect(events.map((e) => e.type)).toEqual(['VERIFICATION_RUN'])

    const passed = await reviewMutations.decideStage(
      null,
      { id: 'app-1', stageId: 'compliance-check', decision: 'PASS' },
      ctx
    )

    expect(passed.currentStageId).toBe('final-approval')
    expect(stored('app-1').currentStageId).toBe('final-approval')
  })

  it('refuses to run a verification on a review stage, before calling any provider', async () => {
    const { ctx, md } = fakeContext([application()])

    await expect(
      reviewMutations.runVerification(
        null,
        { id: 'app-1', stageId: 'document-review' },
        ctx
      )
    ).rejects.toThrow(
      userError("doesn't run a verification", 'NOT_VERIFICATION_STAGE')
    )
    expect(md.putDocument).not.toHaveBeenCalled()
  })

  it('blocks the stage when the bank account holder does not match the company', async () => {
    const { ctx } = fakeContext([
      indiaAtCheck({
        accountNumber: '123456789012',
        holderName: 'Someone Else Traders',
      }),
    ])

    const result = await reviewMutations.runVerification(
      null,
      { id: 'app-1', stageId: 'compliance-check' },
      ctx
    )

    expect(
      result.kycChecks?.find((c) => c.kind === 'BANK_ACCOUNT')?.effectiveStatus
    ).toBe('FAILED')
    await expect(
      reviewMutations.decideStage(
        null,
        { id: 'app-1', stageId: 'compliance-check', decision: 'PASS' },
        ctx
      )
    ).rejects.toThrow(userError('can only be rejected', 'VERIFICATION_FAILED'))
  })

  it('needs a decision on a check that needs review, then passes once it is accepted', async () => {
    const { ctx, stored } = fakeContext([
      indiaAtCheck({ accountNumber: '123456789017', holderName: COMPANY }),
    ])

    await reviewMutations.runVerification(
      null,
      { id: 'app-1', stageId: 'compliance-check' },
      ctx
    )
    await expect(
      reviewMutations.decideStage(
        null,
        { id: 'app-1', stageId: 'compliance-check', decision: 'PASS' },
        ctx
      )
    ).rejects.toThrow(
      userError('needs a manual review first', 'KYC_DECISION_REQUIRED')
    )

    await reviewMutations.decideKycCheck(
      null,
      {
        id: 'app-1',
        stageId: 'compliance-check',
        kind: 'BANK_ACCOUNT',
        decision: 'ACCEPT',
        note: 'Holder name matches the certificate',
      },
      ctx
    )

    const view = applicationFields.kycChecks(stored('app-1'))

    expect(
      view?.find((c) => c.kind === 'BANK_ACCOUNT')?.decision
    ).toMatchObject({
      decision: 'ACCEPTED',
      actor: REVIEWER_EMAIL,
    })
    await expect(
      reviewMutations.decideStage(
        null,
        { id: 'app-1', stageId: 'compliance-check', decision: 'PASS' },
        ctx
      )
    ).resolves.toMatchObject({ currentStageId: 'final-approval' })
  })

  it('refuses an unknown check kind, and a decision note that is too short', async () => {
    const { ctx } = fakeContext([
      indiaAtCheck({ accountNumber: '123456789017', holderName: COMPANY }),
    ])

    await expect(
      reviewMutations.decideKycCheck(
        null,
        {
          id: 'app-1',
          stageId: 'compliance-check',
          kind: 'GST' as never,
          decision: 'ACCEPT',
          note: 'A long enough note',
        },
        ctx
      )
    ).rejects.toThrow('Invalid check')

    await reviewMutations.runVerification(
      null,
      { id: 'app-1', stageId: 'compliance-check' },
      ctx
    )
    await expect(
      reviewMutations.decideKycCheck(
        null,
        {
          id: 'app-1',
          stageId: 'compliance-check',
          kind: 'BANK_ACCOUNT',
          decision: 'ACCEPT',
          note: 'ok',
        },
        ctx
      )
    ).rejects.toThrow(
      userError('Explain the decision in a note', 'NOTE_REQUIRED')
    )
  })
})

describe('revealing an identifier', () => {
  it('returns the full PAN only after recording who opened it', async () => {
    const { ctx, stored } = fakeContext([
      indiaAtCheck({ accountNumber: '123456789011', holderName: COMPANY }),
    ])

    const value = await reviewMutations.revealIdentifier(
      null,
      { id: 'app-1', field: 'PAN' },
      ctx
    )

    expect(value).toBe('ABCCD1231X')
    expect(JSON.stringify(stored('app-1'))).toContain(REVIEWER_EMAIL)
  })

  it('returns nothing when recording fails', async () => {
    const { ctx, md } = fakeContext([
      indiaAtCheck({ accountNumber: '123456789011', holderName: COMPANY }),
    ])

    md.putDocument.mockRejectedValueOnce(new Error('Master Data unavailable'))

    await expect(
      reviewMutations.revealIdentifier(null, { id: 'app-1', field: 'PAN' }, ctx)
    ).rejects.toThrow('Master Data unavailable')
  })

  it('refuses a field that is not revealable', async () => {
    const { ctx, md } = fakeContext([application()])

    await expect(
      reviewMutations.revealIdentifier(
        null,
        { id: 'app-1', field: 'IEC' as never },
        ctx
      )
    ).rejects.toThrow('Invalid identifier')
    expect(md.getDocument).not.toHaveBeenCalled()
  })

  it('never exposes the full numbers through the application fields', () => {
    const app = indiaAtCheck({
      accountNumber: '123456789011',
      holderName: COMPANY,
    })

    const india = JSON.stringify(applicationFields.india(app))

    expect(india).not.toContain('ABCCD1231X')
    expect(india).not.toContain('123456789011')
  })
})

describe('final approval', () => {
  const atApproval = () =>
    atStage(2, {
      documents: [
        accepted('REGISTRATION_CERTIFICATE'),
        accepted('TAX_CERTIFICATE'),
      ],
    })

  it('creates and approves the organization request, then marks the application approved', async () => {
    const { ctx, stored, events, b2bOrganizations } = fakeContext([
      atApproval(),
    ])

    const result = await reviewMutations.decideStage(
      null,
      {
        id: 'app-1',
        stageId: 'final-approval',
        decision: 'PASS',
        note: 'Looks good',
      },
      ctx
    )

    expect(b2bOrganizations.createRequest).toHaveBeenCalledTimes(1)
    expect(b2bOrganizations.approveRequest).toHaveBeenCalledWith(
      'org-request-1',
      'Approved in B2B onboarding, application APP-ABCDEFGH'
    )
    expect(result).toMatchObject({
      status: 'APPROVED',
      organizationRequestId: 'org-request-1',
      organizationId: 'org-request-1',
    })
    expect(stored('app-1').status).toBe('APPROVED')
    expect(events).toEqual([
      expect.objectContaining({ type: 'APPROVED', note: 'Looks good' }),
    ])
  })

  it('reuses an existing request on a retry and skips approving it again', async () => {
    const { ctx, b2bOrganizations } = fakeContext(
      [atApproval()].map((a) => ({
        ...a,
        organizationRequestId: 'org-request-0',
      })),
      { requestStatus: jest.fn().mockResolvedValue('approved') }
    )

    const result = await reviewMutations.decideStage(
      null,
      { id: 'app-1', stageId: 'final-approval', decision: 'PASS' },
      ctx
    )

    expect(b2bOrganizations.createRequest).not.toHaveBeenCalled()
    expect(b2bOrganizations.approveRequest).not.toHaveBeenCalled()
    expect(result.organizationId).toBe('org-request-0')
  })

  it('keeps the application at its stage and records the failure when B2B Organizations fails', async () => {
    const { ctx, stored, events, error } = fakeContext([atApproval()], {
      approveRequest: jest
        .fn()
        .mockRejectedValue(new Error('Request failed with status code 500')),
    })

    await expect(
      reviewMutations.decideStage(
        null,
        { id: 'app-1', stageId: 'final-approval', decision: 'PASS' },
        ctx
      )
    ).rejects.toThrow(
      userError("couldn't create the organization", 'APPROVAL_FAILED')
    )

    const app = stored('app-1')

    expect(app.status).toBe('IN_REVIEW')
    expect(app.currentStageId).toBe('final-approval')
    // Saved, so a retry reuses the request instead of creating a second organization
    expect(app.organizationRequestId).toBe('org-request-1')
    expect(events).toEqual([
      expect.objectContaining({ type: 'APPROVAL_FAILED' }),
    ])
    expect(error).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Organization approval failed',
        application: 'app-1',
      })
    )
  })
})

describe('application fields', () => {
  it('shows the current stage only while the application is in review', () => {
    expect(applicationFields.currentStage(application())?.id).toBe(
      'document-review'
    )
    expect(
      applicationFields.currentStage(application({ status: 'REJECTED' }))
    ).toBeNull()
  })

  it('merges the stored events into the history', async () => {
    const { ctx } = fakeContext([application()])

    await reviewMutations.decideStage(
      null,
      {
        id: 'app-1',
        stageId: 'document-review',
        decision: 'REJECT',
        reason: 'Demo application, not a real business',
      },
      ctx
    )

    const history = await applicationFields.events(application(), null, ctx)

    expect(history.map((e) => e.type)).toContain('REJECTED')
  })

  it('has no KYC checks for an application without them', () => {
    expect(applicationFields.kycChecks(application())).toBeNull()
  })
})
