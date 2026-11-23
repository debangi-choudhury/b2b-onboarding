import type { IndiaField } from './indiaIdentifiers'
import { checkIndiaField, INDIA, parseYesNo } from './indiaIdentifiers'

/**
 * Mirrors the server's rules (node/domain/validation.ts and documents.ts) so
 * people see problems before submitting. The server checks everything again.
 * India identifiers use the same rules file as the server (indiaIdentifiers.ts).
 */

export type FieldName =
  | IndiaField
  | 'companyName'
  | 'tradeName'
  | 'registrationNumber'
  | 'taxId'
  | 'contact.firstName'
  | 'contact.lastName'
  | 'contact.email'
  | 'contact.phone'
  | 'address.street'
  | 'address.number'
  | 'address.complement'
  | 'address.city'
  | 'address.state'
  | 'address.postalCode'
  | 'address.country'
  | 'address.receiverName'

export type DocumentKind = 'REGISTRATION_CERTIFICATE' | 'TAX_CERTIFICATE'

export type ErrorCode =
  | 'REQUIRED'
  | 'TOO_SHORT'
  | 'TOO_LONG'
  | 'INVALID_FORMAT'
  | 'REJECTED'
  | 'MISSING'
  | 'TOO_LARGE'
  | 'EMPTY'
  | 'UNSUPPORTED_TYPE'
  | 'PAN_NOT_BUSINESS'

export interface FieldSpec {
  name: FieldName
  required?: boolean
  min?: number
  max: number
  pattern?: RegExp
  type?: 'text' | 'email' | 'tel'
  autoComplete?: string
}

const NAME = /^[^<>{}\\]*$/
const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9 ./-]*$/

export const COMPANY_FIELDS: FieldSpec[] = [
  {
    name: 'companyName',
    required: true,
    min: 2,
    max: 100,
    pattern: NAME,
    autoComplete: 'organization',
  },
  { name: 'tradeName', max: 100, pattern: NAME },
  {
    name: 'registrationNumber',
    required: true,
    min: 4,
    max: 30,
    pattern: IDENTIFIER,
  },
  { name: 'taxId', max: 30, pattern: IDENTIFIER },
]

export const CONTACT_FIELDS: FieldSpec[] = [
  {
    name: 'contact.firstName',
    required: true,
    max: 50,
    pattern: NAME,
    autoComplete: 'given-name',
  },
  {
    name: 'contact.lastName',
    required: true,
    max: 50,
    pattern: NAME,
    autoComplete: 'family-name',
  },
  {
    name: 'contact.email',
    required: true,
    max: 254,
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/,
    type: 'email',
    autoComplete: 'email',
  },
  {
    name: 'contact.phone',
    max: 30,
    pattern: /^\+?[0-9 ()-]{6,}$/,
    type: 'tel',
    autoComplete: 'tel',
  },
]

export const ADDRESS_FIELDS: FieldSpec[] = [
  {
    name: 'address.street',
    required: true,
    max: 100,
    pattern: NAME,
    autoComplete: 'address-line1',
  },
  { name: 'address.number', max: 20, pattern: NAME },
  {
    name: 'address.complement',
    max: 100,
    pattern: NAME,
    autoComplete: 'address-line2',
  },
  {
    name: 'address.city',
    required: true,
    max: 60,
    pattern: NAME,
    autoComplete: 'address-level2',
  },
  {
    name: 'address.state',
    required: true,
    max: 40,
    pattern: NAME,
    autoComplete: 'address-level1',
  },
  {
    name: 'address.postalCode',
    required: true,
    min: 3,
    max: 12,
    pattern: /^[A-Za-z0-9][A-Za-z0-9 -]*$/,
    autoComplete: 'postal-code',
  },
  { name: 'address.receiverName', max: 100, pattern: NAME },
]

/**
 * Asked on the Company step when the country is India. The import or export
 * answer is a Yes/No choice rendered separately, and IEC only shows for Yes.
 * Lengths leave room for spaces people type; the rules strip them.
 */
export const INDIA_COMPANY_FIELDS: FieldSpec[] = [
  { name: 'india.pan', required: true, max: 14 },
  { name: 'india.iec', required: true, max: 14 },
  { name: 'india.udyam', max: 24 },
]

/** The Bank account step, for India only */
export const BANK_FIELDS: FieldSpec[] = [
  { name: 'india.accountNumber', required: true, max: 24 },
  { name: 'india.ifsc', required: true, max: 14 },
  {
    name: 'india.accountHolderName',
    required: true,
    max: 100,
    autoComplete: 'organization',
  },
]

export const isIndia = (country: string | undefined) => country === INDIA

/** "yes" when the business imports or exports */
export const importsOrExports = (answer: string | undefined) =>
  parseYesNo(answer ?? '') === true

/** ISO 3166-1 alpha-3 codes, as B2B Organizations expects */
export const COUNTRIES = [
  'USA',
  'CAN',
  'MEX',
  'BRA',
  'GBR',
  'DEU',
  'FRA',
  'ESP',
  'ITA',
  'IND',
] as const

export const DOCUMENT_KINDS: DocumentKind[] = [
  'REGISTRATION_CERTIFICATE',
  'TAX_CERTIFICATE',
]

export const MAX_FILE_BYTES = 5 * 1024 * 1024
export const ACCEPTED_FILES =
  '.pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg'

/** 187 B -> "1 KB", 48 KB -> "48 KB", 2.4 MB -> "2.4 MB" */
export function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`
  }

  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function checkField(spec: FieldSpec, raw: string): ErrorCode | null {
  const value = raw.trim()

  if (!value) {
    return spec.required ? 'REQUIRED' : null
  }

  if (spec.min && value.length < spec.min) return 'TOO_SHORT'
  if (value.length > spec.max) return 'TOO_LONG'
  if (spec.pattern && !spec.pattern.test(value)) return 'INVALID_FORMAT'

  return null
}

/**
 * Checks any form field. India fields follow the shared rules, where IEC
 * depends on the import or export answer.
 */
export function checkAnyField(
  spec: FieldSpec,
  raw: string,
  values: Partial<Record<FieldName, string>>
): ErrorCode | null {
  if (spec.name.startsWith('india.')) {
    return checkIndiaField(
      spec.name as IndiaField,
      raw,
      importsOrExports(values['india.importsOrExports'])
    )
  }

  return checkField(spec, raw)
}

export function checkFile(file: File | null): ErrorCode | null {
  if (!file) return 'MISSING'
  if (file.size === 0) return 'EMPTY'
  if (file.size > MAX_FILE_BYTES) return 'TOO_LARGE'
  if (!/\.(pdf|png|jpe?g)$/i.test(file.name)) return 'UNSUPPORTED_TYPE'

  return null
}
