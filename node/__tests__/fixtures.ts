import { DEFAULT_STAGES } from '../domain/stages'
import type { Actor, Application, ApplicationInput } from '../domain/types'
import { newApplication } from '../domain/workflow'

export const NOW = new Date('2026-11-12T10:00:00.000Z')

export const REVIEWER: Actor = { type: 'REVIEWER', id: 'reviewer@example.com' }

export function validInput(overrides: Record<string, unknown> = {}) {
  return {
    companyName: 'TEST - Acme Industrial',
    tradeName: 'Acme',
    registrationNumber: 'us-123456',
    taxId: '12-3456789',
    contact: {
      firstName: 'Test',
      lastName: 'Applicant',
      email: 'Applicant@Example.com',
      phone: '+1 555 010 0100',
    },
    address: {
      street: 'TEST Demo Street',
      number: '1',
      city: 'New York',
      state: 'NY',
      postalCode: '10001',
      country: 'usa',
    },
    ...overrides,
  }
}

export const NORMALIZED_INPUT: ApplicationInput = {
  companyName: 'TEST - Acme Industrial',
  tradeName: 'Acme',
  registrationNumber: 'US-123456',
  taxId: '12-3456789',
  contact: {
    firstName: 'Test',
    lastName: 'Applicant',
    email: 'applicant@example.com',
    phone: '+1 555 010 0100',
  },
  address: {
    street: 'TEST Demo Street',
    number: '1',
    complement: undefined,
    city: 'New York',
    state: 'NY',
    postalCode: '10001',
    country: 'USA',
    receiverName: undefined,
  },
}

export function application(overrides: Partial<Application> = {}): Application {
  const { application: created } = newApplication(
    NORMALIZED_INPUT,
    DEFAULT_STAGES,
    { reference: 'APP-ABCDEFGH', tokenHash: 'a'.repeat(64) },
    NOW
  )

  return { id: 'app-1', ...created, ...overrides }
}
