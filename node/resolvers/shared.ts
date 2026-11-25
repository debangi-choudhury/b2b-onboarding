import { NotFoundError, UserInputError } from '@vtex/api'

import { resolveStages } from '../domain/stages'
import type { StageConfig } from '../domain/stages'
import type { Application, ApplicationEvent } from '../domain/types'
import { WorkflowError } from '../domain/workflow'
import type { DocumentStore } from '../storage/documentStore'
import { MasterDataDocumentStore } from '../storage/masterDataDocumentStore'
import { ApplicationRepository } from '../storage/repository'
import { kycProviderFor } from '../verification/kycProviders'
import { MockRegistryVerifier } from '../verification/mockRegistry'
import type { EligibilityVerifier } from '../verification/types'

// Swap this for a real provider in a client project.
export const verifier: EligibilityVerifier = new MockRegistryVerifier()

export function repository(ctx: Context) {
  return new ApplicationRepository(ctx.clients.accountMasterData, (message) =>
    ctx.vtex.logger.warn({ message })
  )
}

// Swap this for private object storage in a client project.
export function documentStore(ctx: Context): DocumentStore {
  return new MasterDataDocumentStore(ctx.clients.masterDataFiles)
}

/** This app's settings. Read once per request and passed on. */
export function appSettings(ctx: Context): Promise<unknown> {
  // This @vtex/api version has no ctx.vtex.appId; the runtime sets the env var
  return ctx.clients.apps.getAppSettings(process.env.VTEX_APP_ID as string)
}

export async function stageConfig(
  ctx: Context,
  settings?: unknown
): Promise<StageConfig> {
  return resolveStages(settings ?? (await appSettings(ctx)))
}

/** The KYC provider the kycProvider setting picks */
export async function kycProvider(ctx: Context, settings?: unknown) {
  return kycProviderFor(settings ?? (await appSettings(ctx)))
}

const DOCUMENT_ID = /^[A-Za-z0-9-]{1,64}$/

export async function loadApplication(
  ctx: Context,
  id: string
): Promise<Application> {
  if (!DOCUMENT_ID.test(id)) {
    throw new UserInputError('Invalid application ID')
  }

  const app = await repository(ctx).get(id)

  if (!app) {
    throw new NotFoundError('Application not found')
  }

  return app
}

/**
 * A refusal the Admin can show and act on: a 400 with the message, and a code
 * such as STAGE_MISMATCH in the GraphQL error's extensions.code.
 *
 * @vtex/api's UserInputError always sets its own code to BAD_USER_INPUT, and
 * GraphQL takes a response's extensions from the thrown error's extensions,
 * so the code goes there. @vtex/api keeps extensions.code even when it
 * withholds the rest of an error.
 */
export function userError(message: string, code: string): UserInputError {
  return Object.assign(new UserInputError(message), { extensions: { code } })
}

export function toUserError(e: unknown): never {
  if (e instanceof WorkflowError) {
    throw userError(e.message, e.code)
  }

  throw e
}

export async function applyTransition(
  ctx: Context,
  app: Application,
  transition: {
    patch: Partial<Application>
    events: Array<Omit<ApplicationEvent, 'applicationId'>>
  }
): Promise<Application> {
  const repo = repository(ctx)
  const updated = { ...app, ...transition.patch }

  if (Object.keys(transition.patch).length > 0) {
    await repo.save(updated)
  }

  await repo.addEvents(app.id, transition.events)

  return updated
}
