import service from '..'
import { Clients } from '../clients'
import { AccountMasterData } from '../clients/accountMasterData'
import { B2BOrganizations } from '../clients/b2bOrganizations'
import { MasterDataFiles } from '../clients/masterDataFiles'
import { reviewMutations, reviewQueries } from '../resolvers/review'

describe('service', () => {
  const { config } = service as unknown as {
    config: {
      routes: Record<string, unknown>
      graphql: { resolvers: Record<string, Record<string, unknown>> }
      clients: { options: { default: { retries: number; timeout: number } } }
    }
  }

  it('exposes only the two public applicant routes', () => {
    expect(
      Object.keys(config.routes).sort((a, b) => a.localeCompare(b))
    ).toEqual(['apply', 'status'])
  })

  it('wires every review query and mutation', () => {
    expect(
      Object.keys(config.graphql.resolvers.Query).sort((a, b) =>
        a.localeCompare(b)
      )
    ).toEqual(Object.keys(reviewQueries).sort((a, b) => a.localeCompare(b)))
    expect(
      Object.keys(config.graphql.resolvers.Mutation).sort((a, b) =>
        a.localeCompare(b)
      )
    ).toEqual(Object.keys(reviewMutations).sort((a, b) => a.localeCompare(b)))
  })

  it('retries once by default and times out after 15 seconds', () => {
    expect(config.clients.options.default).toEqual({
      retries: 1,
      timeout: 15000,
    })
  })

  it('builds each client once per request', () => {
    // The VTEX IO runtime defines this global; IOClients passes it to every client
    Object.assign(global, { metrics: {} })

    const clients = new Clients({}, {
      account: 'acct',
      workspace: 'test',
      authToken: 'APP-TOKEN',
      region: 'aws-us-east-1',
      production: false,
      userAgent: 'test',
      operationId: 'op',
      requestId: 'req',
      platform: '',
      route: { id: '', params: {} },
      logger: { warn() {}, error() {}, info() {}, debug() {} },
    } as never)

    expect(clients.accountMasterData).toBeInstanceOf(AccountMasterData)
    expect(clients.masterDataFiles).toBeInstanceOf(MasterDataFiles)
    expect(clients.b2bOrganizations).toBeInstanceOf(B2BOrganizations)
    expect(clients.accountMasterData).toBe(clients.accountMasterData)
  })
})
