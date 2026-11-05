import { MemoryStorageDriver, type AssetBlobStore, type ConfigurationSource } from '@core/storage'
import type { RealtimeSocket } from '@core/transports'
import { Logger, ValidationUtils } from '@core/utilities'
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
  PlatformKind,
  PlatformServices,
  ScreenInfo,
  StorageService,
  StoredFile,
} from '../PlatformServices'
import { WebDeviceService, WebNetworkService, domParseXml } from '../web'
import { fileServiceBlobStore } from '../electron'

const logger = Logger.forScope('platform:capacitor')

/**
 * Capacitor implementations for Android and iOS.
 *
 * These talk to `window.Capacitor.Plugins` — the bridge Capacitor installs at
 * runtime — rather than importing `@capacitor/*`. That is deliberate: the Vue
 * bundle stays free of a native dependency, so one build artifact runs on
 * Electron, Android and iOS, and a plugin that is not installed degrades
 * instead of breaking the build.
 *
 * The plugins used here are already declared in `mobile/package.json`:
 * Preferences, Filesystem, Network, Device and App.
 */

interface CapacitorPreferences {
  get(options: { key: string }): Promise<{ value: string | null }>
  set(options: { key: string; value: string }): Promise<void>
  remove(options: { key: string }): Promise<void>
  keys(): Promise<{ keys: string[] }>
}

interface CapacitorFilesystem {
  writeFile(options: {
    path: string
    data: string
    directory: string
    recursive?: boolean
  }): Promise<{ uri: string }>
  getUri(options: { path: string; directory: string }): Promise<{ uri: string }>
  stat(options: { path: string; directory: string }): Promise<{ size: number; uri: string }>
  deleteFile(options: { path: string; directory: string }): Promise<void>
  readdir(options: { path: string; directory: string }): Promise<{ files: Array<{ name: string; size?: number; uri?: string }> }>
  mkdir(options: { path: string; directory: string; recursive?: boolean }): Promise<void>
}

interface CapacitorNetwork {
  getStatus(): Promise<{ connected: boolean; connectionType: string }>
  addListener(
    event: 'networkStatusChange',
    handler: (status: { connected: boolean; connectionType: string }) => void,
  ): Promise<{ remove(): Promise<void> }> | { remove(): void }
}

interface CapacitorDevicePlugin {
  getInfo(): Promise<{ model?: string; osVersion?: string; platform?: string; name?: string }>
  getId(): Promise<{ identifier?: string; uuid?: string }>
}

interface CapacitorAppPlugin {
  getInfo(): Promise<{ version?: string; build?: string }>
  exitApp(): Promise<void>
}

interface CapacitorBridge {
  getPlatform(): string
  isNativePlatform(): boolean
  Plugins?: {
    Preferences?: CapacitorPreferences
    Filesystem?: CapacitorFilesystem
    Network?: CapacitorNetwork
    Device?: CapacitorDevicePlugin
    App?: CapacitorAppPlugin
    KeepAwake?: { keepAwake(): Promise<void>; allowSleep(): Promise<void> }
  }
}

/** Filesystem directory used for cached media. */
const MEDIA_DIRECTORY = 'DATA'
const MEDIA_ROOT = 'cless/res'

export function capacitorBridge(): CapacitorBridge | null {
  const bridge = (globalThis as { Capacitor?: CapacitorBridge }).Capacitor
  return bridge?.getPlatform ? bridge : null
}

export function isCapacitorNative(): boolean {
  const bridge = capacitorBridge()
  return bridge ? bridge.isNativePlatform() : false
}

export function capacitorPlatformKind(): PlatformKind {
  const platform = capacitorBridge()?.getPlatform()
  if (platform === 'android') return 'android'
  if (platform === 'ios') return 'ios'
  return 'web'
}

/**
 * Preferences-backed key/value store.
 *
 * Preferences rather than `localStorage` because a WebView's local storage is
 * cleared when the OS reclaims space, and an offline signage device losing its
 * layout cache to a housekeeping sweep is exactly the failure this whole
 * design exists to prevent.
 */
export class CapacitorStorageService implements StorageService {
  readonly name = 'capacitor-preferences'

  constructor(private readonly preferences: CapacitorPreferences) {}

  static create(): StorageService {
    const preferences = capacitorBridge()?.Plugins?.Preferences
    if (!preferences) {
      logger.warn('Preferences plugin unavailable; falling back to in-memory storage')
      return new MemoryStorageDriver()
    }
    return new CapacitorStorageService(preferences)
  }

  async getItem(key: string): Promise<string | null> {
    try {
      const result = await this.preferences.get({ key })
      return result.value ?? null
    } catch {
      return null
    }
  }

  async setItem(key: string, value: string): Promise<void> {
    await this.preferences.set({ key, value })
  }

  async removeItem(key: string): Promise<void> {
    await this.preferences.remove({ key })
  }

  async keys(): Promise<readonly string[]> {
    try {
      return (await this.preferences.keys()).keys
    } catch {
      return []
    }
  }

