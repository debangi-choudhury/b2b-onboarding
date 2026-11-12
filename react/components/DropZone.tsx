import React, { useRef, useState } from 'react'
import { useIntl } from 'react-intl'
import { useCssHandles } from 'vtex.css-handles'

import type { DocumentKind, ErrorCode } from '../utils/fields'
import { ACCEPTED_FILES, formatSize } from '../utils/fields'
import { documentLabels, errorLabels, messages } from '../utils/messages'
import { color, secondaryButton } from '../utils/theme'
import { fieldId } from './Fields'

const CSS_HANDLES = [
  'dropZone',
  'dropZoneActive',
  'fileCard',
  'fileName',
  'fieldError',
] as const

const iconBox = (bg: string, fg: string): React.CSSProperties => ({
  width: 44,
  height: 44,
  borderRadius: 10,
  background: bg,
  color: fg,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flex: 'none',
})

/** One document: a drop zone, or the chosen file with a Replace button */
export function DropZone({
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
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const id = fieldId(kind)
  const title = intl.formatMessage(documentLabels[kind])

  const pick = () => inputRef.current?.click()

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const dropped = e.dataTransfer.files?.[0]

    if (dropped) onChange(dropped)
  }

  const hiddenInput = (
    <input
      ref={inputRef}
      id={id}
      name={kind}
      type="file"
      accept={ACCEPTED_FILES}
      aria-invalid={!!error}
      aria-describedby={error ? `${id}-error` : undefined}
      style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }}
      onChange={(e) => onChange(e.target.files?.[0] ?? null)}
    />
  )

  return (
    <div>
      <p style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 600 }}>
        {title}
      </p>

      {file && !error ? (
        <div
          className={handles.fileCard}
          style={{
            border: `1.5px solid ${color.success}`,
            background: color.successSoft,
            borderRadius: 12,
            padding: 18,
            display: 'flex',
            gap: 14,
            alignItems: 'center',
          }}
        >
          <span
            style={{
              ...iconBox(color.surface, color.success),
              border: `1px solid ${color.successBorder}`,
            }}
            aria-hidden="true"
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
              <path d="M14 3v5h5" />
              <path d="M9 15l2 2 4-4" />
            </svg>
          </span>
          <span style={{ flex: 1, minWidth: 0, fontSize: 14 }}>
            <span
              className={handles.fileName}
              style={{
                display: 'block',
                fontWeight: 600,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {file.name}
            </span>
            <span style={{ color: color.textSoft }}>
              {formatSize(file.size)} · {intl.formatMessage(messages.ready)}
            </span>
          </span>
          {hiddenInput}
          <button
            type="button"
            style={{ ...secondaryButton, fontSize: 14, padding: '0 14px' }}
            aria-label={`${intl.formatMessage(messages.replace)}: ${title}`}
            onClick={pick}
          >
            {intl.formatMessage(messages.replace)}
          </button>
        </div>
      ) : (
        <label
          htmlFor={id}
          className={`${handles.dropZone} ${
            dragging ? handles.dropZoneActive : ''
          }`}
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          style={{
            border: `1.5px dashed ${
              error
                ? color.dangerBorder
                : dragging
                ? color.accent
                : color.dropBorder
            }`,
            background: dragging ? color.accentSoft : color.dropSoft,
            borderRadius: 12,
            padding: '22px 18px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 8,
            textAlign: 'center',
            cursor: 'pointer',
            position: 'relative',
          }}
        >
          <span
            style={{
              ...iconBox(color.accentSoft, color.accent),
              borderRadius: '50%',
            }}
            aria-hidden="true"
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 16V4" />
              <path d="M6 10l6-6 6 6" />
              <path d="M4 20h16" />
            </svg>
          </span>
          <span style={{ fontSize: 14, fontWeight: 600, color: color.text }}>
            {intl.formatMessage(messages.dropHere)}{' '}
            <span style={{ color: color.accent, textDecoration: 'underline' }}>
              {intl.formatMessage(messages.browse)}
            </span>
          </span>
          <span style={{ fontSize: 13, color: color.textMuted }}>
            {intl.formatMessage(messages.fileHint)}
          </span>
          {hiddenInput}
        </label>
      )}

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
