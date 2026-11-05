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
   * Points a cached media base at the configured host when the two disagree.
   *
   * A player that changes `hostserver` (cless5 → cless4, or a lab URL → a
   * production one) otherwise keeps requesting images from the origin baked
   * into its layout cache, which is exactly the field failure mode where
   * config says one host and every airline logo 404s on another. Intentional
   * CDN hosts — anything whose path is not under `/media/` — are left alone.
   */
  static rebaseMediaBaseUrl(mediaBaseUrl: string, hostserver: string): string {
    const hostOrigin = NetworkUtils.origin(hostserver)
    if (!hostOrigin || !mediaBaseUrl) return mediaBaseUrl
    try {
      const media = new URL(mediaBaseUrl)
      if (media.origin === hostOrigin) return mediaBaseUrl
      if (!/\/media(\/|$)/i.test(media.pathname)) return mediaBaseUrl
      return `${hostOrigin}${media.pathname}`.replace(/\/+$/, '') || hostOrigin
    } catch {
      return mediaBaseUrl
    }
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
