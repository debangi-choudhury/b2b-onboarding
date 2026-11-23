import { MasterDataWriteError } from '../clients/accountMasterData'
import { toKycCheck, verificationOutcome } from '../domain/kycOutcome'
import type {
  Application,
  IndiaIdentifiers,
  KycResult,
  VerificationResult,
} from '../domain/types'
import {
  decide,
  decideKycCheck,
  fullHistory,
  maskedIndia,
  recordVerification,
  revealIdentifier,
  WorkflowError,
} from '../domain/workflow'
import { schemaIsCurrent } from '../storage/repository'
import { APPLICATION_SCHEMA } from '../storage/schemas'
import { MockKycProvider } from '../verification/mockKyc'
import { runKycChecks } from '../verification/kyc'
import { application, NOW, REVIEWER } from './fixtures'

const COMPANY = 'TEST - KYC Demo Pvt Ltd'

// Fake identifiers that only satisfy the formats
const INDIA: IndiaIdentifiers = {
  pan: 'ABCCD1231X',
  importsOrExports: true,
  iec: 'ABCDE12341',
  bank: {
    accountNumber: '123456789011',
    ifsc: 'TEST0001234',
    holderName: COMPANY,
  },
}

const PASSED: VerificationResult = {
  status: 'PASSED',
  code: 'ACTIVE',
  message: 'Active company',
  provider: 'Mock',
  reference: 'MOCK-1',
  checkedAt: NOW.toISOString(),
}

const LATER = new Date(NOW.getTime() + 60_000)

function errorCode(fn: () => unknown) {
  try {
    fn()
  } catch (e) {
    return e instanceof WorkflowError ? e.code : 'OTHER'
  }

  return 'NONE'
}

/** An India application at the verification stage */
function atCheck(overrides: Partial<Application> = {}) {
  return application({
    companyName: COMPANY,
    address: { ...application().address, country: 'IND' },
    india: INDIA,
    currentStageIndex: 1,
    currentStageId: 'compliance-check',
    ...overrides,
  })
}

/** Runs the mock provider and records the results, as runVerification does */
async function verified(
  india: Partial<IndiaIdentifiers> = {},
  registry: VerificationResult = PASSED
) {
  const app = atCheck({ india: { ...INDIA, ...india } })
  const kyc = await runKycChecks(new MockKycProvider(), app, NOW)
  const t = recordVerification(
    app,
    'compliance-check',
    { registry, kyc },
    REVIEWER,
    NOW
  )

  return { app: { ...app, ...t.patch } as Application, transition: t }
}

const result = (overrides: Partial<KycResult> = {}): KycResult => ({
  kind: 'PAN',
  status: 'VERIFIED',
  code: 'VALID',
  message: 'PAN XXXXX1231X is active',
  provider: 'Mock',
  reference: 'MOCK-KYC-1',
  registeredName: 'TEST - KYC DEMO PVT LTD',
  checkedAt: NOW.toISOString(),
  ...overrides,
})

describe('toKycCheck', () => {
  it('keeps a verified result verified when the names match', () => {
    const check = toKycCheck(result(), COMPANY)

    expect(check.effectiveStatus).toBe('VERIFIED')
    expect(check.nameMatch).toMatchObject({
      band: 'STRONG',
      comparedWith: COMPANY,
    })
  })

  it('makes a verified result need review on a partial name match', () => {
    const check = toKycCheck(
      result({ registeredName: 'TEST - KYC DEMO PVT ENTERPRISES' }),
      COMPANY
    )

    expect(check.status).toBe('VERIFIED')
    expect(check.effectiveStatus).toBe('MANUAL_REVIEW')
  })

  it.each([
    'TEST - KYC Demo Pvt Ltd',
    'TEST - KYC Partial Match Pvt Ltd',
    'TEST - Shree Ram Steel Traders Pvt Ltd',
  ])(
    'needs review for the mock bank account ending in 7, for "%s"',
    async (companyName) => {
      const [bank] = await runKycChecks(
        new MockKycProvider(),
        {
          companyName,
          india: {
            ...INDIA,
            iec: undefined,
            bank: {
              ...INDIA.bank,
              accountNumber: '123456789017',
              holderName: companyName,
            },
          },
        },
        NOW
      ).then((results) => results.filter((r) => r.kind === 'BANK_ACCOUNT'))

      expect(toKycCheck(bank, companyName).effectiveStatus).toBe(
        'MANUAL_REVIEW'
      )
    }
  )

  it('fails a verified result when the name is someone else', () => {
    const check = toKycCheck(
      result({ registeredName: 'Other Traders' }),
      COMPANY
    )

    expect(check.effectiveStatus).toBe('FAILED')
  })

  it("never improves the provider's status", () => {
    const check = toKycCheck(result({ status: 'MANUAL_REVIEW' }), COMPANY)

    expect(check.effectiveStatus).toBe('MANUAL_REVIEW')
  })

  it('has no name match without a registered name', () => {
    const check = toKycCheck(
      result({ status: 'FAILED', registeredName: undefined }),
      COMPANY
    )

    expect(check).toMatchObject({ nameMatch: null, effectiveStatus: 'FAILED' })
  })
})

