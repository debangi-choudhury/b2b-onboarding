import type { KycStatus } from './types'

/**
 * Words that say what kind of company it is, not which one. Dropped before
 * comparing, so "Acme Pvt Ltd" matches "ACME PRIVATE LIMITED". TEST is the
 * prefix every demo company carries.
 */
const IGNORED_WORDS = new Set([
  'PVT',
  'PRIVATE',
  'LTD',
  'LIMITED',
  'LLP',
  'CO',
  'COMPANY',
  'TEST',
])

/** At least this similar: the names match */
export const STRONG_MATCH = 0.85

/** At least this similar, but below STRONG_MATCH: a reviewer must decide */
export const PARTIAL_MATCH = 0.5

export type NameMatchBand = 'STRONG' | 'PARTIAL' | 'NONE'

export interface NameMatch {
  /** The applicant's name the provider's name was compared with */
  comparedWith: string
  registeredName: string
  /** 0 to 1 */
  score: number
  band: NameMatchBand
}

/** True for words like PVT or LTD, which name matching ignores */
export function isCompanyTypeWord(word: string): boolean {
  return IGNORED_WORDS.has(word.toUpperCase().replace(/[^A-Z0-9]/g, ''))
}

/** "Acme Pvt. Ltd." -> ["ACME"]. Punctuation separates words. */
export function nameWords(name: string): string[] {
  const words = name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .split(' ')
    .filter((word) => word && !IGNORED_WORDS.has(word))

  return Array.from(new Set(words))
}

/**
 * Sørensen–Dice similarity of the two names' sets of words: 1 when they have
 * the same words in any order, 0 when they share none. Word sets rather than
 * letters, so a different word counts fully: "KYC DEMO" against "KYC
 * ENTERPRISES" is a partial match, not a near-perfect one.
 */
export function nameSimilarity(a: string, b: string): number {
  const left = nameWords(a)
  const right = new Set(nameWords(b))

  if (left.length === 0 || right.size === 0) {
    return 0
  }

  const shared = left.filter((word) => right.has(word)).length

  return (2 * shared) / (left.length + right.size)
}

export function matchNames(
  comparedWith: string,
  registeredName: string
): NameMatch {
  const score =
    Math.round(nameSimilarity(comparedWith, registeredName) * 100) / 100

  const band: NameMatchBand =
    score >= STRONG_MATCH
      ? 'STRONG'
      : score >= PARTIAL_MATCH
      ? 'PARTIAL'
      : 'NONE'

  return { comparedWith, registeredName, score, band }
}

export const BAND_STATUS: Record<NameMatchBand, KycStatus> = {
  STRONG: 'VERIFIED',
  PARTIAL: 'MANUAL_REVIEW',
  NONE: 'FAILED',
}

const SEVERITY: Record<KycStatus, number> = {
  VERIFIED: 0,
  MANUAL_REVIEW: 1,
  FAILED: 2,
}

/** The worse of two statuses: FAILED, then MANUAL_REVIEW, then VERIFIED */
export function worseStatus(a: KycStatus, b: KycStatus): KycStatus {
  return SEVERITY[a] >= SEVERITY[b] ? a : b
}
