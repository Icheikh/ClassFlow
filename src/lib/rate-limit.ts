/**
 * In-memory sliding window rate limiter.
 * Works with Vercel serverless (each instance has its own map,
 * but cold starts reset — acceptable for MVP; upgrade to Redis for multi-region).
 */

type RateLimitEntry = {
  count: number
  resetAt: number
}

const store = new Map<string, RateLimitEntry>()

// Evict stale entries every 10 minutes to prevent memory leak
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of store) {
    if (entry.resetAt <= now) store.delete(key)
  }
}, 10 * 60 * 1000)

export type RateLimitConfig = {
  /** Unique namespace, e.g. "login", "attendance" */
  namespace: string
  /** Max requests allowed in the window */
  max: number
  /** Window duration in seconds (default: 60) */
  windowSeconds?: number
}

export type RateLimitResult = {
  allowed: boolean
  remaining: number
  resetAt: number
}

/**
 * Check and increment rate limit for a given key.
 * Returns whether the request is allowed.
 */
export function checkRateLimit(
  key: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now()
  const windowMs = (config.windowSeconds ?? 60) * 1000
  const fullKey = `${config.namespace}:${key}`
  const entry = store.get(fullKey)

  if (!entry || entry.resetAt <= now) {
    // New window
    store.set(fullKey, { count: 1, resetAt: now + windowMs })
    return { allowed: true, remaining: config.max - 1, resetAt: now + windowMs }
  }

  if (entry.count >= config.max) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt }
  }

  entry.count += 1
  return { allowed: true, remaining: config.max - entry.count, resetAt: entry.resetAt }
}

/**
 * Extract client IP from request headers (Vercel sets x-forwarded-for).
 */
export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for")
  if (forwarded) return forwarded.split(",")[0].trim()
  return "unknown"
}

/**
 * Standard rate limit response headers.
 */
export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
  }
}
