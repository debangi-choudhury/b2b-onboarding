import { maskAccount, maskPan } from '../domain/indiaIdentifiers'
import type { IndiaIdentifiers } from '../domain/types'
import { runKycChecks } from '../verification/kyc'
import { kycProviderFor } from '../verification/kycProviders'
import { MockKycProvider } from '../verification/mockKyc'
import { NOW } from './fixtures'

// Fake identifiers that only satisfy the formats
const COMPANY = 'TEST - KYC Demo Pvt Ltd'

const mock = new MockKycProvider()

const bank = (accountNumber: string, holderName = COMPANY) => ({
  accountNumber,
  ifsc: 'TEST0001234',
  holderName,
})

describe('MockKycProvider: PAN', () => {
  it.each([
    ['ABCCD1231X', 'VERIFIED', 'VALID'],
    ['ABCCD1230X', 'FAILED', 'NOT_FOUND'],
    ['ABCCD1235X', 'MANUAL_REVIEW', 'PROVIDER_UNDECIDED'],
  ])('decides %s by its last digit: %s', async (pan, status, code) => {
    const result = await mock.verifyPan({ pan, companyName: COMPANY }, NOW)

    expect(result).toMatchObject({ kind: 'PAN', status, code })
  })

  it('returns the company name as the registered name, unless not found', async () => {
    const found = await mock.verifyPan(
      { pan: 'ABCCD1231X', companyName: ' TEST - KYC  Demo Pvt Ltd ' },
      NOW
    )

    const missing = await mock.verifyPan(
      { pan: 'ABCCD1230X', companyName: COMPANY },
      NOW
    )

    expect(found.registeredName).toBe('TEST - KYC DEMO PVT LTD')
    expect(missing.registeredName).toBeUndefined()
  })

  it('accepts lowercase and spaces, as typed', async () => {
    const result = await mock.verifyPan(
      { pan: 'abccd 1231 x', companyName: COMPANY },
      NOW
    )

    expect(result.status).toBe('VERIFIED')
  })

  it('fails a badly formatted PAN instead of guessing', async () => {
    const result = await mock.verifyPan(
      { pan: 'ABC1231', companyName: COMPANY },
      NOW
    )

    expect(result).toMatchObject({ status: 'FAILED', code: 'INVALID_FORMAT' })
  })

  it('never puts the full PAN in the message', async () => {
    for (const pan of ['ABCCD1231X', 'ABCCD1230X', 'ABCCD1235X']) {
      // eslint-disable-next-line no-await-in-loop
      const { message } = await mock.verifyPan(
        { pan, companyName: COMPANY },
        NOW
      )

      expect(message).not.toContain(pan)
      expect(message).not.toContain('ABCCD')
    }
  })
})

describe('MockKycProvider: IEC and Udyam', () => {
  it.each([
    ['ABCDE12341', 'VERIFIED'],
    ['ABCDE12340', 'FAILED'],
    ['ABCDE12345', 'MANUAL_REVIEW'],
    ['ABCDE1234F', 'VERIFIED'],
  ])('decides IEC %s: %s', async (iec, status) => {
    const result = await mock.verifyIec({ iec, companyName: COMPANY }, NOW)

    expect(result).toMatchObject({ kind: 'IEC', status })
  })

  it.each([
    ['UDYAM-MH-01-0012341', 'VERIFIED'],
    ['UDYAM-MH-01-0012340', 'FAILED'],
    ['UDYAM-MH-01-0012345', 'MANUAL_REVIEW'],
  ])('decides Udyam %s: %s', async (udyam, status) => {
    const result = await mock.verifyUdyam({ udyam, companyName: COMPANY }, NOW)

    expect(result).toMatchObject({ kind: 'UDYAM', status })
  })

  it('fails a badly formatted IEC or Udyam number', async () => {
    const iec = await mock.verifyIec({ iec: 'ABC', companyName: COMPANY }, NOW)
    const udyam = await mock.verifyUdyam(
      { udyam: 'UDYAM-MH-1-12', companyName: COMPANY },
      NOW
    )

    expect(iec.code).toBe('INVALID_FORMAT')
    expect(udyam.code).toBe('INVALID_FORMAT')
  })
})

