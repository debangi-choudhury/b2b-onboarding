import { ExternalClient } from '@vtex/api'
import type { InstanceOptions, IOContext } from '@vtex/api'
import FormData from 'form-data'

/**
 * Master Data v1 documents and attachments, on the account's own host like
 * AccountMasterData (see there for why not api.vtex.com).
 */
export class MasterDataFiles extends ExternalClient {
  constructor(ctx: IOContext, options?: InstanceOptions) {
    super(
      `http://${ctx.account}.vtexcommercestable.com.br/api/dataentities`,
      ctx,
      {
        ...options,
        headers: {
          ...options?.headers,
          'X-Vtex-Use-Https': 'true',
          VtexIdclientAutCookie: ctx.authToken,
        },
      }
    )
  }

  public async createDocument(
    entity: string,
    fields: Record<string, unknown>
  ): Promise<string> {
    const result = await this.http.post<{ DocumentId: string }>(
      `${entity}/documents`,
      fields,
      {
        headers: { Accept: 'application/vnd.vtex.ds.v10+json' },
        metric: 'md-files-create',
      }
    )

    return result.DocumentId
  }

  public async upload(
    entity: string,
    id: string,
    field: string,
    file: { name: string; contentType: string; data: Buffer }
  ): Promise<void> {
    const form = new FormData()

    form.append(field, file.data, {
      filename: file.name,
      contentType: file.contentType,
      knownLength: file.data.length,
    })

    await this.http.post(
      `${entity}/documents/${id}/${field}/attachments`,
      form.getBuffer(),
      {
        headers: form.getHeaders(),
        metric: 'md-files-upload',
        timeout: 30000,
      }
    )
  }

  public async download(
    entity: string,
    id: string,
    field: string,
    name: string
  ): Promise<{ data: Buffer; contentType: string }> {
    const response = await this.http.getRaw<ArrayBuffer>(
      `${entity}/documents/${id}/${field}/attachments/${encodeURIComponent(
        name
      )}`,
      {
        responseType: 'arraybuffer',
        metric: 'md-files-download',
        timeout: 30000,
      }
    )

    return {
      data: Buffer.from(response.data),
      contentType: String(
        response.headers['content-type'] ?? 'application/octet-stream'
      ),
    }
  }

  public deleteDocument(entity: string, id: string) {
    return this.http.delete(`${entity}/documents/${id}`, {
      metric: 'md-files-delete',
    })
  }
}
