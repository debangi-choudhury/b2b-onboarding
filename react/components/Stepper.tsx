import React from 'react'
import { useIntl } from 'react-intl'
import { useCssHandles } from 'vtex.css-handles'

import { messages } from '../utils/messages'
import { card, color } from '../utils/theme'

const CSS_HANDLES = ['stepper', 'stepperItem'] as const

type Message = { id: string; defaultMessage: string }

const Check = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="3"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M5 12l5 5L20 7" />
  </svg>
)

/**
 * The application's steps. Finished steps can be clicked to go back to them;
 * steps not reached yet can't.
 */
export function Stepper({
  steps,
  current,
  reached,
  onSelect,
}: {
  steps: Message[]
  current: number
  reached: number
  onSelect: (index: number) => void
}) {
  const intl = useIntl()
  const handles = useCssHandles(CSS_HANDLES)

  return (
    <ol
      className={handles.stepper}
      aria-label={intl.formatMessage(messages.stepsLabel)}
      style={{
        ...card,
        borderRadius: 14,
        listStyle: 'none',
        margin: '0 0 32px',
        padding: '20px 24px',
        display: 'flex',
        flexWrap: 'wrap',
        gap: 16,
      }}
    >
      {steps.map((step, index) => {
        const done = index < current
        const isCurrent = index === current
        const clickable = index <= reached && !isCurrent
        const state = isCurrent
          ? messages.stepCurrent
          : done || index <= reached
          ? messages.stepDone
          : messages.stepUpNext

        const circle: React.CSSProperties = {
          width: 32,
          height: 32,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 700,
          fontSize: 14,
          flex: 'none',
          boxSizing: 'border-box',
          ...(isCurrent
            ? {
                background: color.accent,
                color: '#FFFFFF',
                boxShadow: `0 0 0 4px ${color.accentRing}`,
              }
            : done || index <= reached
            ? { background: color.success, color: '#FFFFFF' }
            : {
                background: color.surface,
                border: `2px solid ${color.borderStrong}`,
                color: color.textMuted,
              }),
        }

        const content = (
          <>
            <span style={circle} aria-hidden="true">
              {!isCurrent && (done || index <= reached) ? <Check /> : index + 1}
            </span>
            <span style={{ fontSize: 14, textAlign: 'left' }}>
              <span
                style={{
                  display: 'block',
                  fontWeight: isCurrent ? 700 : 600,
                  color: isCurrent ? color.accent : color.text,
                }}
              >
                {intl.formatMessage(step)}
              </span>
              <span style={{ color: color.textMuted, fontSize: 12 }}>
                {intl.formatMessage(state)}
              </span>
            </span>
          </>
        )

        return (
          <li
            key={step.id}
            className={handles.stepperItem}
            aria-current={isCurrent ? 'step' : undefined}
            style={{ flex: '1 1 150px', minWidth: 0 }}
          >
            {clickable ? (
              <button
                type="button"
                onClick={() => onSelect(index)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  font: 'inherit',
                  cursor: 'pointer',
                  minHeight: 44,
                }}
              >
                {content}
              </button>
            ) : (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  minHeight: 44,
                }}
              >
                {content}
              </div>
            )}
          </li>
        )
      })}
    </ol>
  )
}
