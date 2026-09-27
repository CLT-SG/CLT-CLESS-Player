import { ConnectivityMonitor, HttpClient, LayoutTransport, RealtimeClient, type RealtimeSocket, type XmlParser } from '../comm'
import { BUILTIN_CONTENT_PLUGINS, ContentPluginRegistry } from '../plugins'
import { XmlLayoutAdapter } from '../adapters'
import type { LayoutDocument } from '../schema'
import {
  AirportDisplayService,
  DeviceService,
  LayoutService,
  PlaybackService,
  SchedulerService,
  SyncService,
  type DeviceIdentitySource,
} from '../services'
import {
  AssetCache,
  LayoutRepository,
  SettingsRepository,
  createDefaultStorageDriver,
  type AssetBlobStore,
  type ConfigurationSource,
  type StorageDriver,
} from '../storage'
import type { PlayerConfiguration } from '../types'
import { Logger } from '../utils'
import UnsupportedRenderer from '@/components/renderers/UnsupportedRenderer.vue'
import {
  useAirportDisplayStore,
  useConnectivityStore,
  useLayoutStore,
  useMediaStore,
  usePlayerStatusStore,
  usePlaylistStore,
  useScheduleStore,
  useSettingsStore,
} from '@/stores'

const logger = Logger.forScope('runtime')

/**
 * Everything the runtime needs from its host (Electron, Capacitor, browser).
 *
 * Each entry is optional and degrades cleanly, which is what allows one build
 * to run in all three hosts: without an XML parser the player is JSON-only,
 * without a blob store assets stream from the server, without a socket there
 * are no push updates. None of those absences stop playback.
 */
export interface PlayerHost {
  readonly storage?: StorageDriver
  readonly configurationSource?: ConfigurationSource
  readonly identitySource?: DeviceIdentitySource
  readonly assetBlobStore?: AssetBlobStore
  readonly parseXml?: XmlParser
  readonly realtimeSocket?: RealtimeSocket
}

/**
 * Composition root.
 *
 * This is the only class that knows about every layer, and it exists so that
 * nothing else has to: services receive their collaborators, stores are
 * written from one place, and components read stores. That direction of
 * dependency is the difference between this design and the legacy one, where
 * any script could reach any global.
 */
export class PlayerRuntime {
  readonly registry = new ContentPluginRegistry()

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
  private deviceService: DeviceService | null = null
  private readonly teardown: Array<() => void> = []
  private started = false

  constructor(private readonly host: PlayerHost = {}) {
    this.storage = host.storage ?? createDefaultStorageDriver()
    this.repository = new LayoutRepository(this.storage)
    this.assetCache = new AssetCache(this.storage, host.assetBlobStore ?? null)
    this.settingsRepository = new SettingsRepository(this.storage, host.configurationSource ?? null)
    this.airport = new AirportDisplayService(this.realtime)

    this.registry.registerAll(BUILTIN_CONTENT_PLUGINS).setFallbackComponent(UnsupportedRenderer)
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

    const status = usePlayerStatusStore()
    status.markBooted()
    status.setLifecycle('booting')

    await this.loadConfiguration()
    this.wireStores()
    this.scheduler.start()

    const restored = await this.restoreCachedContent()
    if (restored) status.setLifecycle('playing')

    this.startServices()

    if (!restored) {
      // With no cache the first poll is the only way to get content, so its
      // result decides whether the player is playing or in error.
      const result = await this.syncService?.syncNow()
      if (result?.document) {
        status.setLifecycle('playing')
      } else {
        status.setLifecycle('error', result?.message ?? 'No layout available from server or cache')
      }
    }
  }

  stop(): void {
    for (const dispose of this.teardown.splice(0)) dispose()
    this.scheduler.stop()
    this.playback.stop()
    this.syncService?.stop()
    this.deviceService?.stopReporting()
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
    if (this.playback.pause(reason)) usePlaylistStore().setPaused(true, reason)
  }

