import type { AssetBlobStore, StorageDriver } from '@core/storage'
import type { RealtimeSocket, XmlParser } from '@core/transports'
import type { ConfigurationSource } from '@core/storage'

export type PlatformKind = 'electron' | 'android' | 'ios' | 'web'

/**
 * Key/value persistence. Identical to `StorageDriver`, which the repositories
 * already depend on — aliased rather than redefined so there is one storage
 * abstraction in the codebase, not two that drift.
 */
export type StorageService = StorageDriver

export interface NetworkStatus {
  readonly online: boolean
  /** `wifi`, `cellular`, `ethernet`, `none`, or `unknown`. */
  readonly connectionType: string
}

/**
 * Connectivity facts from the platform.
 *
 * Distinct from `ConnectivityMonitor`, which tracks whether *our server* is
 * answering. Both matter: the OS can report a live interface while the CMS is
 * unreachable across a VPN, which is the common airport failure and the reason
 * the player must not treat "link up" as "server reachable".
 */
export interface NetworkService {
  readonly name: string
  status(): Promise<NetworkStatus>
  onStatusChange(handler: (status: NetworkStatus) => void): () => void
  /** Cheap reachability probe, used before deciding a server is really down. */
  reachable(url: string, timeoutMs?: number): Promise<boolean>
}

export interface StoredFile {
  readonly path: string
  readonly sizeBytes: number
  readonly uri: string
}

/**
 * Local file storage for cached media.
 *
 * `available` is false in a plain browser; the asset cache then keeps version
 * bookkeeping only and media streams from the server, which is the correct
 * degraded behaviour rather than an error.
 */
export interface FileService {
  readonly name: string
  readonly available: boolean
  /** Persists bytes fetched from `remoteUrl` and returns a loadable URI. */
  write(path: string, remoteUrl: string): Promise<string>
  uriFor(path: string): Promise<string | null>
  remove(path: string): Promise<void>
  list(prefix?: string): Promise<readonly StoredFile[]>
  freeSpaceBytes(): Promise<number | null>
}

export interface MediaCapabilities {
  /** HLS playable without a JS polyfill (Safari/iOS, Android WebView). */
  readonly nativeHls: boolean
  readonly flv: boolean
  readonly youTubeEmbed: boolean
  readonly autoplayWithSound: boolean
}

/**
 * Playback facts that genuinely differ per platform.
 *
 * iOS will not autoplay with sound and plays HLS natively; Electron on Windows
 * needs a JS player for HLS and FLV. Encoding that here keeps the renderer
 * components free of platform checks.
 */
export interface MediaService {
  readonly name: string
  readonly capabilities: MediaCapabilities
  /** Prefers a cached local copy, falling back to the remote URL. */
  resolve(path: string, remoteUrl: string): Promise<string>
}

export type NotificationLevel = 'info' | 'warning' | 'error'

/**
 * Operator-visible messages.
 *
 * A signage player has no user, so this is not a UI affordance: it is how a
 * problem reaches whoever is standing in front of the screen or watching the
 * control panel.
 */
export interface NotificationService {
  readonly name: string
  notify(level: NotificationLevel, title: string, message?: string): void
}

export interface ScreenInfo {
  readonly width: number
  readonly height: number
  readonly orientation: 'landscape' | 'portrait'
  readonly devicePixelRatio: number
}

export interface DeviceFacts {
  readonly serial: string | null
  readonly macAddress: string | null
  readonly hostname: string | null
  readonly platform: PlatformKind
  readonly osVersion: string | null
  readonly model: string | null
  readonly appVersion: string | null
}

/**
 * Facts about, and control over, the device itself.
 *
 * Note the split from `services/StatusReportService`: this reports what the
 * device *is*, that one reports what the player is *doing*. The former is a
 * platform concern, the latter is not.
 */
export interface DeviceService {
  readonly name: string
  facts(): Promise<DeviceFacts>
  screen(): ScreenInfo
  /** Keeps the display on; a signage device must never sleep. */
  keepAwake(enabled: boolean): Promise<void>
  restartApp(): Promise<boolean>
}

/**
 * The platform-specific half of the player.
 *
 * Everything above this bundle is shared: the same services, models, state and
 * components run on Electron, Android and iOS. Everything that genuinely
 * differs is behind one of these six interfaces, which is what stops
 * `if (isAndroid)` from spreading through the application.
 */
export interface PlatformServices {
  readonly kind: PlatformKind
  readonly storage: StorageService
  readonly network: NetworkService
  readonly files: FileService
  readonly media: MediaService
  readonly notifications: NotificationService
  readonly device: DeviceService
  /** Present when the platform can parse XML for the compatibility transport. */
  readonly parseXml: XmlParser | null
  readonly configurationSource: ConfigurationSource | null
  readonly realtimeSocket: RealtimeSocket | null
  /** Derived from `files`; `null` when the platform cannot persist bytes. */
  readonly assetBlobStore: AssetBlobStore | null
}
