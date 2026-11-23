import type { ErrorCode } from './fields'

export interface Receipt {
  reference: string
  statusToken: string
  submittedAt: string
}

export interface ApplicantView {
  reference: string
  companyName: string
  status: 'IN_REVIEW' | 'APPROVED' | 'REJECTED'
  currentStageLabel: string | null
  rejectionReason: string | null
  submittedAt: string
  decidedAt: string | null
}

export type ApiResult<T> =
  | { ok: true; data: T }
  | {
      ok: false
      status: number
      code: string
      fields?: Array<{ field: string; code: ErrorCode }>
    }

async function call<T>(url: string, init: RequestInit): Promise<ApiResult<T>> {
  try {
    const response = await fetch(url, {
      ...init,
      credentials: 'omit',
      cache: 'no-store',
    })

    const body = await response.json().catch(() => ({}))

    if (response.ok) {
      return { ok: true, data: body as T }
    }

    return {
      ok: false,
      status: response.status,
      code: body.code ?? 'FAILED',
      fields: body.fields,
    }
  } catch {
    return { ok: false, status: 0, code: 'FAILED' }
  }
}

export function submitApplication(rootPath: string, form: FormData) {
  return call<Receipt>(`${rootPath}/_v/b2b-onboarding/apply`, {
    method: 'POST',
    body: form,
  })
}

export function fetchStatus(
  rootPath: string,
  reference: string,
  token: string
) {
  return call<ApplicantView>(`${rootPath}/_v/b2b-onboarding/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reference, token }),
  })
}
