import React from 'react'
import { useIntl } from 'react-intl'
import { Tag } from 'vtex.styleguide'

import { adminMessages } from './messages'
import type { ApplicationStatus, Stage } from './types'
import { isWaitingForApproval } from './types'

type StepState = 'done' | 'current' | 'rejected' | 'todo'

function stepState(
  index: number,
  current: number,
  status: ApplicationStatus
): StepState {
  if (status === 'APPROVED' || index < current) return 'done'
  if (index === current) return status === 'REJECTED' ? 'rejected' : 'current'

  return 'todo'
}

const CIRCLE: Record<StepState, string> = {
  done: 'bg-success c-on-success b--success',
  current: 'bg-base c-action-primary b--action-primary',
  rejected: 'bg-danger c-on-danger b--danger',
  todo: 'bg-base c-muted-2 b--muted-4',
}

/** The application's stages as a horizontal stepper */
export function StageStepper({
  stages,
  currentStageIndex,
  status,
}: {
  stages: Stage[]
  currentStageIndex: number
  status: ApplicationStatus
}) {
  return (
    <ol className="flex list pa0 ma0">
      {stages.map((stage, index) => {
        const state = stepState(index, currentStageIndex, status)

        return (
          <li key={stage.id} className="flex-auto tc relative">
            {index > 0 && (
              <span
                className={`absolute top-1 left-0 w-50 bt bw1 ${
                  state === 'todo' ? 'b--muted-4' : 'b--success'
                }`}
                style={{ marginTop: 12 }}
                aria-hidden="true"
              />
            )}
            {index < stages.length - 1 && (
              <span
                className={`absolute top-1 right-0 w-50 bt bw1 ${
                  state === 'done' ? 'b--success' : 'b--muted-4'
                }`}
                style={{ marginTop: 12 }}
                aria-hidden="true"
              />
            )}
            <span
              className={`relative z-1 dib br-100 ba bw1 t-small b lh-copy ${CIRCLE[state]}`}
              style={{ width: 32, height: 32, lineHeight: '28px' }}
            >
              {state === 'done' ? '✓' : state === 'rejected' ? '✕' : index + 1}
            </span>
            <div className="t-small c-on-base mt2">{stage.label}</div>
            <div className="t-mini c-muted-1">{stage.type.toLowerCase()}</div>
          </li>
        )
      })}
    </ol>
  )
}

/** Thin progress bar for the queue: share of stages done */
export function ProgressBar({
  stages,
  currentStageIndex,
  status,
}: {
  stages: Stage[]
  currentStageIndex: number
  status: ApplicationStatus
}) {
  const done = status === 'APPROVED' ? stages.length : currentStageIndex
  const percent = stages.length ? Math.round((done / stages.length) * 100) : 0

  return (
    <div className="bg-muted-5 br-pill overflow-hidden" style={{ height: 6 }}>
      <div
        className={status === 'REJECTED' ? 'bg-danger' : 'bg-success'}
        style={{ width: `${percent}%`, height: 6 }}
      />
    </div>
  )
}

export function StatusTag({
  app,
}: {
  app: { status: ApplicationStatus; stages: Stage[]; currentStageIndex: number }
}) {
  const intl = useIntl()

  if (isWaitingForApproval(app)) {
    return (
      <Tag type="warning" variation="low" size="small">
        {intl.formatMessage(adminMessages.statusWAITING)}
      </Tag>
    )
  }

  const type =
    app.status === 'APPROVED'
      ? 'success'
      : app.status === 'REJECTED'
      ? 'error'
      : 'neutral'

  const label = {
    IN_REVIEW: adminMessages.statusIN_REVIEW,
    APPROVED: adminMessages.statusAPPROVED,
    REJECTED: adminMessages.statusREJECTED,
  }[app.status]

  return (
    <Tag type={type} variation="low" size="small">
      {intl.formatMessage(label)}
    </Tag>
  )
}
