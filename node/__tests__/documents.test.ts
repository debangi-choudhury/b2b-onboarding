import { Readable } from 'stream'
import type { IncomingMessage } from 'http'

import FormData from 'form-data'

import {
  checkFiles,
  cleanFileName,
  detectFileType,
  MAX_FILE_BYTES,
} from '../domain/documents'
import type { ReceivedFile } from '../domain/documents'
import { MultipartError, parseApplicationForm } from '../routes/multipart'

const PDF = Buffer.from('%PDF-1.4\n% TEST ONLY\n')
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0])
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0])
const EXE = Buffer.from('MZ\x90\x00 not a document')

describe('detectFileType', () => {
  it('recognizes PDF, PNG and JPEG by their first bytes', () => {
    expect(detectFileType(PDF)?.contentType).toBe('application/pdf')
    expect(detectFileType(PNG)?.contentType).toBe('image/png')
    expect(detectFileType(JPEG)?.contentType).toBe('image/jpeg')
  })

  it('refuses anything else, whatever it is called', () => {
    expect(detectFileType(EXE)).toBeNull()
    expect(detectFileType(Buffer.from('<html>'))).toBeNull()
    expect(detectFileType(Buffer.alloc(0))).toBeNull()
  })
})

describe('cleanFileName', () => {
  it('keeps a plain display name', () => {
    expect(cleanFileName('C:\\fakepath\\Tax certificate (2026).pdf')).toBe(
      'Tax certificate (2026).pdf'
    )
    expect(cleanFileName('../../etc/passwd')).toBe('passwd')
    expect(cleanFileName('<script>.pdf')).toBe('_script_.pdf')
    expect(cleanFileName(undefined)).toBe('document')
  })
})

describe('checkFiles', () => {
  const file = (
    kind: ReceivedFile['kind'],
    data: Buffer,
    truncated = false
  ): ReceivedFile => ({ kind, fileName: 'x', data, truncated })

  it('accepts one valid file of each kind', () => {
    const result = checkFiles([
      file('REGISTRATION_CERTIFICATE', PDF),
      file('TAX_CERTIFICATE', PNG),
    ])

    expect(result.ok).toBe(true)
  })

  it('reports each problem against its document', () => {
    expect(checkFiles([file('TAX_CERTIFICATE', EXE)])).toEqual({
      ok: false,
      errors: [
        { field: 'REGISTRATION_CERTIFICATE', code: 'MISSING' },
        { field: 'TAX_CERTIFICATE', code: 'UNSUPPORTED_TYPE' },
      ],
    })

    expect(
      checkFiles([
        file('REGISTRATION_CERTIFICATE', PDF, true),
        file('TAX_CERTIFICATE', Buffer.alloc(0)),
      ])
    ).toEqual({
      ok: false,
      errors: [
        { field: 'REGISTRATION_CERTIFICATE', code: 'TOO_LARGE' },
        { field: 'TAX_CERTIFICATE', code: 'EMPTY' },
      ],
    })
  })
})

describe('parseApplicationForm', () => {
  function request(form: FormData): IncomingMessage {
    const stream = Readable.from([
      form.getBuffer(),
    ]) as unknown as IncomingMessage

    stream.headers = form.getHeaders()

    return stream
  }

  it('reads nested fields and one file per kind, ignoring unknown parts', async () => {
    const form = new FormData()

    form.append('companyName', 'TEST - Acme')
    form.append('contact.email', 'applicant@example.com')
    form.append('__proto__.polluted', 'yes')
    form.append('REGISTRATION_CERTIFICATE', PDF, 'reg.pdf')
    form.append('TAX_CERTIFICATE', PNG, 'tax.png')
    form.append('SOMETHING_ELSE', PDF, 'other.pdf')

    const { fields, files } = await parseApplicationForm(request(form))

    expect(fields).toEqual({
      companyName: 'TEST - Acme',
      contact: { email: 'applicant@example.com' },
    })
    expect(({} as Record<string, unknown>).polluted).toBeUndefined()
    expect(files.map((f) => [f.kind, f.fileName, f.data.length])).toEqual([
      ['REGISTRATION_CERTIFICATE', 'reg.pdf', PDF.length],
      ['TAX_CERTIFICATE', 'tax.png', PNG.length],
    ])
  })

  it('marks a file over the size limit as truncated without buffering it all', async () => {
    const form = new FormData()

    form.append(
      'REGISTRATION_CERTIFICATE',
      Buffer.concat([PDF, Buffer.alloc(MAX_FILE_BYTES)]),
      'big.pdf'
    )

    const { files } = await parseApplicationForm(request(form))

    expect(files[0].truncated).toBe(true)
    expect(files[0].data).toHaveLength(MAX_FILE_BYTES)
  })

  it('rejects a body that is not multipart', async () => {
    const stream = Readable.from(['{}']) as unknown as IncomingMessage

    stream.headers = { 'content-type': 'application/json' }

    await expect(parseApplicationForm(stream)).rejects.toBeInstanceOf(
      MultipartError
    )
  })
})
