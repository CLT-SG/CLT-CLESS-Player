import { createDefaultStorageDriver, type AssetBlobStore, type ConfigurationSource } from '@core/storage'
import type { RealtimeSocket, XmlParser } from '@core/transports'
import { Logger, MediaUtils, ValidationUtils, type LogRecord } from '@core/utilities'
import type {
  DeviceFacts,
  DeviceService,
  FileService,
  MediaCapabilities,
  MediaService,
  NetworkService,
  NetworkStatus,
  NotificationLevel,
  NotificationService,
  PlatformServices,
  ScreenInfo,
  StoredFile,
} from '../PlatformServices'
import { WebDeviceService, WebNetworkService, domParseXml } from '../web'

const logger = Logger.forScope('platform:electron')

/**
 * Electron implementations, built on the capabilities `preload.js` already
 * exposes.
 *
 * Nothing new is required of the main process: the preload bridge has provided
 * `xml-js`, `electron-log`, `fs`, `macaddress`, `is-reachable`, the loaded
 * `config.json` and `@electron/remote` for years. This file gives those
 * globals types and a narrow surface so no layer above it touches `window`.
 */

/** Subset of the preload surface used here; every member is optional. */
interface PreloadGlobals {
  xmljs?: { xml2js(xml: string, options?: Record<string, unknown>): unknown }
  log?: {
    info(...args: unknown[]): void
    warn(...args: unknown[]): void
    error(...args: unknown[]): void
    debug?(...args: unknown[]): void
  }
  config?: Record<string, unknown>
  ipcRenderer?: { invoke(channel: string, ...args: unknown[]): Promise<unknown> }
  remote?: { app?: { getVersion(): string; relaunch?(): void; quit?(): void } }
  macaddress?: { one(callback: (error: unknown, mac: string) => void): void }
  isReachable?: (target: string) => Promise<boolean>
  os?: { hostname?(): string; release?(): string; platform?(): string }
  io?: (url: string, options?: Record<string, unknown>) => RealtimeSocket
}

export function electronGlobals(): PreloadGlobals {
  return globalThis as unknown as PreloadGlobals
}

/**
 * Routes player logs into `electron-log` so they land in the same daily log
 * file the support team already collects.
 */
export function installElectronLogSink(): void {
  const log = electronGlobals().log
  if (!log) return

  Logger.setSink((record: LogRecord) => {
    const message = `[${record.scope}] ${record.message}`
    switch (record.level) {
      case 'error':
        log.error(message, record.detail ?? '')
        break
      case 'warn':
        log.warn(message, record.detail ?? '')
        break
      case 'debug':
        log.debug?.(message, record.detail ?? '')
        break
      default:
        log.info(message, record.detail ?? '')
    }
  })
}

export class ElectronStorageService {
  static create() {
    // The renderer's `localStorage` is the same store the legacy renderer
    // uses, which is what lets an upgraded device read the cache it already
    // has instead of waiting for a successful sync.
    return createDefaultStorageDriver()
  }
}

export class ElectronNetworkService implements NetworkService {
  readonly name = 'electron'
  private readonly fallback = new WebNetworkService()

  async status(): Promise<NetworkStatus> {
    const status = await this.fallback.status()
    return { online: status.online, connectionType: status.online ? 'ethernet' : 'none' }
  }

  onStatusChange(handler: (status: NetworkStatus) => void): () => void {
    return this.fallback.onStatusChange(handler)
  }

  /**
   * Uses the `is-reachable` module the preload bridge exposes, which probes
   * the host at TCP level and therefore works against a server that blocks
   * HEAD requests — the reason the legacy player used it.
   */
  async reachable(url: string, timeoutMs = 5_000): Promise<boolean> {
    const probe = electronGlobals().isReachable
    if (!probe) return this.fallback.reachable(url, timeoutMs)
    try {
      return await probe(url)
    } catch {
      return false
    }
  }
}

/**
 * On-disk media cache reached through the preload `fs` bridge.
 *
 * Downloads go through `fetch` in the renderer rather than the main process so
 * this needs no new IPC channel; only the write is delegated.
 */
export class ElectronFileService implements FileService {
  readonly name = 'electron'

  constructor(
    private readonly bridge: ElectronFileBridge | null = electronFileBridge(),
    private readonly root = 'res',
  ) {}

  get available(): boolean {
    return this.bridge !== null
  }

  async write(path: string, remoteUrl: string): Promise<string> {
    if (!this.bridge) return remoteUrl
    try {
      const response = await fetch(remoteUrl, { cache: 'no-store' })
      if (!response.ok) return remoteUrl
      const bytes = new Uint8Array(await response.arrayBuffer())
      return await this.bridge.write(`${this.root}/${path}`, bytes)
    } catch (error) {
      logger.warn(`Could not cache ${path} on disk`, error)
      return remoteUrl
    }
  }

  async uriFor(path: string): Promise<string | null> {
    if (!this.bridge) return null
    return this.bridge.uriFor(`${this.root}/${path}`)
  }

  async remove(path: string): Promise<void> {
    await this.bridge?.remove(`${this.root}/${path}`)
  }

  async list(prefix?: string): Promise<readonly StoredFile[]> {
    if (!this.bridge) return []
    return this.bridge.list(prefix ? `${this.root}/${prefix}` : this.root)
  }

  async freeSpaceBytes(): Promise<number | null> {
    return this.bridge?.freeSpaceBytes() ?? null
  }
}

