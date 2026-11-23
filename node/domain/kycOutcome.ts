import { BAND_STATUS, matchNames, worseStatus } from './nameMatch'
import type { Application, KycCheck, KycDecision, KycResult } from './types'

/**
 * Adds name matching to a provider's result. The registered name is compared
 * with the legal company name: for the bank account too, because the account
 * must belong to the business, not just to whoever is named as its holder.
 */
export function toKycCheck(result: KycResult, companyName: string): KycCheck {
  if (!result.registeredName) {
    return { ...result, nameMatch: null, effectiveStatus: result.status }
  }

  const nameMatch = matchNames(companyName, result.registeredName)

  return {
    ...result,
    nameMatch,
    effectiveStatus: worseStatus(result.status, BAND_STATUS[nameMatch.band]),
  }
}

/** The reviewer's latest decision on this exact check, if any */
export function latestDecision(
  app: Pick<Application, 'kycDecisions'>,
  check: Pick<KycCheck, 'kind' | 'reference'>
): KycDecision | null {
  const decisions = (app.kycDecisions ?? []).filter(
    (d) => d.kind === check.kind && d.checkReference === check.reference
  )

  return decisions[decisions.length - 1] ?? null
}

/**
 * Where the verification stage stands:
 *
 * - NOT_RUN: no verification yet
 * - BLOCKED: the registry check or a KYC check failed, or a reviewer rejected
 *   a check. The stage can only be rejected.
 * - NEEDS_DECISION: a check needs a reviewer to accept or reject it
 * - READY: the stage can pass
 *
 * Applications without India identifiers depend on the registry check alone,
 * as before KYC checks existed.
 */
export type VerificationOutcome =
  | 'NOT_RUN'
  | 'BLOCKED'
  | 'NEEDS_DECISION'
  | 'READY'

export function verificationOutcome(
  app: Pick<
    Application,
    'verification' | 'india' | 'kycChecks' | 'kycDecisions'
  >
): VerificationOutcome {
  if (!app.verification || (app.india && !app.kycChecks)) {
    return 'NOT_RUN'
  }

  if (app.verification.status !== 'PASSED') {
    return 'BLOCKED'
  }

  let undecided = false

  for (const check of app.kycChecks ?? []) {
    if (check.effectiveStatus === 'FAILED') {
      return 'BLOCKED'
    }

    if (check.effectiveStatus === 'MANUAL_REVIEW') {
      const decision = latestDecision(app, check)

      if (decision?.decision === 'REJECTED') {
        return 'BLOCKED'
      }

      if (!decision) {
        undecided = true
      }
    }
  }

  return undecided ? 'NEEDS_DECISION' : 'READY'
}