describe('recordVerification with KYC checks', () => {
  it('stores the registry result and every check with its name match', async () => {
    const { app } = await verified()

    expect(app.verification).toEqual(PASSED)
    expect(app.kycChecks?.map((c) => [c.kind, c.effectiveStatus])).toEqual([
      ['PAN', 'VERIFIED'],
      ['IEC', 'VERIFIED'],
      ['BANK_ACCOUNT', 'VERIFIED'],
    ])
  })

  it('logs a compact summary without identifiers in the history', async () => {
    const { transition } = await verified()
    const details = transition.events[0].details as string

    expect(transition.events[0].type).toBe('VERIFICATION_RUN')
    expect(JSON.parse(details).kyc).toEqual([
      expect.objectContaining({
        kind: 'PAN',
        status: 'VERIFIED',
        match: 'STRONG',
      }),
      expect.objectContaining({ kind: 'IEC', status: 'VERIFIED' }),
      expect.objectContaining({ kind: 'BANK_ACCOUNT', status: 'VERIFIED' }),
    ])
    expect(details).not.toContain(INDIA.pan)
    expect(details).not.toContain(INDIA.bank.accountNumber)
    expect(details.length).toBeLessThan(2000)
  })

  it('stores no checks for applications from other countries', () => {
    const app = application({
      currentStageIndex: 1,
      currentStageId: 'compliance-check',
    })

    const t = recordVerification(
      app,
      'compliance-check',
      { registry: PASSED, kyc: [result()] },
      REVIEWER,
      NOW
    )

    expect(t.patch.kycChecks).toBeNull()
    expect(JSON.parse(t.events[0].details as string).kyc).toBeUndefined()
  })
})

describe('verificationOutcome', () => {
  it('is NOT_RUN before any verification', () => {
    expect(verificationOutcome(atCheck())).toBe('NOT_RUN')
  })

  it('is NOT_RUN for an India application verified without KYC checks', () => {
    expect(verificationOutcome(atCheck({ verification: PASSED }))).toBe(
      'NOT_RUN'
    )
  })

  it('is READY when every check is verified', async () => {
    expect(verificationOutcome((await verified()).app)).toBe('READY')
  })

  it('is BLOCKED when the registry check failed, whatever KYC says', async () => {
    const { app } = await verified({}, { ...PASSED, status: 'FAILED' })

    expect(verificationOutcome(app)).toBe('BLOCKED')
  })

  it('is BLOCKED when a KYC check failed', async () => {
    const { app } = await verified({ iec: 'ABCDE12340' })

    expect(verificationOutcome(app)).toBe('BLOCKED')
  })

  it('is NEEDS_DECISION when a check needs a manual review', async () => {
    const { app } = await verified({
      bank: { ...INDIA.bank, accountNumber: '123456789017' },
    })

    expect(verificationOutcome(app)).toBe('NEEDS_DECISION')
  })

  it('decides applications from other countries by the registry alone', () => {
    expect(verificationOutcome(application({ verification: PASSED }))).toBe(
      'READY'
    )
    expect(
      verificationOutcome(
        application({ verification: { ...PASSED, status: 'FAILED' } })
      )
    ).toBe('BLOCKED')
  })
})

