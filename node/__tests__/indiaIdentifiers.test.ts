import { readFileSync } from 'fs'
import { join } from 'path'

import type { IndiaField } from '../domain/indiaIdentifiers'
import {
  BUSINESS_PAN_TYPES,
  checkIndiaField,
  checkPan,
  parseYesNo,
  validateIndia,
} from '../domain/indiaIdentifiers'
import { validateApplication } from '../domain/validation'
import { validInput } from './fixtures'

// Fake identifiers that only satisfy the formats
const INDIA_FORM: Record<IndiaField, string> = {
  'india.pan': 'ABCCD1231X',
  'india.importsOrExports': 'yes',
  'india.iec': 'ABCDE12341',
  'india.udyam': 'UDYAM-MH-01-0012341',
  'india.accountNumber': '123456789011',
  'india.ifsc': 'TEST0001234',
  'india.accountHolderName': 'TEST - KYC Demo Pvt Ltd',
}

/** The form's fields as the multipart parser nests them: india.pan -> { india: { pan } } */
function nested(form: Partial<Record<IndiaField, string>>) {
  return Object.fromEntries(
    Object.entries(form).map(([field, value]) => [field.split('.')[1], value])
  )
}

function indianApplication(form: Partial<Record<IndiaField, string>> = {}) {
  return validInput({
    companyName: 'TEST - KYC Demo Pvt Ltd',
    address: { ...validInput().address, country: 'ind' },
    india: nested({ ...INDIA_FORM, ...form }),
  })
}

describe('the browser copy', () => {
  it('is identical to the server rules', () => {
    const read = (path: string) =>
      readFileSync(join(__dirname, '..', '..', path), 'utf8').replace(
        /\r\n/g,
        '\n'
      )

    expect(read('react/utils/indiaIdentifiers.ts')).toBe(
      read('node/domain/indiaIdentifiers.ts')
    )
  })
})

describe('PAN', () => {
  it.each(BUSINESS_PAN_TYPES)('accepts holder type %s', (type) => {
    expect(checkPan(`ABC${type}D1234X`)).toBeNull()
  })

  it("refuses an individual's PAN, with its own message", () => {
    expect(checkPan('ABCPD1234X')).toBe('PAN_NOT_BUSINESS')
  })

  it('refuses other holder types too', () => {
    expect(checkPan('ABCKD1234X')).toBe('PAN_NOT_BUSINESS')
  })

  it.each([
    ['too short', 'ABCCD123X'],
    ['too long', 'ABCCD12345X'],
    ['digits in the letter part', 'AB1CD1234X'],
    ['letters in the digit part', 'ABCCD12A4X'],
    ['a digit at the end', 'ABCCD12345'],
    ['symbols', 'ABCCD-1234X'],
  ])('refuses one that is %s', (_, pan) => {
    expect(checkPan(pan)).toBe('INVALID_FORMAT')
  })

  it('accepts lowercase and spaces, as typed', () => {
    expect(checkPan(' abccd 1234 x ')).toBeNull()
  })

  it('is required', () => {
    expect(checkPan('  ')).toBe('REQUIRED')
  })
})

describe('IEC', () => {
  const check = (value: string, importsOrExports = true) =>
    checkIndiaField('india.iec', value, importsOrExports)

  it('accepts 10 letters or digits', () => {
    expect(check('ABCDE12341')).toBeNull()
    expect(check('0123456789')).toBeNull()
  })

  it.each(['ABCDE1234', 'ABCDE123412', 'ABCDE-1234'])('refuses %s', (iec) => {
    expect(check(iec)).toBe('INVALID_FORMAT')
  })

  it('is required for importers and exporters only', () => {
    expect(check('')).toBe('REQUIRED')
    expect(check('', false)).toBeNull()
  })

  it("isn't checked for businesses that don't import or export", () => {
    expect(check('nonsense', false)).toBeNull()
  })
})

describe('Udyam', () => {
  const check = (value: string) => checkIndiaField('india.udyam', value, false)

  it('accepts UDYAM-XX-00-0000000', () => {
    expect(check('UDYAM-MH-01-0012345')).toBeNull()
    expect(check('udyam-mh-01-0012345')).toBeNull()
  })

  it.each([
    'UDYAM-MH-1-0012345',
    'UDYAM-MH-01-001234',
    'UDYAM-M1-01-0012345',
    'UDYOG-MH-01-0012345',
    'UDYAMMH010012345',
  ])('refuses %s', (udyam) => {
    expect(check(udyam)).toBe('INVALID_FORMAT')
  })

  it('is optional', () => {
    expect(check('')).toBeNull()
  })
})

