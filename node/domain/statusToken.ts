import { createHash, randomBytes, timingSafeEqual } from 'crypto'

// No 0/O or 1/I, so references are easy to read out on a call
const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'
const REFERENCE = /^APP-[2-9A-HJ-NP-Z]{8}$/

export function newReference(): string {
  const bytes = randomBytes(8)
  let out = ''

  for (const byte of bytes) {
    out += ALPHABET[byte % ALPHABET.length]
  }

  return `APP-${out}`
}

export function isReference(value: string): boolean {
  return REFERENCE.test(value)
}

/** A secret the applicant keeps to check their status. Only its hash is stored. */
export function newStatusToken(): string {
  return randomBytes(24).toString('base64url')
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}

export function tokenMatches(token: string, storedHash: string): boolean {
  if (!token || !storedHash) {
    return false
  }

  const given = Buffer.from(hashToken(token), 'hex')
  const stored = Buffer.from(storedHash, 'hex')

  return given.length === stored.length && timingSafeEqual(given, stored)
}
