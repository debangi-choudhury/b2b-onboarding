import { AppGraphQLClient, AuthenticationError } from '@vtex/api'
import type { InstanceOptions, IOContext } from '@vtex/api'

type Json = Record<string, unknown>

const CREATE_REQUEST = `mutation CreateOrganizationRequest($input: OrganizationInput!) {
  createOrganizationRequest(input: $input, notifyUsers: false) {
    id
    status
  }
}`

const UPDATE_REQUEST = `mutation UpdateOrganizationRequest($id: ID!, $status: String!, $notes: String) {
  updateOrganizationRequest(id: $id, status: $status, notes: $notes, notifyUsers: true) {
    id
    status
    message
  }
}`

const GET_REQUEST = `query GetOrganizationRequest($id: ID!) {
  getOrganizationRequestById(id: $id) {
    id
    status
  }
}`

interface CreateResponse {
  createOrganizationRequest: { id: string; status: string } | null
}

interface UpdateResponse {
  updateOrganizationRequest: {
    id: string | null
    status: string
    message: string
  } | null
}

interface GetResponse {
  getOrganizationRequestById: { id: string; status: string } | null
}

/**
 * B2B Organizations' own GraphQL API. Organizations are created exactly as
 * the native Admin screen creates them, so roles, cost centers and emails work
 * as usual.
 *
 * Every call carries the reviewer's admin token. B2B Organizations refuses the
 * app token ("No token was provided"), so the app can never approve anything
 * on its own authority. Tested in the Phase 1 spike, see B2B-C11-PLAN.md.
 */
export class B2BOrganizations extends AppGraphQLClient {
  constructor(ctx: IOContext, options?: InstanceOptions) {
    super('vtex.b2b-organizations-graphql@2.x', ctx, options)
  }

  public async createRequest(input: Json): Promise<string> {
    const result = await this.graphql.mutate<CreateResponse, { input: Json }>(
      { mutate: CREATE_REQUEST, variables: { input } },
      {
        headers: this.adminHeaders(),
        metric: 'b2b-org-create-request',
        // A retry after a timeout could create a second request, and so a
        // second organization. The caller saves the ID and reuses it instead.
        retries: 0,
      }
    )

    const id = result.data?.createOrganizationRequest?.id

    if (!id) {
      throw new Error('B2B Organizations returned no request ID')
    }

    return id
  }

  public async approveRequest(id: string, notes: string): Promise<void> {
    const result = await this.graphql.mutate<
      UpdateResponse,
      { id: string; status: string; notes: string }
    >(
      { mutate: UPDATE_REQUEST, variables: { id, status: 'approved', notes } },
      { headers: this.adminHeaders(), metric: 'b2b-org-approve-request' }
    )

    const status = result.data?.updateOrganizationRequest?.status

    if (status !== 'success') {
      throw new Error(
        `B2B Organizations didn't approve the request: ${
          result.data?.updateOrganizationRequest?.message ||
          status ||
          'no response'
        }`
      )
    }
  }

  public async requestStatus(id: string): Promise<string | null> {
    const result = await this.graphql.query<GetResponse, { id: string }>(
      { query: GET_REQUEST, variables: { id } },
      { headers: this.adminHeaders(), metric: 'b2b-org-get-request' }
    )

    return result.data?.getOrganizationRequestById?.status ?? null
  }

  private adminHeaders(): Record<string, string> {
    const token = this.context.adminUserAuthToken

    if (!token) {
      throw new AuthenticationError('An admin session is required')
    }

    return {
      VtexIdclientAutCookie: token,
      cookie: `VtexIdclientAutCookie=${token}`,
    }
  }
}
