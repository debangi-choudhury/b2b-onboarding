export type StageType = 'REVIEW' | 'VERIFICATION' | 'APPROVAL'

export interface Stage {
  id: string
  label: string
  type: StageType
}

export type ApplicationStatus = 'IN_REVIEW' | 'APPROVED' | 'REJECTED'

export type VerificationStatus = 'PASSED' | 'FAILED'

export interface VerificationResult {
  status: VerificationStatus
  /** Machine-readable reason, such as NOT_FOUND or DISSOLVED */
  code: string
  message: string
  provider: string
  /** The provider's reference for this check */
  reference: string
  registeredName?: string
  checkedAt: string
}

export interface Address {
  street: string
  number?: string
  complement?: string
  city: string
  state: string
  postalCode: string
  /** ISO 3166-1 alpha-3, such as USA */
  country: string
  receiverName?: string
}

export interface Contact {
  firstName: string
  lastName: string
  email: string
  phone?: string
}

/** What an applicant submits, after validation and normalization */
export interface ApplicationInput {
  companyName: string
  tradeName?: string
  registrationNumber: string
  taxId?: string
  contact: Contact
  address: Address
}

export interface DocumentRef {
  kind: string
  fileName: string
  contentType: string
  size: number
  storageId: string
  uploadedAt: string
}

export interface Application extends ApplicationInput {
  /** The Master Data document ID, which is the same as the reference */
  id: string
  /** Human-friendly reference the applicant sees, such as APP-7K2M9QXD */
  reference: string
  /** SHA-256 of the applicant's status token. The token itself is never stored. */
  tokenHash: string
  status: ApplicationStatus
  /** The stages as configured when the application was submitted */
  stages: Stage[]
  currentStageIndex: number
  currentStageId: string
  verification?: VerificationResult | null
  documents: DocumentRef[]
  rejectionReason?: string | null
  organizationRequestId?: string | null
  organizationId?: string | null
  submittedAt: string
  updatedAt: string
  decidedAt?: string | null
}

export type ActorType = 'APPLICANT' | 'REVIEWER' | 'SYSTEM'

export interface Actor {
  type: ActorType
  /** Reviewer email, or a label for applicant and system actions */
  id: string
}

export type EventType =
  | 'SUBMITTED'
  | 'VERIFICATION_RUN'
  | 'STAGE_PASSED'
  | 'APPROVED'
  | 'REJECTED'
  | 'APPROVAL_FAILED'

export interface ApplicationEvent {
  id?: string
  applicationId: string
  type: EventType
  stageId?: string | null
  stageLabel?: string | null
  actorType: ActorType
  actor: string
  reason?: string | null
  note?: string | null
  /** JSON string with event-specific data */
  details?: string | null
  createdAt: string
}
