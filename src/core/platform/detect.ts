import { Logger } from '@core/utilities'
import type { PlatformKind, PlatformServices } from './PlatformServices'
import { capacitorPlatformKind, createCapacitorPlatform, isCapacitorNative } from './capacitor'
import { createElectronPlatform } from './electron'
import { createWebPlatform } from './web'

const logger = Logger.forScope('platform')

/**
 * Identifies the host the bundle is running in.
 *
 * Capacitor is checked first because an Android build may also expose a
 * `process` global through a polyfill, whereas only Capacitor installs a
 * native bridge. Electron is then identified by its preload surface rather
 * than the user agent, which `nodeIntegration: false` builds do not brand.
 */
export function detectPlatform(): PlatformKind {
  if (isCapacitorNative()) return capacitorPlatformKind()

  const globals = globalThis as {
    process?: { versions?: { electron?: string } }
    ipcRenderer?: unknown
    remote?: unknown
  }
  if (globals.process?.versions?.electron || globals.ipcRenderer || globals.remote) return 'electron'

  return 'web'
}

/**
 * Builds the platform bundle for wherever the player happens to be running.
 *
 * One build artifact ships to all three targets and picks its implementations
 * here, at a single point. That is the whole reason the abstraction exists:
 * without it the alternative is three application builds that drift, and with
 * it a platform difference can only be expressed by adding a service
 * implementation, never by a conditional somewhere in the application.
 *
 * Pass `kind` to force a platform; the test suite and the control-panel
 * preview use that to exercise a target they are not running on.
 */
export function createPlatformServices(kind: PlatformKind = detectPlatform()): PlatformServices {
  switch (kind) {
    case 'electron':
      return createElectronPlatform()
    case 'android':
    case 'ios':
      return createCapacitorPlatform()
    default:
      return createWebPlatform()
  }
}

/** Logs the resolved capabilities once at boot; support asks for this first. */
export function describePlatform(platform: PlatformServices): Record<string, unknown> {
  const description = {
    kind: platform.kind,
    storage: platform.storage.name,
    network: platform.network.name,
    files: platform.files.available ? platform.files.name : `${platform.files.name} (unavailable)`,
    media: platform.media.capabilities,
    xml: platform.parseXml !== null,
    configuration: platform.configurationSource?.name ?? 'none',
    realtime: platform.realtimeSocket !== null,
    assetCache: platform.assetBlobStore?.name ?? 'none',
  }
  logger.info('Platform resolved', description)
  return description
}
