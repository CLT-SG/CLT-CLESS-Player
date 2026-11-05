import { createDefaultStorageDriver, type ConfigurationSource } from '@core/storage'
import { Logger, NetworkUtils } from '@core/utilities'
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
  StoredFile,
} from '../PlatformServices'

const logger = Logger.forScope('platform:web')

/**
 * Browser implementations.
 *
 * These are the baseline every other platform overrides, and they are also
 * what the control-panel preview and the test suite run against. Each one
 * degrades rather than throws, so a missing capability makes the player less
 * capable, never broken.
 */

export class WebNetworkService implements NetworkService {
  readonly name = 'web'

  async status(): Promise<NetworkStatus> {
    const connection = (navigator as { connection?: { effectiveType?: string } }).connection
    return {
      online: navigator.onLine,
      connectionType: connection?.effectiveType ?? 'unknown',
    }
  }

  onStatusChange(handler: (status: NetworkStatus) => void): () => void {
    const emit = () => {
      void this.status().then(handler)
    }
    window.addEventListener('online', emit)
    window.addEventListener('offline', emit)
    return () => {
      window.removeEventListener('online', emit)
      window.removeEventListener('offline', emit)
    }
  }

  /**
   * `navigator.onLine` only says the interface is up, so reachability is a
   * real request. `no-cors` keeps it usable against a server without CORS
   * headers: an opaque response still proves the host answered.
   */
  async reachable(url: string, timeoutMs = 5_000): Promise<boolean> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      await fetch(url, { method: 'HEAD', mode: 'no-cors', cache: 'no-store', signal: controller.signal })
      return true
    } catch {
      return false
    } finally {
      clearTimeout(timer)
    }
  }
}

/** No writable filesystem in a browser; media streams from the server. */
export class WebFileService implements FileService {
  readonly name = 'web'
  readonly available = false

  async write(_path: string, remoteUrl: string): Promise<string> {
    return remoteUrl
  }

  async uriFor(_path: string): Promise<string | null> {
    return null
  }

  async remove(_path: string): Promise<void> {
    // Nothing is stored, so removal is a no-op rather than an error.
  }

  async list(_prefix?: string): Promise<readonly StoredFile[]> {
    return []
  }

  async freeSpaceBytes(): Promise<number | null> {
    const storage = navigator.storage
    if (!storage?.estimate) return null
    try {
      const estimate = await storage.estimate()
      if (estimate.quota == null || estimate.usage == null) return null
      return estimate.quota - estimate.usage
    } catch {
      return null
    }
  }
}

export class WebMediaService implements MediaService {
  readonly name = 'web'

  constructor(private readonly files: FileService) {}

  get capabilities(): MediaCapabilities {
    const probe = document.createElement('video')
    return {
      nativeHls: probe.canPlayType('application/vnd.apple.mpegurl') !== '',
      flv: false,
      youTubeEmbed: true,
      // Every current browser blocks it until the page has been interacted
      // with, which a signage player never is.
      autoplayWithSound: false,
    }
  }

  async resolve(path: string, remoteUrl: string): Promise<string> {
    return (await this.files.uriFor(path)) ?? remoteUrl
  }
}

export class WebNotificationService implements NotificationService {
  readonly name = 'web'

  notify(level: NotificationLevel, title: string, message?: string): void {
    const text = message ? `${title}: ${message}` : title
    if (level === 'error') logger.error(text)
    else if (level === 'warning') logger.warn(text)
    else logger.info(text)
  }
}

export class WebDeviceService implements DeviceService {
  readonly name = 'web'

  constructor(private readonly kind: PlatformKind = 'web') {}

  async facts(): Promise<DeviceFacts> {
    return {
      serial: null,
      macAddress: null,
      hostname: globalThis.location?.hostname ?? null,
      platform: this.kind,
      osVersion: navigator.userAgent,
      model: null,
      appVersion: null,
    }
  }

  screen(): ScreenInfo {
    const width = window.innerWidth || screen.width
    const height = window.innerHeight || screen.height
    return {
      width,
      height,
      orientation: width >= height ? 'landscape' : 'portrait',
      devicePixelRatio: window.devicePixelRatio || 1,
    }
  }

  async keepAwake(_enabled: boolean): Promise<void> {
    // Wake Lock needs a user gesture in most browsers, which a signage player
    // never receives. Kiosk mode is configured outside the app instead.
  }

  async restartApp(): Promise<boolean> {
    globalThis.location?.reload()
    return true
  }
}

/**
 * Reads configuration over HTTP, for a browser-hosted preview.
 *
 * `/api/config` is served by the player's own control-panel process, so a
 * preview sees exactly the configuration the device is running.
 */
export function createWebConfigurationSource(endpoint = '/api/config'): ConfigurationSource {
  return {
    name: 'http',
    async read(): Promise<Record<string, unknown> | null> {
      try {
        const response = await fetch(NetworkUtils.joinUrl(globalThis.location?.origin ?? '', endpoint), {
          cache: 'no-store',
        })
        if (!response.ok) return null
        return (await response.json()) as Record<string, unknown>
      } catch {
        return null
      }
    },
  }
}

/**
 * Parses XML with `DOMParser`, producing the same non-compact tree shape as
 * the `xml-js` parser Electron exposes, so the compatibility adapter has one
 * input shape regardless of platform.
 */
export function domParseXml(xml: string): unknown {
  const parsed = new DOMParser().parseFromString(xml, 'text/xml')

  function convert(element: Element): Record<string, unknown> {
    const attributes: Record<string, string> = {}
    for (const attribute of Array.from(element.attributes)) {
      attributes[attribute.name] = attribute.value
    }

    const elements: Array<Record<string, unknown>> = []
    for (const child of Array.from(element.childNodes)) {
      if (child.nodeType === Node.ELEMENT_NODE) {
        elements.push(convert(child as Element))
      } else if (child.nodeType === Node.TEXT_NODE && (child.textContent ?? '').trim()) {
        elements.push({ type: 'text', text: child.textContent })
      }
    }
    return { type: 'element', name: element.tagName, attributes, elements }
  }

  const root = parsed.documentElement
  return { elements: root ? [convert(root)] : [] }
}

export function createWebPlatform(): PlatformServices {
  const files = new WebFileService()
  return {
    kind: 'web',
    storage: createDefaultStorageDriver(),
    network: new WebNetworkService(),
    files,
    media: new WebMediaService(files),
    notifications: new WebNotificationService(),
    device: new WebDeviceService('web'),
    parseXml: domParseXml,
    configurationSource: createWebConfigurationSource(),
    realtimeSocket: null,
    assetBlobStore: null,
  }
}
