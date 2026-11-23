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

function appSettings(ctx: Context): Promise<unknown> {
  return ctx.clients.apps.getAppSettings(process.env.VTEX_APP_ID as string)
}

export async function stageConfig(ctx: Context): Promise<StageConfig> {
  return resolveStages(await appSettings(ctx))
}

/** The KYC provider the kycProvider setting picks */
export async function kycProvider(ctx: Context) {
  return kycProviderFor(await appSettings(ctx))
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

export function toUserError(e: unknown): never {
  if (e instanceof WorkflowError) {
    throw new UserInputError({ message: e.message, code: e.code })
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
