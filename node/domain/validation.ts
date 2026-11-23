import type { IndiaField, IndiaValues } from './indiaIdentifiers'
import { INDIA, INDIA_FIELDS, validateIndia } from './indiaIdentifiers'
import type { ApplicationInput } from './types'

export interface FieldError {
  field: string
  /** Stable code the form turns into a translated message */
  code:
    | 'REQUIRED'
    | 'TOO_SHORT'
    | 'TOO_LONG'
    | 'INVALID_FORMAT'
    | 'REJECTED'
    /** A PAN whose holder type isn't a business, such as P for a person */
    | 'PAN_NOT_BUSINESS'
}

export type ValidationResult =
  | { ok: true; value: ApplicationInput }
  | { ok: false; errors: FieldError[] }

interface Rule {
  required?: boolean
  min?: number
  max: number
  pattern?: RegExp
}

const NAME = /^[^<>{}\\]*$/
const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9 ./-]*$/
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const PHONE = /^\+?[0-9 ()-]{6,}$/
const POSTAL_CODE = /^[A-Za-z0-9][A-Za-z0-9 -]*$/
const COUNTRY = /^[A-Z]{3}$/

const RULES: Record<string, Rule> = {
  companyName: { required: true, min: 2, max: 100, pattern: NAME },
  tradeName: { max: 100, pattern: NAME },
  registrationNumber: { required: true, min: 4, max: 30, pattern: IDENTIFIER },
  taxId: { max: 30, pattern: IDENTIFIER },
  'contact.firstName': { required: true, max: 50, pattern: NAME },
  'contact.lastName': { required: true, max: 50, pattern: NAME },
  'contact.email': { required: true, max: 254, pattern: EMAIL },
  'contact.phone': { max: 30, pattern: PHONE },
  'address.street': { required: true, max: 100, pattern: NAME },
  'address.number': { max: 20, pattern: NAME },
  'address.complement': { max: 100, pattern: NAME },
  'address.city': { required: true, max: 60, pattern: NAME },
  'address.state': { required: true, max: 40, pattern: NAME },
  'address.postalCode': {
    required: true,
    min: 3,
    max: 12,
    pattern: POSTAL_CODE,
  },
  'address.country': { required: true, max: 3, pattern: COUNTRY },
  'address.receiverName': { max: 100, pattern: NAME },
}

// Control characters, which have no place in any field
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u001f\u007f]/g

function clean(value: unknown): string {
  if (typeof value !== 'string') {
    return ''
  }

  return value.replace(CONTROL, ' ').replace(/\s+/g, ' ').trim()
}

function read(source: unknown, path: string): unknown {
  return path
    .split('.')
    .reduce<unknown>(
      (obj, key) =>
        obj && typeof obj === 'object'
          ? (obj as Record<string, unknown>)[key]
          : undefined,
      source
    )
}

/**
 * Validates and normalizes a submission from the public form. Everything
 * arriving here is untrusted. `website` is a honeypot field the form hides
 * from people, so bots that fill it in are rejected.
 */
export function validateApplication(raw: unknown): ValidationResult {
  const errors: FieldError[] = []
  const values: Record<string, string | undefined> = {}

  if (clean(read(raw, 'website'))) {
    return { ok: false, errors: [{ field: 'website', code: 'REJECTED' }] }
  }

  for (const [field, rule] of Object.entries(RULES)) {
    let value = clean(read(raw, field))

    if (field === 'address.country' || field === 'registrationNumber') {
      value = value.toUpperCase()
    }

    if (field === 'contact.email') {
      value = value.toLowerCase()
    }

    if (!value) {
      if (rule.required) {
        errors.push({ field, code: 'REQUIRED' })
      }

      values[field] = undefined
      continue
    }

    if (rule.min && value.length < rule.min) {
      errors.push({ field, code: 'TOO_SHORT' })
    } else if (value.length > rule.max) {
      errors.push({ field, code: 'TOO_LONG' })
    } else if (rule.pattern && !rule.pattern.test(value)) {
      errors.push({ field, code: 'INVALID_FORMAT' })
    }

    values[field] = value
  }

  // India identifiers only for applications from India. For other countries
  // they're ignored, even if sent.
  let india: IndiaValues | undefined

  if (values['address.country'] === INDIA) {
    const checked = validateIndia(
      Object.fromEntries(
        INDIA_FIELDS.map((field) => [field, clean(read(raw, field))])
      ) as Record<IndiaField, string>
    )

    if (checked.ok) {
      india = checked.value
    } else {
      errors.push(...checked.errors)
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors }
  }

  const v = (field: string) => values[field] as string

  return {
    ok: true,
    value: {
      companyName: v('companyName'),
      tradeName: values.tradeName,
      registrationNumber: v('registrationNumber'),
      taxId: values.taxId,
      contact: {
        firstName: v('contact.firstName'),
        lastName: v('contact.lastName'),
        email: v('contact.email'),
        phone: values['contact.phone'],
      },
      address: {
        street: v('address.street'),
        number: values['address.number'],
        complement: values['address.complement'],
        city: v('address.city'),
        state: v('address.state'),
        postalCode: v('address.postalCode'),
        country: v('address.country'),
        receiverName: values['address.receiverName'],
      },
      india,
    },
  }
}

const REASON_MIN = 10
const REASON_MAX = 500

/** A rejection reason is shown to the applicant, so it must say something. */
export function cleanReason(raw: unknown): string | null {
  const value = clean(raw)

  if (value.length < REASON_MIN || value.length > REASON_MAX) {
    return null
  }

  return value
}

const NOTE_MAX = 1000

/** Internal reviewer notes. Optional, never shown to the applicant. */
export function cleanNote(raw: unknown): string | null {
  const value = clean(raw)

  return value ? value.slice(0, NOTE_MAX) : null
}

const DECISION_NOTE_MIN = 10

/** A reviewer's note on a manual KYC decision: required, unlike other notes */
export function cleanDecisionNote(raw: unknown): string | null {
  const value = clean(raw)

  if (value.length < DECISION_NOTE_MIN || value.length > NOTE_MAX) {
    return null
  }

  return value
}
