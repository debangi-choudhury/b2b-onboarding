import type { NameMatch } from './nameMatch'

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

/** The checks a KYC provider runs for India applications */
export type KycCheckKind = 'PAN' | 'IEC' | 'UDYAM' | 'BANK_ACCOUNT'

export type KycStatus = 'VERIFIED' | 'FAILED' | 'MANUAL_REVIEW'

/** What a KYC provider returns for one check */
export interface KycResult {
  kind: KycCheckKind
  status: KycStatus
  /** Machine-readable reason, such as NOT_FOUND or PROVIDER_UNDECIDED */
  code: string
  /** Shown to reviewers. Never contains a full PAN or account number. */
  message: string
  provider: string
  /** The provider's reference for this check */
  reference: string
  /** The name the provider has on record, for name matching */
  registeredName?: string
  checkedAt: string
}

/** A provider's result as stored on the application, with the name match */
export interface KycCheck extends KycResult {
  /** Set when the provider returned a registered name */
  nameMatch?: NameMatch | null
  /** The worse of the provider's status and the name match's */
  effectiveStatus: KycStatus
}

/**
 * A reviewer's decision on a check that needed one (MANUAL_REVIEW). Kept in
 * their own list, not on the check, so running verification again (which
 * replaces the checks) never loses one from the history.
 */
export interface KycDecision {
  kind: KycCheckKind
  /** The provider reference of the check decided */
  checkReference: string
  decision: 'ACCEPTED' | 'REJECTED'
  note: string
  stageId: string
  stageLabel: string
  actor: string
  at: string
}

/** Identifiers a reviewer can open in full. Each opening is recorded. */
export type RevealableIdentifier = 'PAN' | 'BANK_ACCOUNT'

export interface IdentifierReveal {
  field: RevealableIdentifier
  actor: string
  at: string
}

export interface BankAccount {
  accountNumber: string
  ifsc: string
  holderName: string
}

/** Business identifiers asked for when the country is India (IND) */
export interface IndiaIdentifiers {
  pan: string
  importsOrExports: boolean
  /** Required when importsOrExports is true */
  iec?: string
  /** MSMEs only */
  udyam?: string
  bank: BankAccount
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
  /** Only when address.country is IND. Older applications don't have it. */
  india?: IndiaIdentifiers | null
}

export type DocumentStatus = 'NEEDS_REVIEW' | 'ACCEPTED' | 'REJECTED'

/** One reviewer decision on one document. The latest one is its status. */
export interface DocumentReview {
  decision: 'ACCEPTED' | 'REJECTED'
  stageId: string
  stageLabel: string
  actor: string
  note?: string | null
  at: string
}

export interface DocumentRef {
  kind: string
  fileName: string
  contentType: string
  size: number
  storageId: string
  uploadedAt: string
  /**
   * Kept on the document rather than as history events, because the history
   * entity's schema was locked when this was added. The API merges these into
   * the history it returns.
   */
  reviews?: DocumentReview[]
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
  /** India applications only, from the last verification run */
  kycChecks?: KycCheck[] | null
  kycDecisions?: KycDecision[] | null
  identifierReveals?: IdentifierReveal[] | null
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
  | 'DOCUMENT_REVIEWED'
  | 'VERIFICATION_RUN'
  | 'STAGE_PASSED'
  | 'APPROVED'
  | 'REJECTED'
  | 'APPROVAL_FAILED'
  // Not stored as events: merged into the history from the application record
  | 'KYC_DECIDED'
  | 'IDENTIFIER_REVEALED'

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
