/**
 * Indian business identifiers: formats, checks and masking.
 *
 * The form uses an identical copy, react/utils/indiaIdentifiers.ts, so people
 * see problems before submitting, and the server checks everything again with
 * this one. A test fails if the two files differ, so edit this file and copy
 * it over. Keep it free of imports, and of syntax newer than TypeScript 3.9,
 * which the react builder uses.
 */

/** Permanent Account Number: 5 letters, 4 digits, 1 letter */
export const PAN = /^[A-Z]{5}[0-9]{4}[A-Z]$/

/**
 * The PAN's 4th letter is the holder type. Businesses only: company, firm,
 * HUF, association, trust, body of individuals, local authority, artificial
 * juridical person and government. P (individual) is refused.
 */
export const BUSINESS_PAN_TYPES = ['C', 'F', 'H', 'A', 'T', 'B', 'L', 'J', 'G']

/** Importer Exporter Code: 10 letters or digits */
export const IEC = /^[A-Z0-9]{10}$/

/** Udyam (MSME) registration number, such as UDYAM-MH-01-0012345 */
export const UDYAM = /^UDYAM-[A-Z]{2}-[0-9]{2}-[0-9]{7}$/

/** Bank account number: 9 to 18 digits */
export const BANK_ACCOUNT = /^[0-9]{9,18}$/

/** IFSC: 4 letters (bank), a zero, then 6 letters or digits (branch) */
export const IFSC = /^[A-Z]{4}0[A-Z0-9]{6}$/

const HOLDER_NAME = /^[^<>{}\\]*$/
const HOLDER_NAME_MIN = 2
const HOLDER_NAME_MAX = 100

/** The country whose applications need these identifiers */
export const INDIA = 'IND'

/**
 * Form field names. Flat, with one dot, because the server only reads field
 * names of that shape from the multipart form.
 */
export type IndiaField =
  | 'india.pan'
  | 'india.importsOrExports'
  | 'india.iec'
  | 'india.udyam'
  | 'india.accountNumber'
  | 'india.ifsc'
  | 'india.accountHolderName'

export const INDIA_FIELDS: IndiaField[] = [
  'india.pan',
  'india.importsOrExports',
  'india.iec',
  'india.udyam',
  'india.accountNumber',
  'india.ifsc',
  'india.accountHolderName',
]

export type IndiaErrorCode =
  | 'REQUIRED'
  | 'TOO_SHORT'
  | 'TOO_LONG'
  | 'INVALID_FORMAT'
  | 'PAN_NOT_BUSINESS'

export interface IndiaFieldError {
  field: IndiaField
  code: IndiaErrorCode
}

/** The checked values, in the shape stored on the application */
export interface IndiaValues {
  pan: string
  importsOrExports: boolean
  iec?: string
  udyam?: string
  bank: {
    accountNumber: string
    ifsc: string
    holderName: string
  }
}

/** Uppercase, without spaces, so "abcde 1234 f" checks as "ABCDE1234F" */
export function compact(value: string): string {
  return value.toUpperCase().replace(/\s+/g, '')
}

/** "yes" means the business imports or exports. Empty or "no" means it doesn't. */
export function parseYesNo(value: string): boolean | null {
  const answer = value.trim().toLowerCase()

  if (answer === 'yes') return true
  if (answer === 'no' || answer === '') return false

  return null
}

export function checkPan(value: string): IndiaErrorCode | null {
  const pan = compact(value)

  if (!pan) return 'REQUIRED'
  if (!PAN.test(pan)) return 'INVALID_FORMAT'
  if (BUSINESS_PAN_TYPES.indexOf(pan.charAt(3)) === -1) {
    return 'PAN_NOT_BUSINESS'
  }

  return null
}

function checkPattern(
  value: string,
  pattern: RegExp,
  required: boolean
): IndiaErrorCode | null {
  const compacted = compact(value)

  if (!compacted) return required ? 'REQUIRED' : null

  return pattern.test(compacted) ? null : 'INVALID_FORMAT'
}

function checkHolderName(value: string): IndiaErrorCode | null {
  const name = value.trim().replace(/\s+/g, ' ')

  if (!name) return 'REQUIRED'
  if (name.length < HOLDER_NAME_MIN) return 'TOO_SHORT'
  if (name.length > HOLDER_NAME_MAX) return 'TOO_LONG'

  return HOLDER_NAME.test(name) ? null : 'INVALID_FORMAT'
}

/**
 * Checks one field. IEC is required only for businesses that import or
 * export; for the others it's ignored.
 */
export function checkIndiaField(
  field: IndiaField,
  value: string,
  importsOrExports: boolean
): IndiaErrorCode | null {
  switch (field) {
    case 'india.pan':
      return checkPan(value)

    case 'india.importsOrExports':
      return parseYesNo(value) === null ? 'INVALID_FORMAT' : null

    case 'india.iec':
      return importsOrExports ? checkPattern(value, IEC, true) : null

    case 'india.udyam':
      return checkPattern(value, UDYAM, false)

    case 'india.accountNumber':
      return checkPattern(value, BANK_ACCOUNT, true)

    case 'india.ifsc':
      return checkPattern(value, IFSC, true)

    case 'india.accountHolderName':
      return checkHolderName(value)

    default:
      return null
  }
}

/**
 * Checks every India field and, when they're all fine, returns them
 * normalized: identifiers in uppercase without spaces, the holder name with
 * single spaces, and no IEC for businesses that don't import or export.
 */
export function validateIndia(
  values: Partial<Record<IndiaField, string>>
): { ok: true; value: IndiaValues } | { ok: false; errors: IndiaFieldError[] } {
  const get = (field: IndiaField) => values[field] ?? ''
  const importsOrExports = parseYesNo(get('india.importsOrExports')) === true
  const errors: IndiaFieldError[] = []

  INDIA_FIELDS.forEach((field) => {
    const code = checkIndiaField(field, get(field), importsOrExports)

    if (code) errors.push({ field, code })
  })

  if (errors.length > 0) {
    return { ok: false, errors }
  }

  const iec = compact(get('india.iec'))
  const udyam = compact(get('india.udyam'))

  return {
    ok: true,
    value: {
      pan: compact(get('india.pan')),
      importsOrExports,
      iec: importsOrExports ? iec : undefined,
      udyam: udyam || undefined,
      bank: {
        accountNumber: compact(get('india.accountNumber')),
        ifsc: compact(get('india.ifsc')),
        holderName: get('india.accountHolderName').trim().replace(/\s+/g, ' '),
      },
    },
  }
}

/** ABCCD1234X -> XXXXX1234X: shows only the digits and the check letter */
export function maskPan(pan: string): string {
  return pan.length === 10 ? `XXXXX${pan.slice(5)}` : 'X'.repeat(pan.length)
}

/** 123456789012 -> XXXXXXXX9012: shows only the last 4 digits */
export function maskAccount(accountNumber: string): string {
  const visible = accountNumber.length > 4 ? 4 : 0

  return (
    'X'.repeat(accountNumber.length - visible) +
    accountNumber.slice(accountNumber.length - visible)
  )
}
