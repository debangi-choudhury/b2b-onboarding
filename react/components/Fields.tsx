import React from 'react'
import { useIntl } from 'react-intl'
import { useCssHandles } from 'vtex.css-handles'

import type { ErrorCode, FieldSpec } from '../utils/fields'
import { errorLabels, fieldLabels, messages } from '../utils/messages'
import { color, input, label } from '../utils/theme'

const CSS_HANDLES = ['field', 'fieldLabel', 'fieldInput', 'fieldError'] as const

export const fieldId = (name: string) =>
  `b2b-onboarding-${name.replace('.', '-')}`

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
  const id = fieldId(spec.name)

  return (
    <div className={handles.field}>
      <label htmlFor={id} className={handles.fieldLabel} style={label}>
        {intl.formatMessage(fieldLabels[spec.name])}
        {!spec.required && (
          <span style={{ fontWeight: 400, color: color.textMuted }}>
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
        className={handles.fieldInput}
        style={input(!!error)}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
      />
      {error && (
        <p
          id={`${id}-error`}
          className={handles.fieldError}
          style={{ margin: '6px 0 0', fontSize: 13, color: color.danger }}
        >
          {intl.formatMessage(errorLabels[error])}
        </p>
      )}
    </div>
  )
}
