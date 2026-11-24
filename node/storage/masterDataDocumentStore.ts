import { randomUUID } from 'crypto'

import type { MasterDataFiles } from '../clients/masterDataFiles'
import type { DocumentStore } from './documentStore'

/**
 * Master Data v1 entity "BD", created in the legacy Master Data screen for the
 * Phase 0 attachment test (v1 entities can't be created through the API).
 * Fields: applicationId (Varchar 100), kind (Varchar 50) and file (File).
 * Nothing is readable or writable without credentials.
 *
 * A dedicated entity "OB" was planned, but the legacy screen failed to save it
 * on 2026-11-12, so the user chose to reuse BD. Its display name still refers
 * to that attachment test. The file's name, type and size are kept in the
 * application's own record (DocumentRef), not here.
 */
export const DOCUMENT_ENTITY = 'BD'
const FILE_FIELD = 'file'

/**
 * Master Data v1 serves an attachment to ANYONE who knows the document ID and
 * file name, and accepts uploads the same way (tested 2026-11-11). So both
 * are random and never leave the server: one
 * random-ID document per file, stored under a random name.
 */
export class MasterDataDocumentStore implements DocumentStore {
  constructor(private readonly files: MasterDataFiles) {}

  public async put(input: Parameters<DocumentStore['put']>[0]) {
    const storedName = `${randomUUID()}.${input.type.extension}`

    const id = await this.files.createDocument(DOCUMENT_ENTITY, {
      applicationId: input.applicationId,
      kind: input.kind,
    })

    try {
      await this.files.upload(DOCUMENT_ENTITY, id, FILE_FIELD, {
        name: storedName,
        contentType: input.type.contentType,
        data: input.data,
      })
    } catch (e) {
      await this.files.deleteDocument(DOCUMENT_ENTITY, id).catch(() => {})
      throw e
    }

    return { storageId: `${id}/${storedName}` }
  }

  public async get(storageId: string) {
    const [id, name] = storageId.split('/')

    if (!id || !name) {
      throw new Error('Invalid storage ID')
    }

    return this.files.download(DOCUMENT_ENTITY, id, FILE_FIELD, name)
  }
}
