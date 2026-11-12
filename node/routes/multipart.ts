import type { IncomingMessage } from 'http'

import Busboy from 'busboy'

import {
  cleanFileName,
  DOCUMENT_KINDS,
  isDocumentKind,
  MAX_FILE_BYTES,
} from '../domain/documents'
import type { ReceivedFile } from '../domain/documents'

export class MultipartError extends Error {
  constructor(public readonly code: 'TOO_LARGE' | 'MALFORMED') {
    super(code)
  }
}

const MAX_FIELDS = 40
const MAX_FIELD_BYTES = 1000

/** Turns "contact.email" style names into nested objects */
function setPath(target: Record<string, unknown>, path: string, value: string) {
  const keys = path.split('.')
  let node = target

  keys.slice(0, -1).forEach((key) => {
    if (typeof node[key] !== 'object' || node[key] === null) {
      node[key] = {}
    }

    node = node[key] as Record<string, unknown>
  })

  node[keys[keys.length - 1]] = value
}

const SAFE_PATH = /^[a-zA-Z]+(\.[a-zA-Z]+)?$/

/**
 * Reads the application form: text fields plus one file per document kind.
 * Files are capped while streaming, so an oversized upload is never buffered
 * whole. Unknown file fields are drained and ignored.
 */
export function parseApplicationForm(
  req: IncomingMessage
): Promise<{ fields: Record<string, unknown>; files: ReceivedFile[] }> {
  return new Promise((resolve, reject) => {
    let busboy: Busboy.Busboy

    try {
      busboy = Busboy({
        headers: req.headers,
        limits: {
          fields: MAX_FIELDS,
          fieldSize: MAX_FIELD_BYTES,
          files: DOCUMENT_KINDS.length,
          fileSize: MAX_FILE_BYTES,
          parts: MAX_FIELDS + DOCUMENT_KINDS.length,
        },
      })
    } catch {
      reject(new MultipartError('MALFORMED'))

      return
    }

    const fields: Record<string, unknown> = {}
    const files: ReceivedFile[] = []

    busboy.on('field', (name, value) => {
      if (SAFE_PATH.test(name)) {
        setPath(fields, name, value)
      }
    })

    busboy.on('file', (name, stream, info) => {
      if (!isDocumentKind(name) || files.some((f) => f.kind === name)) {
        stream.resume()

        return
      }

      const chunks: Buffer[] = []
      const file: ReceivedFile = {
        kind: name,
        fileName: cleanFileName(info.filename),
        data: Buffer.alloc(0),
        truncated: false,
      }

      stream.on('data', (chunk: Buffer) => chunks.push(chunk))
      stream.on('limit', () => {
        file.truncated = true
      })
      stream.on('end', () => {
        file.data = Buffer.concat(chunks)
        files.push(file)
      })
    })

    busboy.on('partsLimit', () => reject(new MultipartError('TOO_LARGE')))
    busboy.on('fieldsLimit', () => reject(new MultipartError('TOO_LARGE')))
    busboy.on('error', () => reject(new MultipartError('MALFORMED')))
    busboy.on('close', () => resolve({ fields, files }))

    req.pipe(busboy)
  })
}
