import type { ApplicationInput, VerificationResult } from '../domain/types'

/**
 * Checks whether a business is eligible, for example against a company
 * registry. The demo uses a mock. A client project replaces it with a real
 * provider behind this same interface.
 */
export interface EligibilityVerifier {
  readonly provider: string
  verify(
    input: Pick<
      ApplicationInput,
      'companyName' | 'registrationNumber' | 'address'
    >,
    now: Date
  ): Promise<VerificationResult>
}
