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
    const repo = repository(ctx)
    const token = newStatusToken()
    const now = new Date()

    // A reference clash is about 1 in a trillion; try a few anyway.
    for (let attempt = 0; attempt < 3; attempt++) {
      const reference = newReference()
      const { application, event } = newApplication(
        result.value,
        stages,
        { reference, tokenHash: hashToken(token) },
        now
      )

      // eslint-disable-next-line no-await-in-loop
      if (await repo.create(application)) {
        // eslint-disable-next-line no-await-in-loop
        await repo.addEvents(reference, [event])

        // The token is returned once and never stored. The applicant keeps it.
        return {
          reference,
          statusToken: token,
          submittedAt: application.submittedAt,
        }
      }
    }

    throw new Error('Could not allocate an application reference')
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

    const app = await repository(ctx).get(normalized)

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