describe('MockKycProvider: bank account (penny drop)', () => {
  it.each([
    ['123456789011', 'VERIFIED'],
    ['123456789010', 'FAILED'],
    ['123456789015', 'MANUAL_REVIEW'],
    ['123456789017', 'VERIFIED'],
  ])('decides account %s: %s', async (accountNumber, status) => {
    const result = await mock.verifyBankAccount(bank(accountNumber), NOW)

    expect(result).toMatchObject({ kind: 'BANK_ACCOUNT', status })
  })

  it('returns the account holder name given as the registered name', async () => {
    const result = await mock.verifyBankAccount(
      bank('123456789011', 'Someone Else Traders'),
      NOW
    )

    expect(result.registeredName).toBe('SOMEONE ELSE TRADERS')
  })

  it('changes the last word to ENTERPRISES for accounts ending in 7', async () => {
    const result = await mock.verifyBankAccount(
      bank('123456789017', 'TEST - KYC Demo'),
      NOW
    )

    expect(result.registeredName).toBe('TEST - KYC ENTERPRISES')
  })

  it('changes the last real word, not a suffix like LTD', async () => {
    const result = await mock.verifyBankAccount(
      bank('123456789017', 'TEST - KYC Partial Match Pvt Ltd'),
      NOW
    )

    expect(result.registeredName).toBe('TEST - KYC PARTIAL ENTERPRISES PVT LTD')
  })

  it('fails a badly formatted account number or IFSC', async () => {
    const shortAccount = await mock.verifyBankAccount(bank('12345'), NOW)
    const badIfsc = await mock.verifyBankAccount(
      { ...bank('123456789011'), ifsc: 'TEST1001234' },
      NOW
    )

    expect(shortAccount.code).toBe('INVALID_FORMAT')
    expect(badIfsc.code).toBe('INVALID_FORMAT')
  })

  it('shows only the last 4 digits of the account in the message', async () => {
    const { message } = await mock.verifyBankAccount(bank('123456789011'), NOW)

    expect(message).toContain('XXXXXXXX9011')
    expect(message).not.toContain('123456789011')
  })
})

describe('MockKycProvider: every result', () => {
  it('has the provider, the time and a random reference', async () => {
    const first = await mock.verifyPan(
      { pan: 'ABCCD1231X', companyName: COMPANY },
      NOW
    )

    const second = await mock.verifyPan(
      { pan: 'ABCCD1231X', companyName: COMPANY },
      NOW
    )

    expect(first.provider).toBe('Mock KYC provider (demo)')
    expect(first.checkedAt).toBe(NOW.toISOString())
    expect(first.reference).toMatch(/^MOCK-KYC-[0-9A-F]{10}$/)
    // Not derived from the PAN, so it can't be used to look one up
    expect(first.reference).not.toBe(second.reference)
  })
})

describe('runKycChecks', () => {
  const india: IndiaIdentifiers = {
    pan: 'ABCCD1231X',
    importsOrExports: true,
    iec: 'ABCDE12341',
    udyam: 'UDYAM-MH-01-0012341',
    bank: bank('123456789011'),
  }

  it('runs PAN, IEC, Udyam and bank account, in that order', async () => {
    const results = await runKycChecks(
      mock,
      { companyName: COMPANY, india },
      NOW
    )

    expect(results.map((r) => r.kind)).toEqual([
      'PAN',
      'IEC',
      'UDYAM',
      'BANK_ACCOUNT',
    ])
  })

  it('skips IEC and Udyam when they are not given', async () => {
    const results = await runKycChecks(
      mock,
      {
        companyName: COMPANY,
        india: {
          ...india,
          importsOrExports: false,
          iec: undefined,
          udyam: undefined,
        },
      },
      NOW
    )

    expect(results.map((r) => r.kind)).toEqual(['PAN', 'BANK_ACCOUNT'])
  })

  it('runs no checks for applications without India identifiers', async () => {
    expect(await runKycChecks(mock, { companyName: COMPANY }, NOW)).toEqual([])
    expect(
      await runKycChecks(mock, { companyName: COMPANY, india: null }, NOW)
    ).toEqual([])
  })
})

describe('kycProviderFor', () => {
  it('uses the mock by default', () => {
    for (const settings of [undefined, null, {}, { kycProvider: '' }]) {
      const picked = kycProviderFor(settings)

      expect(picked.name).toBe('mock')
      expect(picked.provider).toBeInstanceOf(MockKycProvider)
      expect(picked.problem).toBeNull()
    }
  })

  it('uses the provider the setting names', () => {
    expect(kycProviderFor({ kycProvider: 'mock' }).problem).toBeNull()
  })

  it('falls back to the mock and reports an unknown provider', () => {
    const picked = kycProviderFor({ kycProvider: 'acme-kyc' })

    expect(picked.name).toBe('mock')
    expect(picked.problem).toBe('Unknown KYC provider "acme-kyc"; using mock')
  })
})

describe('masking', () => {
  it('masks a PAN to its digits and check letter', () => {
    expect(maskPan('ABCCD1234X')).toBe('XXXXX1234X')
  })

  it('masks an account number to its last 4 digits', () => {
    expect(maskAccount('123456789')).toBe('XXXXX6789')
    expect(maskAccount('123456789012345678')).toBe('XXXXXXXXXXXXXX5678')
  })

  it('hides very short values completely', () => {
    expect(maskPan('ABC')).toBe('XXX')
    expect(maskAccount('1234')).toBe('XXXX')
  })
})
