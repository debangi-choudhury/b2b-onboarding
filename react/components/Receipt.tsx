import React, { useState } from 'react'
import { useIntl } from 'react-intl'
import { useCssHandles } from 'vtex.css-handles'

import type { Receipt as ReceiptData } from '../utils/api'
import { messages } from '../utils/messages'

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
    <div className="mb4">
      <div className="t-small c-muted-1 mb1">{label}</div>
      <div className="flex items-center">
        <code
          className={`${handles.receiptValue} t-heading-5 c-on-base mr3 break-all`}
        >
          {value}
        </code>
        <button
          type="button"
          onClick={copy}
          className={`${handles.receiptCopy} pointer pa2 br2 ba b--action-primary bg-base c-action-primary t-small`}
        >
          {intl.formatMessage(copied ? messages.copied : messages.copy)}
        </button>
      </div>
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
    <section
      className={`${handles.receipt} pa6 br3 ba b--success bg-base`}
      aria-live="polite"
    >
      <h2 className={`${handles.receiptTitle} t-heading-3 mt0 mb3 c-success`}>
        {intl.formatMessage(messages.successTitle)}
      </h2>
      <p className="t-body c-on-base mt0 mb5">
        {intl.formatMessage(messages.successText)}
      </p>
      <CopyValue
        label={intl.formatMessage(messages.reference)}
        value={receipt.reference}
      />
      <CopyValue
        label={intl.formatMessage(messages.statusCode)}
        value={receipt.statusToken}
      />
      <a
        className={`${handles.receiptLink} c-link t-body`}
        href={`${rootPath}/business-application/status?reference=${encodeURIComponent(
          receipt.reference
        )}`}
      >
        {intl.formatMessage(messages.checkStatus)}
      </a>
    </section>
  )
}
