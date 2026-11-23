import { defineMessages } from 'react-intl'

import type { DocumentKind, ErrorCode, FieldName } from './fields'

// Every message is declared here so the react builder can extract it.
// Messages it can't find statically slow down every page using the app.
export const messages = defineMessages({
  title: {
    id: 'store/b2b-onboarding.apply.title',
    defaultMessage: 'Apply for a business account',
  },
  demoNotice: {
    id: 'store/b2b-onboarding.apply.demo-notice',
    defaultMessage:
      'Demo store: upload sample documents only, never real company or personal documents.',
  },
  contactHelp: {
    id: 'store/b2b-onboarding.section.contact-help',
    defaultMessage:
      'This person becomes the administrator of your business account and receives the approval email.',
  },
  documentsHelp: {
    id: 'store/b2b-onboarding.section.documents-help',
    defaultMessage: 'PDF, JPG or PNG, up to 5 MB each.',
  },
  optional: {
    id: 'store/b2b-onboarding.optional',
    defaultMessage: '(optional)',
  },
  submit: {
    id: 'store/b2b-onboarding.apply.submit',
    defaultMessage: 'Submit application',
  },
  submitting: {
    id: 'store/b2b-onboarding.apply.submitting',
    defaultMessage: 'Submitting…',
  },
  fixErrors: {
    id: 'store/b2b-onboarding.apply.fix-errors',
    defaultMessage: 'Please correct the highlighted fields.',
  },
  tooMany: {
    id: 'store/b2b-onboarding.error.too-many',
    defaultMessage:
      'Too many attempts. Please wait a few minutes and try again.',
  },
  failed: {
    id: 'store/b2b-onboarding.error.failed',
    defaultMessage: "We couldn't submit your application. Please try again.",
  },
  tooLargeRequest: {
    id: 'store/b2b-onboarding.error.request-too-large',
    defaultMessage: 'The upload is too large. Each document can be up to 5 MB.',
  },
  successTitle: {
    id: 'store/b2b-onboarding.success.title',
    defaultMessage: 'Application received',
  },
  successText: {
    id: 'store/b2b-onboarding.success.text',
    defaultMessage:
      'Keep your reference and status code. You need both to check your application. We show the code only once.',
  },
  reference: {
    id: 'store/b2b-onboarding.reference',
    defaultMessage: 'Reference',
  },
  statusCode: {
    id: 'store/b2b-onboarding.status-code',
    defaultMessage: 'Status code',
  },
  copy: { id: 'store/b2b-onboarding.copy', defaultMessage: 'Copy' },
  copied: { id: 'store/b2b-onboarding.copied', defaultMessage: 'Copied' },
  checkStatus: {
    id: 'store/b2b-onboarding.success.check-status',
    defaultMessage: 'Check application status',
  },
  statusTitle: {
    id: 'store/b2b-onboarding.status.title',
    defaultMessage: 'Application status',
  },
  statusIntro: {
    id: 'store/b2b-onboarding.status.intro',
    defaultMessage:
      'Enter the reference and status code you received when you applied.',
  },
  lookup: {
    id: 'store/b2b-onboarding.status.lookup',
    defaultMessage: 'Check status',
  },
  notFound: {
    id: 'store/b2b-onboarding.status.not-found',
    defaultMessage: 'No application matches this reference and status code.',
  },
  company2: {
    id: 'store/b2b-onboarding.status.company',
    defaultMessage: 'Company',
  },
  submittedOn: {
    id: 'store/b2b-onboarding.status.submitted',
    defaultMessage: 'Submitted',
  },
  decidedOn: {
    id: 'store/b2b-onboarding.status.decided',
    defaultMessage: 'Decided',
  },
  currentStep: {
    id: 'store/b2b-onboarding.status.current-step',
    defaultMessage: 'Current step',
  },
  reason: {
    id: 'store/b2b-onboarding.status.reason',
    defaultMessage: 'Reason',
  },
  IN_REVIEW: {
    id: 'store/b2b-onboarding.status.in-review',
    defaultMessage: 'In review',
  },
  APPROVED: {
    id: 'store/b2b-onboarding.status.approved',
    defaultMessage:
      'Approved. Check your email to sign in to your business account.',
  },
  REJECTED: {
    id: 'store/b2b-onboarding.status.rejected',
    defaultMessage: 'Not approved',
  },
  newApplication: {
    id: 'store/b2b-onboarding.status.new-application',
    defaultMessage: 'Start a new application',
  },
  eyebrow: {
    id: 'store/b2b-onboarding.apply.eyebrow',
    defaultMessage: 'Business account',
  },
  introSteps: {
    id: 'store/b2b-onboarding.apply.intro-steps',
    defaultMessage:
      'A few short steps. Our team reviews every application and emails your administrator when the account is ready.',
  },
  stepsLabel: {
    id: 'store/b2b-onboarding.steps.label',
    defaultMessage: 'Application steps',
  },
  stepCompany: {
    id: 'store/b2b-onboarding.steps.company',
    defaultMessage: 'Company',
  },
  stepAdministrator: {
    id: 'store/b2b-onboarding.steps.administrator',
    defaultMessage: 'Administrator',
  },
  stepAddress: {
    id: 'store/b2b-onboarding.steps.address',
    defaultMessage: 'Address',
  },
  stepDocuments: {
    id: 'store/b2b-onboarding.steps.documents',
    defaultMessage: 'Documents',
  },
  stepReview: {
    id: 'store/b2b-onboarding.steps.review',
    defaultMessage: 'Review',
  },
  stepDone: {
    id: 'store/b2b-onboarding.steps.done',
    defaultMessage: 'Done',
  },
  stepCurrent: {
    id: 'store/b2b-onboarding.steps.current',
    defaultMessage: 'Current step',
  },
  stepUpNext: {
    id: 'store/b2b-onboarding.steps.up-next',
    defaultMessage: 'Up next',
  },
  stepOf: {
    id: 'store/b2b-onboarding.steps.step-of',
    defaultMessage: 'Step {current} of {total}',
  },
  companyTitle: {
    id: 'store/b2b-onboarding.company.title',
    defaultMessage: 'Tell us about your company',
  },
  companyHelp: {
    id: 'store/b2b-onboarding.company.help',
    defaultMessage:
      'Use the legal name and registration number shown on your registration certificate.',
  },
  adminTitle: {
    id: 'store/b2b-onboarding.administrator.title',
    defaultMessage: 'Who will manage the account?',
  },
  addressTitle: {
    id: 'store/b2b-onboarding.address.title',
    defaultMessage: 'Where is your business based?',
  },
  addressHelp: {
    id: 'store/b2b-onboarding.address.help',
    defaultMessage: 'This becomes the default address of your organization.',
  },
  documentsTitle: {
    id: 'store/b2b-onboarding.documents.title',
    defaultMessage: 'Upload your documents',
  },
  reviewTitle: {
    id: 'store/b2b-onboarding.review.title',
    defaultMessage: 'Check your application',
  },
  reviewHelp: {
    id: 'store/b2b-onboarding.review.help',
    defaultMessage:
      'Make sure everything is right before you submit. You can edit any section.',
  },
  back: {
    id: 'store/b2b-onboarding.apply.back',
    defaultMessage: 'Back',
  },
  continue: {
    id: 'store/b2b-onboarding.apply.continue',
    defaultMessage: 'Continue',
  },
  continueReview: {
    id: 'store/b2b-onboarding.apply.continue-review',
    defaultMessage: 'Continue to review',
  },
  edit: {
    id: 'store/b2b-onboarding.apply.edit',
    defaultMessage: 'Edit',
  },
  dropHere: {
    id: 'store/b2b-onboarding.upload.drop-here',
    defaultMessage: 'Drop the file here or',
  },
  browse: {
    id: 'store/b2b-onboarding.upload.browse',
    defaultMessage: 'browse',
  },
  fileHint: {
    id: 'store/b2b-onboarding.upload.hint',
    defaultMessage: 'PDF, JPG or PNG · max 5 MB',
  },
  replace: {
    id: 'store/b2b-onboarding.upload.replace',
    defaultMessage: 'Replace',
  },
  ready: {
    id: 'store/b2b-onboarding.upload.ready',
    defaultMessage: 'Ready',
  },
  nextTitle: {
    id: 'store/b2b-onboarding.next.title',
    defaultMessage: 'What happens next',
  },
  next1Title: {
    id: 'store/b2b-onboarding.next.review-title',
    defaultMessage: 'Document review',
  },
  next1Text: {
    id: 'store/b2b-onboarding.next.review-text',
    defaultMessage: 'A reviewer checks each document.',
  },
  next2Title: {
    id: 'store/b2b-onboarding.next.compliance-title',
    defaultMessage: 'Compliance check',
  },
  next2Text: {
    id: 'store/b2b-onboarding.next.compliance-text',
    defaultMessage: 'We verify your company registration.',
  },
  next3Title: {
    id: 'store/b2b-onboarding.next.approval-title',
    defaultMessage: 'Final approval',
  },
  next3Text: {
    id: 'store/b2b-onboarding.next.approval-text',
    defaultMessage: 'Your administrator gets a sign-in email.',
  },
  summaryTitle: {
    id: 'store/b2b-onboarding.summary.title',
    defaultMessage: 'Your application so far',
  },
  summaryEmpty: {
    id: 'store/b2b-onboarding.summary.empty',
    defaultMessage: 'Your answers appear here as you go.',
  },
  summaryCompany: {
    id: 'store/b2b-onboarding.summary.company',
    defaultMessage: 'Company',
  },
  summaryRegistration: {
    id: 'store/b2b-onboarding.summary.registration',
    defaultMessage: 'Registration',
  },
  summaryAdmin: {
    id: 'store/b2b-onboarding.summary.administrator',
    defaultMessage: 'Administrator',
  },
  summaryAddress: {
    id: 'store/b2b-onboarding.summary.address',
    defaultMessage: 'Address',
  },
  summaryDocuments: {
    id: 'store/b2b-onboarding.summary.documents',
    defaultMessage: 'Documents',
  },
  documentsCount: {
    id: 'store/b2b-onboarding.summary.documents-count',
    defaultMessage: '{count} of {total} uploaded',
  },
  indiaTitle: {
    id: 'store/b2b-onboarding.india.title',
    defaultMessage: 'Indian business identifiers',
  },
  indiaHelp: {
    id: 'store/b2b-onboarding.india.help',
    defaultMessage:
      "Applications from India need the business's PAN. We verify each identifier automatically.",
  },
  indiaDemoNotice: {
    id: 'store/b2b-onboarding.india.demo-notice',
    defaultMessage:
      'Demo store: use made-up numbers in the right format, never a real PAN or real bank details.',
  },
  yes: { id: 'store/b2b-onboarding.yes', defaultMessage: 'Yes' },
  no: { id: 'store/b2b-onboarding.no', defaultMessage: 'No' },
  stepBank: {
    id: 'store/b2b-onboarding.step.bank',
    defaultMessage: 'Bank account',
  },
  bankTitle: {
    id: 'store/b2b-onboarding.bank.title',
    defaultMessage: 'Which bank account should we verify?',
  },
  bankHelp: {
    id: 'store/b2b-onboarding.bank.help',
    defaultMessage:
      "We send a small test transfer to check that the account exists and is in your business's name.",
  },
  countryOnCompanyStep: {
    id: 'store/b2b-onboarding.address.country-on-company',
    defaultMessage: 'Country: {country}. It was chosen on the Company step.',
  },
  changeCountry: {
    id: 'store/b2b-onboarding.address.change-country',
    defaultMessage: 'Change',
  },
})

