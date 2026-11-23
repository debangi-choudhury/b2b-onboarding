import type { DocumentKind, FileType } from '../domain/documents'

export interface StoredDocument {
  /** Where the file lives. Never sent to the browser. */
  storageId: string
}

/**
 * Where application documents are kept. The demo uses Master Data v1
 * attachments (see MasterDataDocumentStore). A client project should use
 * private object storage with short-lived signed URLs behind this interface.
 */
export interface DocumentStore {
  put(input: {
    applicationId: string
    kind: DocumentKind
    fileName: string
    type: FileType
    data: Buffer
  }): Promise<StoredDocument>
  get(storageId: string): Promise<{ data: Buffer; contentType: string }>
}
