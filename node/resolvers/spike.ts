import { AuthenticationError, ForbiddenError } from '@vtex/api'

import type { TokenMode } from '../clients/b2bOrganizations'

const SPIKE_WORKSPACE = 'b2bdev'

interface SpikeResult {
  ok: boolean
  tokenMode: TokenMode
  status?: number
  message?: string
  data?: string
}

function guard(ctx: Context) {
  if (ctx.vtex.workspace !== SPIKE_WORKSPACE) {
    throw new ForbiddenError(`The spike only runs in ${SPIKE_WORKSPACE}`)
  }

  if (!ctx.vtex.adminUserAuthToken) {
    throw new AuthenticationError('Admin session required')
  }
}

async function run(
  tokenMode: TokenMode,
  call: () => Promise<{ data?: unknown }>
): Promise<SpikeResult> {
  try {
    const result = await call()

    return { ok: true, tokenMode, data: JSON.stringify(result.data) }
  } catch (e) {
    const err = e as {
      message?: string
      response?: { status?: number; data?: unknown }
      graphQLErrors?: unknown
    }

    const detail = err.response?.data ?? err.graphQLErrors ?? null

    return {
      ok: false,
      tokenMode,
      status: err.response?.status,
      message: err.message,
      data: detail ? JSON.stringify(detail).slice(0, 1500) : undefined,
    }
  }
}

const TEST_REQUEST = {
  name: 'TEST - Permission spike',
  tradeName: 'TEST Permission spike (B2B-C11)',
  b2bCustomerAdmin: {
    firstName: 'Test',
    lastName: 'Spike',
    email: 'b2b-c11-spike@example.com',
  },
  defaultCostCenter: {
    name: 'TEST - Permission spike HQ',
    businessDocument: 'TEST-SPIKE-0001',
    address: {
      addressType: 'commercial',
      receiverName: 'TEST Receiving',
      postalCode: '10001',
      country: 'USA',
      state: 'NY',
      city: 'New York',
      street: 'TEST Demo Street',
      number: '1',
    },
  },
}

export const spikeQueries = {
  spikeListOrganizationRequests: (
    _: unknown,
    { tokenMode }: { tokenMode: TokenMode },
    ctx: Context
  ) => {
    guard(ctx)

    return run(tokenMode, () =>
      ctx.clients.b2bOrganizations.listRequests(tokenMode)
    )
  },
}

export const spikeMutations = {
  spikeCreateOrganizationRequest: (
    _: unknown,
    { tokenMode }: { tokenMode: TokenMode },
    ctx: Context
  ) => {
    guard(ctx)

    return run(tokenMode, () =>
      ctx.clients.b2bOrganizations.createRequest(tokenMode, TEST_REQUEST)
    )
  },

  spikeDeclineOrganizationRequest: (
    _: unknown,
    { id, tokenMode }: { id: string; tokenMode: TokenMode },
    ctx: Context
  ) => {
    guard(ctx)

    return run(tokenMode, () =>
      ctx.clients.b2bOrganizations.declineRequest(
        tokenMode,
        id,
        'B2B-C11 permission spike: test request, declined automatically'
      )
    )
  },
}
