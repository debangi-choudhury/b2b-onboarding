import type { Stage, StageType } from './types'

export const DEFAULT_STAGES: Stage[] = [
  { id: 'document-review', label: 'Document review', type: 'REVIEW' },
  { id: 'compliance-check', label: 'Compliance check', type: 'VERIFICATION' },
  { id: 'final-approval', label: 'Final approval', type: 'APPROVAL' },
]

export const MAX_STAGES = 8

const STAGE_TYPES: StageType[] = ['REVIEW', 'VERIFICATION', 'APPROVAL']
const STAGE_ID = /^[a-z0-9][a-z0-9-]{0,39}$/

export interface StageConfig {
  stages: Stage[]
  /** True when the settings were missing and the defaults apply */
  isDefault: boolean
  /** Problems found in the settings. When present, the defaults apply. */
  problems: string[]
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

/**
 * Reads the stage list from app settings. Invalid settings never break
 * submissions: the defaults apply and the problems are reported, so the review
 * screen can show them to admins.
 */
export function resolveStages(settings: unknown): StageConfig {
  const raw = (settings as { stages?: unknown } | null | undefined)?.stages

  if (!Array.isArray(raw) || raw.length === 0) {
    return { stages: DEFAULT_STAGES, isDefault: true, problems: [] }
  }

  const problems: string[] = []
  const stages: Stage[] = []

  raw.forEach((item, index) => {
    const entry = (item ?? {}) as Record<string, unknown>
    const label = typeof entry.label === 'string' ? entry.label.trim() : ''
    const type = entry.type as StageType
    const id =
      typeof entry.id === 'string' && entry.id.trim()
        ? entry.id.trim()
        : slugify(label)

    if (!label || label.length > 60) {
      problems.push(`Stage ${index + 1}: label must be 1 to 60 characters`)
    }

    if (!STAGE_TYPES.includes(type)) {
      problems.push(
        `Stage ${index + 1}: type must be REVIEW, VERIFICATION or APPROVAL`
      )
    }

    if (!STAGE_ID.test(id)) {
      problems.push(
        `Stage ${index + 1}: ID must use lowercase letters, digits and hyphens`
      )
    }

    stages.push({ id, label, type })
  })

  if (stages.length > MAX_STAGES) {
    problems.push(`Use at most ${MAX_STAGES} stages`)
  }

  const ids = stages.map((s) => s.id)

  if (new Set(ids).size !== ids.length) {
    problems.push('Stage IDs must be unique')
  }

  const approvals = stages.filter((s) => s.type === 'APPROVAL').length

  if (approvals !== 1 || stages[stages.length - 1]?.type !== 'APPROVAL') {
    problems.push('Use exactly one APPROVAL stage, and make it the last stage')
  }

  if (stages.filter((s) => s.type === 'VERIFICATION').length > 1) {
    problems.push('Use at most one VERIFICATION stage')
  }

  if (problems.length > 0) {
    return { stages: DEFAULT_STAGES, isDefault: true, problems }
  }

  return { stages, isDefault: false, problems }
}
