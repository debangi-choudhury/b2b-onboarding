/**
 * A small fixed-window limiter for the public form. It lives in memory, so
 * each replica counts separately and a restart resets it. It's enough to stop
 * a script hammering the demo, not a determined attacker. A client project
 * should add a CAPTCHA or an edge rate limit.
 */
export class RateLimiter {
  private hits = new Map<string, { count: number; windowStart: number }>()

  constructor(
    private readonly limit: number,
    private readonly windowMs: number
  ) {}

  public allow(key: string, now: number): boolean {
    const entry = this.hits.get(key)

    if (!entry || now - entry.windowStart >= this.windowMs) {
      this.hits.set(key, { count: 1, windowStart: now })
      this.prune(now)

      return true
    }

    if (entry.count >= this.limit) {
      return false
    }

    entry.count += 1

    return true
  }

  private prune(now: number) {
    if (this.hits.size < 5000) {
      return
    }

    for (const [key, entry] of this.hits) {
      if (now - entry.windowStart >= this.windowMs) {
        this.hits.delete(key)
      }
    }
  }
}
