import React, { useState } from 'react'
import { useIntl } from 'react-intl'
import { useCssHandles } from 'vtex.css-handles'
import { useRuntime } from 'vtex.render-runtime'

import { fetchStatus } from './utils/api'
import type { ApplicantView } from './utils/api'
import { messages } from './utils/messages'

const CSS_HANDLES = [
  'statusContainer',
  'statusTitle',
  'statusForm',
  'statusResult',
  'statusBadge',
  'statusReason',
] as const

const BADGE = {
  IN_REVIEW: 'bg-warning--faded',
  APPROVED: 'bg-success--faded',
  REJECTED: 'bg-danger--faded',
}

function StatusPage() {
  const intl = useIntl()
  const handles = useCssHandles(CSS_HANDLES)
  const { rootPath = '', query } = useRuntime()

  // The reference may come from the link on the receipt. The code never does.
  const [reference, setReference] = useState(query?.reference ?? '')
  const [token, setToken] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<ApplicantView | null>(null)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setView(null)
    setLoading(true)

    const result = await fetchStatus(rootPath, reference.trim(), token.trim())

    setLoading(false)

    if (result.ok) {
      setView(result.data)
    } else if (result.status === 404) {
      setError(intl.formatMessage(messages.notFound))
    } else if (result.status === 429) {
      setError(intl.formatMessage(messages.tooMany))
    } else {
      setError(intl.formatMessage(messages.failed))
    }
  }

  const date = (value: string | null) =>
    value
      ? intl.formatDate(value, {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        })
      : ''

  const input = 'w-100 pa3 br2 ba b--muted-4 bg-base c-on-base t-body'

  return (
    <div className={`${handles.statusContainer} mw6 center pv8 ph5`}>
      <h1 className={`${handles.statusTitle} t-heading-2 c-on-base mt0 mb4`}>
        {intl.formatMessage(messages.statusTitle)}
      </h1>
      <p className="t-body c-on-base mb6">
        {intl.formatMessage(messages.statusIntro)}
      </p>

      <form className={`${handles.statusForm} mb6`} onSubmit={onSubmit}>
        <label
          htmlFor="b2b-onboarding-reference"
          className="db mb2 t-small c-on-base"
        >
          {intl.formatMessage(messages.reference)}
        </label>
        <input
          id="b2b-onboarding-reference"
          className={`${input} mb5`}
          value={reference}
          placeholder="APP-XXXXXXXX"
          autoComplete="off"
          required
          onChange={(e) => setReference(e.target.value)}
        />
        <label
          htmlFor="b2b-onboarding-token"
          className="db mb2 t-small c-on-base"
        >
          {intl.formatMessage(messages.statusCode)}
        </label>
        <input
          id="b2b-onboarding-token"
          className={`${input} mb5`}
          value={token}
          type="password"
          autoComplete="off"
          required
          onChange={(e) => setToken(e.target.value)}
        />
        <button
          type="submit"
          disabled={loading}
          className={`pointer pv4 ph7 br2 bn bg-action-primary c-on-action-primary t-action ${
            loading ? 'o-60' : ''
          }`}
        >
          {intl.formatMessage(messages.lookup)}
        </button>
      </form>

      {error && (
        <p className="t-body c-danger" role="alert">
          {error}
        </p>
      )}

      {view && (
        <section
          className={`${handles.statusResult} pa6 br3 ba b--muted-4`}
          aria-live="polite"
        >
          <p
            className={`${
              handles.statusBadge
            } dib pa3 br2 t-body c-on-base mt0 mb5 ${BADGE[view.status]}`}
          >
            {intl.formatMessage(messages[view.status])}
          </p>
          <dl className="t-body c-on-base ma0">
            <dt className="t-small c-muted-1">
              {intl.formatMessage(messages.company2)}
            </dt>
            <dd className="ml0 mb4">{view.companyName}</dd>
            <dt className="t-small c-muted-1">
              {intl.formatMessage(messages.reference)}
            </dt>
            <dd className="ml0 mb4">{view.reference}</dd>
            <dt className="t-small c-muted-1">
              {intl.formatMessage(messages.submittedOn)}
            </dt>
            <dd className="ml0 mb4">{date(view.submittedAt)}</dd>
            {view.currentStageLabel && (
              <>
                <dt className="t-small c-muted-1">
                  {intl.formatMessage(messages.currentStep)}
                </dt>
                <dd className="ml0 mb4">{view.currentStageLabel}</dd>
              </>
            )}
            {view.decidedAt && (
              <>
                <dt className="t-small c-muted-1">
                  {intl.formatMessage(messages.decidedOn)}
                </dt>
                <dd className="ml0 mb4">{date(view.decidedAt)}</dd>
              </>
            )}
            {view.rejectionReason && (
              <>
                <dt className="t-small c-muted-1">
                  {intl.formatMessage(messages.reason)}
                </dt>
                <dd className={`${handles.statusReason} ml0 mb0`}>
                  {view.rejectionReason}
                </dd>
              </>
            )}
          </dl>
        </section>
      )}

      <a
        className="db mt6 c-link t-body"
        href={`${rootPath}/business-application`}
      >
        {intl.formatMessage(messages.newApplication)}
      </a>
    </div>
  )
}

export default StatusPage
