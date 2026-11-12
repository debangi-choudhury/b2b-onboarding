import React, { useEffect, useRef, useState } from 'react'
import { useIntl } from 'react-intl'
import { useCssHandles } from 'vtex.css-handles'
import { useRuntime } from 'vtex.render-runtime'

import { DropZone } from './components/DropZone'
import { TextField } from './components/Fields'
import Receipt from './components/Receipt'
import { NextSteps, Summary } from './components/SidePanels'
import { Stepper } from './components/Stepper'
import { submitApplication } from './utils/api'
import type { Receipt as ReceiptData } from './utils/api'
import type {
  DocumentKind,
  ErrorCode,
  FieldName,
  FieldSpec,
} from './utils/fields'
import {
  ADDRESS_FIELDS,
  checkField,
  checkFile,
  COMPANY_FIELDS,
  CONTACT_FIELDS,
  COUNTRIES,
  DOCUMENT_KINDS,
  formatSize,
} from './utils/fields'
import { documentLabels, fieldLabels, messages } from './utils/messages'
import {
  card,
  color,
  input,
  label,
  primaryButton,
  secondaryButton,
} from './utils/theme'

const CSS_HANDLES = [
  'container',
  'eyebrow',
  'title',
  'intro',
  'layout',
  'stepCard',
  'stepTitle',
  'stepHelp',
  'demoNotice',
  'form',
  'fieldGrid',
  'reviewSection',
  'honeypot',
  'formError',
  'stepActions',
  'submit',
  'aside',
] as const

const ALL_FIELDS = [...COMPANY_FIELDS, ...CONTACT_FIELDS, ...ADDRESS_FIELDS]

type Errors = Partial<Record<FieldName | DocumentKind, ErrorCode>>
type Message = { id: string; defaultMessage: string }

interface Step {
  label: Message
  heading: Message
  help: Message
  fields: FieldSpec[]
  documents: boolean
}

const STEPS: Step[] = [
  {
    label: messages.stepCompany,
    heading: messages.companyTitle,
    help: messages.companyHelp,
    fields: COMPANY_FIELDS,
    documents: false,
  },
  {
    label: messages.stepAdministrator,
    heading: messages.adminTitle,
    help: messages.contactHelp,
    fields: CONTACT_FIELDS,
    documents: false,
  },
  {
    label: messages.stepAddress,
    heading: messages.addressTitle,
    help: messages.addressHelp,
    fields: ADDRESS_FIELDS,
    documents: false,
  },
  {
    label: messages.stepDocuments,
    heading: messages.documentsTitle,
    help: messages.documentsHelp,
    fields: [],
    documents: true,
  },
  {
    label: messages.stepReview,
    heading: messages.reviewTitle,
    help: messages.reviewHelp,
    fields: [],
    documents: false,
  },
]

const REVIEW_STEP = STEPS.length - 1

/** Which step a field or document belongs to, to send people back to it */
function stepOf(name: string): number {
  const index = STEPS.findIndex(
    (step) =>
      step.fields.some((f) => f.name === name) ||
      (step.documents && (DOCUMENT_KINDS as string[]).includes(name))
  )

  return index === -1 ? 0 : index
}

