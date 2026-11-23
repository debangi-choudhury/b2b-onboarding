import type { AccountMasterData } from '../clients/accountMasterData'
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

interface StoredSchema {
  title?: string
  properties?: Record<string, unknown>
}

/** Same title, and every property the code declares is already there */
export function schemaIsCurrent(
  stored: StoredSchema,
  wanted: { title: string; properties: Record<string, unknown> }
): boolean {
  const storedProperties = Object.keys(stored.properties ?? {})

  return (
    stored.title === wanted.title &&
    Object.keys(wanted.properties).every((key) =>
      storedProperties.includes(key)
    )
  )
}

// Checked once per process.
let schemasReady: Promise<void> | null = null

const statusOf = (e: unknown) =>
  (e as { response?: { status?: number } }).response?.status

export class ApplicationRepository {
  constructor(
    private readonly md: AccountMasterData,
    private readonly warn: (message: string) => void = () => {}
  ) {}

  public ensureSchemas(): Promise<void> {
    if (!schemasReady) {
      schemasReady = Promise.all([
        this.ensureSchema(APPLICATION_ENTITY, APPLICATION_SCHEMA),
        this.ensureSchema(EVENT_ENTITY, EVENT_SCHEMA),
      ])
        .then(() => undefined)
        .catch((e) => {
          schemasReady = null
          throw e
        })
    }

    return schemasReady
  }

  /**
   * Writes the schema only when the stored one has a different title or lacks
   * a property, because every schema write locks the entity's schema for about
   * 12 hours. If the entity is locked but a schema exists, carry on with it.
   */
  private async ensureSchema(
    dataEntity: string,
    body: { title: string; properties: Record<string, unknown> }
  ) {
    let stored: StoredSchema | null = null

    try {
      stored = await this.md.getSchema<StoredSchema>(dataEntity, SCHEMA)
    } catch (e) {
      if (statusOf(e) !== 404) {
        throw e
      }
    }

    if (stored && schemaIsCurrent(stored, body)) {
      return
    }

    try {
      await this.md.putSchema(dataEntity, SCHEMA, body)
    } catch (e) {
      if (statusOf(e) === 423 && stored) {
        this.warn(
          `Schema ${dataEntity}/${SCHEMA} is locked by a recent change; using the stored version until the lock ends`
        )

        return
      }

      throw e
    }
  }

  /**
   * Stores a new application under its reference as the document ID. Reads by
   * ID are immediate, while search only finds new documents after a short
   * indexing delay, so the applicant can check their status straight away.
   * Returns false if the reference is already taken.
   */
  public async create(application: Omit<Application, 'id'>): Promise<boolean> {
    await this.ensureSchemas()

    if (await this.get(application.reference)) {
      return false
    }

    await this.md.putDocument(
      APPLICATION_ENTITY,
      application.reference,
      application,
      SCHEMA
    )

    return true
  }

  public async get(id: string): Promise<Application | null> {
    await this.ensureSchemas()

    try {
      const found = await this.md.getDocument<Application | null>(
        APPLICATION_ENTITY,
        id,
        APPLICATION_FIELDS
      )

      return found?.id ? found : null
    } catch (e) {
      if (statusOf(e) === 404) {
        return null
      }

      throw e
    }
  }

  public async list(filter: {
    status?: ApplicationStatus
    page: number
    pageSize: number
  }) {
    await this.ensureSchemas()

    const pagination = {
      page: Math.max(1, filter.page),
      pageSize: Math.min(Math.max(1, filter.pageSize), MAX_PAGE_SIZE),
    }

    const { data, total } = await this.md.search<Application>(
      APPLICATION_ENTITY,
      {
        schema: SCHEMA,
        fields: LIST_FIELDS,
        where: filter.status ? `status=${filter.status}` : undefined,
        sort: 'submittedAt DESC',
        pagination,
      }
    )

    return { data, pagination: { ...pagination, total } }
  }

  /** Writes the whole document. See schemas.ts for why it isn't a PATCH. */
  public async save(application: Application): Promise<void> {
    const { id, ...fields } = application

    await this.md.putDocument(APPLICATION_ENTITY, id, fields, SCHEMA)
  }

  public async addEvents(
    applicationId: string,
    events: Array<Omit<ApplicationEvent, 'applicationId'>>
  ): Promise<void> {
    // Sequential, so the history keeps its order even with equal timestamps
    for (const event of events) {
      // eslint-disable-next-line no-await-in-loop
      await this.md.createDocument(
        EVENT_ENTITY,
        { ...event, applicationId },
        SCHEMA
      )
    }
  }

  public async events(applicationId: string): Promise<ApplicationEvent[]> {
    await this.ensureSchemas()

    const { data } = await this.md.search<ApplicationEvent>(EVENT_ENTITY, {
      schema: SCHEMA,
      fields: EVENT_FIELDS,
      where: `applicationId=${applicationId}`,
      sort: 'createdAt ASC',
      pagination: { page: 1, pageSize: 100 },
    })

    return data
  }
}
