import { IOClients } from '@vtex/api'

import { B2BOrganizations } from './b2bOrganizations'

export class Clients extends IOClients {
  public get b2bOrganizations() {
    return this.getOrSet('b2bOrganizations', B2BOrganizations)
  }
}
