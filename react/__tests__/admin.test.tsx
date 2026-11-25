import React from 'react'
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { useApolloClient, useMutation, useQuery } from 'react-apollo'
import { useRuntime } from 'vtex.render-runtime'

import { adminMessages as m } from '../admin/messages'
import type {
  ApplicationDetail,
  KycCheckInfo,
  ListItem,
  Stage,
} from '../admin/types'
import ReviewDetail from '../ReviewDetail'
import ReviewQueue from '../ReviewQueue'
import { renderWithIntl, text } from './support/render'
import { navigate } from './support/vtex.render-runtime'

jest.mock('react-apollo', () => ({
  useQuery: jest.fn(),
  useMutation: jest.fn(),
  useApolloClient: jest.fn(),
}))

const useQueryMock = useQuery as jest.Mock
const useMutationMock = useMutation as jest.Mock
const useApolloClientMock = useApolloClient as jest.Mock

const STAGES: Stage[] = [
  { id: 'document-review', label: 'Document review', type: 'REVIEW' },
  { id: 'compliance-check', label: 'Compliance check', type: 'VERIFICATION' },
  { id: 'final-approval', label: 'Final approval', type: 'APPROVAL' },
]

beforeEach(() => {
  jest.clearAllMocks()
  ;(useRuntime as jest.Mock).mockReturnValue({ navigate, rootPath: '' })
})

const button = (name: string | RegExp) => screen.getByRole('button', { name })

describe('ReviewQueue', () => {
  const item = (overrides: Partial<ListItem>): ListItem => ({
    id: 'APP-1',
    reference: 'APP-1',
    status: 'IN_REVIEW',
    companyName: 'TEST - One',
    registrationNumber: 'REG-1',
    currentStageIndex: 0,
    stages: STAGES,
    submittedAt: '2026-11-20T10:00:00.000Z',
    updatedAt: '2026-11-20T10:00:00.000Z',
    ...overrides,
  })

  const ITEMS = [
    item({}),
    item({
      id: 'APP-2',
      reference: 'APP-2',
      companyName: 'TEST - Two',
      currentStageIndex: 2,
    }),
    item({
      id: 'APP-3',
      reference: 'APP-3',
      companyName: 'TEST - Three',
      status: 'APPROVED',
      currentStageIndex: 2,
    }),
  ]

  function answer(items: ListItem[], total = items.length) {
    useQueryMock.mockReturnValue({
      loading: false,
      error: undefined,
      data: {
        onboardingApplications: {
          items,
          pagination: { total, page: 1, pageSize: 20 },
        },
      },
    })
  }

  it('lists applications with their step, and opens one on click', () => {
    answer(ITEMS)
    renderWithIntl(<ReviewQueue />)

    expect(screen.getByText('TEST - One')).toBeTruthy()
    expect(
      screen.getByText(
        text(m.stageOf, { current: 1, total: 3, label: 'Document review' })
      )
    ).toBeTruthy()
    expect(screen.getByText(text(m.allDone))).toBeTruthy()

    fireEvent.click(screen.getByText('TEST - Two'))
    expect(navigate).toHaveBeenCalledWith({
      to: '/admin/app/b2b-onboarding/APP-2',
    })
  })

  it('filters by status on the server, and "waiting for approval" on the page', () => {
    answer(ITEMS)
    renderWithIntl(<ReviewQueue />)

    expect(useQueryMock.mock.calls[0][1].variables).toEqual({
      status: undefined,
      page: 1,
      pageSize: 20,
    })

    fireEvent.click(button(text(m.filterRejected)))
    expect(useQueryMock.mock.calls.slice(-1)[0][1].variables.status).toBe(
      'REJECTED'
    )

    fireEvent.click(button(text(m.filterWaiting)))
    expect(useQueryMock.mock.calls.slice(-1)[0][1].variables.status).toBe(
      'IN_REVIEW'
    )
    expect(button(text(m.filterWaiting)).getAttribute('aria-pressed')).toBe(
      'true'
    )
    // Only the one at its approval stage
    expect(screen.getByText('TEST - Two')).toBeTruthy()
    expect(screen.queryByText('TEST - One')).toBeNull()
  })

  it('pages through more than 20 applications', () => {
    answer(ITEMS, 45)
    renderWithIntl(<ReviewQueue />)

    expect(screen.getByText(text(m.pageOf, { page: 1, pages: 3 }))).toBeTruthy()
    expect((button(text(m.previous)) as HTMLButtonElement).disabled).toBe(true)

    fireEvent.click(button(text(m.next)))
    expect(useQueryMock.mock.calls.slice(-1)[0][1].variables.page).toBe(2)
    fireEvent.click(button(text(m.previous)))
    expect(useQueryMock.mock.calls.slice(-1)[0][1].variables.page).toBe(1)
  })

  it('shows loading, empty and error states', () => {
    useQueryMock.mockReturnValue({ loading: true })
    const { unmount } = renderWithIntl(<ReviewQueue />)

    expect(screen.getByRole('progressbar')).toBeTruthy()
    unmount()

    answer([])
    const empty = renderWithIntl(<ReviewQueue />)

    expect(screen.getByText(text(m.empty))).toBeTruthy()
    empty.unmount()

    useQueryMock.mockReturnValue({ loading: false, error: new Error('x') })
    renderWithIntl(<ReviewQueue />)
    expect(screen.getByRole('alert').textContent).toBe(text(m.loadError))
  })
})

