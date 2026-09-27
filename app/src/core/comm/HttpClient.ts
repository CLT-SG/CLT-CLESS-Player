import { Logger, NetworkUtils } from '../utils'

const logger = Logger.forScope('http')

export interface HttpRequestOptions {
  readonly timeoutMs?: number
  readonly headers?: Readonly<Record<string, string>>
  /** Sent as `If-None-Match`, enabling 304 responses. */
  readonly etag?: string | null
  readonly signal?: AbortSignal
}

export type HttpResponse<T> =
  | { readonly status: 'ok'; readonly data: T; readonly etag: string | null; readonly httpStatus: number }
  | { readonly status: 'not-modified'; readonly etag: string | null }
  | {
      readonly status: 'error'
      readonly httpStatus: number
      readonly message: string
      /** True when retrying later is likely to succeed. */
      readonly transient: boolean
    }

/**
 * HTTP client for server communication.
 *
 * Returns a discriminated result instead of throwing, because the caller's
 * decision is always the same three-way branch (use it / keep the cache /
 * back off) and exceptions obscured that in the legacy jQuery callbacks.
 *
 * `not-modified` is a first-class outcome: conditional requests are what make
 * polling cheap enough to run often on constrained links, and they are the
 * foundation of the incremental sync behaviour.
 */
export class HttpClient {
  constructor(
    private readonly defaultTimeoutMs = 15_000,
    private readonly fetchImpl: typeof fetch = globalThis.fetch.bind(globalThis),
  ) {}

  async getJson<T>(url: string, options: HttpRequestOptions = {}): Promise<HttpResponse<T>> {
    return this.request<T>(url, options, async (response) => (await response.json()) as T)
  }

  async getText(url: string, options: HttpRequestOptions = {}): Promise<HttpResponse<string>> {
    return this.request<string>(url, options, (response) => response.text())
  }

  private async request<T>(
    url: string,
    options: HttpRequestOptions,
    read: (response: Response) => Promise<T>,
  ): Promise<HttpResponse<T>> {
    const timeoutMs = options.timeoutMs ?? this.defaultTimeoutMs
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)

    // Abort on either our timeout or the caller's signal.
    const onExternalAbort = () => controller.abort()
    options.signal?.addEventListener('abort', onExternalAbort, { once: true })

    try {
      const headers: Record<string, string> = { Accept: 'application/json, text/xml;q=0.9', ...options.headers }
      if (options.etag) headers['If-None-Match'] = options.etag

      const response = await this.fetchImpl(url, {
        method: 'GET',
        headers,
        signal: controller.signal,
        cache: 'no-store',
      })

      if (response.status === 304) {
        return { status: 'not-modified', etag: response.headers.get('etag') }
      }
      if (!response.ok) {
        return {
          status: 'error',
          httpStatus: response.status,
          message: `HTTP ${response.status} ${response.statusText}`,
          transient: NetworkUtils.isTransient(response.status),
        }
      }

      return {
        status: 'ok',
        data: await read(response),
        etag: response.headers.get('etag'),
        httpStatus: response.status,
      }
    } catch (error) {
      const aborted = NetworkUtils.isAbortError(error)
      const message = aborted ? `Request timed out after ${timeoutMs}ms` : error instanceof Error ? error.message : String(error)
      logger.debug(`GET ${url} failed: ${message}`)
      // A network-level failure is always worth retrying; the server may
      // simply be unreachable from this site right now.
      return { status: 'error', httpStatus: 0, message, transient: true }
    } finally {
      clearTimeout(timer)
      options.signal?.removeEventListener('abort', onExternalAbort)
    }
  }
}
