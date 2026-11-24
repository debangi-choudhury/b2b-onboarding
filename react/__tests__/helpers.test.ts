import { createIntl } from 'react-intl'

import { countryName, countryNames } from '../utils/countries'
import { COUNTRIES } from '../utils/fields'
import { normalizeRootPath } from '../utils/rootPath'

const intl = createIntl({ locale: 'en', messages: {} })

describe('normalizeRootPath', () => {
  it.each([
    [undefined, ''],
    ['', ''],
    ['/', ''],
    ['/us', '/us'],
    ['/us/', '/us'],
  ])('turns %p into %p', (input, expected) => {
    expect(normalizeRootPath(input)).toBe(expected)
  })
})

describe('countryName', () => {
  it('has a name for every country in the form', () => {
    COUNTRIES.forEach((code) => {
      expect(countryNames[code]).toBeDefined()
    })
  })

  it('shows the name instead of the code', () => {
    expect(countryName(intl, 'IND')).toBe('India')
    expect(countryName(intl, 'USA')).toBe('United States')
  })

  it('falls back to the code, or nothing', () => {
    expect(countryName(intl, 'XYZ')).toBe('XYZ')
    expect(countryName(intl, undefined)).toBe('')
  })
})
