import { createHash } from 'crypto'

import type { EligibilityVerifier } from './types'

/**
 * A simulated company registry for the demo. It never calls anything
 * external, and its rules are deterministic so presenters can choose the
 * outcome:
 *
 * - registration numbers ending in 0: not found in the registry
 * - registration numbers ending in 9: the company is dissolved
 * - anything else: an active company
 */
export class MockRegistryVerifier implements EligibilityVerifier {
  public readonly provider = 'Mock company registry (demo)'

  public async verify(
    input: Parameters<EligibilityVerifier['verify']>[0],
    now: Date
  ) {
    const normalized = input.registrationNumber
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')

    const last = normalized.slice(-1)
    const reference = `MOCK-${createHash('sha256')
      .update(normalized)
      .digest('hex')
      .slice(0, 10)
      .toUpperCase()}`

    const base = {
      provider: this.provider,
      reference,
      checkedAt: now.toISOString(),
    }

    if (last === '0') {
      return {
        ...base,
        status: 'FAILED' as const,
        code: 'NOT_FOUND',
        message: `No company with registration number ${input.registrationNumber} in the registry`,
      }
    }

    if (last === '9') {
      return {
        ...base,
        status: 'FAILED' as const,
        code: 'DISSOLVED',
        message: 'The registry lists this company as dissolved',
        registeredName: input.companyName.toUpperCase(),
      }
    }

    return {
      ...base,
      status: 'PASSED' as const,
      code: 'ACTIVE',
      message: `Active company registered in ${input.address.country}`,
      registeredName: input.companyName.toUpperCase(),
    }
  }
}
