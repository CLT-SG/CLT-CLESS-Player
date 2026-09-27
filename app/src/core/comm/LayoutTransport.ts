import { XmlLayoutAdapter } from '../adapters'
import { validateLayoutDocument, type LayoutDocument } from '../schema'
import { describeIssues } from '../schema/validate'
import type { PlayerConfiguration } from '../types'
import { Logger, NetworkUtils } from '../utils'
import type { HttpClient } from './HttpClient'

const logger = Logger.forScope('transport')

export type TransportKind = 'json' | 'xml'

export type FetchOutcome =
  | { readonly status: 'updated'; readonly document: LayoutDocument; readonly etag: string | null; readonly transport: TransportKind }
  | { readonly status: 'not-modified'; readonly transport: TransportKind }
  | { readonly status: 'unreachable'; readonly message: string }
  | { readonly status: 'invalid'; readonly message: string; readonly transport: TransportKind }

/**
 * Parses an XML string into the `xml-js` non-compact tree.
 *
 * Injected rather than imported because the parser differs per host: Electron
 * already bundles `xml-js` and exposes it on the preload bridge, while a
 * browser build can use `DOMParser`. Keeping it behind a function also means
 * the JSON-only path pulls in no XML code at all.
 */
export type XmlParser = (xml: string) => unknown

export interface LayoutTransportOptions {
  readonly http: HttpClient
  readonly configuration: PlayerConfiguration
  readonly parseXml?: XmlParser | null
}

/**
 * Fetches layout documents, preferring the JSON Layout Definition API and
 * falling back to XML.
 *
 * This class is where backward compatibility is actually decided. `auto` mode
 * probes the JSON endpoint once; a 404/405 is remembered as "this server is
 * XML-only" so the player does not pay for a failed probe on every poll, and
 * anything else keeps JSON selected. The result is that one player build
 * serves both a modernised server and an untouched legacy one, which is what
 * makes the server and player rollouts independent.
 */
export class LayoutTransport {
  private readonly http: HttpClient
  private readonly configuration: PlayerConfiguration
  private readonly parseXml: XmlParser | null
  private readonly xmlAdapter: XmlLayoutAdapter

  /** `null` until the first probe resolves which transport the server speaks. */
  private negotiated: TransportKind | null = null

  constructor(options: LayoutTransportOptions) {
    this.http = options.http
    this.configuration = options.configuration
    this.parseXml = options.parseXml ?? null
    this.xmlAdapter = new XmlLayoutAdapter({
      serverBaseUrl: options.configuration.hostserver,
      displayId: options.configuration.displayId,
    })

    if (options.configuration.transport !== 'auto') {
      this.negotiated = options.configuration.transport
    }
  }

  get activeTransport(): TransportKind | null {
    return this.negotiated
  }

  /**
   * Fetches the display's current layout document.
   *
   * `etag` enables a conditional request so an unchanged layout costs one
   * small 304 instead of a full payload.
   */
  async fetchDocument(etag: string | null = null): Promise<FetchOutcome> {
    if (this.negotiated === 'xml') return this.fetchViaXml()
    if (this.negotiated === 'json') return this.fetchViaJson(etag)

    const jsonOutcome = await this.fetchViaJson(etag)
    if (jsonOutcome.status === 'updated' || jsonOutcome.status === 'not-modified') {
      this.negotiated = 'json'
      logger.info('Negotiated JSON Layout Definition API')
      return jsonOutcome
    }

    // Only a definitive "this endpoint does not exist" downgrades the server.
    // A timeout, a 5xx or a malformed payload must not make a modern server
    // look legacy: in those cases the JSON API is present but unhappy, and
    // retrying it later is the correct response.
    if (jsonOutcome.status !== 'unreachable' || !LayoutTransport.isEndpointMissing(jsonOutcome.message)) {
      return jsonOutcome
    }

    logger.info('JSON endpoint unavailable; falling back to XML transport')
    const xmlOutcome = await this.fetchViaXml()
    if (xmlOutcome.status === 'updated') this.negotiated = 'xml'
    return xmlOutcome
  }

