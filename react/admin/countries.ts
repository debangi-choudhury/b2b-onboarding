import { defineMessages } from 'react-intl'
import type { MessageDescriptor } from 'react-intl'

// The Admin's own copy of the country names, so it reads admin/ messages.
export const adminCountryNames: Record<string, MessageDescriptor> =
  defineMessages({
    USA: {
      id: 'admin/b2b-onboarding.country.USA',
      defaultMessage: 'United States',
    },
    CAN: { id: 'admin/b2b-onboarding.country.CAN', defaultMessage: 'Canada' },
    MEX: { id: 'admin/b2b-onboarding.country.MEX', defaultMessage: 'Mexico' },
    BRA: { id: 'admin/b2b-onboarding.country.BRA', defaultMessage: 'Brazil' },
    GBR: {
      id: 'admin/b2b-onboarding.country.GBR',
      defaultMessage: 'United Kingdom',
    },
    DEU: { id: 'admin/b2b-onboarding.country.DEU', defaultMessage: 'Germany' },
    FRA: { id: 'admin/b2b-onboarding.country.FRA', defaultMessage: 'France' },
    ESP: { id: 'admin/b2b-onboarding.country.ESP', defaultMessage: 'Spain' },
    ITA: { id: 'admin/b2b-onboarding.country.ITA', defaultMessage: 'Italy' },
    IND: { id: 'admin/b2b-onboarding.country.IND', defaultMessage: 'India' },
  })
