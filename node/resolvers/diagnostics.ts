import { APPLICATION_ENTITY, SCHEMA } from '../storage/schemas'

/**
 * TEMPORARY (0.1.1): finds which outbound call an installed app is refused.
 * Reviewers only, read-only. Remove once fixed.
 */
async function probe(name: string, call: () => Promise<unknown>) {
  try {
    await call()

    return { name, ok: true, status: 200, url: null, body: null }
  } catch (e) {
    const err = e as {
      message?: string
      config?: { url?: string; baseURL?: string }
      response?: {
        status?: number
        data?: unknown
        headers?: Record<string, unknown>
      }
    }

    return {
      name,
      ok: false,
      status: err.response?.status ?? null,
      url: `${err.config?.baseURL ?? ''} ${err.config?.url ?? ''}`.trim(),
      body: JSON.stringify(err.response?.data ?? err.message ?? null).slice(
        0,
        300
      ),
      headers: JSON.stringify(
        Object.fromEntries(
          Object.entries(err.response?.headers ?? {}).filter(([k]) =>
            /^(x-vtex|x-router|server|content-type)/i.test(k)
          )
        )
      ).slice(0, 300),
    }
  }
}

export async function runDiagnostics(ctx: Context): Promise<string> {
  const md = ctx.clients.accountMasterData
  const results = [
    await probe('getSchema', () => md.getSchema(APPLICATION_ENTITY, SCHEMA)),
    await probe('search', () =>
      md.search(APPLICATION_ENTITY, {
        schema: SCHEMA,
        fields: ['id'],
        pagination: { page: 1, pageSize: 1 },
      })
    ),
    await probe('getDocument', () =>
      md.getDocument(APPLICATION_ENTITY, 'APP-PKPM6CQD', ['id'])
    ),
  ]

  return JSON.stringify(results)
}