describe('manual decisions', () => {
  // Account ending in 7: the penny drop returns a partly different name
  const partial = () =>
    verified({ bank: { ...INDIA.bank, accountNumber: '123456789017' } })

  const decideBank = (
    app: Application,
    decision: 'ACCEPTED' | 'REJECTED',
    note: unknown = 'Bank letter confirms the account belongs to the company.',
    at = LATER
  ) =>
    decideKycCheck(
      app,
      { stageId: 'compliance-check', kind: 'BANK_ACCOUNT', decision, note },
      REVIEWER,
      at
    )

  it("can't pass the stage until the reviewer decides", async () => {
    const { app } = await partial()

    expect(
      errorCode(() =>
        decide(app, 'compliance-check', 'PASS', {}, REVIEWER, LATER)
      )
    ).toBe('KYC_DECISION_REQUIRED')
  })

  it('passes the stage once the reviewer accepts, with who and when', async () => {
    const { app } = await partial()
    const accepted = {
      ...app,
      ...decideBank(app, 'ACCEPTED').patch,
    } as Application

    expect(accepted.kycDecisions).toEqual([
      expect.objectContaining({
        kind: 'BANK_ACCOUNT',
        decision: 'ACCEPTED',
        actor: REVIEWER.id,
        at: LATER.toISOString(),
        stageId: 'compliance-check',
      }),
    ])
    expect(verificationOutcome(accepted)).toBe('READY')
    expect(
      decide(accepted, 'compliance-check', 'PASS', {}, REVIEWER, LATER).patch
    ).toMatchObject({ currentStageId: 'final-approval' })
  })

  it('blocks the stage when the reviewer rejects the check', async () => {
    const { app } = await partial()
    const rejected = {
      ...app,
      ...decideBank(app, 'REJECTED', 'Account is held by a different business.')
        .patch,
    } as Application

    expect(verificationOutcome(rejected)).toBe('BLOCKED')
  })

  it('lets the reviewer change their mind, keeping every decision', async () => {
    const { app } = await partial()
    const rejected = {
      ...app,
      ...decideBank(app, 'REJECTED').patch,
    } as Application

    const accepted = {
      ...rejected,
      ...decideBank(rejected, 'ACCEPTED').patch,
    } as Application

    expect(accepted.kycDecisions).toHaveLength(2)
    expect(verificationOutcome(accepted)).toBe('READY')
  })

  it('requires a note of at least 10 characters', async () => {
    const { app } = await partial()

    expect(errorCode(() => decideBank(app, 'ACCEPTED', 'ok'))).toBe(
      'NOTE_REQUIRED'
    )
    expect(errorCode(() => decideBank(app, 'ACCEPTED', null))).toBe(
      'NOTE_REQUIRED'
    )
  })

  it('only decides checks that need a manual review', async () => {
    const { app } = await verified()

    expect(errorCode(() => decideBank(app, 'ACCEPTED'))).toBe(
      'KYC_CHECK_NOT_UNDECIDED'
    )
  })

  it('needs the check to exist and the verification stage to be current', async () => {
    const { app } = await partial()

    expect(
      errorCode(() =>
        decideKycCheck(
          app,
          {
            stageId: 'compliance-check',
            kind: 'UDYAM',
            decision: 'ACCEPTED',
            note: 'A long enough note.',
          },
          REVIEWER,
          LATER
        )
      )
    ).toBe('KYC_CHECK_NOT_FOUND')
    expect(
      errorCode(() =>
        decideKycCheck(
          { ...app, currentStageIndex: 2, currentStageId: 'final-approval' },
          {
            stageId: 'final-approval',
            kind: 'BANK_ACCOUNT',
            decision: 'ACCEPTED',
            note: 'A long enough note.',
          },
          REVIEWER,
          LATER
        )
      )
    ).toBe('NOT_VERIFICATION_STAGE')
  })

  it('no longer counts a decision after verification runs again', async () => {
    const { app } = await partial()
    const accepted = {
      ...app,
      ...decideBank(app, 'ACCEPTED').patch,
    } as Application

    const kyc = await runKycChecks(new MockKycProvider(), accepted, LATER)
    const rerun = {
      ...accepted,
      ...recordVerification(
        accepted,
        'compliance-check',
        { registry: PASSED, kyc },
        REVIEWER,
        LATER
      ).patch,
    } as Application

    // The new check has a new reference, so the old decision doesn't apply
    expect(verificationOutcome(rerun)).toBe('NEEDS_DECISION')
    // ...but it stays in the history
    expect(rerun.kycDecisions).toHaveLength(1)
  })
})

