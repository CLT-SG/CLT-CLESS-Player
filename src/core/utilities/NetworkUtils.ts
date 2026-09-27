/**
 * Network helpers: URL composition and retry timing.
 *
 * Offline resilience depends on backing off correctly rather than hammering an
 * unreachable server, which is what the legacy `setTimeout(getxml, 5000)` loop
 * did. The backoff schedule lives here so the sync service and the realtime
 * client share one policy.
 */
export abstract class NetworkUtils {
  static readonly DEFAULT_BASE_DELAY_MS = 2_000
  static readonly DEFAULT_MAX_DELAY_MS = 120_000

  static joinUrl(base: string, ...segments: string[]): string {
    const cleanedBase = base.replace(/\/+$/, '')
    const cleanedSegments = segments
      .filter((segment) => segment !== '' && segment != null)
      .map((segment) => String(segment).replace(/^\/+|\/+$/g, ''))
      .filter(Boolean)
    return [cleanedBase, ...cleanedSegments].join('/')
  }

  static withQuery(url: string, params: Record<string, string | number | boolean | null | undefined>): string {
    const entries = Object.entries(params).filter(([, value]) => value != null && value !== '')
    if (!entries.length) return url
    const query = entries
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
      .join('&')
    return url.includes('?') ? `${url}&${query}` : `${url}?${query}`
  }

  /** Origin of an absolute URL, used to prefix server-relative media paths. */
  static origin(url: string): string {
    const match = /^([a-z][a-z0-9+.-]*:\/\/[^/]+)/i.exec(url.trim())
    return match ? match[1]! : ''
  }

  /**
   * Exponential backoff with full jitter.
   *
   * Jitter matters in this deployment: a site can have dozens of players that
   * all lost the server at the same moment, and without it they would retry in
   * lockstep and produce a thundering herd when the server comes back.
   */
  static backoffDelay(
    attempt: number,
    baseDelayMs = NetworkUtils.DEFAULT_BASE_DELAY_MS,
    maxDelayMs = NetworkUtils.DEFAULT_MAX_DELAY_MS,
    random: () => number = Math.random,
  ): number {
    const safeAttempt = Math.max(0, Math.trunc(attempt))
    const exponential = Math.min(maxDelayMs, baseDelayMs * 2 ** safeAttempt)
    const jitter = exponential * 0.5 * random()
    return Math.round(Math.min(maxDelayMs, exponential * 0.5 + jitter))
  }

  static isAbortError(error: unknown): boolean {
    return error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError')
  }

  static isTransient(status: number): boolean {
    return status === 0 || status === 408 || status === 429 || status >= 500
  }
}