export const fieldLabels: Record<
  FieldName,
  { id: string; defaultMessage: string }
> = defineMessages({
  companyName: {
    id: 'store/b2b-onboarding.field.companyName',
    defaultMessage: 'Legal company name',
  },
  tradeName: {
    id: 'store/b2b-onboarding.field.tradeName',
    defaultMessage: 'Trade name',
  },
  registrationNumber: {
    id: 'store/b2b-onboarding.field.registrationNumber',
    defaultMessage: 'Company registration number',
  },
  taxId: { id: 'store/b2b-onboarding.field.taxId', defaultMessage: 'Tax ID' },
  'contact.firstName': {
    id: 'store/b2b-onboarding.field.contact.firstName',
    defaultMessage: 'First name',
  },
  'contact.lastName': {
    id: 'store/b2b-onboarding.field.contact.lastName',
    defaultMessage: 'Last name',
  },
  'contact.email': {
    id: 'store/b2b-onboarding.field.contact.email',
    defaultMessage: 'Email',
  },
  'contact.phone': {
    id: 'store/b2b-onboarding.field.contact.phone',
    defaultMessage: 'Phone',
  },
  'address.street': {
    id: 'store/b2b-onboarding.field.address.street',
    defaultMessage: 'Street',
  },
  'address.number': {
    id: 'store/b2b-onboarding.field.address.number',
    defaultMessage: 'Number',
  },
  'address.complement': {
    id: 'store/b2b-onboarding.field.address.complement',
    defaultMessage: 'Suite, floor or building',
  },
  'address.city': {
    id: 'store/b2b-onboarding.field.address.city',
    defaultMessage: 'City',
  },
  'address.state': {
    id: 'store/b2b-onboarding.field.address.state',
    defaultMessage: 'State or region',
  },
  'address.postalCode': {
    id: 'store/b2b-onboarding.field.address.postalCode',
    defaultMessage: 'Postal code',
  },
  'address.country': {
    id: 'store/b2b-onboarding.field.address.country',
    defaultMessage: 'Country of registration',
  },
  'address.receiverName': {
    id: 'store/b2b-onboarding.field.address.receiverName',
    defaultMessage: 'Receiving contact',
  },
  'india.pan': {
    id: 'store/b2b-onboarding.field.india.pan',
    defaultMessage: "Business's PAN",
  },
  'india.importsOrExports': {
    id: 'store/b2b-onboarding.field.india.importsOrExports',
    defaultMessage: 'Do you import or export?',
  },
  'india.iec': {
    id: 'store/b2b-onboarding.field.india.iec',
    defaultMessage: 'Importer Exporter Code (IEC)',
  },
  'india.udyam': {
    id: 'store/b2b-onboarding.field.india.udyam',
    defaultMessage: 'Udyam registration number',
  },
  'india.accountNumber': {
    id: 'store/b2b-onboarding.field.india.accountNumber',
    defaultMessage: 'Account number',
  },
  'india.ifsc': {
    id: 'store/b2b-onboarding.field.india.ifsc',
    defaultMessage: 'IFSC',
  },
  'india.accountHolderName': {
    id: 'store/b2b-onboarding.field.india.accountHolderName',
    defaultMessage: 'Account holder name',
  },
}) as Record<FieldName, { id: string; defaultMessage: string }>

