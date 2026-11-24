import { defineMessages } from 'react-intl'
import type { IntlShape, MessageDescriptor } from 'react-intl'

// Names for the ISO codes in COUNTRIES. The form still sends the code.
export const countryNames: Record<string, MessageDescriptor> = defineMessages({
  USA: {
    id: 'store/b2b-onboarding.country.USA',
    defaultMessage: 'United States',
  },
  CAN: { id: 'store/b2b-onboarding.country.CAN', defaultMessage: 'Canada' },
  MEX: { id: 'store/b2b-onboarding.country.MEX', defaultMessage: 'Mexico' },
  BRA: { id: 'store/b2b-onboarding.country.BRA', defaultMessage: 'Brazil' },
  GBR: {
    id: 'store/b2b-onboarding.country.GBR',
    defaultMessage: 'United Kingdom',
  },
  DEU: { id: 'store/b2b-onboarding.country.DEU', defaultMessage: 'Germany' },
  FRA: { id: 'store/b2b-onboarding.country.FRA', defaultMessage: 'France' },
  ESP: { id: 'store/b2b-onboarding.country.ESP', defaultMessage: 'Spain' },
  ITA: { id: 'store/b2b-onboarding.country.ITA', defaultMessage: 'Italy' },
  IND: { id: 'store/b2b-onboarding.country.IND', defaultMessage: 'India' },
})

/** The country's name, or the code itself when there's no name for it */
export function countryName(
  intl: IntlShape,
  code: string | undefined,
  names: Record<string, MessageDescriptor> = countryNames
) {
  const message = code ? names[code] : undefined

  return message ? intl.formatMessage(message) : code ?? ''
}
