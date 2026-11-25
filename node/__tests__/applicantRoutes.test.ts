import { Readable } from 'stream'

import FormData from 'form-data'

import { hashToken } from '../domain/statusToken'
import type { Application, ApplicationEvent } from '../domain/types'
import { apply, status } from '../routes/applicant'
import { application, validInput } from './fixtures'

const PDF = Buffer.from('%PDF-1.4\n% TEST ONLY\n')
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0])

// Each test uses its own client address, because the rate limits are per
// address and shared by the whole test file.
let nextAddress = 1
const newAddress = () => `203.0.113.${nextAddress++}`

/** A multipart form with nested field names, as the application page sends */
function applicationForm(overrides: Record<string, unknown> = {}) {
  const form = new FormData()
  const input = validInput(overrides) as Record<string, unknown>

  for (const [key, value] of Object.entries(input)) {
    if (value && typeof value === 'object') {
      for (const [inner, innerValue] of Object.entries(value)) {
        form.append(`${key}.${inner}`, String(innerValue))
      }
    } else if (value !== undefined) {
      form.append(key, String(value))
    }
  }

  return form
}

function withFiles(form: FormData) {
  form.append('REGISTRATION_CERTIFICATE', PDF, 'registration.pdf')
  form.append('TAX_CERTIFICATE', PNG, 'tax.png')

  return form
}

function fakeContext(options: {
  form?: FormData
  body?: unknown
  address?: string
  contentType?: string
  apps?: Application[]
}) {
  const address = options.address ?? newAddress()
  const apps = new Map<string, Record<string, unknown>>()
  const events: ApplicationEvent[] = []
  const stored: Array<{ id: string; fields: unknown; file?: unknown }> = []

  for (const { id, ...fields } of options.apps ?? []) {
    apps.set(id, fields)
  }

  let req: unknown

  if (options.form) {
    const stream = Readable.from([options.form.getBuffer()]) as Readable & {
      headers: Record<string, string>
    }

    stream.headers = options.form.getHeaders()
    req = stream
  } else {
    const raw = JSON.stringify(options.body ?? {})
    const stream = Readable.from([Buffer.from(raw)]) as Readable & {
      headers: Record<string, string>
    }

    stream.headers = {
      'content-type': 'application/json',
      'content-length': String(Buffer.byteLength(raw)),
    }
    req = stream
  }

  const headers: Record<string, string> = {}
  const accountMasterData = {
    getSchema: jest.fn().mockResolvedValue(null),
    putSchema: jest.fn().mockResolvedValue(undefined),
    getDocument: jest.fn(async (_e: string, id: string) =>
      apps.has(id) ? { id, ...apps.get(id) } : null
    ),
    putDocument: jest.fn(
      async (_e: string, id: string, fields: Record<string, unknown>) => {
        apps.set(id, fields)
      }
    ),
    createDocument: jest.fn(async (_e: string, event: ApplicationEvent) => {
      events.push(event)
    }),
  }

  const masterDataFiles = {
    createDocument: jest.fn(async (_e: string, fields: unknown) => {
      stored.push({ id: `bd-${stored.length + 1}`, fields })

      return `bd-${stored.length}`
    }),
    upload: jest.fn(async () => undefined),
    deleteDocument: jest.fn(async () => undefined),
  }

  const ctx = {
    req,
    ip: '10.0.0.1',
    status: 200,
    body: undefined as unknown,
    get: (name: string) =>
      name.toLowerCase() === 'x-forwarded-for' ? `${address}, 10.0.0.2` : '',
    is: (type: string) =>
      (options.contentType ??
        (options.form ? 'multipart/form-data' : 'application/json')) === type
        ? type
        : false,
    set: (name: string, value: string) => {
      headers[name] = value
    },
    request: { body: undefined },
    clients: {
      accountMasterData,
      masterDataFiles,
      apps: { getAppSettings: jest.fn().mockResolvedValue({}) },
    },
    vtex: { logger: { warn: jest.fn(), error: jest.fn() } },
  }

  return {
    ctx,
    headers,
    apps,
    events,
    stored,
    accountMasterData,
    masterDataFiles,
    address,
  }
}