function ApplyPage() {
  const intl = useIntl()
  const handles = useCssHandles(CSS_HANDLES)
  const { rootPath = '' } = useRuntime()
  const headingRef = useRef<HTMLHeadingElement>(null)
  const firstRender = useRef(true)

  const [step, setStep] = useState(0)
  const [reached, setReached] = useState(0)
  const [values, setValues] = useState<Partial<Record<FieldName, string>>>({
    'address.country': 'USA',
  })

  const [files, setFiles] = useState<Record<DocumentKind, File | null>>({
    REGISTRATION_CERTIFICATE: null,
    TAX_CERTIFICATE: null,
  })

  const [website, setWebsite] = useState('')
  const [errors, setErrors] = useState<Errors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [receipt, setReceipt] = useState<ReceiptData | null>(null)

  // Move focus to the new step's heading, so screen readers announce it
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false

      return
    }

    headingRef.current?.focus()
  }, [step])

  const value = (name: FieldName) => values[name] ?? ''

  const setError = (name: FieldName | DocumentKind, code: ErrorCode | null) =>
    setErrors((prev) => ({ ...prev, [name]: code ?? undefined }))

  const stepErrors = (index: number): Errors => {
    const found: Errors = {}

    STEPS[index].fields.forEach((spec) => {
      const code = checkField(spec, value(spec.name))

      if (code) found[spec.name] = code
    })

    if (STEPS[index].documents) {
      DOCUMENT_KINDS.forEach((kind) => {
        const code = checkFile(files[kind])

        if (code) found[kind] = code
      })
    }

    return found
  }

  const goTo = (index: number) => {
    setFormError(null)
    setStep(index)
    setReached((prev) => Math.max(prev, index))
  }

  const submit = async () => {
    // Check every step again, in case something changed on the way
    for (let index = 0; index < REVIEW_STEP; index++) {
      const found = stepErrors(index)

      if (Object.keys(found).length > 0) {
        setErrors(found)
        goTo(index)
        setFormError(intl.formatMessage(messages.fixErrors))

        return
      }
    }

    const form = new FormData()

    ALL_FIELDS.forEach((spec) =>
      form.append(spec.name, value(spec.name).trim())
    )
    form.append('address.country', values['address.country'] ?? 'USA')
    form.append('website', website)
    DOCUMENT_KINDS.forEach((kind) => form.append(kind, files[kind] as File))

    setSubmitting(true)
    setFormError(null)

    const result = await submitApplication(rootPath, form)

    setSubmitting(false)

    if (result.ok) {
      setReceipt(result.data)
      window.scrollTo?.(0, 0)

      return
    }

    if (result.code === 'INVALID_FIELDS' && result.fields?.length) {
      const serverErrors: Errors = {}

      result.fields.forEach(({ field, code }) => {
        serverErrors[field as FieldName | DocumentKind] = code
      })
      setErrors(serverErrors)
      setStep(stepOf(result.fields[0].field))
      setFormError(intl.formatMessage(messages.fixErrors))
    } else if (result.status === 429) {
      setFormError(intl.formatMessage(messages.tooMany))
    } else if (result.status === 413) {
      setFormError(intl.formatMessage(messages.tooLargeRequest))
    } else {
      setFormError(intl.formatMessage(messages.failed))
    }
  }

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (step === REVIEW_STEP) {
      submit()

      return
    }

    const found = stepErrors(step)

    setErrors((prev) => {
      const next = { ...prev }

      STEPS[step].fields.forEach((f) => delete next[f.name])
      if (STEPS[step].documents) DOCUMENT_KINDS.forEach((k) => delete next[k])

      return { ...next, ...found }
    })

    if (Object.keys(found).length > 0) {
      setFormError(intl.formatMessage(messages.fixErrors))

      return
    }

    goTo(step + 1)
  }

  const country = (
    <div>
      <label htmlFor="b2b-onboarding-address-country" style={label}>
        {intl.formatMessage(fieldLabels['address.country'])}
      </label>
      <select
        id="b2b-onboarding-address-country"
        value={values['address.country']}
        onChange={(e) =>
          setValues((prev) => ({ ...prev, 'address.country': e.target.value }))
        }
        style={input(false)}
      >
        {COUNTRIES.map((code) => (
          <option key={code} value={code}>
            {code}
          </option>
        ))}
      </select>
    </div>
  )

  const textField = (spec: FieldSpec) => (
    <TextField
      key={spec.name}
      spec={spec}
      value={value(spec.name)}
      error={errors[spec.name] ?? null}
      onChange={(next) => setValues((prev) => ({ ...prev, [spec.name]: next }))}
      onBlur={() => setError(spec.name, checkField(spec, value(spec.name)))}
    />
  )

  const grid: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: '18px 20px',
  }

  const demoNotice = (
    <div
      role="note"
      className={handles.demoNotice}
      style={{
        display: 'flex',
        gap: 12,
        alignItems: 'flex-start',
        padding: '14px 16px',
        background: color.warningSoft,
        border: `1px solid ${color.warningBorder}`,
        borderRadius: 10,
        marginBottom: 24,
        fontSize: 14,
        color: color.warningText,
      }}
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        style={{ flex: 'none', marginTop: 1 }}
      >
        <circle cx="12" cy="12" r="10" />
        <path d="M12 8v5" />
        <path d="M12 16h.01" />
      </svg>
      <span>{intl.formatMessage(messages.demoNotice)}</span>
    </div>
  )

  const address = [
    value('address.street'),
    value('address.number'),
    value('address.complement'),
  ]
    .filter(Boolean)
    .join(', ')

  const place = [
    value('address.city'),
    value('address.state'),
    value('address.postalCode'),
    values['address.country'],
  ]
    .filter(Boolean)
    .join(', ')

  const reviewSections = [
    {
      step: 0,
      rows: COMPANY_FIELDS.map((f) => ({
        label: intl.formatMessage(fieldLabels[f.name]),
        value: value(f.name),
      })),
    },
    {
      step: 1,
      rows: CONTACT_FIELDS.map((f) => ({
        label: intl.formatMessage(fieldLabels[f.name]),
        value: value(f.name),
      })),
    },
    {
      step: 2,
      rows: [
        { label: intl.formatMessage(messages.summaryAddress), value: address },
        { label: '', value: place },
        {
          label: intl.formatMessage(fieldLabels['address.receiverName']),
          value: value('address.receiverName'),
        },
      ],
    },
    {
      step: 3,
      rows: DOCUMENT_KINDS.map((kind) => ({
        label: intl.formatMessage(documentLabels[kind]),
        value: files[kind]
          ? `${files[kind]?.name} · ${formatSize(files[kind]?.size ?? 0)}`
          : '',
      })),
    },
  ]

  const uploaded = DOCUMENT_KINDS.filter((k) => files[k]).length
  const summaryRows = [
    {
      label: intl.formatMessage(messages.summaryCompany),
      value: value('companyName'),
    },
    {
      label: intl.formatMessage(messages.summaryRegistration),
      value: value('registrationNumber'),
    },
    {
      label: intl.formatMessage(messages.summaryAdmin),
      value: [value('contact.firstName'), value('contact.lastName')]
        .filter(Boolean)
        .join(' '),
    },
    {
      label: intl.formatMessage(messages.summaryAddress),
      value: [value('address.city'), value('address.state')]
        .filter(Boolean)
        .join(', '),
    },
    {
      label: intl.formatMessage(messages.summaryDocuments),
      value: uploaded
        ? intl.formatMessage(messages.documentsCount, {
            count: uploaded,
            total: DOCUMENT_KINDS.length,
          })
        : '',
    },
  ].filter((row) => row.value)

  const current = STEPS[step]

  return (
    <div
      className={handles.container}
      style={{ background: color.ground, color: color.text }}
    >
      <div
        style={{ maxWidth: 1200, margin: '0 auto', padding: '40px 24px 64px' }}
      >
        <p
          className={handles.eyebrow}
          style={{
            margin: '0 0 8px',
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: color.accent,
          }}
        >
          {intl.formatMessage(messages.eyebrow)}
        </p>
        <h1
          className={handles.title}
          style={{
            margin: '0 0 8px',
            fontSize: 34,
            lineHeight: 1.2,
            fontWeight: 700,
          }}
        >
          {intl.formatMessage(messages.title)}
        </h1>

        {receipt ? (
          <Receipt receipt={receipt} rootPath={rootPath} />
        ) : (
          <>
            <p
              className={handles.intro}
              style={{
                margin: '0 0 28px',
                fontSize: 16,
                color: color.textSoft,
                maxWidth: 640,
              }}
            >
              {intl.formatMessage(messages.introSteps)}
            </p>

            <Stepper
              steps={STEPS.map((s) => s.label)}
              current={step}
              reached={reached}
              onSelect={goTo}
            />

            <div
              className={handles.layout}
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 24,
                alignItems: 'flex-start',
              }}
            >
              <form
                className={`${handles.form} ${handles.stepCard}`}
                onSubmit={onSubmit}
                noValidate
                style={{
                  ...card,
                  flex: '999 1 560px',
                  minWidth: 0,
                  padding: 32,
                }}
              >
                <h2
                  ref={headingRef}
                  tabIndex={-1}
                  className={handles.stepTitle}
                  style={{
                    margin: '0 0 6px',
                    fontSize: 22,
                    fontWeight: 700,
                    outline: 'none',
                  }}
                >
                  {intl.formatMessage(current.heading)}
                </h2>
                <p
                  className={handles.stepHelp}
                  style={{
                    margin: '0 0 24px',
                    fontSize: 15,
                    color: color.textSoft,
                  }}
                >
                  {intl.formatMessage(current.help)}
                </p>

                {current.documents && demoNotice}

                {current.fields.length > 0 && (
                  <div className={handles.fieldGrid} style={grid}>
                    {step === 2 ? (
                      <>
                        {current.fields
                          .filter((f) => f.name !== 'address.receiverName')
                          .map(textField)}
                        {country}
                        {current.fields
                          .filter((f) => f.name === 'address.receiverName')
                          .map(textField)}
                      </>
                    ) : (
                      current.fields.map(textField)
                    )}
                  </div>
                )}

                {current.documents && (
                  <div className={handles.fieldGrid} style={grid}>
                    {DOCUMENT_KINDS.map((kind) => (
                      <DropZone
                        key={kind}
                        kind={kind}
                        file={files[kind]}
                        error={errors[kind] ?? null}
                        onChange={(file) => {
                          setFiles((prev) => ({ ...prev, [kind]: file }))
                          setError(kind, checkFile(file))
                        }}
                      />
                    ))}
                  </div>
                )}

                {step === REVIEW_STEP && (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 16,
                    }}
                  >
                    {demoNotice}
                    {reviewSections.map((section) => (
                      <section
                        key={section.step}
                        className={handles.reviewSection}
                        style={{
                          border: `1px solid ${color.border}`,
                          borderRadius: 12,
                          padding: '16px 20px',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: 12,
                            marginBottom: 8,
                          }}
                        >
                          <h3
                            style={{ margin: 0, fontSize: 16, fontWeight: 700 }}
                          >
                            {intl.formatMessage(STEPS[section.step].label)}
                          </h3>
                          <button
                            type="button"
                            onClick={() => goTo(section.step)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: color.accent,
                              font: 'inherit',
                              fontSize: 14,
                              fontWeight: 600,
                              cursor: 'pointer',
                              minHeight: 44,
                              padding: '0 8px',
                            }}
                            aria-label={`${intl.formatMessage(
                              messages.edit
                            )}: ${intl.formatMessage(
                              STEPS[section.step].label
                            )}`}
                          >
                            {intl.formatMessage(messages.edit)}
                          </button>
                        </div>
                        <dl
                          style={{
                            margin: 0,
                            display: 'grid',
                            gridTemplateColumns: 'minmax(0, 200px) 1fr',
                            gap: '6px 16px',
                            fontSize: 14,
                          }}
                        >
                          {section.rows
                            .filter((row) => row.value)
                            .map((row, i) => (
                              <React.Fragment key={`${row.label}-${i}`}>
                                <dt style={{ color: color.textMuted }}>
                                  {row.label}
                                </dt>
                                <dd
                                  style={{
                                    margin: 0,
                                    overflowWrap: 'anywhere',
                                  }}
                                >
                                  {row.value}
                                </dd>
                              </React.Fragment>
                            ))}
                        </dl>
                      </section>
                    ))}
                  </div>
                )}

                {/* Hidden from people; bots that fill it in are rejected */}
                <div
                  className={handles.honeypot}
                  aria-hidden="true"
                  style={{ position: 'absolute', left: '-10000px' }}
                >
                  <label htmlFor="b2b-onboarding-website">Website</label>
                  <input
                    id="b2b-onboarding-website"
                    name="website"
                    tabIndex={-1}
                    autoComplete="off"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                  />
                </div>

                {formError && (
                  <p
                    className={handles.formError}
                    role="alert"
                    style={{
                      margin: '24px 0 0',
                      fontSize: 15,
                      color: color.danger,
                    }}
                  >
                    {formError}
                  </p>
                )}

                <div
                  className={handles.stepActions}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 16,
                    marginTop: 32,
                    paddingTop: 24,
                    borderTop: `1px solid ${color.border}`,
                    flexWrap: 'wrap',
                  }}
                >
                  {step > 0 ? (
                    <button
                      type="button"
                      style={secondaryButton}
                      onClick={() => goTo(step - 1)}
                    >
                      {intl.formatMessage(messages.back)}
                    </button>
                  ) : (
                    <span />
                  )}
                  <span style={{ fontSize: 13, color: color.textMuted }}>
                    {intl.formatMessage(messages.stepOf, {
                      current: step + 1,
                      total: STEPS.length,
                    })}
                  </span>
                  <button
                    type="submit"
                    className={handles.submit}
                    disabled={submitting}
                    style={primaryButton(submitting)}
                  >
                    {step === REVIEW_STEP
                      ? intl.formatMessage(
                          submitting ? messages.submitting : messages.submit
                        )
                      : step === REVIEW_STEP - 1
                      ? intl.formatMessage(messages.continueReview)
                      : intl.formatMessage(messages.continue)}
                  </button>
                </div>
              </form>

              <aside
                className={handles.aside}
                style={{
                  flex: '1 1 300px',
                  minWidth: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 16,
                }}
              >
                <NextSteps />
                <Summary rows={summaryRows} />
              </aside>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default ApplyPage
