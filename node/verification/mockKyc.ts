import { randomBytes } from 'crypto'

import {
  BANK_ACCOUNT,
  compact,
  IEC,
  IFSC,
  maskAccount,
  maskPan,
  PAN,
  UDYAM,
} from '../domain/indiaIdentifiers'
import { isCompanyTypeWord } from '../domain/nameMatch'
import type { KycCheckKind, KycResult, KycStatus } from '../domain/types'
import type { KycProvider } from './kyc'

type Outcome = 'FAIL' | 'UNDECIDED' | 'PASS'

/**
 * The demo's rule, on the last digit of an identifier's number part:
 * 0 fails, 5 is left undecided, anything else (or a letter) passes.
 */
function outcomeOf(lastCharacter: string): Outcome {
  if (lastCharacter === '0') return 'FAIL'
  if (lastCharacter === '5') return 'UNDECIDED'

  return 'PASS'
}

const CODE: Record<Outcome, string> = {
  FAIL: 'NOT_FOUND',
  UNDECIDED: 'PROVIDER_UNDECIDED',
  PASS: 'VALID',
}

const STATUS: Record<Outcome, KycStatus> = {
  FAIL: 'FAILED',
  UNDECIDED: 'MANUAL_REVIEW',
  PASS: 'VERIFIED',
}

/** Uppercase words, so registered names look like a registry's records */
function recordName(name: string) {
  return name.trim().replace(/\s+/g, ' ').toUpperCase()
}

/**
 * A simulated KYC provider for the demo. It never calls anything external,
 * and its rules are deterministic so presenters can choose each outcome:
 *
 * - PAN (by its 4 digits), IEC, Udyam and bank account ending in 0: failed,
 *   not found
 * - ending in 5: the provider couldn't decide, so a reviewer must
 * - anything else: verified, with the company name as the registered name
 * - bank account: the registered name is the account holder name given. When
 *   the account number ends in 7, its last real word (not PVT, LTD and the
 *   like) becomes ENTERPRISES, to show a partial name match. Replacing a
 *   suffix instead would only add a word, which long names still match.
 *
 * References are random, never derived from the identifier, so they can't be
 * used to guess a PAN or an account number.
 */
export class MockKycProvider implements KycProvider {
  public readonly provider = 'Mock KYC provider (demo)'

  private base(kind: KycCheckKind, now: Date) {
    return {
      kind,
      provider: this.provider,
      reference: `MOCK-KYC-${randomBytes(5).toString('hex').toUpperCase()}`,
      checkedAt: now.toISOString(),
    }
  }

  private invalid(kind: KycCheckKind, now: Date): KycResult {
    return {
      ...this.base(kind, now),
      status: 'FAILED',
      code: 'INVALID_FORMAT',
      message: 'The provider refused the number as badly formatted',
    }
  }

  private decided(
    kind: KycCheckKind,
    now: Date,
    result: {
      outcome: Outcome
      messages: Record<Outcome, string>
      registeredName: string
    }
  ): KycResult {
    const { outcome, messages, registeredName } = result

    return {
      ...this.base(kind, now),
      status: STATUS[outcome],
      code: CODE[outcome],
      message: messages[outcome],
      ...(outcome === 'FAIL' ? {} : { registeredName }),
    }
  }

  public async verifyPan(
    input: { pan: string; companyName: string },
    now: Date
  ) {
    const pan = compact(input.pan)

    if (!PAN.test(pan)) {
      return this.invalid('PAN', now)
    }

    const masked = maskPan(pan)

    return this.decided('PAN', now, {
      outcome: outcomeOf(pan.charAt(8)),
      messages: {
        FAIL: `No PAN ${masked} in the income tax records`,
        UNDECIDED: `PAN ${masked} found, but its status couldn't be confirmed`,
        PASS: `PAN ${masked} is active`,
      },
      registeredName: recordName(input.companyName),
    })
  }

  public async verifyIec(
    input: { iec: string; companyName: string },
    now: Date
  ) {
    const iec = compact(input.iec)

    if (!IEC.test(iec)) {
      return this.invalid('IEC', now)
    }

    return this.decided('IEC', now, {
      outcome: outcomeOf(iec.charAt(9)),
      messages: {
        FAIL: `No importer-exporter with IEC ${iec}`,
        UNDECIDED: `IEC ${iec} found, but it may be suspended`,
        PASS: `IEC ${iec} is active`,
      },
      registeredName: recordName(input.companyName),
    })
  }

  public async verifyUdyam(
    input: { udyam: string; companyName: string },
    now: Date
  ) {
    const udyam = compact(input.udyam)

    if (!UDYAM.test(udyam)) {
      return this.invalid('UDYAM', now)
    }

    return this.decided('UDYAM', now, {
      outcome: outcomeOf(udyam.charAt(udyam.length - 1)),
      messages: {
        FAIL: `No MSME with Udyam registration ${udyam}`,
        UNDECIDED: `Udyam registration ${udyam} found, but its details are incomplete`,
        PASS: `Udyam registration ${udyam} is valid`,
      },
      registeredName: recordName(input.companyName),
    })
  }

  public async verifyBankAccount(
    input: { accountNumber: string; ifsc: string; holderName: string },
    now: Date
  ) {
    const accountNumber = compact(input.accountNumber)
    const ifsc = compact(input.ifsc)

    if (!BANK_ACCOUNT.test(accountNumber) || !IFSC.test(ifsc)) {
      return this.invalid('BANK_ACCOUNT', now)
    }

    const last = accountNumber.charAt(accountNumber.length - 1)
    const words = recordName(input.holderName).split(' ')

    if (last === '7') {
      const isRealWord = (word: string) =>
        /[A-Z0-9]/.test(word) && !isCompanyTypeWord(word)

      let index = words.length - 1

      while (index >= 0 && !isRealWord(words[index])) index--

      if (index >= 0) {
        words[index] = 'ENTERPRISES'
      } else {
        words.push('ENTERPRISES')
      }
    }

    const masked = maskAccount(accountNumber)

    return this.decided('BANK_ACCOUNT', now, {
      outcome: outcomeOf(last),
      messages: {
        FAIL: `No account ${masked} at ${ifsc}`,
        UNDECIDED: `Test transfer to ${masked} at ${ifsc} is still pending`,
        PASS: `Test transfer to ${masked} at ${ifsc} succeeded`,
      },
      registeredName: words.join(' '),
    })
  }
}
