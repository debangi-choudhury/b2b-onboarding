import React, { useEffect, useState } from 'react'
import { useApolloClient, useMutation, useQuery } from 'react-apollo'
import { useIntl } from 'react-intl'
import {
  Alert,
  Button,
  Layout,
  Modal,
  PageBlock,
  PageHeader,
  Spinner,
  Tag,
  Textarea,
} from 'vtex.styleguide'
import { useRuntime } from 'vtex.render-runtime'

import { adminMessages as m } from './admin/messages'
import { StageStepper, StatusTag } from './admin/StageStepper'
import type {
  ApplicationDetail,
  DocumentInfo,
  HistoryEvent,
} from './admin/types'
import APPLICATION from './graphql/application.graphql'
import DECIDE_STAGE from './graphql/decideStage.graphql'
import DOCUMENT from './graphql/document.graphql'
import REVIEW_DOCUMENT from './graphql/reviewDocument.graphql'
import RUN_VERIFICATION from './graphql/runVerification.graphql'
import { formatSize } from './utils/fields'

type Message = { id: string; defaultMessage: string }

const DOC_LABEL: Record<string, Message> = {
  REGISTRATION_CERTIFICATE: m.docREGISTRATION_CERTIFICATE,
  TAX_CERTIFICATE: m.docTAX_CERTIFICATE,
}

const DOC_STATUS: Record<string, Message> = {
  NEEDS_REVIEW: m.docNEEDS_REVIEW,
  ACCEPTED: m.docACCEPTED,
  REJECTED: m.docREJECTED,
}

const EVENT_LABEL: Record<string, Message> = {
  SUBMITTED: m.evSUBMITTED,
  DOCUMENT_REVIEWED: m.evDOCUMENT_REVIEWED,
  VERIFICATION_RUN: m.evVERIFICATION_RUN,
  STAGE_PASSED: m.evSTAGE_PASSED,
  APPROVED: m.evAPPROVED,
  REJECTED: m.evREJECTED,
  APPROVAL_FAILED: m.evAPPROVAL_FAILED,
}

function errorText(e: unknown): string {
  const err = e as {
    graphQLErrors?: Array<{ message?: string }>
    message?: string
  }

  return err.graphQLErrors?.[0]?.message ?? err.message ?? String(e)
}

function Field({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null

  return (
    <div className="mb3">
      <div className="t-mini c-muted-1">{label}</div>
      <div className="t-body c-on-base">{value}</div>
    </div>
  )
}

/** Opens a document in a modal. The file comes from our API as base64. */
function DocumentViewer({
  applicationId,
  doc,
  onClose,
}: {
  applicationId: string
  doc: DocumentInfo
  onClose: () => void
}) {
  const intl = useIntl()
  const client = useApolloClient()
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let objectUrl: string | null = null

    client
      .query({
        query: DOCUMENT,
        variables: { id: applicationId, kind: doc.kind },
        fetchPolicy: 'no-cache',
      })
      .then(
        ({
          data,
        }: {
          data: {
            onboardingDocument: { contentType: string; dataBase64: string }
          }
        }) => {
          const { contentType, dataBase64 } = data.onboardingDocument
          const bytes = Uint8Array.from(atob(dataBase64), (c) =>
            c.charCodeAt(0)
          )

          objectUrl = URL.createObjectURL(
            new Blob([bytes], { type: contentType })
          )
          setUrl(objectUrl)
        }
      )
      .catch((e: unknown) => setError(errorText(e)))

    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [client, applicationId, doc.kind])

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={`${intl.formatMessage(DOC_LABEL[doc.kind] ?? m.documents)} · ${
        doc.fileName
      }`}
      bottomBar={
        url ? (
          <a className="c-link t-body" href={url} download={doc.fileName}>
            {intl.formatMessage(m.download)}
          </a>
        ) : null
      }
    >
      {error && <Alert type="error">{error}</Alert>}
      {!url && !error && (
        <div className="flex justify-center pa7">
          <Spinner />
        </div>
      )}
      {url &&
        (doc.contentType === 'application/pdf' ? (
          <object
            data={url}
            type="application/pdf"
            width="100%"
            style={{ height: '70vh' }}
          >
            <a href={url} download={doc.fileName}>
              {doc.fileName}
            </a>
          </object>
        ) : (
          <img src={url} alt={doc.fileName} style={{ maxWidth: '100%' }} />
        ))}
    </Modal>
  )
}

