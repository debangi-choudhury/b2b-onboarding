import { AppGraphQLClient, ForbiddenError } from '@vtex/api'
import type { InstanceOptions, IOContext } from '@vtex/api'

export type TokenMode = 'ADMIN' | 'APP'

type Json = Record<string, unknown>

const LIST_REQUESTS = `query SpikeListRequests {
  getOrganizationRequests(page: 1, pageSize: 1) {
    pagination { total }
  }
}`

const CREATE_REQUEST = `mutation SpikeCreateRequest($input: OrganizationInput!) {
  createOrganizationRequest(input: $input, notifyUsers: false) {
    id
    status
  }
}`

const DECLINE_REQUEST = `mutation SpikeDeclineRequest($id: ID!, $notes: String) {
  updateOrganizationRequest(id: $id, status: "declined", notes: $notes, notifyUsers: false) {
    id
    status
    message
  }
}`

/**
 * Calls B2B Organizations' own GraphQL API, so organizations are created the
 * same way the native Admin screen creates them.
 */
export class B2BOrganizations extends AppGraphQLClient {
  constructor(ctx: IOContext, options?: InstanceOptions) {
    super('vtex.b2b-organizations-graphql@2.x', ctx, options)
  }

  public listRequests(mode: TokenMode) {
    return this.graphql.query<Json, Record<string, never>>(
      { query: LIST_REQUESTS, variables: {} },
      { headers: this.headersFor(mode), metric: 'b2b-org-spike-list' }
    )
  }

  public createRequest(mode: TokenMode, input: Record<string, unknown>) {
    return this.graphql.mutate<Json, { input: Record<string, unknown> }>(
      { mutate: CREATE_REQUEST, variables: { input } },
      { headers: this.headersFor(mode), metric: 'b2b-org-spike-create' }
    )
  }

  public declineRequest(mode: TokenMode, id: string, notes: string) {
    return this.graphql.mutate<Json, { id: string; notes: string }>(
      { mutate: DECLINE_REQUEST, variables: { id, notes } },
      { headers: this.headersFor(mode), metric: 'b2b-org-spike-decline' }
    )
  }

  private headersFor(mode: TokenMode): Record<string, string> {
    if (mode === 'APP') {
      return {}
    }

    const token = this.context.adminUserAuthToken

    if (!token) {
      throw new ForbiddenError('No admin session')
    }

    return {
      VtexIdclientAutCookie: token,
      cookie: `VtexIdclientAutCookie=${token}`,
    }
  }
}
