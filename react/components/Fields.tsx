import React from 'react'
import { useIntl } from 'react-intl'
import { useCssHandles } from 'vtex.css-handles'

import type { DocumentKind, ErrorCode, FieldSpec } from '../utils/fields'
import { ACCEPTED_FILES, formatSize } from '../utils/fields'
import {
  documentLabels,
  errorLabels,
  fieldLabels,
  messages,
} from '../utils/messages'

const CSS_HANDLES = [
  'field',
  'fieldLabel',
  'fieldInput',
  'fieldError',
  'fileName',
] as const

const inputClass = (hasError: boolean) =>
  `w-100 pa3 br2 ba bg-base c-on-base t-body ${
    hasError ? 'b--danger' : 'b--muted-4'
  }`

const idFor = (name: string) => `b2b-onboarding-${name.replace('.', '-')}`

export function TextField({
  spec,
  value,
  error,
  onChange,
  onBlur,
}: {
  spec: FieldSpec
  value: string
  error: ErrorCode | null
  onChange: (value: string) => void
  onBlur: () => void
}) {
  const intl = useIntl()
  const handles = useCssHandles(CSS_HANDLES)
  const id = idFor(spec.name)

  return (
    <div className={`${handles.field} mb5`}>
      <label
        htmlFor={id}
        className={`${handles.fieldLabel} db mb2 t-small c-on-base`}
      >
        {intl.formatMessage(fieldLabels[spec.name])}
        {!spec.required && (
          <span className="c-muted-1">
            {' '}
            {intl.formatMessage(messages.optional)}
          </span>
        )}
      </label>
      <input
        id={id}
        name={spec.name}
        type={spec.type ?? 'text'}
        value={value}
        maxLength={spec.max}
        autoComplete={spec.autoComplete}
        required={spec.required}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`${handles.fieldInput} ${inputClass(!!error)}`}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
      />
      {error && (
        <p
          id={`${id}-error`}
          className={`${handles.fieldError} mt2 mb0 t-small c-danger`}
        >
          {intl.formatMessage(errorLabels[error])}
        </p>
      )}
    </div>
  )
}

export function FileField({
  kind,
  file,
  error,
  onChange,
}: {
  kind: DocumentKind
  file: File | null
  error: ErrorCode | null
  onChange: (file: File | null) => void
}) {
  const intl = useIntl()
  const handles = useCssHandles(CSS_HANDLES)
  const id = idFor(kind)

  return (
    <div className={`${handles.field} mb5`}>
      <label
        htmlFor={id}
        className={`${handles.fieldLabel} db mb2 t-small c-on-base`}
      >
        {intl.formatMessage(documentLabels[kind])}
      </label>
      <input
        id={id}
        name={kind}
        type="file"
        accept={ACCEPTED_FILES}
        required
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`${handles.fieldInput} ${inputClass(!!error)}`}
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
      {file && !error && (
        <p className={`${handles.fileName} mt2 mb0 t-small c-muted-1`}>
          {file.name} · {formatSize(file.size)}
        </p>
      )}
      {error && (
        <p
          id={`${id}-error`}
          className={`${handles.fieldError} mt2 mb0 t-small c-danger`}
        >
          {intl.formatMessage(errorLabels[error])}
        </p>
      )}
    </div>
  )
}
