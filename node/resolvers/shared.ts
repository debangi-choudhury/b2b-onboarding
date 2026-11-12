import { NotFoundError, UserInputError } from '@vtex/api'

import { resolveStages } from '../domain/stages'
import type { StageConfig } from '../domain/stages'
import type { Application, ApplicationEvent } from '../domain/types'
import { WorkflowError } from '../domain/workflow'
import { ApplicationRepository } from '../storage/repository'
import { MockRegistryVerifier } from '../verification/mockRegistry'
import type { EligibilityVerifier } from '../verification/types'

// Swap this for a real provider in a client project.
export const verifier: EligibilityVerifier = new MockRegistryVerifier()

export function repository(ctx: Context) {
  return new ApplicationRepository(ctx.clients.masterdata, (message) =>
    ctx.vtex.logger.warn({ message })
  )
}

export async function stageConfig(ctx: Context): Promise<StageConfig> {
  const appId = process.env.VTEX_APP_ID as string
  const settings = await ctx.clients.apps.getAppSettings(appId)

  return resolveStages(settings)
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
