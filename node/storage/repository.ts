import type { MasterData } from '@vtex/api'

import type {
  Application,
  ApplicationEvent,
  ApplicationStatus,
} from '../domain/types'
import {
  APPLICATION_ENTITY,
  APPLICATION_SCHEMA,
  EVENT_ENTITY,
  EVENT_SCHEMA,
  SCHEMA,
} from './schemas'

const APPLICATION_FIELDS = ['id', ...Object.keys(APPLICATION_SCHEMA.properties)]

const LIST_FIELDS = [
  'id',
  'reference',
  'status',
  'companyName',
  'registrationNumber',
  'currentStageId',
  'currentStageIndex',
  'stages',
  'submittedAt',
  'updatedAt',
]

const EVENT_FIELDS = ['id', ...Object.keys(EVENT_SCHEMA.properties)]

export const MAX_PAGE_SIZE = 50

// Applied once per process. The PUT is idempotent, so several replicas
// applying it at the same time is harmless.
let schemasReady: Promise<void> | null = null

export class ApplicationRepository {
  constructor(private readonly md: MasterData) {}

  public ensureSchemas(): Promise<void> {
    if (!schemasReady) {
      schemasReady = Promise.all([
        this.md.createOrUpdateSchema({
          dataEntity: APPLICATION_ENTITY,
          schemaName: SCHEMA,
          schemaBody: APPLICATION_SCHEMA,
        }),
        this.md.createOrUpdateSchema({
          dataEntity: EVENT_ENTITY,
          schemaName: SCHEMA,
          schemaBody: EVENT_SCHEMA,
        }),
      ])
        .then(() => undefined)
        .catch((e) => {
          schemasReady = null
          throw e
        })
    }

    return schemasReady
  }

  public async create(application: Omit<Application, 'id'>): Promise<string> {
    await this.ensureSchemas()

    const { DocumentId } = await this.md.createDocument({
      dataEntity: APPLICATION_ENTITY,
      schema: SCHEMA,
      fields: application,
    })

    return DocumentId
  }

  public async get(id: string): Promise<Application | null> {
    await this.ensureSchemas()

    try {
      return await this.md.getDocument<Application>({
        dataEntity: APPLICATION_ENTITY,
        id,
        fields: APPLICATION_FIELDS,
      })
    } catch (e) {
      if ((e as { response?: { status?: number } }).response?.status === 404) {
        return null
      }

      throw e
    }
  }

  public async findByReference(reference: string): Promise<Application | null> {
    await this.ensureSchemas()

    // Callers check the reference's format first, so it is safe in a filter.
    const [found] = await this.md.searchDocuments<Application>({
      dataEntity: APPLICATION_ENTITY,
      schema: SCHEMA,
      fields: APPLICATION_FIELDS,
      where: `reference=${reference}`,
      pagination: { page: 1, pageSize: 1 },
    })

    return found ?? null
  }

  public async list(filter: {
    status?: ApplicationStatus
    page: number
    pageSize: number
  }) {
    await this.ensureSchemas()

    return this.md.searchDocumentsWithPaginationInfo<Application>({
      dataEntity: APPLICATION_ENTITY,
      schema: SCHEMA,
      fields: LIST_FIELDS,
      where: filter.status ? `status=${filter.status}` : undefined,
      sort: 'submittedAt DESC',
      pagination: {
        page: Math.max(1, filter.page),
        pageSize: Math.min(Math.max(1, filter.pageSize), MAX_PAGE_SIZE),
      },
    })
  }

  public async update(id: string, patch: Partial<Application>): Promise<void> {
    if (Object.keys(patch).length === 0) {
      return
    }

    await this.md.updatePartialDocument({
      dataEntity: APPLICATION_ENTITY,
      schema: SCHEMA,
      id,
      fields: patch,
    })
  }

  public async addEvents(
    applicationId: string,
    events: Array<Omit<ApplicationEvent, 'applicationId'>>
  ): Promise<void> {
    // Sequential, so the history keeps its order even with equal timestamps
    for (const event of events) {
      // eslint-disable-next-line no-await-in-loop
      await this.md.createDocument({
        dataEntity: EVENT_ENTITY,
        schema: SCHEMA,
        fields: { ...event, applicationId },
      })
    }
  }

  public async events(applicationId: string): Promise<ApplicationEvent[]> {
    await this.ensureSchemas()

    return this.md.searchDocuments<ApplicationEvent>({
      dataEntity: EVENT_ENTITY,
      schema: SCHEMA,
      fields: EVENT_FIELDS,
      where: `applicationId=${applicationId}`,
      sort: 'createdAt ASC',
      pagination: { page: 1, pageSize: 100 },
    })
  }
}
