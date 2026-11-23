import type { KycProvider } from './kyc'
import { MockKycProvider } from './mockKyc'

/**
 * The values of the kycProvider app setting. To add a real provider, add its
 * class here and its value to the setting's enum in manifest.json.
 */
const PROVIDERS = {
  mock: () => new MockKycProvider(),
}

export type KycProviderName = keyof typeof PROVIDERS

export const DEFAULT_KYC_PROVIDER: KycProviderName = 'mock'

/**
 * Picks the provider from app settings. A missing or unknown value falls back
 * to the default, so a bad setting never stops verification; `problem` says
 * why, for the review screen.
 */
export function kycProviderFor(settings: unknown): {
  name: KycProviderName
  provider: KycProvider
  problem: string | null
} {
  const raw = (settings as { kycProvider?: unknown } | null | undefined)
    ?.kycProvider

  if (raw === undefined || raw === null || raw === '') {
    return {
      name: DEFAULT_KYC_PROVIDER,
      provider: PROVIDERS[DEFAULT_KYC_PROVIDER](),
      problem: null,
    }
  }

  if (typeof raw === 'string' && Object.keys(PROVIDERS).includes(raw)) {
    const name = raw as KycProviderName

    return { name, provider: PROVIDERS[name](), problem: null }
  }

  return {
    name: DEFAULT_KYC_PROVIDER,
    provider: PROVIDERS[DEFAULT_KYC_PROVIDER](),
    problem: `Unknown KYC provider "${String(raw).slice(
      0,
      40
    )}"; using ${DEFAULT_KYC_PROVIDER}`,
  }
}