describe('apply', () => {
  it('stores the files, then the application, and returns the reference and status code once', async () => {
    const fake = fakeContext({ form: withFiles(applicationForm()) })

    await apply(fake.ctx as never)

    expect(fake.ctx.status).toBe(201)
    expect(fake.headers['Cache-Control']).toBe('no-store')

    const body = fake.ctx.body as {
      reference: string
      statusToken: string
      submittedAt: string
    }

    expect(body.reference).toMatch(/^APP-[A-Z0-9]{8}$/)
    expect(body.statusToken.length).toBeGreaterThan(10)

    // Two files, each in its own random BD document, linked to the reference
    expect(fake.masterDataFiles.createDocument).toHaveBeenCalledTimes(2)
    expect(fake.stored.map((s) => s.fields)).toEqual([
      { applicationId: body.reference, kind: 'REGISTRATION_CERTIFICATE' },
      { applicationId: body.reference, kind: 'TAX_CERTIFICATE' },
    ])

    const saved = fake.apps.get(body.reference) as unknown as Application

    expect(saved).toMatchObject({
      reference: body.reference,
      status: 'IN_REVIEW',
      companyName: 'TEST - Acme Industrial',
    })
    expect(saved.documents.map((d) => [d.kind, d.contentType])).toEqual([
      ['REGISTRATION_CERTIFICATE', 'application/pdf'],
      ['TAX_CERTIFICATE', 'image/png'],
    ])
    // Only a hash of the status code is kept
    expect(JSON.stringify(saved)).not.toContain(body.statusToken)
    expect(saved.tokenHash).toBe(hashToken(body.statusToken))

    expect(fake.events).toEqual([
      expect.objectContaining({
        type: 'SUBMITTED',
        applicationId: body.reference,
        actorType: 'APPLICANT',
      }),
    ])
  })

  it('lists every invalid field and missing file, without storing anything', async () => {
    const fake = fakeContext({
      form: applicationForm({ companyName: '' }),
    })

    await apply(fake.ctx as never)

    expect(fake.ctx.status).toBe(400)

    const body = fake.ctx.body as {
      code: string
      fields: Array<{ field: string }>
    }

    expect(body.code).toBe('INVALID_FIELDS')
    expect(body.fields.map((f) => f.field)).toEqual(
      expect.arrayContaining([
        'companyName',
        'REGISTRATION_CERTIFICATE',
        'TAX_CERTIFICATE',
      ])
    )
    expect(fake.masterDataFiles.createDocument).not.toHaveBeenCalled()
    expect(fake.accountMasterData.putDocument).not.toHaveBeenCalled()
  })

  it('refuses anything other than a multipart form', async () => {
    const fake = fakeContext({ body: {}, contentType: 'application/json' })

    await apply(fake.ctx as never)

    expect(fake.ctx.status).toBe(415)
    expect(fake.ctx.body).toEqual({ code: 'UNSUPPORTED_MEDIA_TYPE' })
  })

  it('answers 400 for a form it cannot read', async () => {
    const fake = fakeContext({ form: applicationForm() })

    // Claims to be multipart but sends no boundary
    ;(fake.ctx.req as { headers: Record<string, string> }).headers = {
      'content-type': 'multipart/form-data',
    }

    await apply(fake.ctx as never)

    expect(fake.ctx.status).toBe(400)
    expect(fake.ctx.body).toEqual({ code: 'MALFORMED' })
  })

  it('allows five applications per address in ten minutes', async () => {
    const address = newAddress()

    for (let i = 0; i < 5; i++) {
      const fake = fakeContext({ body: {}, address, contentType: 'none' })

      // eslint-disable-next-line no-await-in-loop
      await apply(fake.ctx as never)
      expect(fake.ctx.status).toBe(415)
    }

    const blocked = fakeContext({ body: {}, address, contentType: 'none' })

    await apply(blocked.ctx as never)
    expect(blocked.ctx.status).toBe(429)
    expect(blocked.ctx.body).toEqual({ code: 'TOO_MANY_REQUESTS' })
  })

  it('tries another reference when the first is taken', async () => {
    const fake = fakeContext({ form: withFiles(applicationForm()) })
    const { getDocument } = fake.accountMasterData

    getDocument.mockResolvedValueOnce({ id: 'taken' })

    await apply(fake.ctx as never)

    expect(fake.ctx.status).toBe(201)
  })

  it('gives up after three taken references', async () => {
    const fake = fakeContext({ form: withFiles(applicationForm()) })

    fake.accountMasterData.getDocument.mockResolvedValue({ id: 'taken' })

    await expect(apply(fake.ctx as never)).rejects.toThrow(
      'Could not allocate an application reference'
    )
    expect(fake.masterDataFiles.createDocument).not.toHaveBeenCalled()
  })
})

