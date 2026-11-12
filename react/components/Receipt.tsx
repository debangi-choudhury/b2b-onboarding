import React, { useState } from 'react'
import { useIntl } from 'react-intl'
import { useCssHandles } from 'vtex.css-handles'

import type { Receipt as ReceiptData } from '../utils/api'
import { messages } from '../utils/messages'
import { card, color, primaryButton, secondaryButton } from '../utils/theme'
import { NextSteps } from './SidePanels'

const CSS_HANDLES = [
  'receipt',
  'receiptTitle',
  'receiptValue',
  'receiptCopy',
  'receiptLink',
] as const

function CopyValue({ label, value }: { label: string; value: string }) {
  const intl = useIntl()
  const handles = useCssHandles(CSS_HANDLES)
  const [copied, setCopied] = useState(false)

  const copy = () => {
    navigator.clipboard
      ?.writeText(value)
      .then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      })
      .catch(() => {})
  }

  return (
    <div
      style={{
        border: `1px solid ${color.border}`,
        borderRadius: 12,
        padding: '14px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        flexWrap: 'wrap',
      }}
    >
      <span style={{ flex: '1 1 200px', minWidth: 0 }}>
        <span
          style={{ display: 'block', fontSize: 13, color: color.textMuted }}
        >
          {label}
        </span>
        <code
          className={handles.receiptValue}
          style={{
            fontSize: 18,
            fontWeight: 600,
            color: color.text,
            overflowWrap: 'anywhere',
          }}
        >
          {value}
        </code>
      </span>
      <button
        type="button"
        onClick={copy}
        className={handles.receiptCopy}
        style={{ ...secondaryButton, fontSize: 14 }}
        aria-label={`${intl.formatMessage(messages.copy)}: ${label}`}
      >
        {intl.formatMessage(copied ? messages.copied : messages.copy)}
      </button>
    </div>
  )
}

export default function Receipt({
  receipt,
  rootPath,
}: {
  receipt: ReceiptData
  rootPath: string
}) {
  const intl = useIntl()
  const handles = useCssHandles(CSS_HANDLES)

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 24,
        alignItems: 'flex-start',
        marginTop: 24,
      }}
    >
      <section
        className={handles.receipt}
        aria-live="polite"
        style={{ ...card, flex: '999 1 560px', minWidth: 0, padding: 32 }}
      >
        <span
          aria-hidden="true"
          style={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: color.successSoft,
            border: `1px solid ${color.successBorder}`,
            color: color.success,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 16,
          }}
        >
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 12l5 5L20 7" />
          </svg>
        </span>
        <h2
          className={handles.receiptTitle}
          style={{ margin: '0 0 8px', fontSize: 24, fontWeight: 700 }}
        >
          {intl.formatMessage(messages.successTitle)}
        </h2>
        <p style={{ margin: '0 0 24px', fontSize: 15, color: color.textSoft }}>
          {intl.formatMessage(messages.successText)}
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <CopyValue
            label={intl.formatMessage(messages.reference)}
            value={receipt.reference}
          />
          <CopyValue
            label={intl.formatMessage(messages.statusCode)}
            value={receipt.statusToken}
          />
        </div>
        <a
          className={handles.receiptLink}
          href={`${rootPath}/business-application/status?reference=${encodeURIComponent(
            receipt.reference
          )}`}
          style={{
            ...primaryButton(),
            display: 'inline-flex',
            alignItems: 'center',
            textDecoration: 'none',
            marginTop: 24,
          }}
        >
          {intl.formatMessage(messages.checkStatus)}
        </a>
      </section>
      <aside style={{ flex: '1 1 300px', minWidth: 0 }}>
        <NextSteps />
      </aside>
    </div>
  )
}