describe('bank account', () => {
  const account = (value: string) =>
    checkIndiaField('india.accountNumber', value, false)

  const ifsc = (value: string) => checkIndiaField('india.ifsc', value, false)

  const holder = (value: string) =>
    checkIndiaField('india.accountHolderName', value, false)

  it('accepts account numbers of 9 to 18 digits', () => {
    expect(account('123456789')).toBeNull()
    expect(account('123456789012345678')).toBeNull()
    expect(account('1234 5678 9012')).toBeNull()
  })

  it.each(['12345678', '1234567890123456789', '12345678A', '-123456789'])(
    'refuses account number %s',
    (value) => {
      expect(account(value)).toBe('INVALID_FORMAT')
    }
  )

  it('accepts an IFSC with a zero in 5th place', () => {
    expect(ifsc('TEST0001234')).toBeNull()
    expect(ifsc('test0ab12cd')).toBeNull()
  })

  it.each(['TEST1001234', 'TES00001234', 'TEST000123', 'TEST00012345'])(
    'refuses IFSC %s',
    (value) => {
      expect(ifsc(value)).toBe('INVALID_FORMAT')
    }
  )

  it('needs an account holder name of 2 to 100 safe characters', () => {
    expect(holder('TEST - KYC Demo Pvt Ltd')).toBeNull()
    expect(holder('')).toBe('REQUIRED')
    expect(holder('A')).toBe('TOO_SHORT')
    expect(holder('A'.repeat(101))).toBe('TOO_LONG')
    expect(holder('<script>')).toBe('INVALID_FORMAT')
  })

  it('requires all three', () => {
    expect(account('')).toBe('REQUIRED')
    expect(ifsc('')).toBe('REQUIRED')
  })
})

describe('import or export answer', () => {
  it('reads yes, no, and empty as no', () => {
    expect(parseYesNo('yes')).toBe(true)
    expect(parseYesNo(' YES ')).toBe(true)
    expect(parseYesNo('no')).toBe(false)
    expect(parseYesNo('')).toBe(false)
  })

  it('refuses anything else', () => {
    expect(parseYesNo('maybe')).toBeNull()
    expect(checkIndiaField('india.importsOrExports', 'true', false)).toBe(
      'INVALID_FORMAT'
    )
  })
})

describe('validateIndia', () => {
  it('normalizes every value', () => {
    const result = validateIndia({
      ...INDIA_FORM,
      'india.pan': 'abccd 1231 x',
      'india.iec': 'abcde12341',
      'india.accountNumber': '1234 5678 9011',
      'india.ifsc': 'test0001234',
      'india.accountHolderName': '  TEST -  KYC Demo Pvt Ltd ',
    })

    expect(result).toEqual({
      ok: true,
      value: {
        pan: 'ABCCD1231X',
        importsOrExports: true,
        iec: 'ABCDE12341',
        udyam: 'UDYAM-MH-01-0012341',
        bank: {
          accountNumber: '123456789011',
          ifsc: 'TEST0001234',
          holderName: 'TEST - KYC Demo Pvt Ltd',
        },
      },
    })
  })

  it("drops the IEC of a business that doesn't import or export", () => {
    const result = validateIndia({
      ...INDIA_FORM,
      'india.importsOrExports': 'no',
    })

    expect(result.ok && result.value.iec).toBeUndefined()
    expect(result.ok && result.value.importsOrExports).toBe(false)
  })

  it('leaves an empty Udyam number undefined', () => {
    const result = validateIndia({ ...INDIA_FORM, 'india.udyam': ' ' })

    expect(result.ok && result.value.udyam).toBeUndefined()
  })

  it('reports every problem at once', () => {
    const result = validateIndia({})

    expect(result.ok ? [] : result.errors).toEqual([
      { field: 'india.pan', code: 'REQUIRED' },
      { field: 'india.accountNumber', code: 'REQUIRED' },
      { field: 'india.ifsc', code: 'REQUIRED' },
      { field: 'india.accountHolderName', code: 'REQUIRED' },
    ])
  })
})

describe('validateApplication with India identifiers', () => {
  it('checks and stores them when the country is India', () => {
    const result = validateApplication(indianApplication())

    expect(result.ok && result.value.address.country).toBe('IND')
    expect(result.ok && result.value.india).toMatchObject({
      pan: 'ABCCD1231X',
      iec: 'ABCDE12341',
      bank: { accountNumber: '123456789011' },
    })
  })

  it('requires them when the country is India', () => {
    const result = validateApplication(
      validInput({ address: { ...validInput().address, country: 'IND' } })
    )

    expect(result.ok ? [] : result.errors.map((e) => e.field)).toEqual([
      'india.pan',
      'india.accountNumber',
      'india.ifsc',
      'india.accountHolderName',
    ])
  })

  it("refuses an individual's PAN", () => {
    const result = validateApplication(
      indianApplication({ 'india.pan': 'ABCPD1234X' })
    )

    expect(result.ok ? [] : result.errors).toEqual([
      { field: 'india.pan', code: 'PAN_NOT_BUSINESS' },
    ])
  })

  it('reports India problems together with the other fields', () => {
    const result = validateApplication({
      ...indianApplication({ 'india.ifsc': 'nope' }),
      companyName: '',
    })

    expect(result.ok ? [] : result.errors).toEqual([
      { field: 'companyName', code: 'REQUIRED' },
      { field: 'india.ifsc', code: 'INVALID_FORMAT' },
    ])
  })

  it('ignores them for other countries, even if sent', () => {
    const result = validateApplication({
      ...validInput(),
      india: nested({ 'india.pan': 'not a pan' }),
    })

    expect(result.ok).toBe(true)
    expect(result.ok && result.value.india).toBeUndefined()
  })

  it('ignores non-string values instead of trusting them', () => {
    const result = validateApplication(
      validInput({
        address: { ...validInput().address, country: 'IND' },
        india: { ...nested(INDIA_FORM), pan: { $ne: null } },
      })
    )

    expect(result.ok ? [] : result.errors).toEqual([
      { field: 'india.pan', code: 'REQUIRED' },
    ])
  })
})