describe('status', () => {
  const TOKEN = 'TEST-status-code-123'

  function submitted(overrides: Partial<Application> = {}) {
    return application({
      id: 'APP-ABCDEFGH',
      tokenHash: hashToken(TOKEN),
      ...overrides,
    })
  }

  it('shows the current step to the applicant who has the code', async () => {
    const fake = fakeContext({
      apps: [submitted()],
      body: { reference: ' app-abcdefgh ', token: TOKEN },
    })

    await status(fake.ctx as never)

    expect(fake.ctx.status).toBe(200)
    expect(fake.ctx.body).toEqual({
      reference: 'APP-ABCDEFGH',
      companyName: 'TEST - Acme Industrial',
      status: 'IN_REVIEW',
      currentStageLabel: 'Document review',
      rejectionReason: null,
      submittedAt: expect.any(String),
      decidedAt: null,
    })
  })

  it('shows the reason for a rejection, but no internal data', async () => {
    const fake = fakeContext({
      apps: [
        submitted({
          status: 'REJECTED',
          rejectionReason: 'Registration certificate has expired',
          decidedAt: '2026-11-20T10:00:00.000Z',
        }),
      ],
      body: { reference: 'APP-ABCDEFGH', token: TOKEN },
    })

    await status(fake.ctx as never)

    expect(fake.ctx.body).toMatchObject({
      status: 'REJECTED',
      currentStageLabel: null,
      rejectionReason: 'Registration certificate has expired',
      decidedAt: '2026-11-20T10:00:00.000Z',
    })
    expect(JSON.stringify(fake.ctx.body)).not.toContain('tokenHash')
  })

  it.each([
    ['a wrong code', { reference: 'APP-ABCDEFGH', token: 'wrong' }],
    ['an unknown reference', { reference: 'APP-ZZZZZZZZ', token: TOKEN }],
    ['a malformed reference', { reference: 'nope', token: TOKEN }],
    ['no code', { reference: 'APP-ABCDEFGH' }],
  ])('gives the same answer for %s', async (_, body) => {
    const fake = fakeContext({ apps: [submitted()], body })

    await status(fake.ctx as never)

    expect(fake.ctx.status).toBe(404)
    expect(fake.ctx.body).toEqual({ code: 'NOT_FOUND' })
  })

  it('answers 400 for a body that is not JSON', async () => {
    const fake = fakeContext({ body: {} })
    const stream = Readable.from([Buffer.from('{not json')]) as Readable & {
      headers: Record<string, string>
    }

    stream.headers = { 'content-type': 'application/json' }
    fake.ctx.req = stream

    await status(fake.ctx as never)

    expect(fake.ctx.status).toBe(400)
    expect(fake.ctx.body).toEqual({ code: 'MALFORMED' })
  })

  it('allows 30 checks per address in ten minutes', async () => {
    const address = newAddress()

    for (let i = 0; i < 30; i++) {
      const fake = fakeContext({ address, body: {} })

      // eslint-disable-next-line no-await-in-loop
      await status(fake.ctx as never)
      expect(fake.ctx.status).toBe(404)
    }

    const blocked = fakeContext({ address, body: {} })

    await status(blocked.ctx as never)
    expect(blocked.ctx.status).toBe(429)
  })
})