/** Format hints shown under some labels */
export const fieldHints: Partial<
  Record<FieldName, { id: string; defaultMessage: string }>
> = defineMessages({
  'india.pan': {
    id: 'store/b2b-onboarding.hint.india.pan',
    defaultMessage:
      '10 characters, such as ABCCD1234X. The 4th letter shows the holder type: C for a company, F for a firm.',
  },
  'india.iec': {
    id: 'store/b2b-onboarding.hint.india.iec',
    defaultMessage: '10 letters or digits, from the DGFT certificate',
  },
  'india.udyam': {
    id: 'store/b2b-onboarding.hint.india.udyam',
    defaultMessage: 'For MSMEs, such as UDYAM-MH-01-0012345',
  },
  'india.accountNumber': {
    id: 'store/b2b-onboarding.hint.india.accountNumber',
    defaultMessage: '9 to 18 digits',
  },
  'india.ifsc': {
    id: 'store/b2b-onboarding.hint.india.ifsc',
    defaultMessage:
      '11 characters, such as SBIN0001234, from a cheque or the bank',
  },
  'india.accountHolderName': {
    id: 'store/b2b-onboarding.hint.india.accountHolderName',
    defaultMessage:
      "As the bank shows it. It should be your business's legal name.",
  },
})

export const documentLabels: Record<
  DocumentKind,
  { id: string; defaultMessage: string }
