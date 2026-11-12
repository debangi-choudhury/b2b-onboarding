/**
 * Master Data v2 schemas, applied by the app itself (see repository.ts)
 * rather than by the masterdata builder, which creates a new schema on every
 * link and install, with a limit of 60 per entity. Bump the schema name when
 * a change isn't backwards compatible.
 */

export const APPLICATION_ENTITY = 'b2b_onboarding_application'
export const EVENT_ENTITY = 'b2b_onboarding_event'
export const SCHEMA = 'v1'

// No public access of any kind: everything goes through the app.
const PRIVATE = {
  allowGetAll: false,
  publicRead: [],
  publicWrite: [],
  publicFilter: [],
}

const text = (maxLength: number) => ({ type: ['string', 'null'], maxLength })

export const APPLICATION_SCHEMA = {
  title: 'B2B onboarding application',
  type: 'object',
  properties: {
    reference: { type: 'string', maxLength: 20 },
    tokenHash: { type: 'string', maxLength: 64 },
    status: { type: 'string', enum: ['IN_REVIEW', 'APPROVED', 'REJECTED'] },
    companyName: { type: 'string', maxLength: 100 },
    tradeName: text(100),
    registrationNumber: { type: 'string', maxLength: 30 },
    taxId: text(30),
    contact: { type: 'object' },
    address: { type: 'object' },
    stages: { type: 'array', items: { type: 'object' } },
    currentStageIndex: { type: 'integer' },
    currentStageId: { type: 'string', maxLength: 40 },
    verification: { type: ['object', 'null'] },
    documents: { type: 'array', items: { type: 'object' } },
    rejectionReason: text(500),
    organizationRequestId: text(64),
    organizationId: text(64),
    submittedAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
    decidedAt: { type: ['string', 'null'] },
  },
  required: [
    'reference',
    'tokenHash',
    'status',
    'companyName',
    'registrationNumber',
    'stages',
    'currentStageIndex',
    'currentStageId',
    'submittedAt',
    'updatedAt',
  ],
  'v-indexed': [
    'reference',
    'status',
    'currentStageId',
    'companyName',
    'registrationNumber',
    'submittedAt',
  ],
  'v-default-fields': [
    'id',
    'reference',
    'status',
    'companyName',
    'submittedAt',
  ],
  // Reviewers act on what they just read, so never serve a cached copy
  'v-cache': false,
  'v-security': PRIVATE,
}

export const EVENT_SCHEMA = {
  title: 'B2B onboarding application history',
  type: 'object',
  properties: {
    applicationId: { type: 'string', maxLength: 64 },
    type: {
      type: 'string',
      enum: [
        'SUBMITTED',
        'VERIFICATION_RUN',
        'STAGE_PASSED',
        'APPROVED',
        'REJECTED',
        'APPROVAL_FAILED',
      ],
    },
    stageId: text(40),
    stageLabel: text(60),
    actorType: { type: 'string', enum: ['APPLICANT', 'REVIEWER', 'SYSTEM'] },
    actor: { type: 'string', maxLength: 254 },
    reason: text(500),
    note: text(1000),
    details: text(2000),
    createdAt: { type: 'string', format: 'date-time' },
  },
  required: ['applicationId', 'type', 'actorType', 'actor', 'createdAt'],
  'v-indexed': ['applicationId', 'type', 'createdAt'],
  'v-default-fields': ['id', 'applicationId', 'type', 'createdAt'],
  'v-cache': false,
  'v-security': PRIVATE,
}