  private async fetchViaJson(etag: string | null): Promise<FetchOutcome> {
    const url = this.buildUrl(`${this.configuration.displayId}/ds.json`)
    const response = await this.http.getJson<unknown>(url, {
      timeoutMs: this.configuration.requestTimeoutMs,
      etag,
    })

    if (response.status === 'not-modified') return { status: 'not-modified', transport: 'json' }
    if (response.status === 'error') {
      if (response.httpStatus === 404 || response.httpStatus === 405 || response.httpStatus === 501) {
        return { status: 'unreachable', message: `endpoint-missing: ${response.message}` }
      }
      return { status: 'unreachable', message: response.message }
    }

    const validation = validateLayoutDocument(response.data)
    if (!validation.ok) {
      return {
        status: 'invalid',
        transport: 'json',
        message: describeIssues(validation.errors),
      }
    }
    for (const warning of validation.warnings) logger.warn(`${warning.path}: ${warning.message}`)

    return { status: 'updated', document: validation.value, etag: response.etag, transport: 'json' }
  }

  /**
   * Fetches and adapts the legacy XML.
   *
   * A playlist requires one request per member layout, matching the legacy
   * behaviour. Members are fetched concurrently and failures are tolerated:
   * a playlist that loses one layout still plays the rest.
   */
  private async fetchViaXml(): Promise<FetchOutcome> {
    if (!this.parseXml) {
      return { status: 'unreachable', message: 'No XML parser available in this host' }
    }

    const rootUrl = this.buildUrl(`${this.configuration.displayId}/ds.xml`)
    const rootResponse = await this.http.getText(rootUrl, { timeoutMs: this.configuration.requestTimeoutMs })
    if (rootResponse.status === 'not-modified') return { status: 'not-modified', transport: 'xml' }
    if (rootResponse.status === 'error') return { status: 'unreachable', message: rootResponse.message }

    let parsedRoot: unknown
    try {
      parsedRoot = this.parseXml(rootResponse.data)
    } catch (error) {
      return { status: 'invalid', transport: 'xml', message: `Unparseable XML: ${String(error)}` }
    }

    const memberUrls = LayoutTransport.loopMemberUrls(parsedRoot)
    const members = await Promise.all(memberUrls.map((url) => this.fetchXmlMember(url)))
    const parsedMembers = members.filter((member): member is unknown => member !== null)

    try {
      const document = this.xmlAdapter.adaptDocument(parsedRoot, parsedMembers)
      return { status: 'updated', document, etag: document.etag || null, transport: 'xml' }
    } catch (error) {
      return {
        status: 'invalid',
        transport: 'xml',
        message: error instanceof Error ? error.message : String(error),
      }
    }
  }

  private async fetchXmlMember(url: string): Promise<unknown | null> {
    const response = await this.http.getText(this.applyProxy(url), {
      timeoutMs: this.configuration.requestTimeoutMs,
    })
    if (response.status !== 'ok' || !this.parseXml) return null
    try {
      return this.parseXml(response.data)
    } catch {
      logger.warn(`Skipped unparseable loop member: ${url}`)
      return null
    }
  }

  /** Reads `<loop><layout url="...">` without instantiating the adapter. */
  private static loopMemberUrls(parsedRoot: unknown): string[] {
    const document = parsedRoot as { elements?: Array<{ elements?: Array<{ name?: string; elements?: Array<{ name?: string; attributes?: Record<string, string> }> }> }> }
    const root = document?.elements?.[0]
    const loop = root?.elements?.find((child) => child.name === 'loop')
    if (!loop?.elements) return []
    return loop.elements
      .filter((child) => child.name === 'layout')
      .map((child) => child.attributes?.['url'] ?? '')
      .filter(Boolean)
  }

  private buildUrl(path: string): string {
    const base = NetworkUtils.joinUrl(this.configuration.hostserver, path)
    const withVersion = this.configuration.playerVersion
      ? NetworkUtils.withQuery(base, { v: this.configuration.playerVersion })
      : base
    return this.applyProxy(withVersion)
  }

  /**
   * Routes through a CORS proxy when the deployment needs it (browser-hosted
   * preview against a server without permissive CORS headers).
   */
  private applyProxy(url: string): string {
    if (!this.configuration.corsProxy) return url
    return `https://corsproxy.io/?url=${encodeURIComponent(url)}`
  }

  private static isEndpointMissing(message: string): boolean {
    return message.startsWith('endpoint-missing:')
  }
}
