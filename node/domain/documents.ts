/** The documents every application needs, one file each */
export const DOCUMENT_KINDS = [
  'REGISTRATION_CERTIFICATE',
  'TAX_CERTIFICATE',
] as const

export type DocumentKind = (typeof DOCUMENT_KINDS)[number]

export const MAX_FILE_BYTES = 5 * 1024 * 1024

export interface FileType {
  contentType: 'application/pdf' | 'image/png' | 'image/jpeg'
  extension: 'pdf' | 'png' | 'jpg'
}

export function isDocumentKind(value: string): value is DocumentKind {
  return (DOCUMENT_KINDS as readonly string[]).includes(value)
}

/**
 * Identifies a file by its first bytes, never by its name or the type the
 * browser claims. Anything other than PDF, PNG or JPEG is refused.
 */
export function detectFileType(head: Buffer): FileType | null {
  if (head.length >= 5 && head.subarray(0, 5).toString('latin1') === '%PDF-') {
    return { contentType: 'application/pdf', extension: 'pdf' }
  }

  if (
    head.length >= 8 &&
    head
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return { contentType: 'image/png', extension: 'png' }
  }

  if (
    head.length >= 3 &&
    head[0] === 0xff &&
    head[1] === 0xd8 &&
    head[2] === 0xff
  ) {
    return { contentType: 'image/jpeg', extension: 'jpg' }
  }

  return null
}

/** Keeps a display name only: no paths, control characters or odd symbols */
export function cleanFileName(name: string | undefined): string {
  const base = (name ?? '').split(/[\\/]/).pop() ?? ''
  const cleaned = base
    .replace(/[^\w .()-]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(-100)

  return cleaned || 'document'
}

export type FileProblem = 'MISSING' | 'TOO_LARGE' | 'EMPTY' | 'UNSUPPORTED_TYPE'

export interface ReceivedFile {
  kind: DocumentKind
  fileName: string
  data: Buffer
  truncated: boolean
}

export interface CheckedFile extends ReceivedFile {
  type: FileType
}

export type FileCheck =
  | { ok: true; files: CheckedFile[] }
  | { ok: false; errors: Array<{ field: DocumentKind; code: FileProblem }> }

/** Every kind present exactly once, within size, and of an allowed type */
export function checkFiles(received: ReceivedFile[]): FileCheck {
  const errors: Array<{ field: DocumentKind; code: FileProblem }> = []
  const files: CheckedFile[] = []

  for (const kind of DOCUMENT_KINDS) {
    const file = received.find((f) => f.kind === kind)

    if (!file) {
      errors.push({ field: kind, code: 'MISSING' })
      continue
    }

    if (file.truncated || file.data.length > MAX_FILE_BYTES) {
      errors.push({ field: kind, code: 'TOO_LARGE' })
      continue
    }

    if (file.data.length === 0) {
      errors.push({ field: kind, code: 'EMPTY' })
      continue
    }

    const type = detectFileType(file.data)

    if (!type) {
      errors.push({ field: kind, code: 'UNSUPPORTED_TYPE' })
      continue
    }

    files.push({ ...file, type })
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true, files }
}