describe('ReviewDetail', () => {
  const doc = (kind: string, status = 'NEEDS_REVIEW') => ({
    kind,
    fileName: `${kind}.pdf`,
    contentType: kind === 'TAX_CERTIFICATE' ? 'image/png' : 'application/pdf',
    size: 2048,
    uploadedAt: '2026-11-20T10:00:00.000Z',
    status: status as 'NEEDS_REVIEW',
    lastReview:
      status === 'NEEDS_REVIEW'
        ? null
        : {
            decision: status as 'ACCEPTED',
            actor: 'reviewer@example.com',
            note: 'Looks fine',
            at: '2026-11-21T10:00:00.000Z',
          },
  })

  const check = (overrides: Partial<KycCheckInfo>): KycCheckInfo => ({
    kind: 'PAN',
    status: 'VERIFIED',
    effectiveStatus: 'VERIFIED',
    code: 'ACTIVE',
    message: 'PAN XXXXX1234F is active',
    provider: 'Mock KYC provider (demo)',
    reference: 'MOCK-KYC-1',
    registeredName: 'TEST - KYC DEMO PVT LTD',
    checkedAt: '2026-11-21T10:00:00.000Z',
    nameMatch: {
      comparedWith: 'TEST - KYC Demo Pvt Ltd',
      registeredName: 'TEST - KYC DEMO PVT LTD',
      score: 1,
      band: 'STRONG',
    },
    decision: null,
    ...overrides,
  })

  function application(
    overrides: Partial<ApplicationDetail> = {}
  ): ApplicationDetail {
    const index = overrides.currentStageIndex ?? 0

    return {
      id: 'APP-1',
      reference: 'APP-1',
      status: 'IN_REVIEW',
      companyName: 'TEST - KYC Demo Pvt Ltd',
      tradeName: 'KYC Demo',
      registrationNumber: 'REG-12345',
      taxId: null,
      contact: {
        firstName: 'Test',
        lastName: 'Applicant',
        email: 'applicant@example.com',
        phone: null,
      },
      address: {
        street: 'TEST Street',
        number: '1',
        complement: null,
        city: 'Kolkata',
        state: 'WB',
        postalCode: '700001',
        country: 'IND',
        receiverName: null,
      },
      stages: STAGES,
      currentStageIndex: index,
      currentStage: STAGES[index],
      verification: null,
      india: null,
      kycChecks: null,
      verificationOutcome: 'NOT_RUN',
      documents: [doc('REGISTRATION_CERTIFICATE'), doc('TAX_CERTIFICATE')],
      rejectionReason: null,
      organizationId: null,
      submittedAt: '2026-11-20T10:00:00.000Z',
      updatedAt: null,
      decidedAt: null,
      events: [],
      ...overrides,
    }
  }

  const INDIA = {
    maskedPan: 'XXXXX1234F',
    importsOrExports: true,
    iec: '0512345678',
    udyam: null,
    maskedAccountNumber: 'XXXXXXXX9017',
    ifsc: 'HDFC0001234',
    accountHolderName: 'TEST - KYC Demo Pvt Ltd',
  }

  /** Mutations by GraphQL file name, each a jest.fn resolving to `result` */
  let mutations: Record<string, jest.Mock>
  let refetch: jest.Mock

  function show(app: ApplicationDetail | null, state = {}) {
    refetch = jest.fn().mockResolvedValue({})
    useQueryMock.mockReturnValue({
      data: app ? { onboardingApplication: app } : undefined,
      loading: false,
      error: undefined,
      refetch,
      ...state,
    })

    mutations = {}
    useMutationMock.mockImplementation((document: string) => {
      mutations[document] =
        mutations[document] ?? jest.fn().mockResolvedValue({ data: {} })

      return [mutations[document]]
    })

    return renderWithIntl(<ReviewDetail params={{ id: 'APP-1' }} />)
  }

  const variablesOf = (document: string) =>
    mutations[document].mock.calls[0][0].variables

  it('loads the application by ID, always from the network', () => {
    show(application())

    expect(useQueryMock).toHaveBeenCalledWith('application.graphql', {
      variables: { id: 'APP-1' },
      fetchPolicy: 'network-only',
    })
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
      'TEST - KYC Demo Pvt Ltd'
    )
    // The country's name, not its code, at the end of the address
    expect(screen.getByText(/India$/)).toBeTruthy()

    fireEvent.click(button(text(m.back)))
    expect(navigate).toHaveBeenCalledWith({ to: '/admin/app/b2b-onboarding' })
  })

  it('shows loading and error states', () => {
    const loading = show(null, { loading: true })

    expect(screen.getByRole('progressbar')).toBeTruthy()
    loading.unmount()

    show(null, { error: new Error('x') })
    expect(screen.getByRole('alert').textContent).toBe(text(m.loadError))
  })

  it('accepts documents, then passes Document review with the note', async () => {
    show(application())

    const pass = button(text(m.passStage, { stage: 'Document review' }))

    expect((pass as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText(text(m.passHintReview))).toBeTruthy()

    await act(async () => {
      fireEvent.click(
        screen.getAllByRole('button', { name: text(m.accept) })[0]
      )
    })

    expect(variablesOf('reviewDocument.graphql')).toEqual({
      id: 'APP-1',
      stageId: 'document-review',
      kind: 'REGISTRATION_CERTIFICATE',
      decision: 'ACCEPT',
    })
    expect(refetch).toHaveBeenCalled()
  })

  it('passes a stage once its documents are accepted', async () => {
    show(
      application({
        documents: [
          doc('REGISTRATION_CERTIFICATE', 'ACCEPTED'),
          doc('TAX_CERTIFICATE', 'ACCEPTED'),
        ],
      })
    )

    expect(screen.getAllByText(/Looks fine/)).toHaveLength(2)

    fireEvent.change(screen.getByLabelText(text(m.internalNote)), {
      target: { value: 'All good' },
    })

    await act(async () => {
      fireEvent.click(button(text(m.passStage, { stage: 'Document review' })))
    })

    expect(variablesOf('decideStage.graphql')).toEqual({
      id: 'APP-1',
      stageId: 'document-review',
      decision: 'PASS',
      note: 'All good',
    })
  })

  it('rejects a document with an internal note', async () => {
    show(application())

    fireEvent.click(screen.getAllByRole('button', { name: text(m.reject) })[1])

    const dialog = screen.getByRole('dialog')

    fireEvent.change(within(dialog).getByLabelText(text(m.internalNote)), {
      target: { value: 'Expired certificate' },
    })

    await act(async () => {
      fireEvent.click(within(dialog).getByText(text(m.confirmReject)))
    })

    expect(variablesOf('reviewDocument.graphql')).toEqual({
      id: 'APP-1',
      stageId: 'document-review',
      kind: 'TAX_CERTIFICATE',
      decision: 'REJECT',
      note: 'Expired certificate',
    })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('rejects the application only with a reason of 10 characters', async () => {
    show(application())

    fireEvent.click(button(text(m.rejectApplication)))

    const dialog = screen.getByRole('dialog')
    const confirm = within(dialog).getByText(
      text(m.confirmReject)
    ) as HTMLButtonElement

    expect(confirm.disabled).toBe(true)

    fireEvent.change(within(dialog).getByLabelText(text(m.reasonLabel)), {
      target: { value: 'Not a real business' },
    })
    expect(confirm.disabled).toBe(false)

    await act(async () => {
      fireEvent.click(confirm)
    })

    expect(variablesOf('decideStage.graphql')).toMatchObject({
      decision: 'REJECT',
      reason: 'Not a real business',
    })
  })

  it('closes dialogs without acting', () => {
    show(application())

    fireEvent.click(button(text(m.rejectApplication)))
    fireEvent.click(
      within(screen.getByRole('dialog')).getByText(text(m.cancel))
    )
    expect(screen.queryByRole('dialog')).toBeNull()

    fireEvent.click(screen.getAllByRole('button', { name: text(m.reject) })[0])
    fireEvent.click(screen.getByText('Close dialog'))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('runs the verification and shows the India checks with their name match', async () => {
    show(
      application({
        currentStageIndex: 1,
        india: INDIA,
        verificationOutcome: 'NOT_RUN',
      })
    )

    expect(screen.getByText(text(m.kycNotChecked))).toBeTruthy()
    expect(screen.getByText('XXXXX1234F')).toBeTruthy()
    expect(screen.getByText(text(m.docOnlyOnReview))).toBeTruthy()

    await act(async () => {
      fireEvent.click(button(text(m.runCheck)))
    })

    expect(variablesOf('runVerification.graphql')).toEqual({
      id: 'APP-1',
      stageId: 'compliance-check',
    })
  })

  it('needs a decision on a check that needs review, with a note of 10 characters', async () => {
    show(
      application({
        currentStageIndex: 1,
        india: INDIA,
        verification: {
          status: 'PASSED',
          code: 'ACTIVE',
          message: 'Active company registered in IND',
          provider: 'Mock company registry (demo)',
          reference: 'MOCK-1',
          registeredName: null,
          checkedAt: '2026-11-21T10:00:00.000Z',
        },
        kycChecks: [
          check({}),
          check({
            kind: 'BANK_ACCOUNT',
            status: 'VERIFIED',
            effectiveStatus: 'MANUAL_REVIEW',
            message: 'Test transfer succeeded',
            nameMatch: {
              comparedWith: 'TEST - KYC Demo Pvt Ltd',
              registeredName: 'TEST - KYC DEMO PRIVATE',
              score: 0.8,
              band: 'PARTIAL',
            },
          }),
        ],
        verificationOutcome: 'NEEDS_DECISION',
      })
    )

    expect(screen.getByText(text(m.passHintNeedsDecision))).toBeTruthy()
    expect(screen.getByText(text(m.runAgain))).toBeTruthy()
    expect(screen.getByText(/80%/)).toBeTruthy()

    fireEvent.click(button(text(m.acceptCheck)))

    const dialog = screen.getByRole('dialog')
    const confirm = within(dialog).getByText(
      text(m.confirmDecision)
    ) as HTMLButtonElement

    fireEvent.change(within(dialog).getByLabelText(text(m.decisionNote)), {
      target: { value: 'short' },
    })
    expect(confirm.disabled).toBe(true)

    fireEvent.change(within(dialog).getByLabelText(text(m.decisionNote)), {
      target: { value: 'Holder name matches the certificate' },
    })

    await act(async () => {
      fireEvent.click(confirm)
    })

    expect(variablesOf('decideKycCheck.graphql')).toEqual({
      id: 'APP-1',
      stageId: 'compliance-check',
      kind: 'BANK_ACCOUNT',
      decision: 'ACCEPT',
      note: 'Holder name matches the certificate',
    })
  })

  it('shows decided and failed checks with the right tags and hints', () => {
    show(
      application({
        currentStageIndex: 1,
        india: INDIA,
        verification: {
          status: 'FAILED',
          code: 'NOT_FOUND',
          message: 'No company with that number',
          provider: 'Mock',
          reference: 'MOCK-2',
          registeredName: null,
          checkedAt: '2026-11-21T10:00:00.000Z',
        },
        kycChecks: [
          check({
            kind: 'PAN',
            effectiveStatus: 'MANUAL_REVIEW',
            decision: {
              decision: 'REJECTED',
              note: 'Name differs',
              actor: 'reviewer@example.com',
              at: '2026-11-21T11:00:00.000Z',
            },
          }),
          check({
            kind: 'IEC',
            effectiveStatus: 'MANUAL_REVIEW',
            decision: {
              decision: 'ACCEPTED',
              note: 'Checked by phone',
              actor: 'reviewer@example.com',
              at: '2026-11-21T11:00:00.000Z',
            },
          }),
          check({ kind: 'UDYAM', effectiveStatus: 'FAILED', nameMatch: null }),
        ],
        verificationOutcome: 'BLOCKED',
      })
    )

    expect(screen.getByText(text(m.passHintBlocked))).toBeTruthy()
    expect(screen.getByText(text(m.kycRejected))).toBeTruthy()
    expect(screen.getByText(text(m.kycAccepted))).toBeTruthy()
    // The registry check and the Udyam check both failed
    expect(screen.getAllByText(text(m.kycFAILED))).toHaveLength(2)
    expect(text(m.checkFailed)).toBe(text(m.kycFAILED))
    expect(screen.getAllByText(/Name differs|Checked by phone/)).toHaveLength(2)
  })

  it('opens a full identifier, records it, and hides it again', async () => {
    show(application({ currentStageIndex: 1, india: INDIA }))

    mutations['revealIdentifier.graphql'].mockResolvedValue({
      data: { revealIdentifier: 'ABCCK1234F' },
    })

    await act(async () => {
      fireEvent.click(screen.getAllByText(text(m.showFull))[0])
    })

    expect(variablesOf('revealIdentifier.graphql')).toEqual({
      id: 'APP-1',
      field: 'PAN',
    })
    expect(screen.getByText('ABCCK1234F')).toBeTruthy()
    expect(refetch).toHaveBeenCalled()

    fireEvent.click(button(text(m.hideFull)))
    expect(screen.queryByText('ABCCK1234F')).toBeNull()
  })

  it('shows an error when an identifier cannot be opened', async () => {
    show(application({ currentStageIndex: 1, india: INDIA }))

    mutations['revealIdentifier.graphql'].mockRejectedValue(
      new Error('Recording failed')
    )

    await act(async () => {
      fireEvent.click(screen.getAllByText(text(m.showFull))[1])
    })

    expect(screen.getByRole('alert').textContent).toContain('Recording failed')
  })

  it('reports a failed action with its message and reloads', async () => {
    show(application())

    mutations['reviewDocument.graphql'].mockRejectedValue({
      graphQLErrors: [
        { message: 'The application is now at "Final approval"' },
      ],
    })

    await act(async () => {
      fireEvent.click(
        screen.getAllByRole('button', { name: text(m.accept) })[0]
      )
    })

    const alert = screen.getByRole('alert')

    expect(alert.textContent).toContain('now at "Final approval"')
    expect(refetch).toHaveBeenCalled()

    fireEvent.click(within(alert).getByText('Close alert'))
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('approves at Final approval', async () => {
    show(application({ currentStageIndex: 2, verificationOutcome: 'READY' }))

    expect(screen.getByText(text(m.passHintApproval))).toBeTruthy()

    await act(async () => {
      fireEvent.click(button(text(m.approve)))
    })

    expect(variablesOf('decideStage.graphql')).toMatchObject({
      stageId: 'final-approval',
      decision: 'PASS',
    })
  })

  it('shows a closed application with its outcome and history', () => {
    show(
      application({
        status: 'APPROVED',
        currentStage: null,
        currentStageIndex: 2,
        organizationId: 'org-123',
        decidedAt: '2026-11-22T10:00:00.000Z',
        events: [
          {
            type: 'SUBMITTED',
            stageId: null,
            stageLabel: null,
            actorType: 'APPLICANT',
            actor: 'applicant',
            reason: null,
            note: null,
            details: null,
            createdAt: '2026-11-20T10:00:00.000Z',
          },
          {
            type: 'DOCUMENT_REVIEWED',
            stageId: 'document-review',
            stageLabel: 'Document review',
            actorType: 'REVIEWER',
            actor: 'reviewer@example.com',
            reason: null,
            note: 'OK',
            details: JSON.stringify({
              kind: 'TAX_CERTIFICATE',
              decision: 'ACCEPTED',
            }),
            createdAt: '2026-11-20T11:00:00.000Z',
          },
          {
            type: 'VERIFICATION_RUN',
            stageId: 'compliance-check',
            stageLabel: 'Compliance check',
            actorType: 'REVIEWER',
            actor: 'reviewer@example.com',
            reason: null,
            note: null,
            details: JSON.stringify({
              status: 'PASSED',
              message: 'Active company',
              kyc: [{ kind: 'PAN', status: 'VERIFIED' }],
            }),
            createdAt: '2026-11-20T12:00:00.000Z',
          },
          {
            type: 'KYC_DECIDED',
            stageId: 'compliance-check',
            stageLabel: 'Compliance check',
            actorType: 'REVIEWER',
            actor: 'reviewer@example.com',
            reason: null,
            note: null,
            details: JSON.stringify({ kind: 'PAN', decision: 'REJECTED' }),
            createdAt: '2026-11-20T13:00:00.000Z',
          },
          {
            type: 'IDENTIFIER_REVEALED',
            stageId: null,
            stageLabel: null,
            actorType: 'REVIEWER',
            actor: 'reviewer@example.com',
            reason: null,
            note: null,
            details: JSON.stringify({ field: 'BANK_ACCOUNT' }),
            createdAt: '2026-11-20T14:00:00.000Z',
          },
          {
            type: 'APPROVAL_FAILED',
            stageId: 'final-approval',
            stageLabel: 'Final approval',
            actorType: 'REVIEWER',
            actor: 'reviewer@example.com',
            reason: null,
            note: null,
            details: JSON.stringify({ message: 'B2B Organizations was down' }),
            createdAt: '2026-11-20T15:00:00.000Z',
          },
          {
            type: 'REJECTED',
            stageId: null,
            stageLabel: null,
            actorType: 'REVIEWER',
            actor: 'reviewer@example.com',
            reason: 'Old reason',
            note: null,
            details: '{not json',
            createdAt: '2026-11-20T16:00:00.000Z',
          },
        ],
      })
    )

    expect(
      screen.getByText(text(m.organizationCreated, { id: 'org-123' }))
    ).toBeTruthy()
    expect(screen.queryByText(text(m.rejectApplication))).toBeNull()
    expect(screen.queryByText(text(m.accept))).toBeNull()
    expect(screen.getByText('B2B Organizations was down')).toBeTruthy()
    expect(screen.getByText('Old reason')).toBeTruthy()
    expect(screen.getByText(/Active company · /)).toBeTruthy()
  })

  it('shows a rejected application with its reason', () => {
    show(
      application({
        status: 'REJECTED',
        rejectionReason: 'Registration certificate has expired',
        decidedAt: null,
      })
    )

    expect(
      screen.getByText(
        text(m.rejectedBecause, {
          reason: 'Registration certificate has expired',
        })
      )
    ).toBeTruthy()
  })

  describe('document viewer', () => {
    const originalUrl = { ...URL }

    beforeEach(() => {
      URL.createObjectURL = jest.fn(() => 'blob:document')
      URL.revokeObjectURL = jest.fn()
    })

    afterEach(() => {
      URL.createObjectURL = originalUrl.createObjectURL
      URL.revokeObjectURL = originalUrl.revokeObjectURL
    })

    it('shows a PDF from base64, with a download link, and frees it on close', async () => {
      const query = jest.fn().mockResolvedValue({
        data: {
          onboardingDocument: {
            contentType: 'application/pdf',
            dataBase64: Buffer.from('%PDF-1.4').toString('base64'),
          },
        },
      })

      useApolloClientMock.mockReturnValue({ query })
      show(application())

      fireEvent.click(screen.getAllByText(text(m.view))[0])

      await waitFor(() =>
        expect(screen.getByText(text(m.download))).toBeTruthy()
      )
      expect(query).toHaveBeenCalledWith({
        query: 'document.graphql',
        variables: { id: 'APP-1', kind: 'REGISTRATION_CERTIFICATE' },
        fetchPolicy: 'no-cache',
      })
      expect(
        document.querySelector('object[type="application/pdf"]')
      ).toBeTruthy()

      fireEvent.click(screen.getByText('Close dialog'))
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:document')
    })

    it('shows an image, or the error when the file cannot be read', async () => {
      const query = jest
        .fn()
        .mockResolvedValueOnce({
          data: {
            onboardingDocument: {
              contentType: 'image/png',
              dataBase64: Buffer.from('png').toString('base64'),
            },
          },
        })
        .mockRejectedValueOnce(new Error('Document not found'))

      useApolloClientMock.mockReturnValue({ query })
      show(application())

      fireEvent.click(screen.getAllByText(text(m.view))[1])
      expect(await screen.findByAltText('TAX_CERTIFICATE.pdf')).toBeTruthy()
      fireEvent.click(screen.getByText('Close dialog'))

      fireEvent.click(screen.getAllByText(text(m.view))[0])
      expect((await screen.findByRole('alert')).textContent).toBe(
        'Document not found'
      )
    })
  })
})
