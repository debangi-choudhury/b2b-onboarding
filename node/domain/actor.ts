import type { Actor } from './types'

/**
 * The reviewer's identity, read from their VTEX ID token. The router has
 * already checked the token against @auth before the resolver runs, so this
 * only reads the claims to record who acted.
 */
export function reviewerFromToken(token: string | undefined): Actor {
  const fallback: Actor = { type: 'REVIEWER', id: 'unknown reviewer' }

  if (!token) {
    return fallback
  }

  const [, payload] = token.split('.')

  if (!payload) {
    return fallback
  }

  try {
    const claims = JSON.parse(
      Buffer.from(payload, 'base64url').toString('utf8')
    ) as {
      sub?: unknown
      userId?: unknown
    }

    const id = typeof claims.sub === 'string' ? claims.sub : null

    return id ? { type: 'REVIEWER', id: id.slice(0, 254) } : fallback
  } catch {
    return fallback
  }
}
