import { AccountMasterData } from '../clients/accountMasterData'
import { B2BOrganizations } from '../clients/b2bOrganizations'
import { MasterDataFiles } from '../clients/masterDataFiles'

/*
 * Calls that create something must not be retried: a retry after a timeout
 * could create it twice. These call the client methods with a stand-in HTTP
 * layer and check the options they pass.
 */

const lastOptions = (fn: jest.Mock) =>
  fn.mock.calls[fn.mock.calls.length - 1].slice(-1)[0]

describe('calls that create something are never retried', () => {
  it('Master Data: creating a document', async () => {
    const post = jest.fn().mockResolvedValue({ DocumentId: 'doc-1' })

    await AccountMasterData.prototype.createDocument.call(
      { http: { post } },
      'b2b_onboarding_event',
      { type: 'SUBMITTED' },
      'v1'
    )

    expect(lastOptions(post)).toMatchObject({
      retries: 0,
      metric: 'amd-create',
    })
  })

  it('B2B Organizations: creating an organization request', async () => {
    const mutate = jest.fn().mockResolvedValue({
      data: { createOrganizationRequest: { id: 'req-1' } },
    })

    await B2BOrganizations.prototype.createRequest.call(
      { graphql: { mutate }, adminHeaders: () => ({}) },
      { name: 'TEST' }
    )

    expect(lastOptions(mutate)).toMatchObject({
      retries: 0,
      metric: 'b2b-org-create-request',
    })
  })

  it('Attachments: creating the document record and uploading the file', async () => {
    const post = jest.fn().mockResolvedValue({ DocumentId: 'doc-1' })
    const self = { http: { post } }

    await MasterDataFiles.prototype.createDocument.call(self, 'BD', {})
    expect(lastOptions(post)).toMatchObject({ retries: 0 })

    await MasterDataFiles.prototype.upload.call(self, 'BD', 'doc-1', 'file', {
      name: 'TEST.pdf',
      contentType: 'application/pdf',
      data: Buffer.from('%PDF-1.4'),
    })
    expect(lastOptions(post)).toMatchObject({
      retries: 0,
      metric: 'md-files-upload',
    })
  })

  it('still lets safe calls use the default retries', async () => {
    const put = jest.fn().mockResolvedValue({})

    await AccountMasterData.prototype.putDocument.call(
      { http: { put } },
      'b2b_onboarding_application',
      'APP-1',
      {},
      'v1'
    )

    expect(lastOptions(put).retries).toBeUndefined()
  })
})
