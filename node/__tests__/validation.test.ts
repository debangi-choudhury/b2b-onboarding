import {
  cleanNote,
  cleanReason,
  validateApplication,
} from '../domain/validation'
import { NORMALIZED_INPUT, validInput } from './fixtures'

describe('validateApplication', () => {
  it('accepts a valid application and normalizes it', () => {
    const result = validateApplication(validInput())

    expect(result).toEqual({ ok: true, value: NORMALIZED_INPUT })
  })

  it('trims and collapses whitespace, and strips control characters', () => {
    const result = validateApplication(
      validInput({ companyName: '  TEST -\u0000 Acme \n\t Industrial  ' })
    )

    expect(result.ok && result.value.companyName).toBe('TEST - Acme Industrial')
  })

  it('reports every missing required field', () => {
    const result = validateApplication({})

    expect(result.ok).toBe(false)
    const fields = result.ok ? [] : result.errors.map((e) => e.field)

    expect(fields).toEqual(
      expect.arrayContaining([
        'companyName',
        'registrationNumber',
        'contact.firstName',
        'contact.lastName',
        'contact.email',
        'address.street',
        'address.city',
        'address.state',
        'address.postalCode',
        'address.country',
      ])
    )
    expect(
      result.ok ? [] : result.errors.every((e) => e.code === 'REQUIRED')
    ).toBe(true)
  })

  it.each([
    [
      'contact.email',
      { contact: { ...validInput().contact, email: 'not-an-email' } },
      'INVALID_FORMAT',
    ],
    [
      'address.country',
      { address: { ...validInput().address, country: 'US' } },
      'INVALID_FORMAT',
    ],
    ['registrationNumber', { registrationNumber: 'AB<1>' }, 'INVALID_FORMAT'],
    ['registrationNumber', { registrationNumber: 'AB1' }, 'TOO_SHORT'],
    ['companyName', { companyName: 'x'.repeat(101) }, 'TOO_LONG'],
    ['companyName', { companyName: '<script>' }, 'INVALID_FORMAT'],
    [
      'contact.phone',
      { contact: { ...validInput().contact, phone: 'call me' } },
      'INVALID_FORMAT',
    ],
  ])('rejects a bad %s', (field, overrides, code) => {
    const result = validateApplication(validInput(overrides))

    expect(result.ok).toBe(false)
    expect(result.ok ? [] : result.errors).toContainEqual({ field, code })
  })

  it('ignores non-string values instead of trusting them', () => {
    const result = validateApplication(
      validInput({ companyName: { $ne: null } })
    )

    expect(result.ok ? [] : result.errors).toContainEqual({
      field: 'companyName',
      code: 'REQUIRED',
    })
  })

  it('rejects submissions that fill in the honeypot field', () => {
    const result = validateApplication(
      validInput({ website: 'http://spam.example' })
    )

    expect(result).toEqual({
      ok: false,
      errors: [{ field: 'website', code: 'REJECTED' }],
    })
  })

  it('leaves optional fields undefined when empty', () => {
    const result = validateApplication(
      validInput({ tradeName: '   ', taxId: '' })
    )

    expect(result.ok && result.value.tradeName).toBeUndefined()
    expect(result.ok && result.value.taxId).toBeUndefined()
  })
})

describe('cleanReason', () => {
  it('needs 10 to 500 characters', () => {
    expect(cleanReason('Too short')).toBeNull()
    expect(cleanReason(` ${'x'.repeat(10)} `)).toBe('x'.repeat(10))
    expect(cleanReason('x'.repeat(501))).toBeNull()
    expect(cleanReason(undefined)).toBeNull()
  })
})

describe('cleanNote', () => {
  it('is optional and capped at 1000 characters', () => {
    expect(cleanNote('')).toBeNull()
    expect(cleanNote('x'.repeat(1200))).toHaveLength(1000)
  })
})
