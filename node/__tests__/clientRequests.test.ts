import type { IOContext } from '@vtex/api'

import {
  AccountMasterData,
  MasterDataWriteError,
} from '../clients/accountMasterData'
import { B2BOrganizations } from '../clients/b2bOrganizations'
import { MasterDataFiles } from '../clients/masterDataFiles'

/*
 * What each client sends: paths, parameters and headers. The HTTP layer is a
 * stand-in, so nothing leaves the test.
 */

const context = (adminUserAuthToken?: string) =>
  ({
    account: 'acct',
    workspace: 'test',
    authToken: 'APP-TOKEN',
    adminUserAuthToken,
    region: 'aws-us-east-1',
    production: false,
    userAgent: 'test',
    operationId: 'op',
    requestId: 'req',
    platform: '',
    route: { id: '', params: {} },
    logger: { warn() {}, error() {}, info() {}, debug() {} },
  } as unknown as IOContext)

function withHttp<T extends object>(
  client: T,
  http: Record<string, jest.Mock>
) {
  Object.assign(client, { http })

  return client
}

describe('AccountMasterData', () => {
  it('uses the account host with the app token', () => {
    const client = new AccountMasterData(context())
    const { options } = client as unknown as {
      options: { headers: Record<string, string> }
    }

    expect(options.headers).toMatchObject({
      VtexIdclientAutCookie: 'APP-TOKEN',
      'X-Vtex-Use-Https': 'true',
    })
  })

  it('reads and writes schemas and documents on the expected paths', async () => {
    const http = {
      get: jest.fn().mockResolvedValue({}),
      put: jest.fn().mockResolvedValue({}),
      delete: jest.fn().mockResolvedValue({}),
    }

    const client = withHttp(new AccountMasterData(context()), http)

    await client.getSchema('entity', 'v1')
    await client.putSchema('entity', 'v1', { title: 'T' })
    await client.getDocument('entity', 'APP 1', ['id', 'status'])
    await client.putDocument('entity', 'APP 1', { a: 1 }, 'v1')
    await client.putDocument('entity', 'APP-2', { a: 1 })
    await client.deleteDocument('entity', 'APP 1')

    expect(http.get.mock.calls.map((c) => c[0])).toEqual([
      'entity/schemas/v1',
      'entity/documents/APP%201',
    ])
    expect(http.get.mock.calls[1][1].params).toEqual({ _fields: 'id,status' })
    expect(http.put.mock.calls.map((c) => [c[0], c[2].params])).toEqual([
      ['entity/schemas/v1', undefined],
      ['entity/documents/APP%201', { _schema: 'v1' }],
      ['entity/documents/APP-2', {}],
    ])
    expect(http.delete.mock.calls[0][0]).toBe('entity/documents/APP%201')
  })

  it('returns the new document ID, and uses no schema parameter without one', async () => {
    const post = jest.fn().mockResolvedValue({ DocumentId: 'doc-9' })
    const client = withHttp(new AccountMasterData(context()), { post })

    await expect(client.createDocument('entity', {})).resolves.toBe('doc-9')
    expect(post.mock.calls[0][2].params).toEqual({})
  })

  it('throws writes as an error with only the HTTP status, never the document', async () => {
    const failure = {
      message: 'Request failed',
      response: { status: 400 },
      config: { data: '{"pan":"ABCCD1231X"}' },
    }

    const client = withHttp(new AccountMasterData(context()), {
      post: jest.fn().mockRejectedValue(failure),
      put: jest.fn().mockRejectedValue({}),
    })

    const created = await client.createDocument('e', {}).catch((e) => e)

    expect(created).toBeInstanceOf(MasterDataWriteError)
    expect(created.message).toBe('Master Data create failed with HTTP 400')
    expect(created.response).toEqual({ status: 400 })
    expect(JSON.stringify(created)).not.toContain('ABCCD1231X')

    await expect(client.putDocument('e', 'id', {})).rejects.toThrow(
      'Master Data save failed'
    )
  })

  it('searches one page through REST-Range and reads the total from the answer', async () => {
    const getRaw = jest.fn().mockResolvedValue({
      data: [{ id: 'a' }, { id: 'b' }],
      headers: { 'rest-content-range': 'resources 20-21/42' },
    })

    const client = withHttp(new AccountMasterData(context()), { getRaw })

    const result = await client.search('entity', {
      fields: ['id'],
      where: 'status=IN_REVIEW',
      sort: 'submittedAt DESC',
      schema: 'v1',
      pagination: { page: 3, pageSize: 10 },
    })

    expect(result).toEqual({ data: [{ id: 'a' }, { id: 'b' }], total: 42 })
    expect(getRaw).toHaveBeenCalledWith('entity/search', {
      params: {
        _fields: 'id',
        _where: 'status=IN_REVIEW',
        _sort: 'submittedAt DESC',
        _schema: 'v1',
      },
      headers: { 'REST-Range': 'resources=20-29' },
      metric: 'amd-search',
    })
  })

  it('counts the rows when the answer has no range', async () => {
    const getRaw = jest.fn().mockResolvedValue({ data: [{}], headers: {} })
    const client = withHttp(new AccountMasterData(context()), { getRaw })

    await expect(
      client.search('entity', {
        fields: ['id'],
        pagination: { page: 1, pageSize: 5 },
      })
    ).resolves.toMatchObject({ total: 1 })
    expect(getRaw.mock.calls[0][1].params).toEqual({ _fields: 'id' })
  })
})

