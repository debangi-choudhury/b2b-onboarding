import React, { useEffect, useRef, useState } from 'react'
import { useIntl } from 'react-intl'
import { useCssHandles } from 'vtex.css-handles'
import { useRuntime } from 'vtex.render-runtime'

import { DropZone } from './components/DropZone'
import { fieldId, TextField } from './components/Fields'
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
  BANK_FIELDS,
  checkAnyField,
  checkFile,
  COMPANY_FIELDS,
  CONTACT_FIELDS,
  COUNTRIES,
  DOCUMENT_KINDS,
  formatSize,
  importsOrExports,
  INDIA_COMPANY_FIELDS,
  isIndia,
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
  'indiaSection',
  'reviewSection',
  'honeypot',
  'formError',
  'stepActions',
  'submit',
  'aside',
] as const

type Errors = Partial<Record<FieldName | DocumentKind, ErrorCode>>
type Message = { id: string; defaultMessage: string }
type Values = Partial<Record<FieldName, string>>

type StepId =
  | 'company'
  | 'bank'
  | 'contact'
  | 'address'
  | 'documents'
  | 'review'

interface Step {
  id: StepId
  label: Message
  heading: Message
  help: Message
  fields: FieldSpec[]
  documents: boolean
}

const COMPANY_STEP: Step = {
  id: 'company',
  label: messages.stepCompany,
  heading: messages.companyTitle,
  help: messages.companyHelp,
  fields: COMPANY_FIELDS,
  documents: false,
}

const BANK_STEP: Step = {
  id: 'bank',
  label: messages.stepBank,
  heading: messages.bankTitle,
  help: messages.bankHelp,
  fields: BANK_FIELDS,
  documents: false,
}

const OTHER_STEPS: Step[] = [
  {
    id: 'contact',
    label: messages.stepAdministrator,
    heading: messages.adminTitle,
    help: messages.contactHelp,
    fields: CONTACT_FIELDS,
    documents: false,
  },
  {
    id: 'address',
    label: messages.stepAddress,
    heading: messages.addressTitle,
    help: messages.addressHelp,
    fields: ADDRESS_FIELDS,
    documents: false,
  },
  {
    id: 'documents',
    label: messages.stepDocuments,
    heading: messages.documentsTitle,
    help: messages.documentsHelp,
    fields: [],
    documents: true,
  },
  {
    id: 'review',
    label: messages.stepReview,
    heading: messages.reviewTitle,
    help: messages.reviewHelp,
    fields: [],
    documents: false,
  },
]

/**
 * Six steps for India, with the India identifiers on the Company step and a
 * Bank account step after it. Five steps for every other country.
 */
function stepsFor(country: string | undefined): Step[] {
  return isIndia(country)
    ? [
        {
          ...COMPANY_STEP,
          fields: [...COMPANY_FIELDS, ...INDIA_COMPANY_FIELDS],
        },
        BANK_STEP,
        ...OTHER_STEPS,
      ]
    : [COMPANY_STEP, ...OTHER_STEPS]
}

