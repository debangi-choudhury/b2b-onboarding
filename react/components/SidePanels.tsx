import React from 'react'
import { useIntl } from 'react-intl'
import { useCssHandles } from 'vtex.css-handles'

import { messages } from '../utils/messages'
import { card, color } from '../utils/theme'

const CSS_HANDLES = ['nextSteps', 'summary'] as const

const NEXT = [
  { title: messages.next1Title, text: messages.next1Text },
  { title: messages.next2Title, text: messages.next2Text },
  { title: messages.next3Title, text: messages.next3Text },
]

/** The review stages, so applicants know what to expect */
export function NextSteps() {
  const intl = useIntl()
  const handles = useCssHandles(CSS_HANDLES)

  return (
    <div className={handles.nextSteps} style={{ ...card, padding: 24 }}>
      <h2 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700 }}>
        {intl.formatMessage(messages.nextTitle)}
      </h2>
      <ol
        style={{
          listStyle: 'none',
          margin: 0,
          padding: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        {NEXT.map((item, index) => (
          <li key={item.title.id} style={{ display: 'flex', gap: 12 }}>
            <span
              aria-hidden="true"
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                background: color.accentSoft,
                color: color.accent,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: 13,
                flex: 'none',
              }}
            >
              {index + 1}
            </span>
            <span style={{ fontSize: 14 }}>
              <span style={{ display: 'block', fontWeight: 600 }}>
                {intl.formatMessage(item.title)}
              </span>
              <span style={{ color: color.textSoft }}>
                {intl.formatMessage(item.text)}
              </span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  )
}

/** What the applicant has entered so far */
export function Summary({
  rows,
}: {
  rows: Array<{ label: string; value: string }>
}) {
  const intl = useIntl()
  const handles = useCssHandles(CSS_HANDLES)

  return (
    <div
      className={handles.summary}
      style={{ ...card, padding: 24, fontSize: 14 }}
    >
      <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700 }}>
        {intl.formatMessage(messages.summaryTitle)}
      </h2>
      {rows.length === 0 ? (
        <p style={{ margin: 0, color: color.textMuted }}>
          {intl.formatMessage(messages.summaryEmpty)}
        </p>
      ) : (
        <dl
          style={{
            margin: 0,
            display: 'grid',
            gridTemplateColumns: 'max-content 1fr',
            gap: '8px 16px',
          }}
        >
          {rows.map((row) => (
            <React.Fragment key={row.label}>
              <dt style={{ color: color.textMuted }}>{row.label}</dt>
              <dd
                style={{ margin: 0, fontWeight: 600, overflowWrap: 'anywhere' }}
              >
                {row.value}
              </dd>
            </React.Fragment>
          ))}
        </dl>
      )}
    </div>
  )
}
