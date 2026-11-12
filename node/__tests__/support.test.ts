import { reviewerFromToken } from '../domain/actor'
import { toOrganizationInput } from '../domain/organization'
import { RateLimiter } from '../domain/rateLimit'
import {
  hashToken,
  isReference,
  newReference,
  newStatusToken,
  tokenMatches,
} from '../domain/statusToken'
import { MockRegistryVerifier } from '../verification/mockRegistry'
import { application, NOW } from './fixtures'

describe('MockRegistryVerifier', () => {
  const verifier = new MockRegistryVerifier()
  const check = (registrationNumber: string) =>
    verifier.verify({ ...application(), registrationNumber }, NOW)

  it('fails numbers ending in 0 as not found', async () => {
    await expect(check('US-123450')).resolves.toMatchObject({
      status: 'FAILED',
      code: 'NOT_FOUND',
    })
  })

  it('fails numbers ending in 9 as dissolved', async () => {
    await expect(check('US-123459')).resolves.toMatchObject({
      status: 'FAILED',
      code: 'DISSOLVED',
    })
  })

  it('passes other numbers, with a stable reference', async () => {
    const first = await check('US-123456')
    const again = await check('us 123456')

    expect(first).toMatchObject({
      status: 'PASSED',
      code: 'ACTIVE',
      checkedAt: NOW.toISOString(),
    })
    expect(first.reference).toMatch(/^MOCK-[0-9A-F]{10}$/)
    expect(again.reference).toBe(first.reference)
  })
})

describe('status token', () => {
  it('makes readable references', () => {
    for (let i = 0; i < 50; i++) {
      expect(isReference(newReference())).toBe(true)
    }

    expect(isReference('APP-0000000O')).toBe(false)
    expect(isReference('APP-ABC')).toBe(false)
  })

  it('matches only the right token', () => {
    const token = newStatusToken()
    const hash = hashToken(token)

    expect(hash).toMatch(/^[0-9a-f]{64}$/)
    expect(tokenMatches(token, hash)).toBe(true)
    expect(tokenMatches(newStatusToken(), hash)).toBe(false)
    expect(tokenMatches('', hash)).toBe(false)
    expect(tokenMatches(token, '')).toBe(false)
  })
})

describe('RateLimiter', () => {
  it('allows up to the limit per window, then resets', () => {
    const limiter = new RateLimiter(2, 1000)

    expect(limiter.allow('ip', 0)).toBe(true)
    expect(limiter.allow('ip', 10)).toBe(true)
    expect(limiter.allow('ip', 20)).toBe(false)
    expect(limiter.allow('other', 20)).toBe(true)
    expect(limiter.allow('ip', 1000)).toBe(true)
  })
})

describe('reviewerFromToken', () => {
  const token = (claims: object) =>
    `x.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.y`

  it('reads the email from the token', () => {
    expect(reviewerFromToken(token({ sub: 'reviewer@example.com' }))).toEqual({
      type: 'REVIEWER',
      id: 'reviewer@example.com',
    })
  })

  it('falls back for missing or broken tokens', () => {
    for (const t of [undefined, '', 'not-a-jwt', 'x.!!!.y', token({})]) {
      expect(reviewerFromToken(t).id).toBe('unknown reviewer')
    }
  })
})

describe('toOrganizationInput', () => {
  it('fills the native request fields from the application', () => {
    expect(toOrganizationInput(application())).toEqual({
      name: 'TEST - Acme Industrial',
      tradeName: 'Acme',
      b2bCustomerAdmin: {
        firstName: 'Test',
        lastName: 'Applicant',
        email: 'applicant@example.com',
      },
      defaultCostCenter: {
        name: 'TEST - Acme Industrial HQ',
        phoneNumber: '+1 555 010 0100',
        businessDocument: '12-3456789',
        address: {
          addressType: 'commercial',
          receiverName: 'Test Applicant',
          street: 'TEST Demo Street',
          number: '1',
          complement: undefined,
          city: 'New York',
          state: 'NY',
          postalCode: '10001',
          country: 'USA',
        },
      },
    })
  })

  it('uses the registration number when there is no tax ID', () => {
    const input = toOrganizationInput(application({ taxId: undefined }))

    expect(input.defaultCostCenter.businessDocument).toBe('US-123456')
  })
})
