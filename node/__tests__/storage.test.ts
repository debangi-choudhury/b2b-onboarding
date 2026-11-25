import type { ApplicationEvent } from '../domain/types'
import type { DocumentStore } from '../storage/documentStore'
import { MasterDataDocumentStore } from '../storage/masterDataDocumentStore'
import type { ApplicationRepository as Repository } from '../storage/repository'
import {
  APPLICATION_ENTITY,
  APPLICATION_SCHEMA,
  EVENT_ENTITY,
  EVENT_SCHEMA,
  SCHEMA,
} from '../storage/schemas'
import { application } from './fixtures'

const locked = { response: { status: 423 } }
const notFound = { response: { status: 404 } }

function fakeMasterData() {
  return {
    getSchema: jest.fn().mockRejectedValue(notFound),
    putSchema: jest.fn().mockResolvedValue(undefined),
    getDocument: jest.fn().mockResolvedValue(null),
    putDocument: jest.fn().mockResolvedValue(undefined),
    createDocument: jest.fn().mockResolvedValue('event-1'),
    search: jest.fn().mockResolvedValue({ data: [], total: 0 }),
  }
}

/**
 * The repository checks its schemas once per process, so each test loads a
 * fresh copy of the module.
 */
function freshRepository(md: ReturnType<typeof fakeMasterData>) {
  const warn = jest.fn()
  let repo: Repository | undefined

  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires, node/global-require
    const { ApplicationRepository } = require('../storage/repository')

    repo = new ApplicationRepository(md, warn)
  })

  return { repo: repo as Repository, warn }
}

describe('ApplicationRepository schemas', () => {
  it('writes both schemas when they are missing, once per process', async () => {
    const md = fakeMasterData()
    const { repo } = freshRepository(md)

    await repo.get('APP-1')
    await repo.get('APP-2')

    expect(md.putSchema).toHaveBeenCalledTimes(2)
    expect(md.putSchema).toHaveBeenCalledWith(
      APPLICATION_ENTITY,
      SCHEMA,
      APPLICATION_SCHEMA
    )
    expect(md.putSchema).toHaveBeenCalledWith(
      EVENT_ENTITY,
      SCHEMA,
      EVENT_SCHEMA
    )
  })

  it('leaves a current schema alone, because every write locks it for hours', async () => {
    const md = fakeMasterData()

    md.getSchema.mockImplementation(async (entity: string) =>
      entity === APPLICATION_ENTITY ? APPLICATION_SCHEMA : EVENT_SCHEMA
    )

    await freshRepository(md).repo.get('APP-1')

    expect(md.putSchema).not.toHaveBeenCalled()
  })

  it('carries on with the stored schema while a newer one is locked', async () => {
    const md = fakeMasterData()

    md.getSchema.mockResolvedValue({ title: 'old', properties: {} })
    md.putSchema.mockRejectedValue(locked)

    const { repo, warn } = freshRepository(md)

    await expect(repo.get('APP-1')).resolves.toBeNull()
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('is locked'))
  })

  it('fails when the schema is locked and none is stored, and tries again next time', async () => {
    const md = fakeMasterData()

    md.putSchema.mockRejectedValueOnce(locked)

    const { repo } = freshRepository(md)

    await expect(repo.get('APP-1')).rejects.toBe(locked)
    await expect(repo.get('APP-1')).resolves.toBeNull()
  })

  it('fails on any other error reading the schema', async () => {
    const md = fakeMasterData()
    const down = { response: { status: 500 } }

    md.getSchema.mockRejectedValue(down)

    await expect(freshRepository(md).repo.get('APP-1')).rejects.toBe(down)
  })
})

