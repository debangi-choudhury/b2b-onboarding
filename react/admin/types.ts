export type ApplicationStatus = 'IN_REVIEW' | 'APPROVED' | 'REJECTED'
export type StageType = 'REVIEW' | 'VERIFICATION' | 'APPROVAL'
export type DocumentStatus = 'NEEDS_REVIEW' | 'ACCEPTED' | 'REJECTED'

export interface Stage {
  id: string
  label: string
  type: StageType
}

export interface ListItem {
  id: string
  reference: string
  status: ApplicationStatus
  companyName: string
  registrationNumber: string
  currentStageIndex: number
  stages: Stage[]
  submittedAt: string
  updatedAt: string
}

export interface DocumentInfo {
  kind: string
  fileName: string
  contentType: string
  size: number
  uploadedAt: string
  status: DocumentStatus
  lastReview: {
    decision: DocumentStatus
    actor: string
    note: string | null
    at: string
  } | null
}

export interface HistoryEvent {
  type: string
  stageId: string | null
  stageLabel: string | null
  actorType: 'APPLICANT' | 'REVIEWER' | 'SYSTEM'
  actor: string
  reason: string | null
  note: string | null
  details: string | null
  createdAt: string
}

export interface ApplicationDetail {
  id: string
  reference: string
  status: ApplicationStatus
  companyName: string
  tradeName: string | null
  registrationNumber: string
  taxId: string | null
  contact: {
    firstName: string
    lastName: string
    email: string
    phone: string | null
  }
  address: {
    street: string
    number: string | null
    complement: string | null
    city: string
    state: string
    postalCode: string
    country: string
    receiverName: string | null
  }
  stages: Stage[]
  currentStageIndex: number
  currentStage: Stage | null
  verification: {
    status: 'PASSED' | 'FAILED'
    code: string
    message: string
    provider: string
    reference: string
    registeredName: string | null
    checkedAt: string
  } | null
  documents: DocumentInfo[]
  rejectionReason: string | null
  organizationId: string | null
  submittedAt: string
  updatedAt: string | null
  decidedAt: string | null
  events: HistoryEvent[]
}

/** "Waiting for approval": in review and at the final APPROVAL stage */
export function isWaitingForApproval(app: {
  status: ApplicationStatus
  stages: Stage[]
  currentStageIndex: number
}) {
  return (
    app.status === 'IN_REVIEW' &&
    app.stages[app.currentStageIndex]?.type === 'APPROVAL'
  )
}
