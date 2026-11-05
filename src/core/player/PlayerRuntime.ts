import {
  ConnectivityMonitor,
  HttpClient,
  LayoutTransport,
  RealtimeClient,
  type RealtimeSocket,
  type TransportKind,
  type XmlParser,
} from '@core/transports'
import { BUILTIN_CONTENT_PLUGINS, ContentPluginRegistry } from '@core/plugins'
import { XmlLayoutAdapter } from '@core/transports/xml'
import type { LayoutDocument, PlaylistDefinition } from '@core/layouts/schema'
import { LayoutService, type PreparedLayout } from '@core/layouts'
import { SchedulerService } from '@core/schedules'
import { AirportDisplayService, type AirportEvent, type AirportSlotOverride } from '@core/airport-display'
import {
  PlaybackService,
  StatusReportService,
  SyncService,
  type DeviceIdentity,
  type DeviceIdentitySource,
  type PlaybackPosition,
  type SyncResult,
} from '@core/services'
import {
  AssetCache,
  LayoutRepository,
  SettingsRepository,
  createDefaultStorageDriver,
  type AssetBlobStore,
  type AssetSyncSummary,
  type ConfigurationSource,
  type StorageDriver,
} from '@core/storage'
import type { ConnectivityState, PlayerConfiguration, PlayerLifecycle } from '@core/types'
import { Emitter, Logger } from '@core/utilities'
import type { PlatformServices } from '@core/platform'

const logger = Logger.forScope('runtime')

/**
 * Everything the runtime needs from its host (Electron, Capacitor, browser).
 *
 * Each entry is optional and degrades cleanly, which is what allows one build
 * to run in all three hosts: without an XML parser the player is JSON-only,
 * without a blob store assets stream from the server, without a socket there
 * are no push updates. None of those absences stop playback.
 *
 * Hosts are normally built from a `PlatformServices` bundle rather than by
 * hand; see `createHostFromPlatform`.
 */
export interface PlayerHost {
  readonly storage?: StorageDriver
  readonly configurationSource?: ConfigurationSource
  readonly identitySource?: DeviceIdentitySource
  readonly assetBlobStore?: AssetBlobStore
  readonly parseXml?: XmlParser
  readonly realtimeSocket?: RealtimeSocket
  /** Present when the host was derived from the platform abstraction layer. */
  readonly platform?: PlatformServices
}

/**
 * Everything the runtime publishes.
 *
 * This is the whole surface a renderer needs to subscribe to, and it is
 * deliberately state rather than commands: each payload is the new value of
 * something, so a renderer binds it to its own state container without
 * needing to know the order events arrive in.
 */
export interface PlayerRuntimeEvents {
  configuration: PlayerConfiguration
  lifecycle: { readonly state: PlayerLifecycle; readonly message?: string }
  connectivity: { readonly state: ConnectivityState; readonly failureStreak: number }
  transport: TransportKind | null
  clock: Date
  document: LayoutDocument
  scheduleId: string | null
  layout: { readonly position: PlaybackPosition; readonly prepared: PreparedLayout }
  playlist: { readonly playlist: PlaylistDefinition | null; readonly layoutCount: number }
  paused: { readonly paused: boolean; readonly reason?: string }
  sync: { readonly result: SyncResult; readonly nextPollSeconds: number }
  identity: DeviceIdentity
  assets: {
    readonly pending: readonly string[]
    readonly backend: string
    readonly summary?: AssetSyncSummary
  }
  airportOverrides: readonly AirportSlotOverride[]
  airportAnnouncement: {
    readonly eventId: string
    readonly languages: AirportEvent['content']['announcementLanguages']
    readonly queuedAt: number
  }
}

/**
 * Composition root.
 *
 * This is the only class that knows about every layer, and it exists so that
 * nothing else has to: services receive their collaborators, and the runtime
 * publishes the result. It has no framework dependency at all — no Vue, no
 * Pinia, no DOM — which is what lets the Vue renderer, the legacy renderer and
 * the Capacitor build all drive the same logic.
 */
export class PlayerRuntime {
  readonly registry = new ContentPluginRegistry()
  readonly events = new Emitter<PlayerRuntimeEvents>()

  private readonly storage: StorageDriver
  private readonly repository: LayoutRepository
  private readonly assetCache: AssetCache
  private readonly settingsRepository: SettingsRepository
  private readonly connectivity = new ConnectivityMonitor()
  private readonly realtime = new RealtimeClient()
  private readonly scheduler = new SchedulerService()
  private readonly playback = new PlaybackService()
  private readonly airport: AirportDisplayService

  private configuration: PlayerConfiguration | null = null
  private layoutService: LayoutService | null = null
  private syncService: SyncService | null = null
  private statusReports: StatusReportService | null = null
  private activeLayoutId: string | null = null
  private pendingAssets: readonly string[] = []
  private readonly teardown: Array<() => void> = []
  private started = false