/** What the preload script must provide for on-disk caching to be available. */
export interface ElectronFileBridge {
  write(path: string, bytes: Uint8Array): Promise<string>
  uriFor(path: string): Promise<string | null>
  remove(path: string): Promise<void>
  list(prefix: string): Promise<readonly StoredFile[]>
  freeSpaceBytes(): Promise<number | null>
}

/**
 * Resolves the preload file bridge if the main process exposes one.
 *
 * Returning `null` is expected on current builds: the player then behaves like
 * the browser platform and streams media, so this file can ship before the
 * main process gains the channel.
 */
export function electronFileBridge(): ElectronFileBridge | null {
  const bridge = (globalThis as { clessFiles?: ElectronFileBridge }).clessFiles
  return bridge ?? null
}

export class ElectronMediaService implements MediaService {
  readonly name = 'electron'

  constructor(private readonly files: FileService) {}

  get capabilities(): MediaCapabilities {
    return {
      // Chromium needs a JS player for both; the renderer already bundles one.
      nativeHls: false,
      flv: true,
      youTubeEmbed: true,
      // A desktop Electron window is not subject to the autoplay gesture
      // requirement, which is why the legacy player can play video with sound.
      autoplayWithSound: true,
    }
  }

  async resolve(path: string, remoteUrl: string): Promise<string> {
    return (await this.files.uriFor(path)) ?? remoteUrl
  }
}

export class ElectronNotificationService implements NotificationService {
  readonly name = 'electron'

  notify(level: NotificationLevel, title: string, message?: string): void {
    const text = message ? `${title}: ${message}` : title
    if (level === 'error') logger.error(text)
    else if (level === 'warning') logger.warn(text)
    else logger.info(text)
  }
}

export class ElectronDeviceService implements DeviceService {
  readonly name = 'electron'
  private readonly fallback = new WebDeviceService('electron')

  async facts(): Promise<DeviceFacts> {
    const globals = electronGlobals()
    const macAddress = await new Promise<string | null>((resolve) => {
      if (!globals.macaddress) {
        resolve(null)
        return
      }
      globals.macaddress.one((error, mac) => resolve(error ? null : mac))
    })

    return {
      serial: ValidationUtils.nonEmpty(String(globals.config?.['serialkey'] ?? '')),
      macAddress,
      hostname: globals.os?.hostname?.() ?? globalThis.location?.hostname ?? null,
      platform: 'electron',
      osVersion: globals.os?.release?.() ?? null,
      model: globals.os?.platform?.() ?? null,
      appVersion: globals.remote?.app?.getVersion() ?? null,
    }
  }

  screen(): ScreenInfo {
    return this.fallback.screen()
  }

  async keepAwake(_enabled: boolean): Promise<void> {
    // The main process already owns power management through
    // `electron-shutdown-command` and the `screenTimeout` config key, so the
    // renderer must not fight it.
  }

  async restartApp(): Promise<boolean> {
    const remote = electronGlobals().remote
    if (!remote?.app?.relaunch) return false
    remote.app.relaunch()
    remote.app.quit?.()
    return true
  }
}

/**
 * Reads configuration from the Electron main process, falling back to the
 * `config.json` the preload script already required.
 */
export function electronConfigurationSource(): ConfigurationSource {
  return {
    name: 'electron',
    async read() {
      const globals = electronGlobals()

      if (globals.ipcRenderer) {
        try {
          const result = await globals.ipcRenderer.invoke('get-configuration')
          if (ValidationUtils.isRecord(result)) return withRuntimeVersion(result)
        } catch {
          // The channel may not exist on an older main process; the preload
          // copy below is the compatible path.
        }
      }

      return ValidationUtils.isRecord(globals.config) ? withRuntimeVersion(globals.config) : null
    },
  }
}

/** Stamps the packaged app version so the server heartbeat reports it. */
function withRuntimeVersion(config: Record<string, unknown>): Record<string, unknown> {
  const version = electronGlobals().remote?.app?.getVersion()
  return version ? { ...config, version } : config
}

/**
 * Connects to the control-panel Socket.IO server the player's own main process
 * runs. Returns `null` when the client library is absent, which simply means
 * no push updates.
 */
export function connectControlPanelSocket(url = 'https://localhost:9000'): RealtimeSocket | null {
  const io = electronGlobals().io
  if (!io) return null
  try {
    return io(url, { rejectUnauthorized: false, transports: ['websocket', 'polling'] })
  } catch {
    return null
  }
}

/** Adapts a `FileService` to the asset cache's blob-store contract. */
export function fileServiceBlobStore(files: FileService): AssetBlobStore | null {
  if (!files.available) return null
  return {
    name: files.name,
    async has(path) {
      return (await files.uriFor(path)) !== null
    },
    async put(path, _version, url) {
      return files.write(path, url)
    },
    async resolve(path) {
      return files.uriFor(path)
    },
    async remove(path) {
      await files.remove(path)
    },
  }
}

export function createElectronPlatform(): PlatformServices {
  installElectronLogSink()
  const files = new ElectronFileService()
  const xmljs = electronGlobals().xmljs
  const parseXml: XmlParser | null = xmljs
    ? (xml: string) => xmljs.xml2js(xml, { compact: false, trim: false })
    : domParseXml

  return {
    kind: 'electron',
    storage: ElectronStorageService.create(),
    network: new ElectronNetworkService(),
    files,
    media: new ElectronMediaService(files),
    notifications: new ElectronNotificationService(),
    device: new ElectronDeviceService(),
    parseXml,
    configurationSource: electronConfigurationSource(),
    realtimeSocket: connectControlPanelSocket(),
    assetBlobStore: fileServiceBlobStore(files),
  }
}

/** Re-exported for the media helpers the renderer shares with the legacy build. */
export { MediaUtils }