  async usedBytes(): Promise<number | null> {
    return null
  }
}

export class CapacitorNetworkService implements NetworkService {
  readonly name = 'capacitor'
  private readonly fallback = new WebNetworkService()

  constructor(private readonly network: CapacitorNetwork | null = capacitorBridge()?.Plugins?.Network ?? null) {}

  async status(): Promise<NetworkStatus> {
    if (!this.network) return this.fallback.status()
    try {
      const status = await this.network.getStatus()
      return { online: status.connected, connectionType: status.connectionType }
    } catch {
      return this.fallback.status()
    }
  }

  onStatusChange(handler: (status: NetworkStatus) => void): () => void {
    if (!this.network) return this.fallback.onStatusChange(handler)

    let remove: (() => void) | null = null
    const result = this.network.addListener('networkStatusChange', (status) => {
      handler({ online: status.connected, connectionType: status.connectionType })
    })

    if (result instanceof Promise) {
      void result.then((handle) => {
        remove = () => void handle.remove()
      })
    } else {
      remove = () => result.remove()
    }

    return () => remove?.()
  }

  async reachable(url: string, timeoutMs = 5_000): Promise<boolean> {
    // A mobile device can hold a live cellular link while the CMS sits behind
    // an unreachable VPN, so the interface state is never enough on its own.
    const status = await this.status()
    if (!status.online) return false
    return this.fallback.reachable(url, timeoutMs)
  }
}

/** Filesystem-backed media cache. */
export class CapacitorFileService implements FileService {
  readonly name = 'capacitor-filesystem'

  constructor(private readonly filesystem: CapacitorFilesystem | null = capacitorBridge()?.Plugins?.Filesystem ?? null) {}

  get available(): boolean {
    return this.filesystem !== null
  }

  private target(path: string): { path: string; directory: string } {
    return { path: `${MEDIA_ROOT}/${path}`, directory: MEDIA_DIRECTORY }
  }

  async write(path: string, remoteUrl: string): Promise<string> {
    if (!this.filesystem) return remoteUrl
    try {
      const response = await fetch(remoteUrl, { cache: 'no-store' })
      if (!response.ok) return remoteUrl
      const data = await CapacitorFileService.toBase64(await response.blob())
      const written = await this.filesystem.writeFile({ ...this.target(path), data, recursive: true })
      return written.uri
    } catch (error) {
      logger.warn(`Could not cache ${path} to the filesystem`, error)
      return remoteUrl
    }
  }

  async uriFor(path: string): Promise<string | null> {
    if (!this.filesystem) return null
    try {
      // `stat` rather than `getUri`, because getUri returns a path whether or
      // not the file exists and the caller needs to know if it is really there.
      const stat = await this.filesystem.stat(this.target(path))
      return CapacitorFileService.toWebViewUri(stat.uri)
    } catch {
      return null
    }
  }

  async remove(path: string): Promise<void> {
    try {
      await this.filesystem?.deleteFile(this.target(path))
    } catch {
      // Already gone is the desired end state.
    }
  }

  async list(prefix?: string): Promise<readonly StoredFile[]> {
    if (!this.filesystem) return []
    try {
      const listing = await this.filesystem.readdir({
        path: prefix ? `${MEDIA_ROOT}/${prefix}` : MEDIA_ROOT,
        directory: MEDIA_DIRECTORY,
      })
      return listing.files.map((file) => ({
        path: file.name,
        sizeBytes: file.size ?? 0,
        uri: CapacitorFileService.toWebViewUri(file.uri ?? ''),
      }))
    } catch {
      return []
    }
  }

  async freeSpaceBytes(): Promise<number | null> {
    // Capacitor has no cross-platform free-space API; the asset cache treats
    // `null` as "unknown" and relies on pruning instead of pre-flighting.
    return null
  }

  /**
   * Converts a native `file://` path into the scheme the WebView can load.
   *
   * Android and iOS both refuse `file://` from an `https://` origin, so
   * Capacitor proxies local files through its own host.
   */
  private static toWebViewUri(uri: string): string {
    if (!uri) return uri
    const convert = (globalThis as { Capacitor?: { convertFileSrc?(u: string): string } }).Capacitor?.convertFileSrc
    return convert ? convert(uri) : uri
  }

  private static toBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onerror = () => reject(reader.error ?? new Error('read failed'))
      reader.onload = () => {
        const result = String(reader.result ?? '')
        // Capacitor wants the payload without the data-URL prefix.
        resolve(result.slice(result.indexOf(',') + 1))
      }
      reader.readAsDataURL(blob)
    })
  }
}

export class CapacitorMediaService implements MediaService {
  readonly name = 'capacitor'

  constructor(
    private readonly files: FileService,
    private readonly kind: PlatformKind = capacitorPlatformKind(),
  ) {}

  get capabilities(): MediaCapabilities {
    const ios = this.kind === 'ios'
    return {
      // Both mobile WebViews play HLS natively; iOS *only* plays it natively.
      nativeHls: true,
      flv: false,
      youTubeEmbed: true,
      // iOS blocks audible autoplay outright; Android allows it for a
      // WebView the app owns.
      autoplayWithSound: !ios,
    }
  }