  constructor(private readonly host: PlayerHost = {}) {
    this.storage = host.storage ?? createDefaultStorageDriver()
    this.repository = new LayoutRepository(this.storage)
    this.assetCache = new AssetCache(this.storage, host.assetBlobStore ?? null)
    this.settingsRepository = new SettingsRepository(this.storage, host.configurationSource ?? null)
    this.airport = new AirportDisplayService(this.realtime)

    this.registry.registerAll(BUILTIN_CONTENT_PLUGINS)
  }

  /** Convenience passthrough so callers do not reach through `events`. */
  on<TKey extends keyof PlayerRuntimeEvents>(
    event: TKey,
    handler: (payload: PlayerRuntimeEvents[TKey]) => void,
  ): () => void {
    return this.events.on(event, handler)
  }

  /**
   * Boots the player.
   *
   * Order matters and encodes the offline-first requirement: configuration,
   * then cached content on screen, then the network. Nothing waits on a
   * request, so a player with no server, no VPN and no internet reaches
   * `playing` in the same time it takes to read storage.
   */
  async start(): Promise<void> {
    if (this.started) return
    this.started = true

    this.setLifecycle('booting')

    await this.loadConfiguration()
    this.wireServices()
    this.scheduler.start()

    const restored = await this.restoreCachedContent()
    if (restored) this.setLifecycle('playing')

    this.startServices()

    if (!restored) {
      // With no cache the first poll is the only way to get content, so its
      // result decides whether the player is playing or in error.
      const result = await this.syncService?.syncNow()
      if (result?.document) {
        this.setLifecycle('playing')
      } else {
        this.setLifecycle('error', result?.message ?? 'No layout available from server or cache')
      }
    }
  }

  stop(): void {
    for (const dispose of this.teardown.splice(0)) dispose()
    this.scheduler.stop()
    this.playback.stop()
    this.syncService?.stop()
    this.statusReports?.stopReporting()
    this.airport.stop()
    this.realtime.detach()
    this.started = false
  }

  /** Triggers an immediate synchronisation, e.g. from the control panel. */
  async refreshNow(): Promise<void> {
    await this.syncService?.syncNow()
  }

  advanceLayout(): void {
    this.playback.next()
  }

  pausePlayback(reason: string): void {
    if (this.playback.pause(reason)) this.events.emit('paused', { paused: true, reason })
  }

  resumePlayback(reason: string): void {
    if (this.playback.resume(reason)) this.events.emit('paused', { paused: false })
  }

  /** Feeds an Airport Display event in from the local HTTP control API. */
  handleAirportEvent(payload: unknown): boolean {
    return this.airport.handle(payload) !== null
  }

  private setLifecycle(state: PlayerLifecycle, message?: string): void {
    this.events.emit('lifecycle', message === undefined ? { state } : { state, message })
    this.statusReports?.setLifecycle(state)
  }

  private async loadConfiguration(): Promise<void> {
    const configuration = await this.settingsRepository.load()
    this.configuration = configuration
    Logger.setLevel(configuration.logLevel)
    this.events.emit('configuration', configuration)

    this.layoutService = new LayoutService(this.registry, configuration.hostserver)

    const http = new HttpClient(configuration.requestTimeoutMs)
    const transport = new LayoutTransport({
      http,
      configuration,
      parseXml: this.host.parseXml ?? null,
    })

    this.syncService = new SyncService({
      transport,
      repository: this.repository,
      assetCache: this.assetCache,
      connectivity: this.connectivity,
      configuration,
    })

    if (this.host.realtimeSocket) this.realtime.attach(this.host.realtimeSocket)
    this.statusReports = new StatusReportService(
      configuration,
      this.realtime,
      this.connectivity,
      this.host.identitySource ?? null,
    )

    this.events.emit('assets', { pending: [], backend: this.assetCache.backendName })
    logger.info('Configuration loaded', {
      server: configuration.hostserver,
      display: configuration.displayId,
      mode: configuration.mode,
    })
  }

  /**
   * Republishes service events on the runtime's own surface.
   *
   * Services do not know who is listening, and the runtime does not know what
   * the listener does with it. That indirection is what keeps the core free of
   * the renderer.
   */
  private wireServices(): void {
    this.teardown.push(
      this.connectivity.onChange((state) => {
        this.events.emit('connectivity', { state, failureStreak: this.connectivity.failureStreak })
      }),
    )

    this.teardown.push(
      this.scheduler.onTick((now) => {
        this.events.emit('clock', now)
      }),
    )

    this.teardown.push(
      this.playback.onChange((position, layout) => {
        const prepared = this.layoutService?.prepare(layout)
        if (!prepared) return
        this.activeLayoutId = layout.id
        this.events.emit('layout', { position, prepared })
        this.statusReports?.setCurrentLayout(layout.id, layout.revision)
        // Persisted so a restart resumes on this layout rather than at the
        // start of the playlist.
        void this.repository.setActiveLayoutId(layout.id)
      }),
    )

    this.teardown.push(
      this.syncService?.onSync((result) => {
        this.events.emit('sync', { result, nextPollSeconds: this.syncService?.nextPollSeconds ?? 0 })
        if (result.document) {
          this.statusReports?.markSynced(result.at)
          void this.applyDocument(result.document)
        }
      }) ?? (() => undefined),
    )

    this.teardown.push(
      this.syncService?.onAssets((summary) => {
        this.events.emit('assets', {
          pending: this.pendingAssets,
          backend: this.assetCache.backendName,
          summary,
        })
      }) ?? (() => undefined),
    )

    this.teardown.push(
      this.airport.onEvent((event) => {
        this.events.emit('airportOverrides', this.airport.activeOverrides)
        if (event.content.hasAnnouncement) {
          this.events.emit('airportAnnouncement', {
            eventId: event.eventId,
            languages: event.content.announcementLanguages,
            queuedAt: event.receivedAt,
          })
        }
      }),
    )
  }