describe('MasterDataFiles', () => {
  it('downloads an attachment as a buffer with its type', async () => {
    const getRaw = jest.fn().mockResolvedValue({
      data: new Uint8Array([37, 80, 68, 70]).buffer,
      headers: { 'content-type': 'application/pdf' },
    })

    const client = withHttp(new MasterDataFiles(context()), { getRaw })
    const file = await client.download('BD', 'bd-1', 'file', 'a b.pdf')

    expect(file.data.toString()).toBe('%PDF')
    expect(file.contentType).toBe('application/pdf')
    expect(getRaw.mock.calls[0][0]).toBe(
      'BD/documents/bd-1/file/attachments/a%20b.pdf'
    )
  })

  it('falls back to a generic type and deletes by ID', async () => {
    const http = {
      getRaw: jest
        .fn()
        .mockResolvedValue({ data: new ArrayBuffer(0), headers: {} }),
      delete: jest.fn().mockResolvedValue(undefined),
    }

    const client = withHttp(new MasterDataFiles(context()), http)

    await expect(
      client.download('BD', 'x', 'file', 'y')
    ).resolves.toMatchObject({ contentType: 'application/octet-stream' })
    await client.deleteDocument('BD', 'bd-1')
    expect(http.delete.mock.calls[0][0]).toBe('BD/documents/bd-1')
  })
})

describe('B2BOrganizations', () => {
  function client(graphql: Record<string, jest.Mock>, token = 'ADMIN-TOKEN') {
    const b2b = new B2BOrganizations(context(token))

    Object.assign(b2b, { graphql })

    return b2b
  }

  it('sends the reviewer’s admin token, never the app token', async () => {
    const mutate = jest.fn().mockResolvedValue({
      data: { createOrganizationRequest: { id: 'req-1' } },
    })

    await expect(
      client({ mutate }).createRequest({ name: 'TEST' })
    ).resolves.toBe('req-1')
    expect(mutate.mock.calls[0][1].headers).toEqual({
      VtexIdclientAutCookie: 'ADMIN-TOKEN',
      cookie: 'VtexIdclientAutCookie=ADMIN-TOKEN',
    })
  })

  it('refuses to call without an admin session', async () => {
    const mutate = jest.fn()

    await expect(
      client({ mutate }, '').createRequest({ name: 'TEST' })
    ).rejects.toThrow('An admin session is required')
    expect(mutate).not.toHaveBeenCalled()
  })

  it('fails when no request ID comes back', async () => {
    const mutate = jest.fn().mockResolvedValue({ data: null })

    await expect(client({ mutate }).createRequest({})).rejects.toThrow(
      'returned no request ID'
    )
  })

  it('approves a request and passes on why it was refused', async () => {
    const mutate = jest
      .fn()
      .mockResolvedValueOnce({
        data: { updateOrganizationRequest: { status: 'success' } },
      })
      .mockResolvedValueOnce({
        data: {
          updateOrganizationRequest: {
            status: 'error',
            message: 'Duplicated name',
          },
        },
      })
      .mockResolvedValueOnce({
        data: { updateOrganizationRequest: { status: 'error' } },
      })
      .mockResolvedValueOnce({ data: null })

    const b2b = client({ mutate })

    await expect(b2b.approveRequest('req-1', 'notes')).resolves.toBeUndefined()
    expect(mutate.mock.calls[0][0].variables).toEqual({
      id: 'req-1',
      status: 'approved',
      notes: 'notes',
    })
    await expect(b2b.approveRequest('req-1', 'n')).rejects.toThrow(
      "didn't approve the request: Duplicated name"
    )
    await expect(b2b.approveRequest('req-1', 'n')).rejects.toThrow(': error')
    await expect(b2b.approveRequest('req-1', 'n')).rejects.toThrow(
      ': no response'
    )
  })

  it('reads a request’s status, or null when there is none', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce({
        data: { getOrganizationRequestById: { status: 'approved' } },
      })
      .mockResolvedValueOnce({ data: { getOrganizationRequestById: null } })

    const b2b = client({ query })

    await expect(b2b.requestStatus('req-1')).resolves.toBe('approved')
    await expect(b2b.requestStatus('req-2')).resolves.toBeNull()
  })
})
