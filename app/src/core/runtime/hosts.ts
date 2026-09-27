import type { RealtimeSocket } from '../comm'
import type { ConfigurationSource, StorageDriver } from '../storage'
import type { DeviceIdentitySource } from '../services'
import { Logger, ValidationUtils, type LogRecord } from '../utils'
import type { PlayerHost } from './PlayerRuntime'

/**
 * Host bridges.
 *
 * The existing `preload.js` already exposes `xml-js`, `electron-log`, the
 * loaded `config.json` and `@electron/remote` on `window`. These factories
 * read those globals and hand the runtime typed, narrow capabilities, so the
 * core layers never touch `window` and the same bundle runs unchanged in a
 * plain browser.
 */

/** Subset of the preload surface this app uses; everything is optional. */
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
  remote?: { app?: { getVersion(): string } }
  macaddress?: { one(callback: (error: unknown, mac: string) => void): void }
  io?: (url: string, options?: Record<string, unknown>) => RealtimeSocket
}

function preload(): PreloadGlobals {
  return globalThis as unknown as PreloadGlobals
}

/**
 * Routes player logs into `electron-log` so they land in the same daily log
 * file the support team already collects.
 */
function installElectronLogSink(): void {
  const log = preload().log
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

/**
 * Reads configuration from the Electron main process, falling back to the
 * `config.json` the preload script already required.
 */
function electronConfigurationSource(): ConfigurationSource {
  return {
    name: 'electron',
    async read() {
      const globals = preload()

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
  const version = preload().remote?.app?.getVersion()
  return version ? { ...config, version } : config
}

function electronIdentitySource(): DeviceIdentitySource {
  return {
    async read() {
      const globals = preload()
      const macAddress = await new Promise<string | null>((resolve) => {
        if (!globals.macaddress) {
          resolve(null)
          return
        }
        globals.macaddress.one((error, mac) => resolve(error ? null : mac))
      })

      return {
        macAddress,
        hostname: globalThis.location?.hostname ?? null,
        playerVersion: globals.remote?.app?.getVersion() ?? undefined,
      }
    },
  }
}

/**
 * Connects to the control-panel Socket.IO server that the player's own
 * Electron main process runs. Returns `undefined` when the client library is
 * not present, which simply means no push updates.
 */
function connectControlPanelSocket(url = 'https://localhost:9000'): RealtimeSocket | undefined {
  const io = preload().io
  if (!io) return undefined
  try {
    return io(url, { rejectUnauthorized: false, transports: ['websocket', 'polling'] })
  } catch {
    return undefined
  }
}

/**
 * Host wiring for the Electron renderer: the full-capability deployment.
 */
export function createElectronHost(options: { storage?: StorageDriver } = {}): PlayerHost {
  installElectronLogSink()
  const xmljs = preload().xmljs

  return {
    storage: options.storage,
    configurationSource: electronConfigurationSource(),
    identitySource: electronIdentitySource(),
    // `xml2js` in non-compact mode produces exactly the tree the adapter and
    // the legacy cache both use.
    parseXml: xmljs ? (xml: string) => xmljs.xml2js(xml, { compact: false, trim: false }) : undefined,
    realtimeSocket: connectControlPanelSocket(),
  }
}

/**
 * Host wiring for a plain browser (control-panel live preview, development).
 *
 * Configuration comes from the player's own HTTP API, and XML parsing uses
 * `DOMParser`, so no Electron globals are required.
 */
export function createBrowserHost(options: { configUrl?: string; storage?: StorageDriver } = {}): PlayerHost {
  const configUrl = options.configUrl ?? '/api/config'

  return {
    storage: options.storage,
    configurationSource: {
      name: 'http',
      async read() {
        const response = await fetch(configUrl, { cache: 'no-store' })
        if (!response.ok) return null
        const payload: unknown = await response.json()
        return ValidationUtils.isRecord(payload) ? payload : null
      },
    },
    parseXml: (xml: string) => domParseToXmlJs(xml),
  }
}

/**
 * Converts XML to the `xml-js` non-compact shape using `DOMParser`.
 *
 * Producing the same tree as `xml-js` means the adapter has a single input
 * format regardless of host, rather than one code path per parser.
 */
function domParseToXmlJs(xml: string): unknown {
  const parsed = new DOMParser().parseFromString(xml, 'text/xml')
  const error = parsed.querySelector('parsererror')
  if (error) throw new Error(`XML parse error: ${error.textContent ?? 'unknown'}`)

  function convert(element: Element): Record<string, unknown> {
    const attributes: Record<string, string> = {}
    for (const attribute of Array.from(element.attributes)) {
      attributes[attribute.name] = attribute.value
    }

    const elements: Array<Record<string, unknown>> = []
    for (const child of Array.from(element.childNodes)) {
      if (child.nodeType === Node.ELEMENT_NODE) {
        elements.push(convert(child as Element))
      } else if (child.nodeType === Node.TEXT_NODE) {
        const text = child.textContent ?? ''
        if (text.trim()) elements.push({ type: 'text', text })
      }
    }

    return { type: 'element', name: element.tagName, attributes, elements }
  }

  const root = parsed.documentElement
  return { elements: root ? [convert(root)] : [] }
}