  private startServices(): void {
    this.syncService?.start()
    this.airport.start()
    void this.statusReports?.initialize().then((identity) => {
      this.events.emit('identity', identity)
      this.statusReports?.startReporting()
    })
  }

  /**
   * Loads content from cache, adopting the previous renderer's cache when the
   * modern one is empty. Returns `true` when something is now on screen.
   */
  private async restoreCachedContent(): Promise<boolean> {
    const cached = await this.syncService?.restoreFromCache()
    if (cached) {
      await this.applyDocument(cached)
      return true
    }

    const adopted = await this.adoptLegacyCache()
    if (adopted) {
      await this.applyDocument(adopted)
      return true
    }
    return false
  }

  /**
   * Converts the legacy `localStorage` cache into a modern document.
   *
   * Without this an offline device that is updated in place would have no
   * content until it next reached the server — which for a genuinely offline
   * site could be never.
   */
  private async adoptLegacyCache(): Promise<LayoutDocument | null> {
    const configuration = this.configuration
    if (!configuration) return null

    const legacyRoot = await this.repository.readLegacyDocument(configuration.displayId)
    if (!legacyRoot) return null

    const adapter = new XmlLayoutAdapter({
      serverBaseUrl: configuration.hostserver,
      displayId: configuration.displayId,
    })

    try {
      // A cached loop only stores member URLs, so the members are read from
      // their own legacy keys before adapting.
      const memberIds = PlayerRuntime.legacyLoopLayoutIds(legacyRoot)
      const members = (
        await Promise.all(memberIds.map((id) => this.repository.readLegacyLayout(id)))
      ).filter((member): member is unknown => member !== null)

      const document = adapter.adaptDocument(legacyRoot, members)
      logger.info('Adopted layout cache written by the previous renderer')
      await this.repository.saveDocument(configuration.displayId, document)

      const resumeId = await this.repository.readLegacyActiveLayoutId()
      if (resumeId) await this.repository.setActiveLayoutId(resumeId)

      return document
    } catch (error) {
      logger.warn('Legacy cache could not be adapted', error)
      return null
    }
  }

  private static legacyLoopLayoutIds(parsed: unknown): string[] {
    const document = parsed as {
      elements?: Array<{ elements?: Array<{ name?: string; elements?: Array<{ attributes?: Record<string, string> }> }> }>
    }
    const loop = document?.elements?.[0]?.elements?.find((child) => child.name === 'loop')
    if (!loop?.elements) return []
    return loop.elements
      .map((entry) => XmlLayoutAdapter.layoutIdFromUrl(entry.attributes?.['url'] ?? ''))
      .filter((id): id is string => id !== null)
  }

  /** Publishes a document and (re)starts playback. */
  private async applyDocument(document: LayoutDocument): Promise<void> {
    this.events.emit('document', document)
    this.events.emit('scheduleId', document.display?.scheduleId ?? null)
    this.events.emit('transport', document.origin === 'xml-adapter' ? 'xml' : 'json')

    const layouts = LayoutService.layoutsOf(document)
    if (!layouts.length) {
      logger.warn('Document contains no playable layouts')
      return
    }

    this.events.emit('playlist', { playlist: document.playlist, layoutCount: layouts.length })

    // An update to the playlist currently on screen must not restart it.
    if (this.activeLayoutId) {
      this.playback.applyUpdate(layouts, document.playlist)
    } else {
      const resumeId = await this.repository.getActiveLayoutId()
      this.playback.load(layouts, document.playlist, resumeId)
      this.playback.start()
    }

    void this.reportPendingAssets(document)
  }

  private async reportPendingAssets(document: LayoutDocument): Promise<void> {
    const layouts = document.mode === 'playlist' ? document.layouts : document.layout ? [document.layout] : []
    const pending: string[] = []
    for (const layout of layouts) {
      const missing = await this.assetCache.pendingAssets(layout.assets)
      pending.push(...missing.map((asset) => asset.path))
    }
    this.pendingAssets = pending
    this.events.emit('assets', { pending, backend: this.assetCache.backendName })
  }
}