describe('masking and reveals', () => {
  it('shows only masked identifiers to reviewers', () => {
    const shown = maskedIndia(atCheck())

    expect(shown).toEqual({
      maskedPan: 'XXXXX1231X',
      importsOrExports: true,
      iec: 'ABCDE12341',
      udyam: null,
      maskedAccountNumber: 'XXXXXXXX9011',
      ifsc: 'TEST0001234',
      accountHolderName: COMPANY,
    })
    expect(JSON.stringify(shown)).not.toContain(INDIA.pan)
    expect(JSON.stringify(shown)).not.toContain(INDIA.bank.accountNumber)
  })

  it('shows nothing for applications from other countries', () => {
    expect(maskedIndia(application())).toBeNull()
  })

  it('returns the full value and records who opened it', () => {
    const app = atCheck()
    const pan = revealIdentifier(app, 'PAN', REVIEWER, LATER)
    const account = revealIdentifier(
      { ...app, ...pan.transition.patch } as Application,
      'BANK_ACCOUNT',
      REVIEWER,
      LATER
    )

    expect(pan.value).toBe(INDIA.pan)
    expect(account.value).toBe(INDIA.bank.accountNumber)
    expect(account.transition.patch.identifierReveals).toEqual([
      { field: 'PAN', actor: REVIEWER.id, at: LATER.toISOString() },
      { field: 'BANK_ACCOUNT', actor: REVIEWER.id, at: LATER.toISOString() },
    ])
  })

  it('works after the application is closed, too', () => {
    expect(
      revealIdentifier(atCheck({ status: 'APPROVED' }), 'PAN', REVIEWER, LATER)
        .value
    ).toBe(INDIA.pan)
  })

  it('refuses when the application has no India identifiers', () => {
    expect(
      errorCode(() => revealIdentifier(application(), 'PAN', REVIEWER, LATER))
    ).toBe('IDENTIFIER_NOT_FOUND')
  })
})

describe('fullHistory with KYC entries', () => {
  it('merges decisions and reveals into the history, oldest first', async () => {
    const { app } = await verified({
      bank: { ...INDIA.bank, accountNumber: '123456789017' },
    })

    const decided = {
      ...app,
      ...decideKycCheck(
        app,
        {
          stageId: 'compliance-check',
          kind: 'BANK_ACCOUNT',
          decision: 'ACCEPTED',
          note: 'Bank letter confirms the account.',
        },
        REVIEWER,
        new Date(NOW.getTime() + 2000)
      ).patch,
    } as Application

    const revealed = {
      ...decided,
      ...revealIdentifier(
        decided,
        'PAN',
        REVIEWER,
        new Date(NOW.getTime() + 1000)
      ).transition.patch,
    } as Application

    const history = fullHistory(revealed, [
      {
        applicationId: app.id,
        type: 'SUBMITTED',
        actorType: 'APPLICANT',
        actor: 'applicant',
        createdAt: NOW.toISOString(),
      },
    ])

    expect(history.map((e) => e.type)).toEqual([
      'SUBMITTED',
      'IDENTIFIER_REVEALED',
      'KYC_DECIDED',
    ])
    expect(history[2]).toMatchObject({
      actor: REVIEWER.id,
      note: 'Bank letter confirms the account.',
      stageLabel: 'Compliance check',
    })
    expect(JSON.parse(history[2].details as string)).toMatchObject({
      kind: 'BANK_ACCOUNT',
      decision: 'ACCEPTED',
    })
    expect(JSON.parse(history[1].details as string)).toEqual({ field: 'PAN' })
  })
})

describe('Master Data', () => {
  const wanted = {
    title: APPLICATION_SCHEMA.title,
    properties: APPLICATION_SCHEMA.properties,
  }

  it('keeps the title 0.2.2 uses, so 0.2.2 never rewrites the schema', () => {
    expect(APPLICATION_SCHEMA.title).toBe('B2B onboarding application')
  })

  it('never indexes India identifiers', () => {
    const indexed = APPLICATION_SCHEMA['v-indexed'] as string[]

    for (const field of [
      'india',
      'kycChecks',
      'kycDecisions',
      'identifierReveals',
    ]) {
      expect(indexed).not.toContain(field)
      expect(Object.keys(APPLICATION_SCHEMA.properties)).toContain(field)
    }
  })

  it('writes the schema when a property is missing, and not otherwise', () => {
    const { india, ...withoutIndia } = APPLICATION_SCHEMA.properties

    expect(india).toBeDefined()
    expect(schemaIsCurrent(wanted, wanted)).toBe(true)
    expect(
      schemaIsCurrent({ ...wanted, properties: withoutIndia }, wanted)
    ).toBe(false)
    expect(schemaIsCurrent({ ...wanted, title: 'Old' }, wanted)).toBe(false)
    expect(schemaIsCurrent({ title: wanted.title }, wanted)).toBe(false)
  })

  it('keeps the document out of write errors', () => {
    const cause = Object.assign(new Error('Request failed'), {
      config: { data: JSON.stringify({ india: INDIA }) },
      response: { status: 400, data: { india: INDIA } },
    })

    const error = new MasterDataWriteError('save', cause)

    expect(error.message).toBe('Master Data save failed with HTTP 400')
    expect(error.response).toEqual({ status: 400 })
    expect(JSON.stringify(error)).not.toContain(INDIA.pan)
    expect(String(error.stack)).not.toContain(INDIA.pan)
  })
})
