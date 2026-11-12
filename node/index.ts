import type {
  ClientsConfig,
  ParamsContext,
  RecorderState,
  ServiceContext,
} from '@vtex/api'
import { Service } from '@vtex/api'

import { Clients } from './clients'
import { applicantMutations, applicantQueries } from './resolvers/applicant'
import {
  applicationFields,
  reviewMutations,
  reviewQueries,
} from './resolvers/review'

const clients: ClientsConfig<Clients> = {
  implementation: Clients,
  options: {
    default: {
      retries: 1,
      timeout: 15000,
    },
  },
}

declare global {
  type Context = ServiceContext<Clients>
}

export default new Service<Clients, RecorderState, ParamsContext>({
  clients,
  graphql: {
    resolvers: {
      Application: applicationFields,
      Query: {
        ...applicantQueries,
        ...reviewQueries,
      },
      Mutation: {
        ...applicantMutations,
        ...reviewMutations,
      },
    },
  },
})