  async resolve(path: string, remoteUrl: string): Promise<string> {
    return (await this.files.uriFor(path)) ?? remoteUrl
  }
}

export class CapacitorNotificationService implements NotificationService {
  readonly name = 'capacitor'

  notify(level: NotificationLevel, title: string, message?: string): void {
    const text = message ? `${title}: ${message}` : title
    if (level === 'error') logger.error(text)
    else if (level === 'warning') logger.warn(text)
    else logger.info(text)
  }
}

export class CapacitorDeviceService implements DeviceService {
  readonly name = 'capacitor'
  private readonly fallback: WebDeviceService

  constructor(private readonly kind: PlatformKind = capacitorPlatformKind()) {
    this.fallback = new WebDeviceService(kind)
  }

  async facts(): Promise<DeviceFacts> {
    const plugins = capacitorBridge()?.Plugins
    const [info, id, app] = await Promise.all([
      plugins?.Device?.getInfo().catch(() => null) ?? null,
      plugins?.Device?.getId().catch(() => null) ?? null,
      plugins?.App?.getInfo().catch(() => null) ?? null,
    ])

    return {
      // A mobile OS will not disclose the MAC address, so the Capacitor device
      // id is the stable identifier the serial key is bound to instead.
      serial: ValidationUtils.nonEmpty(id?.identifier ?? id?.uuid ?? ''),
      macAddress: null,
      hostname: ValidationUtils.nonEmpty(info?.name ?? ''),
      platform: this.kind,
      osVersion: ValidationUtils.nonEmpty(info?.osVersion ?? ''),
      model: ValidationUtils.nonEmpty(info?.model ?? ''),
      appVersion: ValidationUtils.nonEmpty(app?.version ?? ''),
    }
  }

  screen(): ScreenInfo {
    return this.fallback.screen()
  }

  async keepAwake(enabled: boolean): Promise<void> {
    const plugin = capacitorBridge()?.Plugins?.KeepAwake
    if (!plugin) return
    try {
      await (enabled ? plugin.keepAwake() : plugin.allowSleep())
    } catch (error) {
      logger.warn('Keep-awake request failed', error)
    }
  }

  async restartApp(): Promise<boolean> {
    // Mobile platforms give an app no way to relaunch itself; exiting hands
    // control back to the launcher, which kiosk setups restart automatically.
    const app = capacitorBridge()?.Plugins?.App
    if (!app) return false
    await app.exitApp()
    return true
  }
}

/**
 * Reads configuration from the existing mobile config loader.
 *
 * `mobile-config.js` already resolves configuration from Preferences, the
 * bundled `config.json` and the activation flow, publishing the result on
 * `window.config`. Reusing it means the Vue renderer and the legacy mobile
 * renderer are configured identically.
 */
export function capacitorConfigurationSource(): ConfigurationSource {
  return {
    name: 'capacitor',
    async read() {
      const globals = globalThis as {
        config?: Record<string, unknown>
        mobileConfigLoader?: { loadConfiguration?(): Promise<Record<string, unknown>> }
      }

      if (globals.mobileConfigLoader?.loadConfiguration) {
        try {
          const loaded = await globals.mobileConfigLoader.loadConfiguration()
          if (ValidationUtils.isRecord(loaded)) return loaded
        } catch (error) {
          // Fall through to whatever the loader already published; a config
          // read failure must not stop an offline device from booting.
          logger.warn('Mobile config loader failed', error)
        }
      }
      return ValidationUtils.isRecord(globals.config) ? globals.config : null
    },
  }
}

/** Socket.IO client, as bundled by the existing mobile socket adapter. */
export function capacitorRealtimeSocket(): RealtimeSocket | null {
  const globals = globalThis as {
    io?: (url: string, options?: Record<string, unknown>) => RealtimeSocket
    mobileSocketManager?: { socket?: RealtimeSocket }
  }
  if (globals.mobileSocketManager?.socket) return globals.mobileSocketManager.socket
  if (!globals.io) return null
  try {
    return globals.io('/', { transports: ['websocket', 'polling'] })
  } catch {
    return null
  }
}

export function createCapacitorPlatform(): PlatformServices {
  const files = new CapacitorFileService()
  const kind = capacitorPlatformKind()

  return {
    kind,
    storage: CapacitorStorageService.create(),
    network: new CapacitorNetworkService(),
    files,
    media: new CapacitorMediaService(files, kind),
    notifications: new CapacitorNotificationService(),
    device: new CapacitorDeviceService(kind),
    // The mobile shim exposes an `xml-js` work-alike; `DOMParser` is the
    // guaranteed fallback and produces the same tree.
    parseXml: domParseXml,
    configurationSource: capacitorConfigurationSource(),
    realtimeSocket: capacitorRealtimeSocket(),
    assetBlobStore: fileServiceBlobStore(files),
  }
}

export { fileServiceBlobStore }
export type { AssetBlobStore }
