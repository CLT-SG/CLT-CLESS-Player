import type { ConnectivityMonitor, LayoutTransport } from '../comm'
import type { LayoutDocument } from '../schema'
import type { AssetCache, LayoutRepository } from '../storage'
import type { PlayerConfiguration, SyncOutcome } from '../types'
import { Logger, NetworkUtils } from '../utils'

const logger = Logger.forScope('sync')

export interface SyncResult {
  readonly outcome: SyncOutcome
  readonly document: LayoutDocument | null
  readonly message: string | null
  readonly at: number
}

export type SyncListener = (result: SyncResult) => void

export interface SyncServiceOptions {
  readonly transport: LayoutTransport
  readonly repository: LayoutRepository
  readonly assetCache: AssetCache
  readonly connectivity: ConnectivityMonitor
  readonly configuration: PlayerConfiguration
}

/**
 * Keeps the local layout cache in step with the server.
 *
 * The behaviour that matters here is what happens when the server is *not*
 * available. This service never clears or invalidates the cache on a failed
 * poll; it reports the failure, backs off, and leaves the last good document
 * in place. Playback therefore continues uninterrupted through a network
 * outage, a VPN drop or a server restart, and picks the new content up on the
 * first successful poll after reconnect.
 *
 * Incremental behaviour comes from two things: the document ETag (an unchanged
 * layout costs a 304) and the asset manifest (unchanged media is never
 * re-downloaded, even when the layout itself changed).
 */
export class SyncService {
  private readonly transport: LayoutTransport
  private readonly repository: LayoutRepository
  private readonly assetCache: AssetCache
  private readonly connectivity: ConnectivityMonitor
  private readonly configuration: PlayerConfiguration
  private readonly listeners = new Set<SyncListener>()

  private timer: ReturnType<typeof setTimeout> | null = null
  private inFlight: Promise<SyncResult> | null = null
  private failureAttempts = 0
  private currentEtag: string | null = null
  private refreshSeconds: number
  private running = false
  private lastResult: SyncResult | null = null

  constructor(options: SyncServiceOptions) {
    this.transport = options.transport
    this.repository = options.repository
    this.assetCache = options.assetCache
    this.connectivity = options.connectivity
    this.configuration = options.configuration
    this.refreshSeconds = options.configuration.defaultRefreshSeconds
  }

  onSync(listener: SyncListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  get isRunning(): boolean {
    return this.running
  }

  get lastSync(): SyncResult | null {
    return this.lastResult
  }

  /** Seconds until the next poll, as currently scheduled. */
  get nextPollSeconds(): number {
    return this.failureAttempts > 0
      ? Math.round(NetworkUtils.backoffDelay(this.failureAttempts) / 1000)
      : this.refreshSeconds
  }

  /**
   * Loads the cached document without touching the network.
   *
   * Called first at boot so the screen shows content immediately, before the
   * outcome of any request is known. When the modern cache is empty it also
   * adopts the cache written by the previous renderer, which is what makes an
   * in-place upgrade non-disruptive for an offline device.
   */
  async restoreFromCache(): Promise<LayoutDocument | null> {
    const cached = await this.repository.loadDocument(this.configuration.displayId)
    if (cached) {
      this.currentEtag = cached.etag || null
      logger.info(`Restored cached document (revision ${cached.etag || 'unknown'})`)
      return cached
    }
    logger.info('No cached layout document available')
    return null
  }

  /** Starts background polling. Offline-mode players stay cache-only. */
  start(): void {
    if (this.running) return
    this.running = true

    if (this.configuration.mode === 'offline') {
      this.connectivity.forceOffline('Player configured for offline mode')
      logger.info('Offline mode: background synchronisation disabled')
      return
    }

    void this.syncNow()
  }

  stop(): void {
    this.running = false
    if (this.timer != null) {
      clearTimeout(this.timer)
      this.timer = null
    }
  }

  /**
   * Performs one synchronisation pass.
   *
   * Concurrent calls share the in-flight promise, so a manual refresh from the
   * control panel cannot overlap the scheduled poll and produce two competing
   * layout updates.
   */
  async syncNow(): Promise<SyncResult> {
    if (this.inFlight) return this.inFlight

    this.inFlight = this.performSync().finally(() => {
      this.inFlight = null
    })
    return this.inFlight
  }

  private async performSync(): Promise<SyncResult> {
    if (this.configuration.mode === 'offline') {
      return this.finish({ outcome: 'offline', document: null, message: 'Offline mode', at: Date.now() }, false)
    }

    const outcome = await this.transport.fetchDocument(this.currentEtag)

    switch (outcome.status) {
      case 'updated': {
        this.connectivity.reportSuccess()
        this.currentEtag = outcome.etag ?? outcome.document.etag ?? null
        this.refreshSeconds = SyncService.refreshSecondsFor(outcome.document, this.configuration)

        await this.repository.saveDocument(this.configuration.displayId, outcome.document)
        // Assets are refreshed after the document is cached so playback can
        // start from the new layout while media downloads continue.
        void this.synchronizeAssets(outcome.document)

        logger.info(`Layout updated via ${outcome.transport} (revision ${this.currentEtag ?? 'unknown'})`)
        return this.finish({ outcome: 'updated', document: outcome.document, message: null, at: Date.now() }, true)
      }

      case 'not-modified': {
        this.connectivity.reportSuccess()
        return this.finish({ outcome: 'unchanged', document: null, message: null, at: Date.now() }, true)
      }

      case 'invalid': {
        // The server answered, so connectivity is fine; the payload is not.
        // Keeping the cached layout is strictly better than rendering nothing.
        this.connectivity.reportSuccess()
        logger.error(`Rejected invalid layout document: ${outcome.message}`)
        return this.finish({ outcome: 'invalid', document: null, message: outcome.message, at: Date.now() }, true)
      }

      case 'unreachable':
      default: {
        this.connectivity.reportFailure(outcome.message)
        logger.warn(`Synchronisation failed: ${outcome.message}`)
        return this.finish({ outcome: 'error', document: null, message: outcome.message, at: Date.now() }, false)
      }
    }
  }

  private async synchronizeAssets(document: LayoutDocument): Promise<void> {
    const layouts = document.mode === 'playlist' ? document.layouts : document.layout ? [document.layout] : []
    for (const layout of layouts) {
      if (!layout.assets.length) continue
      const summary = await this.assetCache.synchronize(layout.assets, layout.mediaBaseUrl)
      logger.debug(`Assets for layout ${layout.id}`, summary)
    }
  }

  /**
   * Emits the result and schedules the next poll.
   *
   * On success the cadence is the server's `refreshInterval`; on failure it is
   * jittered exponential backoff, so a site full of players does not stampede
   * a recovering server.
   */
  private finish(result: SyncResult, succeeded: boolean): SyncResult {
    this.lastResult = result
    this.failureAttempts = succeeded ? 0 : this.failureAttempts + 1

    for (const listener of this.listeners) {
      try {
        listener(result)
      } catch (error) {
        logger.warn('Sync listener failed', error)
      }
    }

    if (this.running && this.configuration.mode !== 'offline') {
      const delayMs = succeeded
        ? this.refreshSeconds * 1000
        : NetworkUtils.backoffDelay(this.failureAttempts)
      this.timer = setTimeout(() => void this.syncNow(), delayMs)
    }
    return result
  }

  private static refreshSecondsFor(document: LayoutDocument, configuration: PlayerConfiguration): number {
    const layout = document.mode === 'playlist' ? document.layouts[0] : document.layout
    const interval = layout?.refreshInterval ?? 0
    return interval > 0 ? interval : configuration.defaultRefreshSeconds
  }
}
