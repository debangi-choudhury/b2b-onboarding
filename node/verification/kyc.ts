import type { ApplicationInput, BankAccount, KycResult } from '../domain/types'

/**
 * Verifies Indian business identifiers with a KYC provider. The demo uses a
 * mock (MockKycProvider). A client project adds a real provider as one new
 * class behind this interface, plus an option in the kycProvider setting.
 *
 * Implementations must never log the identifiers they receive, and must
 * never put a full PAN or account number in a result's message.
 */
export interface KycProvider {
  /** Shown to reviewers next to each result */
  readonly provider: string
  verifyPan(
    input: { pan: string; companyName: string },
    now: Date
  ): Promise<KycResult>
  verifyIec(
    input: { iec: string; companyName: string },
    now: Date
  ): Promise<KycResult>
  verifyUdyam(
    input: { udyam: string; companyName: string },
    now: Date
  ): Promise<KycResult>
  /** Penny drop: a test transfer that returns the account holder's name */
  verifyBankAccount(input: BankAccount, now: Date): Promise<KycResult>
}

/**
 * Runs every check that applies to an application, in a fixed order: PAN,
 * then IEC and Udyam when given, then the bank account. Applications without
 * India identifiers get no checks.
 */
export async function runKycChecks(
  provider: KycProvider,
  input: Pick<ApplicationInput, 'companyName' | 'india'>,
  now: Date
): Promise<KycResult[]> {
  const { india, companyName } = input

  if (!india) {
    return []
  }

  return Promise.all([
    provider.verifyPan({ pan: india.pan, companyName }, now),
    ...(india.iec
      ? [provider.verifyIec({ iec: india.iec, companyName }, now)]
      : []),
    ...(india.udyam
      ? [provider.verifyUdyam({ udyam: india.udyam, companyName }, now)]
      : []),
    provider.verifyBankAccount(india.bank, now),
  ])
}