> = defineMessages({
  REGISTRATION_CERTIFICATE: {
    id: 'store/b2b-onboarding.document.registration',
    defaultMessage: 'Business registration certificate',
  },
  TAX_CERTIFICATE: {
    id: 'store/b2b-onboarding.document.tax',
    defaultMessage: 'Tax certificate',
  },
})

export const errorLabels: Record<
  ErrorCode,
  { id: string; defaultMessage: string }
> = defineMessages({
  REQUIRED: {
    id: 'store/b2b-onboarding.error.required',
    defaultMessage: 'Required',
  },
  TOO_SHORT: {
    id: 'store/b2b-onboarding.error.too-short',
    defaultMessage: 'Too short',
  },
  TOO_LONG: {
    id: 'store/b2b-onboarding.error.too-long',
    defaultMessage: 'Too long',
  },
  INVALID_FORMAT: {
    id: 'store/b2b-onboarding.error.invalid-format',
    defaultMessage: 'Check the format',
  },
  REJECTED: {
    id: 'store/b2b-onboarding.error.rejected',
    defaultMessage: 'Not accepted',
  },
  MISSING: {
    id: 'store/b2b-onboarding.error.missing',
    defaultMessage: 'Upload this document',
  },
  TOO_LARGE: {
    id: 'store/b2b-onboarding.error.too-large',
    defaultMessage: 'Larger than 5 MB',
  },
  EMPTY: {
    id: 'store/b2b-onboarding.error.empty',
    defaultMessage: 'The file is empty',
  },
  UNSUPPORTED_TYPE: {
    id: 'store/b2b-onboarding.error.unsupported-type',
    defaultMessage: 'Use a PDF, JPG or PNG file',
  },
  PAN_NOT_BUSINESS: {
    id: 'store/b2b-onboarding.error.pan-not-business',
    defaultMessage:
      "This is an individual's PAN. Use the business's own PAN, whose 4th letter is C, F, H, A, T, B, L, J or G",
  },
})
