import { TooManyRequestsError, UserInputError } from '@vtex/api'

import { RateLimiter } from '../domain/rateLimit'
import {
  hashToken,
  isReference,
  newReference,
  newStatusToken,
  tokenMatches,
} from '../domain/statusToken'
import { validateApplication } from '../domain/validation'
import { currentStage, newApplication } from '../domain/workflow'
import { repository, stageConfig } from './shared'

// Per replica: 5 submissions and 30 status checks per client per 10 minutes
const submissions = new RateLimiter(5, 10 * 60 * 1000)
const statusChecks = new RateLimiter(30, 10 * 60 * 1000)

function clientKey(ctx: Context): string {
  const forwarded = ctx.get('x-forwarded-for').split(',')[0].trim()

  return forwarded || ctx.ip || 'unknown'
}

export const applicantMutations = {
  submitApplication: async (
    _: unknown,
    { input }: { input: unknown },
    ctx: Context
  ) => {
    if (!submissions.allow(clientKey(ctx), Date.now())) {
      throw new TooManyRequestsError('Too many applications. Try again later.')
    }

    const result = validateApplication(input)

    if (!result.ok) {
      throw new UserInputError({
        message: 'The application has invalid fields',
        code: 'INVALID_FIELDS',
        fields: result.errors,
      })
    }

    const { stages } = await stageConfig(ctx)
    const reference = newReference()
    const token = newStatusToken()
    const now = new Date()

    const { application, event } = newApplication(
      result.value,
      stages,
      { reference, tokenHash: hashToken(token) },
      now
    )

    const repo = repository(ctx)
    const id = await repo.create(application)

    await repo.addEvents(id, [event])

    // The token is returned once and never stored. The applicant keeps it.
    return {
      reference,
      statusToken: token,
      submittedAt: application.submittedAt,
    }
  },
}

export const applicantQueries = {
  applicationStatus: async (
    _: unknown,
    { reference, token }: { reference: string; token: string },
    ctx: Context
  ) => {
    if (!statusChecks.allow(clientKey(ctx), Date.now())) {
      throw new TooManyRequestsError('Too many status checks. Try again later.')
    }

    const normalized = (reference || '').trim().toUpperCase()

    // One answer for a bad reference, an unknown one and a wrong token, so
    // the endpoint can't be used to discover which references exist.
    const notFound = () => {
      throw new UserInputError({
        message: 'No application matches this reference and code',
        code: 'NOT_FOUND',
      })
    }

    if (!isReference(normalized)) {
      return notFound()
    }

    const app = await repository(ctx).findByReference(normalized)

    if (!app || !tokenMatches(token, app.tokenHash)) {
      return notFound()
    }

    return {
      reference: app.reference,
      companyName: app.companyName,
      status: app.status,
      currentStageLabel:
        app.status === 'IN_REVIEW' ? currentStage(app).label : null,
      rejectionReason: app.status === 'REJECTED' ? app.rejectionReason : null,
      submittedAt: app.submittedAt,
      decidedAt: app.decidedAt,
    }
  },
}