describe('ApplicationRepository documents', () => {
  it('reads an application by ID with every stored field', async () => {
    const md = fakeMasterData()

    md.getDocument.mockResolvedValue({ id: 'APP-1', status: 'IN_REVIEW' })

    const found = await freshRepository(md).repo.get('APP-1')

    expect(found).toEqual({ id: 'APP-1', status: 'IN_REVIEW' })

    const [entity, id, fields] = md.getDocument.mock.calls[0]

    expect([entity, id]).toEqual([APPLICATION_ENTITY, 'APP-1'])
    expect(fields).toEqual(
      expect.arrayContaining(['id', 'reference', 'tokenHash', 'india'])
    )
  })

  it('treats a 404 or an empty answer as not found, and passes other errors on', async () => {
    const md = fakeMasterData()
    const { repo } = freshRepository(md)

    md.getDocument.mockResolvedValueOnce({})
    await expect(repo.get('APP-1')).resolves.toBeNull()

    md.getDocument.mockRejectedValueOnce(notFound)
    await expect(repo.get('APP-1')).resolves.toBeNull()

    const down = new Error('down')

    md.getDocument.mockRejectedValueOnce(down)
    await expect(repo.get('APP-1')).rejects.toBe(down)
  })

  it('creates an application under its reference, unless the reference is taken', async () => {
    const md = fakeMasterData()
    const { repo } = freshRepository(md)
    const { id, ...app } = application({ reference: 'APP-NEW00001' })

    await expect(repo.create(app)).resolves.toBe(true)
    expect(md.putDocument).toHaveBeenCalledWith(
      APPLICATION_ENTITY,
      'APP-NEW00001',
      app,
      SCHEMA
    )

    md.getDocument.mockResolvedValueOnce({ id: 'APP-NEW00001' })
    await expect(repo.create(app)).resolves.toBe(false)
    expect(md.putDocument).toHaveBeenCalledTimes(1)
    expect(id).toBe('app-1')
  })

  it('saves the whole document without its ID field', async () => {
    const md = fakeMasterData()

    await freshRepository(md).repo.save(application())

    const [, id, fields] = md.putDocument.mock.calls[0]

    expect(id).toBe('app-1')
    expect(fields).not.toHaveProperty('id')
  })

  it('lists newest first, filtered by status, with the page size capped at 50', async () => {
    const md = fakeMasterData()

    md.search.mockResolvedValue({ data: [{ id: 'APP-1' }], total: 75 })

    const result = await freshRepository(md).repo.list({
      status: 'REJECTED',
      page: 0,
      pageSize: 500,
    })

    expect(result).toEqual({
      data: [{ id: 'APP-1' }],
      pagination: { page: 1, pageSize: 50, total: 75 },
    })
    expect(md.search).toHaveBeenCalledWith(
      APPLICATION_ENTITY,
      expect.objectContaining({
        where: 'status=REJECTED',
        sort: 'submittedAt DESC',
        pagination: { page: 1, pageSize: 50 },
      })
    )
  })

  it('lists every status when none is given', async () => {
    const md = fakeMasterData()

    await freshRepository(md).repo.list({ page: 2, pageSize: 20 })

    expect(md.search.mock.calls[0][1]).toMatchObject({
      where: undefined,
      pagination: { page: 2, pageSize: 20 },
    })
  })

  it('adds history events one at a time, in order', async () => {
    const md = fakeMasterData()
    const order: string[] = []

    md.createDocument.mockImplementation(
      async (_e: string, event: ApplicationEvent) => {
        await new Promise((resolve) => setTimeout(resolve, 5))
        order.push(event.type)
      }
    )

    await freshRepository(md).repo.addEvents('APP-1', [
      {
        type: 'STAGE_PASSED',
        actorType: 'REVIEWER',
        actor: 'a',
        createdAt: 'x',
      },
      { type: 'REJECTED', actorType: 'REVIEWER', actor: 'a', createdAt: 'y' },
    ])

    expect(order).toEqual(['STAGE_PASSED', 'REJECTED'])
    expect(md.createDocument.mock.calls[0][1]).toMatchObject({
      applicationId: 'APP-1',
    })
  })

  it('reads an application’s history oldest first', async () => {
    const md = fakeMasterData()

    md.search.mockResolvedValue({ data: [{ type: 'SUBMITTED' }], total: 1 })

    await expect(freshRepository(md).repo.events('APP-1')).resolves.toEqual([
      { type: 'SUBMITTED' },
    ])
    expect(md.search).toHaveBeenCalledWith(
      EVENT_ENTITY,
      expect.objectContaining({
        where: 'applicationId=APP-1',
        sort: 'createdAt ASC',
      })
    )
  })
})

describe('MasterDataDocumentStore', () => {
  const PDF = Buffer.from('%PDF-1.4')

  function fakeFiles() {
    return {
      createDocument: jest.fn().mockResolvedValue('bd-1'),
      upload: jest.fn().mockResolvedValue(undefined),
      download: jest
        .fn()
        .mockResolvedValue({ data: PDF, contentType: 'application/pdf' }),
      deleteDocument: jest.fn().mockResolvedValue(undefined),
    }
  }

  const input: Parameters<DocumentStore['put']>[0] = {
    applicationId: 'APP-1',
    kind: 'TAX_CERTIFICATE',
    fileName: 'Tax certificate.pdf',
    type: { contentType: 'application/pdf', extension: 'pdf' },
    data: PDF,
  }

  it('stores each file in its own record under a random name', async () => {
    const files = fakeFiles()
    const store = new MasterDataDocumentStore(files as never)

    const { storageId } = await store.put(input)

    expect(storageId).toMatch(/^bd-1\/[0-9a-f-]{36}\.pdf$/)
    expect(files.createDocument).toHaveBeenCalledWith('BD', {
      applicationId: 'APP-1',
      kind: 'TAX_CERTIFICATE',
    })

    const [, , field, file] = files.upload.mock.calls[0]

    expect(field).toBe('file')
    expect(file).toMatchObject({ contentType: 'application/pdf', data: PDF })
    // The applicant's own file name never reaches storage
    expect(file.name).not.toContain('Tax certificate')
  })

  it('removes the empty record when the upload fails', async () => {
    const files = fakeFiles()
    const failure = new Error('upload failed')

    files.upload.mockRejectedValue(failure)
    files.deleteDocument.mockRejectedValue(new Error('also down'))

    await expect(
      new MasterDataDocumentStore(files as never).put(input)
    ).rejects.toBe(failure)
    expect(files.deleteDocument).toHaveBeenCalledWith('BD', 'bd-1')
  })

  it('reads a file back by its storage ID', async () => {
    const files = fakeFiles()
    const store = new MasterDataDocumentStore(files as never)

    await expect(store.get('bd-1/stored.pdf')).resolves.toEqual({
      data: PDF,
      contentType: 'application/pdf',
    })
    expect(files.download).toHaveBeenCalledWith(
      'BD',
      'bd-1',
      'file',
      'stored.pdf'
    )
    await expect(store.get('no-slash')).rejects.toThrow('Invalid storage ID')
  })
})