  resumePlayback(reason: string): void {
    if (this.playback.resume(reason)) usePlaylistStore().setPaused(false)
  }

  /** Feeds an Airport Display event in from the local HTTP control API. */
  handleAirportEvent(payload: unknown): boolean {
    return this.airport.handle(payload) !== null
  }

  private async loadConfiguration(): Promise<void> {
    const configuration = await this.settingsRepository.load()
    this.configuration = configuration
    Logger.setLevel(configuration.logLevel)
    useSettingsStore().apply(configuration)

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
    this.deviceService = new DeviceService(
      configuration,
      this.realtime,
      this.connectivity,
      this.host.identitySource ?? null,
    )

    useMediaStore().setBackend(this.assetCache.backendName)
    logger.info('Configuration loaded', {
      server: configuration.hostserver,
      display: configuration.displayId,
      mode: configuration.mode,
    })
  }

  /** Subscribes the stores to service events. Services never import stores. */
  private wireStores(): void {
    const connectivityStore = useConnectivityStore()
    const layoutStore = useLayoutStore()
    const playlistStore = usePlaylistStore()
    const scheduleStore = useScheduleStore()
    const airportStore = useAirportDisplayStore()
    const mediaStore = useMediaStore()

    this.teardown.push(
      this.connectivity.onChange((state) => {
        connectivityStore.setState(state, this.connectivity.failureStreak)
      }),
    )

    this.teardown.push(
      this.scheduler.onTick((now) => {
        scheduleStore.tick(now)
      }),
    )

    this.teardown.push(
      this.playback.onChange((position, layout) => {
        playlistStore.setPosition(position.index)
        const prepared = this.layoutService?.prepare(layout) ?? null
        layoutStore.setPrepared(prepared)
        this.deviceService?.setCurrentLayout(layout.id, layout.revision)
        // Persisted so a restart resumes on this layout rather than at the
        // start of the playlist.
        void this.repository.setActiveLayoutId(layout.id)
      }),
    )

    this.teardown.push(
      this.syncService?.onSync((result) => {
        connectivityStore.recordSync(result.outcome, result.message, result.at)
        connectivityStore.setNextPoll(this.syncService?.nextPollSeconds ?? 0)
        if (result.document) {
          this.deviceService?.markSynced(result.at)
          void this.applyDocument(result.document)
        }
      }) ?? (() => undefined),
    )

    this.teardown.push(
      this.airport.onEvent((event) => {
        airportStore.applyOverrides(this.airport.activeOverrides)
        if (event.content.hasAnnouncement) {
          airportStore.enqueueAnnouncement({
            eventId: event.eventId,
            languages: event.content.announcementLanguages,
            queuedAt: event.receivedAt,
          })
        }
      }),
    )

    this.teardown.push(() => {
      mediaStore.setPending([])
    })
  }

  private startServices(): void {
    this.syncService?.start()
    this.airport.start()
    void this.deviceService?.initialize().then((identity) => {
      usePlayerStatusStore().setIdentity(identity)
      this.deviceService?.startReporting()
    })
    useConnectivityStore().setTransport(null)
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

  /** Publishes a document to the stores and (re)starts playback. */
  private async applyDocument(document: LayoutDocument): Promise<void> {
    const layoutStore = useLayoutStore()
    const playlistStore = usePlaylistStore()
    const scheduleStore = useScheduleStore()

    layoutStore.setDocument(document)
    scheduleStore.setScheduleId(document.display?.scheduleId ?? null)
    useConnectivityStore().setTransport(document.origin === 'xml-adapter' ? 'xml' : 'json')

    const layouts = LayoutService.layoutsOf(document)
    if (!layouts.length) {
      logger.warn('Document contains no playable layouts')
      return
    }

    playlistStore.setPlaylist(document.playlist, layouts.length)

    // An update to the playlist currently on screen must not restart it.
    if (layoutStore.activeLayoutId) {
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
    useMediaStore().setPending(pending)
  }
}
