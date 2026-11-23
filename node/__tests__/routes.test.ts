import { guarded } from '../routes/applicant'

function fakeContext() {
  const error = jest.fn()
  const headers: Record<string, string> = {}
  const ctx = {
    status: 200,
    body: undefined as unknown,
    set: (name: string, value: string) => {
      headers[name] = value
    },
    vtex: { logger: { error } },
  }

  return { ctx, error, headers }
}

describe('guarded public routes', () => {
  it('passes a normal answer through untouched', async () => {
    const { ctx } = fakeContext()

    await guarded('status', async (c) => {
      c.status = 404
      c.body = { code: 'NOT_FOUND' }
    })(ctx as never)

    expect(ctx.status).toBe(404)
    expect(ctx.body).toEqual({ code: 'NOT_FOUND' })
  })

  it('answers a plain 503 and logs only the message and status', async () => {
    const { ctx, error, headers } = fakeContext()
    const failure = Object.assign(
      new Error('Request failed with status code 403'),
      {
        config: { data: '{"india":{"pan":"ABCCD1231X"}}' },
        response: { status: 403, data: { secret: 'x' } },
      }
    )

    await guarded('apply', async () => {
      throw failure
    })(ctx as never)

    expect(ctx.status).toBe(503)
    expect(ctx.body).toEqual({ code: 'UNAVAILABLE' })
    expect(headers['Cache-Control']).toBe('no-store')
    expect(error).toHaveBeenCalledWith({
      message: 'Applicant route failed',
      route: 'apply',
      error: 'Request failed with status code 403',
      status: 403,
    })
    expect(JSON.stringify(error.mock.calls)).not.toContain('ABCCD1231X')
  })
})
