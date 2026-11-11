import type {
  ClientsConfig,
  ParamsContext,
  RecorderState,
  ServiceContext,
} from '@vtex/api'
import { Service } from '@vtex/api'

import { Clients } from './clients'
import { spikeMutations, spikeQueries } from './resolvers/spike'

const clients: ClientsConfig<Clients> = {
  implementation: Clients,
  options: {
    default: {
      retries: 0,
      timeout: 15000,
    },
  },
}

declare global {
  type Context = ServiceContext<Clients, RecorderState>
}

export default new Service<Clients, RecorderState, ParamsContext>({
  clients,
  graphql: {
    resolvers: {
      Query: {
        ...spikeQueries,
      },
      Mutation: {
        ...spikeMutations,
      },
    },
  },
})
