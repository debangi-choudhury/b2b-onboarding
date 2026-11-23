import { json } from 'co-body'

import { checkFiles } from '../domain/documents'
import { RateLimiter } from '../domain/rateLimit'
import {
  hashToken,
  isReference,
  newReference,
  newStatusToken,
  tokenMatches,
} from '../domain/statusToken'
import type { DocumentRef } from '../domain/types'
import { validateApplication } from '../domain/validation'
import { currentStage, newApplication } from '../domain/workflow'
import { MultipartError, parseApplicationForm } from './multipart'
import { documentStore, repository, stageConfig } from '../resolvers/shared'

/*
 * Public REST endpoints for applicants, who aren't logged in. They are REST
 * rather than GraphQL because the store sends GraphQL queries as GET requests
 * with their variables in the URL, which would put the status code in logs.
 */

// Per replica: 5 applications and 30 status checks per client per 10 minutes
const submissions = new RateLimiter(5, 10 * 60 * 1000)
const statusChecks = new RateLimiter(30, 10 * 60 * 1000)

function clientKey(ctx: Context): string {
  const forwarded = ctx.get('x-forwarded-for').split(',')[0].trim()

  return forwarded || ctx.ip || 'unknown'
}

function reply(ctx: Context, httpStatus: number, body: unknown) {
  ctx.status = httpStatus
  ctx.body = body
  ctx.set('Cache-Control', 'no-store')
}

/**
 * Public routes must not pass an unexpected failure to the caller: the
 * default error body carries the error's stack and details. Log the message
 * and status only (never the error object, which can hold the request), and
 * answer with a plain code the pages already handle.
 */
export function guarded(
  route: string,
  handler: (ctx: Context) => Promise<void>
) {
  return async (ctx: Context) => {
    try {
      await handler(ctx)
    } catch (e) {
      ctx.vtex.logger.error({
        message: 'Applicant route failed',
        route,
        error: e instanceof Error ? e.message : String(e),
        status: (e as { response?: { status?: number } }).response?.status,
      })
      reply(ctx, 503, { code: 'UNAVAILABLE' })
    }
  }
}

/** A reference clash is about 1 in a trillion; try a few anyway. */
async function freeReference(
  repo: ReturnType<typeof repository>,
  attemptsLeft = 3
): Promise<string> {
  const reference = newReference()

  if (!(await repo.get(reference))) {
    return reference
  }

  if (attemptsLeft <= 1) {
    throw new Error('Could not allocate an application reference')
  }

  return freeReference(repo, attemptsLeft - 1)
}

export async function apply(ctx: Context) {
  if (!submissions.allow(clientKey(ctx), Date.now())) {
    return reply(ctx, 429, { code: 'TOO_MANY_REQUESTS' })
  }

  if (!ctx.is('multipart/form-data')) {
    return reply(ctx, 415, { code: 'UNSUPPORTED_MEDIA_TYPE' })
  }

  let form

  try {
    form = await parseApplicationForm(ctx.req)
  } catch (e) {
    const code = e instanceof MultipartError ? e.code : 'MALFORMED'

    return reply(ctx, code === 'TOO_LARGE' ? 413 : 400, { code })
  }

  const details = validateApplication(form.fields)
  const files = checkFiles(form.files)

  if (!details.ok || !files.ok) {
    return reply(ctx, 400, {
      code: 'INVALID_FIELDS',
      fields: [
        ...(details.ok ? [] : details.errors),
        ...(files.ok ? [] : files.errors),
      ],
    })
  }

  const repo = repository(ctx)
  const store = documentStore(ctx)
  const { stages } = await stageConfig(ctx)

  const reference = await freeReference(repo)

  // Store the files first, so an application never exists without them. If
  // saving the application then fails, the files are orphaned but unreachable.
  const documents: DocumentRef[] = []

  for (const file of files.files) {
    // eslint-disable-next-line no-await-in-loop
    const { storageId } = await store.put({
      applicationId: reference,
      kind: file.kind,
      fileName: file.fileName,
      type: file.type,
      data: file.data,
    })

    documents.push({
      kind: file.kind,
      fileName: file.fileName,
      contentType: file.type.contentType,
      size: file.data.length,
      storageId,
      uploadedAt: new Date().toISOString(),
    })
  }

  const token = newStatusToken()
  const { application, event } = newApplication(
    details.value,
    stages,
    { reference, tokenHash: hashToken(token) },
    new Date()
  )

  if (!(await repo.create({ ...application, documents }))) {
    throw new Error('Application reference was taken while saving')
  }

  await repo.addEvents(reference, [
    {
      ...event,
      details: JSON.stringify({
        documents: documents.map((d) => ({ kind: d.kind, size: d.size })),
      }),
    },
  ])

  // The code is returned once and never stored. The applicant keeps it.
  return reply(ctx, 201, {
    reference,
    statusToken: token,
    submittedAt: application.submittedAt,
  })
}

export async function status(ctx: Context) {
  if (!statusChecks.allow(clientKey(ctx), Date.now())) {
    return reply(ctx, 429, { code: 'TOO_MANY_REQUESTS' })
  }

  let body: { reference?: unknown; token?: unknown }

  try {
    body = await json(ctx, { limit: '2kb' })
  } catch {
    return reply(ctx, 400, { code: 'MALFORMED' })
  }

  const reference =
    typeof body.reference === 'string'
      ? body.reference.trim().toUpperCase()
      : ''

  const token = typeof body.token === 'string' ? body.token.trim() : ''

  // One answer for a bad reference, an unknown one and a wrong code, so the
  // endpoint can't be used to discover which references exist.
  const notFound = () => reply(ctx, 404, { code: 'NOT_FOUND' })

  if (!isReference(reference) || !token) {
    return notFound()
  }

  const app = await repository(ctx).get(reference)

  if (!app || !tokenMatches(token, app.tokenHash)) {
    return notFound()
  }

  return reply(ctx, 200, {
    reference: app.reference,
    companyName: app.companyName,
    status: app.status,
    currentStageLabel:
      app.status === 'IN_REVIEW' ? currentStage(app).label : null,
    rejectionReason: app.status === 'REJECTED' ? app.rejectionReason : null,
    submittedAt: app.submittedAt,
    decidedAt: app.decidedAt ?? null,
  })
}
