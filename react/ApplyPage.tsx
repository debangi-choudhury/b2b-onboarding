import React, { useState } from 'react'
import { useIntl } from 'react-intl'
import { useCssHandles } from 'vtex.css-handles'
import { useRuntime } from 'vtex.render-runtime'

import { FileField, TextField } from './components/Fields'
import Receipt from './components/Receipt'
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
} from './utils/fields'
import { fieldLabels, messages } from './utils/messages'

const CSS_HANDLES = [
  'container',
  'title',
  'intro',
  'demoNotice',
  'form',
  'section',
  'sectionTitle',
  'sectionHelp',
  'honeypot',
  'formError',
  'submit',
] as const

const ALL_FIELDS = [...COMPANY_FIELDS, ...CONTACT_FIELDS, ...ADDRESS_FIELDS]

type Errors = Partial<Record<FieldName | DocumentKind, ErrorCode>>

function ApplyPage() {
  const intl = useIntl()
  const handles = useCssHandles(CSS_HANDLES)
  const { rootPath = '' } = useRuntime()

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

  const setError = (name: FieldName | DocumentKind, code: ErrorCode | null) =>
    setErrors((prev) => ({ ...prev, [name]: code ?? undefined }))

  const validateAll = (): Errors => {
    const found: Errors = {}

    ALL_FIELDS.forEach((spec) => {
      const code = checkField(spec, values[spec.name] ?? '')

      if (code) found[spec.name] = code
    })

    DOCUMENT_KINDS.forEach((kind) => {
      const code = checkFile(files[kind])

      if (code) found[kind] = code
    })

    return found
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)

    const found = validateAll()

    setErrors(found)

    if (Object.keys(found).length > 0) {
      setFormError(intl.formatMessage(messages.fixErrors))

      return
    }

    const form = new FormData()

    ALL_FIELDS.forEach((spec) =>
      form.append(spec.name, (values[spec.name] ?? '').trim())
    )
    form.append('address.country', values['address.country'] ?? 'USA')
    form.append('website', website)
    DOCUMENT_KINDS.forEach((kind) => form.append(kind, files[kind] as File))

    setSubmitting(true)

    const result = await submitApplication(rootPath, form)

    setSubmitting(false)

    if (result.ok) {
      setReceipt(result.data)
      window.scrollTo?.(0, 0)

      return
    }

    if (result.code === 'INVALID_FIELDS' && result.fields) {
      const serverErrors: Errors = {}

      result.fields.forEach(({ field, code }) => {
        serverErrors[field as FieldName | DocumentKind] = code
      })
      setErrors(serverErrors)
      setFormError(intl.formatMessage(messages.fixErrors))
    } else if (result.status === 429) {
      setFormError(intl.formatMessage(messages.tooMany))
    } else if (result.status === 413) {
      setFormError(intl.formatMessage(messages.tooLargeRequest))
    } else {
      setFormError(intl.formatMessage(messages.failed))
    }
  }

  const renderFields = (specs: FieldSpec[]) =>
    specs.map((spec) => (
      <TextField
        key={spec.name}
        spec={spec}
        value={values[spec.name] ?? ''}
        error={errors[spec.name] ?? null}
        onChange={(value) =>
          setValues((prev) => ({ ...prev, [spec.name]: value }))
        }
        onBlur={() =>
          setError(spec.name, checkField(spec, values[spec.name] ?? ''))
        }
      />
    ))

  const section = (
    title: string,
    help: string | null,
    children: React.ReactNode
  ) => (
    <fieldset className={`${handles.section} bn pa0 mb6`}>
      <legend className={`${handles.sectionTitle} t-heading-4 c-on-base mb3`}>
        {title}
      </legend>
      {help && (
        <p className={`${handles.sectionHelp} t-small c-muted-1 mt0 mb4`}>
          {help}
        </p>
      )}
      {children}
    </fieldset>
  )

  return (
    <div className={`${handles.container} mw7 center pv8 ph5`}>
      <h1 className={`${handles.title} t-heading-2 c-on-base mt0 mb4`}>
        {intl.formatMessage(messages.title)}
      </h1>

      {receipt ? (
        <Receipt receipt={receipt} rootPath={rootPath} />
      ) : (
        <>
          <p className={`${handles.intro} t-body c-on-base mb4`}>
            {intl.formatMessage(messages.intro)}
          </p>
          <p
            className={`${handles.demoNotice} t-small pa4 br2 bg-warning--faded c-on-base mb6`}
          >
            {intl.formatMessage(messages.demoNotice)}
          </p>

          <form className={handles.form} onSubmit={onSubmit} noValidate>
            {section(
              intl.formatMessage(messages.company),
              null,
              renderFields(COMPANY_FIELDS)
            )}
            {section(
              intl.formatMessage(messages.contact),
              intl.formatMessage(messages.contactHelp),
              renderFields(CONTACT_FIELDS)
            )}
            {section(
              intl.formatMessage(messages.address),
              null,
              <>
                {renderFields(ADDRESS_FIELDS)}
                <div className="mb5">
                  <label
                    htmlFor="b2b-onboarding-address-country"
                    className="db mb2 t-small c-on-base"
                  >
                    {intl.formatMessage(fieldLabels['address.country'])}
                  </label>
                  <select
                    id="b2b-onboarding-address-country"
                    value={values['address.country']}
                    onChange={(e) =>
                      setValues((prev) => ({
                        ...prev,
                        'address.country': e.target.value,
                      }))
                    }
                    className="w-100 pa3 br2 ba b--muted-4 bg-base c-on-base t-body"
                  >
                    {COUNTRIES.map((code) => (
                      <option key={code} value={code}>
                        {code}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}
            {section(
              intl.formatMessage(messages.documents),
              intl.formatMessage(messages.documentsHelp),
              DOCUMENT_KINDS.map((kind) => (
                <FileField
                  key={kind}
                  kind={kind}
                  file={files[kind]}
                  error={errors[kind] ?? null}
                  onChange={(file) => {
                    setFiles((prev) => ({ ...prev, [kind]: file }))
                    setError(kind, checkFile(file))
                  }}
                />
              ))
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
                className={`${handles.formError} t-body c-danger mb4`}
                role="alert"
              >
                {formError}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className={`${
                handles.submit
              } pointer pv4 ph7 br2 bn bg-action-primary c-on-action-primary t-action ${
                submitting ? 'o-60' : ''
              }`}
            >
              {intl.formatMessage(
                submitting ? messages.submitting : messages.submit
              )}
            </button>
          </form>
        </>
      )}
    </div>
  )
}

export default ApplyPage
