import type {
  ClientsConfig,
  ParamsContext,
  RecorderState,
  ServiceContext,
} from '@vtex/api'
import { method, Service } from '@vtex/api'

import { Clients } from './clients'
import {
  applicationFields,
  reviewMutations,
  reviewQueries,
} from './resolvers/review'
import { apply, status } from './routes/applicant'

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
  routes: {
    apply: method({ POST: apply }),
    status: method({ POST: status }),
  },
  graphql: {
    resolvers: {
      Application: applicationFields,
      Query: reviewQueries,
      Mutation: reviewMutations,
    },
  },
})
