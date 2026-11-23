import { ExternalClient } from '@vtex/api'
import type { InstanceOptions, IOContext } from '@vtex/api'

interface Pagination {
  page: number
  pageSize: number
}

/**
 * Master Data through the account's own host, {account}.vtexcommercestable.com.br.
 *
 * VTEX documents the ADMIN_DS policy for this host, while @vtex/api's built-in
 * MasterData client calls api.vtex.com, so this client keeps to the documented
 * host.
 *
 * Note from 2026-11-12: after the app's first install in a workspace, every
 * Master Data call got 403 ("Forbidden", "Cannot read private fields") for
 * about 15 to 17 minutes, on either host, until its policies took effect.
 * Linked apps don't show this. Wait before testing a fresh install.
 */
export class AccountMasterData extends ExternalClient {
  constructor(ctx: IOContext, options?: InstanceOptions) {
    super(
      `http://${ctx.account}.vtexcommercestable.com.br/api/dataentities`,
      ctx,
      {
        ...options,
        headers: {
          ...options?.headers,
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'X-Vtex-Use-Https': 'true',
          VtexIdclientAutCookie: ctx.authToken,
        },
      }
    )
  }

  public getSchema<T>(entity: string, schema: string) {
    return this.http.get<T>(`${entity}/schemas/${schema}`, {
      metric: 'amd-get-schema',
    })
  }

  public putSchema(entity: string, schema: string, body: object) {
    return this.http.put(`${entity}/schemas/${schema}`, body, {
      metric: 'amd-put-schema',
    })
  }

  public getDocument<T>(entity: string, id: string, fields: string[]) {
    return this.http.get<T>(`${entity}/documents/${encodeURIComponent(id)}`, {
      params: { _fields: fields.join(',') },
      metric: 'amd-get',
    })
  }

  public async createDocument(
    entity: string,
    fields: object,
    schema?: string
  ): Promise<string> {
    const result = await this.http.post<{ DocumentId: string }>(
      `${entity}/documents`,
      fields,
      { params: schema ? { _schema: schema } : {}, metric: 'amd-create' }
    )

    return result.DocumentId
  }

  /** Creates or replaces a whole document under the given ID */
  public putDocument(
    entity: string,
    id: string,
    fields: object,
    schema?: string
  ) {
    return this.http.put(
      `${entity}/documents/${encodeURIComponent(id)}`,
      fields,
      {
        params: schema ? { _schema: schema } : {},
        metric: 'amd-put',
      }
    )
  }

  public deleteDocument(entity: string, id: string) {
    return this.http.delete(`${entity}/documents/${encodeURIComponent(id)}`, {
      metric: 'amd-delete',
    })
  }

  public async search<T>(
    entity: string,
    input: {
      fields: string[]
      where?: string
      sort?: string
      schema?: string
      pagination: Pagination
    }
  ): Promise<{ data: T[]; total: number }> {
    const from = (input.pagination.page - 1) * input.pagination.pageSize
    const to = from + input.pagination.pageSize - 1

    const response = await this.http.getRaw<T[]>(`${entity}/search`, {
      params: {
        _fields: input.fields.join(','),
        ...(input.where ? { _where: input.where } : {}),
        ...(input.sort ? { _sort: input.sort } : {}),
        ...(input.schema ? { _schema: input.schema } : {}),
      },
      headers: { 'REST-Range': `resources=${from}-${to}` },
      metric: 'amd-search',
    })

    // REST-Content-Range: resources 0-19/42
    const range = String(response.headers['rest-content-range'] ?? '')
    const total = Number(range.split('/')[1]) || response.data.length

    return { data: response.data, total }
  }
}
