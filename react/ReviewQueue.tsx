import React, { useState } from 'react'
import { useQuery } from 'react-apollo'
import { useIntl } from 'react-intl'
import {
  Alert,
  Button,
  Layout,
  PageBlock,
  PageHeader,
  Spinner,
} from 'vtex.styleguide'
import { useRuntime } from 'vtex.render-runtime'

import { adminMessages } from './admin/messages'
import { ProgressBar, StatusTag } from './admin/StageStepper'
import type { ApplicationStatus, ListItem } from './admin/types'
import { isWaitingForApproval } from './admin/types'
import APPLICATIONS from './graphql/applications.graphql'

type Filter = 'ALL' | 'IN_REVIEW' | 'WAITING' | 'APPROVED' | 'REJECTED'

const FILTERS: Array<{
  id: Filter
  message: { id: string; defaultMessage: string }
}> = [
  { id: 'ALL', message: adminMessages.filterAll },
  { id: 'IN_REVIEW', message: adminMessages.filterInReview },
  { id: 'WAITING', message: adminMessages.filterWaiting },
  { id: 'APPROVED', message: adminMessages.filterApproved },
  { id: 'REJECTED', message: adminMessages.filterRejected },
]

const PAGE_SIZE = 20

// "Waiting for approval" is a slice of IN_REVIEW, filtered on this page
const serverStatus = (filter: Filter): ApplicationStatus | undefined =>
  filter === 'ALL' ? undefined : filter === 'WAITING' ? 'IN_REVIEW' : filter

interface QueryData {
  onboardingApplications: {
    items: ListItem[]
    pagination: { total: number; page: number; pageSize: number }
  }
}

function ReviewQueue() {
  const intl = useIntl()
  const { navigate } = useRuntime()
  const [filter, setFilter] = useState<Filter>('ALL')
  const [page, setPage] = useState(1)

  const { data, loading, error } = useQuery<QueryData>(APPLICATIONS, {
    variables: { status: serverStatus(filter), page, pageSize: PAGE_SIZE },
    fetchPolicy: 'network-only',
  })

  const result = data?.onboardingApplications
  const items = (result?.items ?? []).filter(
    (item) => filter !== 'WAITING' || isWaitingForApproval(item)
  )

  const pages = result
    ? Math.max(1, Math.ceil(result.pagination.total / PAGE_SIZE))
    : 1

  const date = (value: string) =>
    intl.formatDate(value, { year: 'numeric', month: 'short', day: 'numeric' })

  return (
    <Layout
      pageHeader={
        <PageHeader
          title={intl.formatMessage(adminMessages.queueTitle)}
          subtitle={intl.formatMessage(adminMessages.queueSubtitle)}
        />
      }
    >
      <PageBlock>
        <div className="flex flex-wrap mb5" role="group">
          {FILTERS.map(({ id, message }) => (
            <button
              key={id}
              type="button"
              aria-pressed={filter === id}
              onClick={() => {
                setFilter(id)
                setPage(1)
              }}
              className={`pointer mr3 mb2 ph4 pv2 br-pill ba t-small ${
                filter === id
                  ? 'bg-action-primary c-on-action-primary b--action-primary'
                  : 'bg-base c-on-base b--muted-4'
              }`}
            >
              {intl.formatMessage(message)}
            </button>
          ))}
        </div>

        {error && (
          <Alert type="error">
            {intl.formatMessage(adminMessages.loadError)}
          </Alert>
        )}

        {loading && !data && (
          <div className="flex justify-center pa7">
            <Spinner />
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <p className="t-body c-muted-1 tc pa7">
            {intl.formatMessage(adminMessages.empty)}
          </p>
        )}

        {items.length > 0 && (
          <table
            className="w-100 t-small"
            style={{ borderCollapse: 'collapse' }}
          >
            <thead>
              <tr className="tl c-muted-1 bb b--muted-4">
                <th className="pa3 normal">
                  {intl.formatMessage(adminMessages.colReference)}
                </th>
                <th className="pa3 normal">
                  {intl.formatMessage(adminMessages.colCompany)}
                </th>
                <th className="pa3 normal">
                  {intl.formatMessage(adminMessages.colRegistration)}
                </th>
                <th className="pa3 normal">
                  {intl.formatMessage(adminMessages.colSubmitted)}
                </th>
                <th className="pa3 normal" style={{ width: '22%' }}>
                  {intl.formatMessage(adminMessages.colProgress)}
                </th>
                <th className="pa3 normal">
                  {intl.formatMessage(adminMessages.colStatus)}
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const stage = item.stages[item.currentStageIndex]

                return (
                  <tr
                    key={item.id}
                    className="bb b--muted-5 pointer hover-bg-muted-5"
                    onClick={() =>
                      navigate({ to: `/admin/app/b2b-onboarding/${item.id}` })
                    }
                  >
                    <td className="pa3">
                      <a
                        className="c-link no-underline"
                        href={`/admin/app/b2b-onboarding/${item.id}`}
                        onClick={(e) => e.preventDefault()}
                      >
                        <code>{item.reference}</code>
                      </a>
                    </td>
                    <td className="pa3 c-on-base">{item.companyName}</td>
                    <td className="pa3 c-muted-1">{item.registrationNumber}</td>
                    <td className="pa3 c-muted-1">{date(item.submittedAt)}</td>
                    <td className="pa3">
                      <ProgressBar
                        stages={item.stages}
                        currentStageIndex={item.currentStageIndex}
                        status={item.status}
                      />
                      <div className="t-mini c-muted-1 mt1">
                        {item.status === 'APPROVED' || !stage
                          ? intl.formatMessage(adminMessages.allDone)
                          : intl.formatMessage(adminMessages.stageOf, {
                              current: item.currentStageIndex + 1,
                              total: item.stages.length,
                              label: stage.label,
                            })}
                      </div>
                    </td>
                    <td className="pa3">
                      <StatusTag app={item} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}

        {result && pages > 1 && (
          <div className="flex items-center justify-end mt5">
            <Button
              variation="tertiary"
              size="small"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              {intl.formatMessage(adminMessages.previous)}
            </Button>
            <span className="t-small c-muted-1 mh3">
              {intl.formatMessage(adminMessages.pageOf, { page, pages })}
            </span>
            <Button
              variation="tertiary"
              size="small"
              disabled={page >= pages}
              onClick={() => setPage(page + 1)}
            >
              {intl.formatMessage(adminMessages.next)}
            </Button>
          </div>
        )}
      </PageBlock>
    </Layout>
  )
}

export default ReviewQueue
