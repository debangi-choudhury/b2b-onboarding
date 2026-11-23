import React, { useState } from 'react'
import { useIntl } from 'react-intl'
import { useCssHandles } from 'vtex.css-handles'
import { useRuntime } from 'vtex.render-runtime'

import { NextSteps } from './components/SidePanels'
import { fetchStatus } from './utils/api'
import type { ApplicantView } from './utils/api'
import { messages } from './utils/messages'
import { card, color, input, label, primaryButton } from './utils/theme'

const CSS_HANDLES = [
  'statusContainer',
  'statusTitle',
  'statusForm',
  'statusResult',
  'statusBadge',
  'statusReason',
] as const

const BADGE = {
  IN_REVIEW: { background: '#EEF3FD', border: '#C9D6F5', color: '#1A3FA6' },
  APPROVED: { background: '#F1FAF5', border: '#CFE7DA', color: '#17704A' },
  REJECTED: { background: '#FDF1F0', border: '#F2C9C6', color: '#9E2A24' },
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

  const row = (term: string, detail: string | null | undefined) =>
    detail ? (
      <>
        <dt style={{ color: color.textMuted }}>{term}</dt>
        <dd style={{ margin: 0, fontWeight: 600, overflowWrap: 'anywhere' }}>
          {detail}
        </dd>
      </>
    ) : null

  return (
    <div
      className={handles.statusContainer}
      style={{ background: color.ground, color: color.text }}
    >
      <div
        style={{ maxWidth: 1200, margin: '0 auto', padding: '40px 24px 64px' }}
      >
        <p
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
          className={handles.statusTitle}
          style={{
            margin: '0 0 8px',
            fontSize: 34,
            lineHeight: 1.2,
            fontWeight: 700,
          }}
        >
          {intl.formatMessage(messages.statusTitle)}
        </h1>
        <p style={{ margin: '0 0 28px', fontSize: 16, color: color.textSoft }}>
          {intl.formatMessage(messages.statusIntro)}
        </p>

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 24,
            alignItems: 'flex-start',
          }}
        >
          <div
            style={{
              flex: '999 1 560px',
              minWidth: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: 24,
            }}
          >
            <form
              className={handles.statusForm}
              onSubmit={onSubmit}
              style={{ ...card, padding: 32 }}
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: '18px 20px',
                }}
              >
                <div>
                  <label htmlFor="b2b-onboarding-reference" style={label}>
                    {intl.formatMessage(messages.reference)}
                  </label>
                  <input
                    id="b2b-onboarding-reference"
                    style={input(false)}
                    value={reference}
                    placeholder="APP-XXXXXXXX"
                    autoComplete="off"
                    required
                    onChange={(e) => setReference(e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="b2b-onboarding-token" style={label}>
                    {intl.formatMessage(messages.statusCode)}
                  </label>
                  <input
                    id="b2b-onboarding-token"
                    style={input(false)}
                    value={token}
                    type="password"
                    autoComplete="off"
                    required
                    onChange={(e) => setToken(e.target.value)}
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                style={{ ...primaryButton(loading), marginTop: 24 }}
              >
                {intl.formatMessage(messages.lookup)}
              </button>
              {error && (
                <p
                  role="alert"
                  style={{
                    margin: '16px 0 0',
                    fontSize: 15,
                    color: color.danger,
                  }}
                >
                  {error}
                </p>
              )}
            </form>

            {view && (
              <section
                className={handles.statusResult}
                aria-live="polite"
                style={{ ...card, padding: 32 }}
              >
                <p
                  className={handles.statusBadge}
                  style={{
                    display: 'inline-block',
                    margin: '0 0 20px',
                    padding: '8px 14px',
                    borderRadius: 999,
                    fontSize: 14,
                    fontWeight: 600,
                    background: BADGE[view.status].background,
                    border: `1px solid ${BADGE[view.status].border}`,
                    color: BADGE[view.status].color,
                  }}
                >
                  {intl.formatMessage(messages[view.status])}
                </p>
                <dl
                  style={{
                    margin: 0,
                    display: 'grid',
                    gridTemplateColumns: 'minmax(0, 180px) 1fr',
                    gap: '10px 16px',
                    fontSize: 15,
                  }}
                >
                  {row(intl.formatMessage(messages.company2), view.companyName)}
                  {row(intl.formatMessage(messages.reference), view.reference)}
                  {row(
                    intl.formatMessage(messages.submittedOn),
                    date(view.submittedAt)
                  )}
                  {row(
                    intl.formatMessage(messages.currentStep),
                    view.currentStageLabel
                  )}
                  {row(
                    intl.formatMessage(messages.decidedOn),
                    date(view.decidedAt)
                  )}
                </dl>
                {view.rejectionReason && (
                  <div
                    className={handles.statusReason}
                    style={{
                      marginTop: 20,
                      padding: '14px 16px',
                      borderRadius: 10,
                      background: BADGE.REJECTED.background,
                      border: `1px solid ${BADGE.REJECTED.border}`,
                      fontSize: 15,
                    }}
                  >
                    <span
                      style={{
                        display: 'block',
                        fontWeight: 600,
                        marginBottom: 4,
                      }}
                    >
                      {intl.formatMessage(messages.reason)}
                    </span>
                    {view.rejectionReason}
                  </div>
                )}
              </section>
            )}

            <a
              href={`${rootPath}/business-application`}
              style={{ fontSize: 15, fontWeight: 600 }}
            >
              {intl.formatMessage(messages.newApplication)}
            </a>
          </div>

          <aside style={{ flex: '1 1 300px', minWidth: 0 }}>
            <NextSteps />
          </aside>
        </div>
      </div>
    </div>
  )
}

export default StatusPage
