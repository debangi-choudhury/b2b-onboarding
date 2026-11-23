import { IOClients } from '@vtex/api'

import { AccountMasterData } from './accountMasterData'
import { B2BOrganizations } from './b2bOrganizations'
import { MasterDataFiles } from './masterDataFiles'

export class Clients extends IOClients {
  public get b2bOrganizations() {
    return this.getOrSet('b2bOrganizations', B2BOrganizations)
  }

  public get accountMasterData() {
    return this.getOrSet('accountMasterData', AccountMasterData)
  }

  public get masterDataFiles() {
    return this.getOrSet('masterDataFiles', MasterDataFiles)
  }
}