function HistoryList({ events }: { events: HistoryEvent[] }) {
  const intl = useIntl()

  return (
    <ol className="list pa0 ma0">
      {events.map((event, i) => {
        let detail: string | null = null

        try {
          const parsed = event.details ? JSON.parse(event.details) : null

          if (event.type === 'DOCUMENT_REVIEWED' && parsed) {
            detail = `${intl.formatMessage(
              DOC_LABEL[parsed.kind] ?? m.documents
            )}: ${intl.formatMessage(
              DOC_STATUS[parsed.decision] ?? m.docNEEDS_REVIEW
            )}`
          } else if (event.type === 'VERIFICATION_RUN' && parsed) {
            detail = `${parsed.status}: ${parsed.message}`
          } else if (event.type === 'APPROVAL_FAILED' && parsed) {
            detail = parsed.message
          }
        } catch {
          detail = null
        }

        return (
          <li key={i} className="flex pv3 bb b--muted-5">
            <div className="t-mini c-muted-1 w-30 pr3">
              {intl.formatDate(event.createdAt, {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </div>
            <div className="w-70">
              <div className="t-small c-on-base">
                {intl.formatMessage(EVENT_LABEL[event.type] ?? m.history)}
                {event.stageLabel ? ` · ${event.stageLabel}` : ''}
              </div>
              <div className="t-mini c-muted-1">
                {intl.formatMessage(m.by, { actor: event.actor })}
              </div>
              {detail && <div className="t-small c-on-base mt1">{detail}</div>}
              {event.reason && (
                <div className="t-small c-danger mt1">{event.reason}</div>
              )}
              {event.note && (
                <div className="t-small c-muted-1 mt1 i">{event.note}</div>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

function ReviewDetail({ params }: { params: { id: string } }) {
  const intl = useIntl()
  const { navigate } = useRuntime()
  const { data, loading, error, refetch } = useQuery<{
    onboardingApplication: ApplicationDetail
  }>(APPLICATION, { variables: { id: params.id }, fetchPolicy: 'network-only' })

  const [reviewDoc] = useMutation(REVIEW_DOCUMENT)
  const [runCheck] = useMutation(RUN_VERIFICATION)
  const [decideStage] = useMutation(DECIDE_STAGE)

  const [busy, setBusy] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [viewing, setViewing] = useState<DocumentInfo | null>(null)
  const [rejectingDoc, setRejectingDoc] = useState<DocumentInfo | null>(null)
  const [rejectingApp, setRejectingApp] = useState(false)
  const [note, setNote] = useState('')
  const [reason, setReason] = useState('')

  const app = data?.onboardingApplication
  const stage = app?.currentStage ?? null
  const date = (value: string) =>
    intl.formatDate(value, { year: 'numeric', month: 'short', day: 'numeric' })

  // Every action sends the stage the reviewer is looking at, so two reviewers
  // can't act on different stages of the same application.
  const act = async (key: string, run: () => Promise<unknown>) => {
    setBusy(key)
    setActionError(null)

    try {
      await run()
      await refetch()
      setNote('')
      setReason('')
      setRejectingDoc(null)
      setRejectingApp(false)
    } catch (e) {
      setActionError(
        intl.formatMessage(m.actionFailed, { message: errorText(e) })
      )
      await refetch().catch(() => {})
    } finally {
      setBusy(null)
    }
  }

  const header = (
    <PageHeader
      title={app ? `${app.companyName}` : intl.formatMessage(m.queueTitle)}
      subtitle={
        app
          ? `${app.reference} · ${intl.formatMessage(m.submittedOn, {
              date: date(app.submittedAt),
            })}`
          : undefined
      }
      linkLabel={intl.formatMessage(m.back)}
      onLinkClick={() => navigate({ to: '/admin/app/b2b-onboarding' })}
    />
  )

  if (loading && !app) {
    return (
      <Layout pageHeader={header}>
        <div className="flex justify-center pa7">
          <Spinner />
        </div>
      </Layout>
    )
  }

  if (error || !app) {
    return (
      <Layout pageHeader={header}>
        <Alert type="error">{intl.formatMessage(m.loadError)}</Alert>
      </Layout>
    )
  }

  const pendingDocs = app.documents.filter(
    (d) => d.status !== 'ACCEPTED'
  ).length

  const canPass =
    !!stage &&
    (stage.type === 'REVIEW'
      ? pendingDocs === 0
      : stage.type === 'VERIFICATION'
      ? app.verification?.status === 'PASSED'
      : true)

  const passHint =
    stage?.type === 'REVIEW'
      ? m.passHintReview
      : stage?.type === 'VERIFICATION'
      ? m.passHintVerification
      : m.passHintApproval

  return (
    <Layout pageHeader={header}>
      <div className="mb5 flex items-center">
        <StatusTag app={app} />
      </div>

      {actionError && (
        <div className="mb5">
          <Alert type="error" onClose={() => setActionError(null)}>
            {actionError}
          </Alert>
        </div>
      )}

      <PageBlock>
        <StageStepper
          stages={app.stages}
          currentStageIndex={app.currentStageIndex}
          status={app.status}
        />
      </PageBlock>

      {app.status !== 'IN_REVIEW' && (
        <PageBlock>
          <p className="t-body c-on-base mt0">
            {intl.formatMessage(m.closed, {
              date: app.decidedAt ? date(app.decidedAt) : '',
            })}
          </p>
          {app.rejectionReason && (
            <p className="t-body c-danger mb0">
              {intl.formatMessage(m.rejectedBecause, {
                reason: app.rejectionReason,
              })}
            </p>
          )}
          {app.organizationId && (
            <p className="t-body c-success mb0">
              {intl.formatMessage(m.organizationCreated, {
                id: app.organizationId,
              })}
            </p>
          )}
        </PageBlock>
      )}

      {stage && app.status === 'IN_REVIEW' && (
        <PageBlock
          title={`${intl.formatMessage(m.currentStep)}: ${stage.label}`}
        >
          <p className="t-small c-muted-1 mt0 mb5">
            {intl.formatMessage(passHint)}
          </p>
          <div className="flex flex-wrap">
            <div className="mr4 mb3">
              <Button
                isLoading={busy === 'pass'}
                disabled={!canPass || !!busy}
                onClick={() =>
                  act('pass', () =>
                    decideStage({
                      variables: {
                        id: app.id,
                        stageId: stage.id,
                        decision: 'PASS',
                        note: note || undefined,
                      },
                    })
                  )
                }
              >
                {stage.type === 'APPROVAL'
                  ? intl.formatMessage(m.approve)
                  : intl.formatMessage(m.passStage, { stage: stage.label })}
              </Button>
            </div>
            <div className="mb3">
              <Button
                variation="danger-tertiary"
                disabled={!!busy}
                onClick={() => setRejectingApp(true)}
              >
                {intl.formatMessage(m.rejectApplication)}
              </Button>
            </div>
          </div>
          <div className="mt4">
            <Textarea
              label={intl.formatMessage(m.internalNote)}
              value={note}
              rows={2}
              maxLength={1000}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </PageBlock>
      )}

      <PageBlock variation="half">
        <div>
          <h3 className="t-heading-5 mt0">{intl.formatMessage(m.company)}</h3>
          <Field
            label={intl.formatMessage(m.legalName)}
            value={app.companyName}
          />
          <Field
            label={intl.formatMessage(m.tradeName)}
            value={app.tradeName}
          />
          <Field
            label={intl.formatMessage(m.registration)}
            value={app.registrationNumber}
          />
          <Field label={intl.formatMessage(m.taxId)} value={app.taxId} />
          <h3 className="t-heading-5">{intl.formatMessage(m.address)}</h3>
          <div className="t-body c-on-base">
            {[app.address.street, app.address.number, app.address.complement]
              .filter(Boolean)
              .join(', ')}
            <br />
            {app.address.city}, {app.address.state} {app.address.postalCode}
            <br />
            {app.address.country}
          </div>
        </div>
        <div>
          <h3 className="t-heading-5 mt0">{intl.formatMessage(m.contact)}</h3>
          <Field
            label={intl.formatMessage(m.name)}
            value={`${app.contact.firstName} ${app.contact.lastName}`}
          />
          <Field
            label={intl.formatMessage(m.email)}
            value={app.contact.email}
          />
          <Field
            label={intl.formatMessage(m.phone)}
            value={app.contact.phone}
          />
        </div>
      </PageBlock>

      <PageBlock title={intl.formatMessage(m.documents)}>
        {stage?.type !== 'REVIEW' && app.status === 'IN_REVIEW' && (
          <p className="t-small c-muted-1 mt0">
            {intl.formatMessage(m.docOnlyOnReview)}
          </p>
        )}
        {app.documents.map((doc) => (
          <div
            key={doc.kind}
            className="flex flex-wrap items-center justify-between pv4 bb b--muted-5"
          >
            <div className="mb2">
              <div className="t-body c-on-base">
                {intl.formatMessage(DOC_LABEL[doc.kind] ?? m.documents)}{' '}
                <Tag
                  size="small"
                  variation="low"
                  type={
                    doc.status === 'ACCEPTED'
                      ? 'success'
                      : doc.status === 'REJECTED'
                      ? 'error'
                      : 'warning'
                  }
                >
                  {intl.formatMessage(DOC_STATUS[doc.status])}
                </Tag>
              </div>
              <div className="t-small c-muted-1">
                {doc.fileName} · {formatSize(doc.size)} · {date(doc.uploadedAt)}
              </div>
              {doc.lastReview && (
                <div className="t-mini c-muted-1 mt1">
                  {intl.formatMessage(m.reviewedBy, {
                    decision: intl.formatMessage(
                      DOC_STATUS[doc.lastReview.decision]
                    ),
                    actor: doc.lastReview.actor,
                    date: date(doc.lastReview.at),
                  })}
                  {doc.lastReview.note ? ` · ${doc.lastReview.note}` : ''}
                </div>
              )}
            </div>
            <div className="flex">
              <div className="mr3">
                <Button
                  size="small"
                  variation="secondary"
                  onClick={() => setViewing(doc)}
                >
                  {intl.formatMessage(m.view)}
                </Button>
              </div>
              {stage?.type === 'REVIEW' && app.status === 'IN_REVIEW' && (
                <>
                  <div className="mr3">
                    <Button
                      size="small"
                      isLoading={busy === `accept-${doc.kind}`}
                      disabled={!!busy || doc.status === 'ACCEPTED'}
                      onClick={() =>
                        act(`accept-${doc.kind}`, () =>
                          reviewDoc({
                            variables: {
                              id: app.id,
                              stageId: stage.id,
                              kind: doc.kind,
                              decision: 'ACCEPT',
                            },
                          })
                        )
                      }
                    >
                      {intl.formatMessage(m.accept)}
                    </Button>
                  </div>
                  <Button
                    size="small"
                    variation="danger-tertiary"
                    disabled={!!busy || doc.status === 'REJECTED'}
                    onClick={() => setRejectingDoc(doc)}
                  >
                    {intl.formatMessage(m.reject)}
                  </Button>
                </>
              )}
            </div>
          </div>
        ))}
      </PageBlock>

      {app.stages.some((s) => s.type === 'VERIFICATION') && (
        <PageBlock title={intl.formatMessage(m.verification)}>
          <p className="t-small c-muted-1 mt0">
            {intl.formatMessage(m.demoNotice)}
          </p>
          {app.verification ? (
            <div className="mb4">
              <Tag
                type={
                  app.verification.status === 'PASSED' ? 'success' : 'error'
                }
                variation="low"
              >
                {intl.formatMessage(
                  app.verification.status === 'PASSED'
                    ? m.checkPassed
                    : m.checkFailed
                )}
              </Tag>
              <p className="t-body c-on-base mb1">{app.verification.message}</p>
              <p className="t-mini c-muted-1 mt0">
                {intl.formatMessage(m.checkedBy, {
                  provider: app.verification.provider,
                  reference: app.verification.reference,
                  date: date(app.verification.checkedAt),
                })}
              </p>
            </div>
          ) : (
            <p className="t-body c-muted-1">
              {intl.formatMessage(m.notChecked)}
            </p>
          )}
          {stage?.type === 'VERIFICATION' && app.status === 'IN_REVIEW' && (
            <Button
              variation="secondary"
              isLoading={busy === 'check'}
              disabled={!!busy}
              onClick={() =>
                act('check', () =>
                  runCheck({ variables: { id: app.id, stageId: stage.id } })
                )
              }
            >
              {intl.formatMessage(app.verification ? m.runAgain : m.runCheck)}
            </Button>
          )}
        </PageBlock>
      )}

      <PageBlock title={intl.formatMessage(m.history)}>
        <HistoryList events={app.events} />
      </PageBlock>

      {viewing && (
        <DocumentViewer
          applicationId={app.id}
          doc={viewing}
          onClose={() => setViewing(null)}
        />
      )}

      {rejectingDoc && stage && (
        <Modal
          isOpen
          onClose={() => setRejectingDoc(null)}
          title={intl.formatMessage(m.documentNoteTitle, {
            document: intl.formatMessage(
              DOC_LABEL[rejectingDoc.kind] ?? m.documents
            ),
          })}
          bottomBar={
            <div className="flex justify-end">
              <div className="mr3">
                <Button
                  variation="tertiary"
                  onClick={() => setRejectingDoc(null)}
                >
                  {intl.formatMessage(m.cancel)}
                </Button>
              </div>
              <Button
                variation="danger"
                isLoading={busy === 'reject-doc'}
                onClick={() =>
                  act('reject-doc', () =>
                    reviewDoc({
                      variables: {
                        id: app.id,
                        stageId: stage.id,
                        kind: rejectingDoc.kind,
                        decision: 'REJECT',
                        note: note || undefined,
                      },
                    })
                  )
                }
              >
                {intl.formatMessage(m.confirmReject)}
              </Button>
            </div>
          }
        >
          <Textarea
            label={intl.formatMessage(m.internalNote)}
            value={note}
            rows={3}
            maxLength={1000}
            onChange={(e) => setNote(e.target.value)}
          />
        </Modal>
      )}

      {rejectingApp && stage && (
        <Modal
          isOpen
          onClose={() => setRejectingApp(false)}
          title={intl.formatMessage(m.rejectApplication)}
          bottomBar={
            <div className="flex justify-end">
              <div className="mr3">
                <Button
                  variation="tertiary"
                  onClick={() => setRejectingApp(false)}
                >
                  {intl.formatMessage(m.cancel)}
                </Button>
              </div>
              <Button
                variation="danger"
                isLoading={busy === 'reject-app'}
                disabled={reason.trim().length < 10}
                onClick={() =>
                  act('reject-app', () =>
                    decideStage({
                      variables: {
                        id: app.id,
                        stageId: stage.id,
                        decision: 'REJECT',
                        reason,
                        note: note || undefined,
                      },
                    })
                  )
                }
              >
                {intl.formatMessage(m.confirmReject)}
              </Button>
            </div>
          }
        >
          <div className="mb4">
            <Textarea
              label={intl.formatMessage(m.reasonLabel)}
              value={reason}
              rows={3}
              maxLength={500}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          <Textarea
            label={intl.formatMessage(m.internalNote)}
            value={note}
            rows={2}
            maxLength={1000}
            onChange={(e) => setNote(e.target.value)}
          />
        </Modal>
      )}
    </Layout>
  )
}

export default ReviewDetail
