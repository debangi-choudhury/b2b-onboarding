import { defineMessages } from 'react-intl'

// Every Admin message is declared here so the react builder can extract it.
export const adminMessages = defineMessages({
  navTitle: {
    id: 'admin/b2b-onboarding.navigation.title',
    defaultMessage: 'B2B onboarding',
  },
  navLabel: {
    id: 'admin/b2b-onboarding.navigation.label',
    defaultMessage: 'Applications',
  },
  queueTitle: {
    id: 'admin/b2b-onboarding.queue.title',
    defaultMessage: 'Business applications',
  },
  queueSubtitle: {
    id: 'admin/b2b-onboarding.queue.subtitle',
    defaultMessage:
      'Review new B2B customers stage by stage. Approval creates their organization.',
  },
  filterAll: { id: 'admin/b2b-onboarding.filter.all', defaultMessage: 'All' },
  filterInReview: {
    id: 'admin/b2b-onboarding.filter.in-review',
    defaultMessage: 'In review',
  },
  filterWaiting: {
    id: 'admin/b2b-onboarding.filter.waiting',
    defaultMessage: 'Waiting for approval',
  },
  filterApproved: {
    id: 'admin/b2b-onboarding.filter.approved',
    defaultMessage: 'Approved',
  },
  filterRejected: {
    id: 'admin/b2b-onboarding.filter.rejected',
    defaultMessage: 'Rejected',
  },
  colReference: {
    id: 'admin/b2b-onboarding.col.reference',
    defaultMessage: 'Reference',
  },
  colCompany: {
    id: 'admin/b2b-onboarding.col.company',
    defaultMessage: 'Company',
  },
  colRegistration: {
    id: 'admin/b2b-onboarding.col.registration',
    defaultMessage: 'Registration number',
  },
  colSubmitted: {
    id: 'admin/b2b-onboarding.col.submitted',
    defaultMessage: 'Submitted',
  },
  colProgress: {
    id: 'admin/b2b-onboarding.col.progress',
    defaultMessage: 'Progress',
  },
  colStatus: {
    id: 'admin/b2b-onboarding.col.status',
    defaultMessage: 'Status',
  },
  empty: {
    id: 'admin/b2b-onboarding.queue.empty',
    defaultMessage: 'No applications here yet.',
  },
  loadError: {
    id: 'admin/b2b-onboarding.load-error',
    defaultMessage: "Couldn't load applications. Reload the page to try again.",
  },
  previous: { id: 'admin/b2b-onboarding.previous', defaultMessage: 'Previous' },
  next: { id: 'admin/b2b-onboarding.next', defaultMessage: 'Next' },
  pageOf: {
    id: 'admin/b2b-onboarding.page-of',
    defaultMessage: 'Page {page} of {pages}',
  },
  stageOf: {
    id: 'admin/b2b-onboarding.stage-of',
    defaultMessage: 'Step {current} of {total}: {label}',
  },
  allDone: {
    id: 'admin/b2b-onboarding.all-done',
    defaultMessage: 'All steps done',
  },
  statusIN_REVIEW: {
    id: 'admin/b2b-onboarding.status.in-review',
    defaultMessage: 'In review',
  },
  statusAPPROVED: {
    id: 'admin/b2b-onboarding.status.approved',
    defaultMessage: 'Approved',
  },
  statusREJECTED: {
    id: 'admin/b2b-onboarding.status.rejected',
    defaultMessage: 'Rejected',
  },
  statusWAITING: {
    id: 'admin/b2b-onboarding.status.waiting',
    defaultMessage: 'Waiting for approval',
  },
  back: { id: 'admin/b2b-onboarding.back', defaultMessage: 'All applications' },
  submittedOn: {
    id: 'admin/b2b-onboarding.submitted-on',
    defaultMessage: 'Submitted {date}',
  },
  company: {
    id: 'admin/b2b-onboarding.section.company',
    defaultMessage: 'Company',
  },
  contact: {
    id: 'admin/b2b-onboarding.section.contact',
    defaultMessage: 'Account administrator',
  },
  address: {
    id: 'admin/b2b-onboarding.section.address',
    defaultMessage: 'Business address',
  },
  documents: {
    id: 'admin/b2b-onboarding.section.documents',
    defaultMessage: 'Documents',
  },
  verification: {
    id: 'admin/b2b-onboarding.section.verification',
    defaultMessage: 'Eligibility check',
  },
  history: {
    id: 'admin/b2b-onboarding.section.history',
    defaultMessage: 'Audit trail',
  },
  currentStep: {
    id: 'admin/b2b-onboarding.section.current-step',
    defaultMessage: 'Current step',
  },
  tradeName: {
    id: 'admin/b2b-onboarding.field.trade-name',
    defaultMessage: 'Trade name',
  },
  registration: {
    id: 'admin/b2b-onboarding.field.registration',
    defaultMessage: 'Registration number',
  },
  taxId: { id: 'admin/b2b-onboarding.field.tax-id', defaultMessage: 'Tax ID' },
  name: { id: 'admin/b2b-onboarding.field.name', defaultMessage: 'Name' },
  email: { id: 'admin/b2b-onboarding.field.email', defaultMessage: 'Email' },
  phone: { id: 'admin/b2b-onboarding.field.phone', defaultMessage: 'Phone' },
  docREGISTRATION_CERTIFICATE: {
    id: 'admin/b2b-onboarding.document.registration',
    defaultMessage: 'Business registration certificate',
  },
  docTAX_CERTIFICATE: {
    id: 'admin/b2b-onboarding.document.tax',
    defaultMessage: 'Tax certificate',
  },
  docNEEDS_REVIEW: {
    id: 'admin/b2b-onboarding.document.needs-review',
    defaultMessage: 'Needs review',
  },
  docACCEPTED: {
    id: 'admin/b2b-onboarding.document.accepted',
    defaultMessage: 'Accepted',
  },
  docREJECTED: {
    id: 'admin/b2b-onboarding.document.rejected',
    defaultMessage: 'Rejected',
  },
  view: { id: 'admin/b2b-onboarding.document.view', defaultMessage: 'View' },
  download: {
    id: 'admin/b2b-onboarding.document.download',
    defaultMessage: 'Download',
  },
  accept: {
    id: 'admin/b2b-onboarding.document.accept',
    defaultMessage: 'Accept',
  },
  reject: {
    id: 'admin/b2b-onboarding.document.reject',
    defaultMessage: 'Reject',
  },
  reviewedBy: {
    id: 'admin/b2b-onboarding.document.reviewed-by',
    defaultMessage: '{decision} by {actor}, {date}',
  },
  docOnlyOnReview: {
    id: 'admin/b2b-onboarding.document.only-on-review',
    defaultMessage: 'Documents are accepted or rejected on review stages.',
  },
  notChecked: {
    id: 'admin/b2b-onboarding.verification.not-checked',
    defaultMessage: 'Not checked yet.',
  },
  runCheck: {
    id: 'admin/b2b-onboarding.verification.run',
    defaultMessage: 'Run check',
  },
  runAgain: {
    id: 'admin/b2b-onboarding.verification.run-again',
    defaultMessage: 'Run again',
  },
  checkPassed: {
    id: 'admin/b2b-onboarding.verification.passed',
    defaultMessage: 'Passed',
  },
  checkFailed: {
    id: 'admin/b2b-onboarding.verification.failed',
    defaultMessage: 'Failed',
  },
  checkedBy: {
    id: 'admin/b2b-onboarding.verification.checked-by',
    defaultMessage: '{provider}, reference {reference}, {date}',
  },
  passStage: {
    id: 'admin/b2b-onboarding.action.pass',
    defaultMessage: 'Pass "{stage}"',
  },
  approve: {
    id: 'admin/b2b-onboarding.action.approve',
    defaultMessage: 'Approve and create organization',
  },
  rejectApplication: {
    id: 'admin/b2b-onboarding.action.reject',
    defaultMessage: 'Reject application',
  },
  passHintReview: {
    id: 'admin/b2b-onboarding.action.hint-review',
    defaultMessage: 'Accept every document to pass this step.',
  },
  passHintVerification: {
    id: 'admin/b2b-onboarding.action.hint-verification',
    defaultMessage:
      'The eligibility check must pass before this step can pass.',
  },
  passHintApproval: {
    id: 'admin/b2b-onboarding.action.hint-approval',
    defaultMessage:
      'Approving creates the organization, its cost center and the administrator user in B2B Organizations, and sends the approval email.',
  },
  internalNote: {
    id: 'admin/b2b-onboarding.action.note',
    defaultMessage: 'Internal note (optional, never shown to the applicant)',
  },
  reasonLabel: {
    id: 'admin/b2b-onboarding.action.reason',
    defaultMessage: 'Reason for the applicant (10 to 500 characters)',
  },
  cancel: {
    id: 'admin/b2b-onboarding.action.cancel',
    defaultMessage: 'Cancel',
  },
  confirmReject: {
    id: 'admin/b2b-onboarding.action.confirm-reject',
    defaultMessage: 'Reject',
  },
  documentNoteTitle: {
    id: 'admin/b2b-onboarding.document.note-title',
    defaultMessage: 'Reject {document}',
  },
  closed: {
    id: 'admin/b2b-onboarding.closed',
    defaultMessage: 'This application is closed. Decided {date}.',
  },
  rejectedBecause: {
    id: 'admin/b2b-onboarding.rejected-because',
    defaultMessage: 'Reason given to the applicant: {reason}',
  },
  organizationCreated: {
    id: 'admin/b2b-onboarding.organization-created',
    defaultMessage: 'Organization created in B2B Organizations (ID {id}).',
  },
  evSUBMITTED: {
    id: 'admin/b2b-onboarding.event.submitted',
    defaultMessage: 'Application submitted',
  },
  evDOCUMENT_REVIEWED: {
    id: 'admin/b2b-onboarding.event.document-reviewed',
    defaultMessage: 'Document reviewed',
  },
  evVERIFICATION_RUN: {
    id: 'admin/b2b-onboarding.event.verification-run',
    defaultMessage: 'Eligibility check run',
  },
  evSTAGE_PASSED: {
    id: 'admin/b2b-onboarding.event.stage-passed',
    defaultMessage: 'Step passed',
  },
  evAPPROVED: {
    id: 'admin/b2b-onboarding.event.approved',
    defaultMessage: 'Approved, organization created',
  },
  evREJECTED: {
    id: 'admin/b2b-onboarding.event.rejected',
    defaultMessage: 'Application rejected',
  },
  evAPPROVAL_FAILED: {
    id: 'admin/b2b-onboarding.event.approval-failed',
    defaultMessage: 'Creating the organization failed',
  },
  by: { id: 'admin/b2b-onboarding.event.by', defaultMessage: 'by {actor}' },
  actionFailed: {
    id: 'admin/b2b-onboarding.action-failed',
    defaultMessage: "That didn't work: {message}",
  },
  demoNotice: {
    id: 'admin/b2b-onboarding.demo-notice',
    defaultMessage:
      'Demo: the eligibility check uses a simulated company registry. Registration numbers ending in 0 are not found, ending in 9 are dissolved, and all others pass.',
  },
})
