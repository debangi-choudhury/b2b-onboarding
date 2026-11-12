import { defineMessages } from 'react-intl'

import type { DocumentKind, ErrorCode, FieldName } from './fields'

// Every message is declared here so the react builder can extract it.
// Messages it can't find statically slow down every page using the app.
export const messages = defineMessages({
  title: {
    id: 'store/b2b-onboarding.apply.title',
    defaultMessage: 'Apply for a business account',
  },
  intro: {
    id: 'store/b2b-onboarding.apply.intro',
    defaultMessage:
      'Tell us about your company and upload two documents. Our team reviews every application in stages and emails you when your account is ready.',
  },
  demoNotice: {
    id: 'store/b2b-onboarding.apply.demo-notice',
    defaultMessage:
      'Demo store: upload sample documents only, never real company or personal documents.',
  },
  company: {
    id: 'store/b2b-onboarding.section.company',
    defaultMessage: 'Company',
  },
  contact: {
    id: 'store/b2b-onboarding.section.contact',
    defaultMessage: 'Account administrator',
  },
  contactHelp: {
    id: 'store/b2b-onboarding.section.contact-help',
    defaultMessage:
      'This person becomes the administrator of your business account and receives the approval email.',
  },
  address: {
    id: 'store/b2b-onboarding.section.address',
    defaultMessage: 'Business address',
  },
  documents: {
    id: 'store/b2b-onboarding.section.documents',
    defaultMessage: 'Documents',
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
    defaultMessage: 'Country',
  },
  'address.receiverName': {
    id: 'store/b2b-onboarding.field.address.receiverName',
    defaultMessage: 'Receiving contact',
  },
}) as Record<FieldName, { id: string; defaultMessage: string }>

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
})