function ApplyPage() {
  const intl = useIntl()
  const handles = useCssHandles(CSS_HANDLES)
  const { rootPath = '' } = useRuntime()
  const headingRef = useRef<HTMLHeadingElement>(null)
  const firstRender = useRef(true)

  const [step, setStep] = useState(0)
  const [reached, setReached] = useState(0)
  const [values, setValues] = useState<Values>({
    'address.country': 'USA',
    'india.importsOrExports': 'no',
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

  const country = values['address.country']
  const india = isIndia(country)
  const trades = importsOrExports(values['india.importsOrExports'])
  const steps = stepsFor(country)
  const reviewStep = steps.length - 1
  const indexOf = (id: StepId) => steps.findIndex((s) => s.id === id)

  /** Which step a field or document belongs to, to send people back to it */
  const stepOf = (name: string) => {
    const index = steps.findIndex(
      (s) =>
        s.fields.some((f) => f.name === name) ||
        (s.documents && (DOCUMENT_KINDS as string[]).includes(name))
    )

    return index === -1 ? 0 : index
  }

  const value = (name: FieldName) => values[name] ?? ''

  const setError = (name: FieldName | DocumentKind, code: ErrorCode | null) =>
    setErrors((prev) => ({ ...prev, [name]: code ?? undefined }))

  const stepErrors = (index: number): Errors => {
    const found: Errors = {}

    steps[index].fields.forEach((spec) => {
      const code = checkAnyField(spec, value(spec.name), values)

      if (code) found[spec.name] = code
    })

    if (steps[index].documents) {
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
    for (let index = 0; index < reviewStep; index++) {
      const found = stepErrors(index)

      if (Object.keys(found).length > 0) {
        setErrors(found)
        goTo(index)
        setFormError(intl.formatMessage(messages.fixErrors))

        return
      }
    }

    const form = new FormData()

    // Only the fields of the steps shown: India fields only for India, and
    // IEC only for businesses that import or export
    steps.forEach((s) =>
      s.fields
        .filter((spec) => spec.name !== 'india.iec' || trades)
        .forEach((spec) => form.append(spec.name, value(spec.name).trim()))
    )
    form.append('address.country', country ?? 'USA')
    if (india) {
      form.append('india.importsOrExports', trades ? 'yes' : 'no')
    }

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

    if (step === reviewStep) {
      submit()

      return
    }

    const found = stepErrors(step)

    setErrors((prev) => {
      const next = { ...prev }

      steps[step].fields.forEach((f) => delete next[f.name])
      if (steps[step].documents) DOCUMENT_KINDS.forEach((k) => delete next[k])

      return { ...next, ...found }
    })

    if (Object.keys(found).length > 0) {
      setFormError(intl.formatMessage(messages.fixErrors))

      return
    }

    goTo(step + 1)
  }

  const select = (
    name: FieldName,
    options: Array<{ value: string; label: string }>,
    onSelected?: (selected: string) => void
  ) => (
    <div>
      <label htmlFor={fieldId(name)} style={label}>
        {intl.formatMessage(fieldLabels[name])}
      </label>
      <select
        id={fieldId(name)}
        value={value(name)}
        onChange={(e) => {
          // Read the value now: React 16 reuses the event object, so it's
          // already cleared by the time the updater function below runs.
          const selected = e.target.value

          setValues((prev) => ({ ...prev, [name]: selected }))
          onSelected?.(selected)
        }}
        style={input(false)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  )

  const countrySelect = select(
    'address.country',
    COUNTRIES.map((code) => ({ value: code, label: code })),
    (selected) => {
      // The steps change when India is chosen or left, so steps reached
      // earlier no longer line up: make people walk through them again.
      if (isIndia(selected) !== india) {
        setReached(0)
      }
    }
  )

  const tradeSelect = select('india.importsOrExports', [
    { value: 'no', label: intl.formatMessage(messages.no) },
    { value: 'yes', label: intl.formatMessage(messages.yes) },
  ])

  const textField = (spec: FieldSpec) => (
    <TextField
      key={spec.name}
      spec={spec}
      value={value(spec.name)}
      error={errors[spec.name] ?? null}
      onChange={(next) => setValues((prev) => ({ ...prev, [spec.name]: next }))}
      onBlur={() =>
        setError(spec.name, checkAnyField(spec, value(spec.name), values))
      }
    />
  )

  const grid: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: '18px 20px',
  }

  const notice = (text: Message) => (
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
      <span>{intl.formatMessage(text)}</span>
    </div>
  )

  const demoNotice = notice(messages.demoNotice)

  const current = steps[step] ?? steps[0]

  const companyFields = (
    <>
      <div className={handles.fieldGrid} style={grid}>
        {countrySelect}
        {COMPANY_FIELDS.map(textField)}
      </div>
      {india && (
        <section
          className={handles.indiaSection}
          aria-labelledby="b2b-onboarding-india-title"
          style={{
            marginTop: 28,
            paddingTop: 24,
            borderTop: `1px solid ${color.border}`,
          }}
        >
          <h3
            id="b2b-onboarding-india-title"
            style={{ margin: '0 0 6px', fontSize: 17, fontWeight: 700 }}
          >
            {intl.formatMessage(messages.indiaTitle)}
          </h3>
          <p
            style={{ margin: '0 0 18px', fontSize: 14, color: color.textSoft }}
          >
            {intl.formatMessage(messages.indiaHelp)}
          </p>
          {notice(messages.indiaDemoNotice)}
          <div style={grid}>
            {INDIA_COMPANY_FIELDS.filter((f) => f.name === 'india.pan').map(
              textField
            )}
            {INDIA_COMPANY_FIELDS.filter((f) => f.name === 'india.udyam').map(
              textField
            )}
            {tradeSelect}
            {trades &&
              INDIA_COMPANY_FIELDS.filter((f) => f.name === 'india.iec').map(
                textField
              )}
          </div>
        </section>
      )}
    </>
  )

  const addressFields = (
    <div className={handles.fieldGrid} style={grid}>
      {current.fields.map(textField)}
      <p
        style={{
          gridColumn: '1 / -1',
          margin: 0,
          fontSize: 14,
          color: color.textSoft,
        }}
      >
        {intl.formatMessage(messages.countryOnCompanyStep, { country })}{' '}
        <button
          type="button"
          onClick={() => goTo(indexOf('company'))}
          style={{
            background: 'none',
            border: 'none',
            color: color.accent,
            font: 'inherit',
            fontWeight: 600,
            cursor: 'pointer',
            padding: 0,
          }}
        >
          {intl.formatMessage(messages.changeCountry)}
        </button>
      </p>
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
    country,
  ]
    .filter(Boolean)
    .join(', ')

  const rowsOf = (fields: FieldSpec[]) =>
    fields
      .filter((f) => f.name !== 'india.iec' || trades)
      .map((f) => ({
        label: intl.formatMessage(fieldLabels[f.name]),
        value: value(f.name),
      }))

  const reviewSections = [
    {
      id: 'company' as StepId,
      rows: [
        {
          label: intl.formatMessage(fieldLabels['address.country']),
          value: country ?? '',
        },
        ...rowsOf(COMPANY_FIELDS),
        ...(india
          ? [
              ...rowsOf(
                INDIA_COMPANY_FIELDS.filter((f) => f.name !== 'india.iec')
              ),
              {
                label: intl.formatMessage(
                  fieldLabels['india.importsOrExports']
                ),
                value: intl.formatMessage(trades ? messages.yes : messages.no),
              },
              ...rowsOf(
                INDIA_COMPANY_FIELDS.filter((f) => f.name === 'india.iec')
              ),
            ]
          : []),
      ],
    },
    ...(india ? [{ id: 'bank' as StepId, rows: rowsOf(BANK_FIELDS) }] : []),
    { id: 'contact' as StepId, rows: rowsOf(CONTACT_FIELDS) },
    {
      id: 'address' as StepId,
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
      id: 'documents' as StepId,
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
              steps={steps.map((s) => s.label)}
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
                {current.id === 'bank' && notice(messages.indiaDemoNotice)}

                {current.id === 'company' && companyFields}
                {current.id === 'address' && addressFields}
                {(current.id === 'bank' || current.id === 'contact') && (
                  <div className={handles.fieldGrid} style={grid}>
                    {current.fields.map(textField)}
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

                {current.id === 'review' && (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 16,
                    }}
                  >
                    {demoNotice}
                    {reviewSections.map((section) => {
                      const index = indexOf(section.id)
                      const sectionLabel = intl.formatMessage(
                        steps[index].label
                      )

                      return (
                        <section
                          key={section.id}
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
                              style={{
                                margin: 0,
                                fontSize: 16,
                                fontWeight: 700,
                              }}
                            >
                              {sectionLabel}
                            </h3>
                            <button
                              type="button"
                              onClick={() => goTo(index)}
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
                              )}: ${sectionLabel}`}
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
                      )
                    })}
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
                      total: steps.length,
                    })}
                  </span>
                  <button
                    type="submit"
                    className={handles.submit}
                    disabled={submitting}
                    style={primaryButton(submitting)}
                  >
                    {step === reviewStep
                      ? intl.formatMessage(
                          submitting ? messages.submitting : messages.submit
                        )
                      : step === reviewStep - 1
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
