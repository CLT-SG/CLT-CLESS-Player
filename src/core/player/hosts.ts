import type { DeviceIdentitySource } from '@core/services'
import { createPlatformServices, describePlatform, type PlatformKind, type PlatformServices } from '@core/platform'
import type { PlayerHost } from './PlayerRuntime'

/**
 * Adapts a platform bundle to the runtime's host contract.
 *
 * The runtime asks for a handful of narrow capabilities; the platform layer
 * provides six broader services. Keeping the translation here means the
 * runtime never sees a `PlatformKind`, and a new platform is added by writing
 * service implementations rather than by touching the composition root.
 */
export function createHostFromPlatform(platform: PlatformServices): PlayerHost {
  return {
    platform,
    storage: platform.storage,
    configurationSource: platform.configurationSource ?? undefined,
    identitySource: platformIdentitySource(platform),
    assetBlobStore: platform.assetBlobStore ?? undefined,
    parseXml: platform.parseXml ?? undefined,
    realtimeSocket: platform.realtimeSocket ?? undefined,
  }
}

/**
 * Builds the host for wherever the bundle is running.
 *
 * This is the single call `main.ts` makes, on every target.
 */
export function createHost(kind?: PlatformKind): PlayerHost {
  const platform = createPlatformServices(kind)
  describePlatform(platform)
  return createHostFromPlatform(platform)
}

/**
 * Derives player identity from the platform's device facts.
 *
 * Electron reports a MAC address and the packaged app version; a mobile OS
 * withholds the MAC and reports a Capacitor device id instead. Both arrive
 * here in the same shape, so the status report is platform-independent even
 * though its inputs are not.
 */
function platformIdentitySource(platform: PlatformServices): DeviceIdentitySource {
  return {
    async read() {
      const facts = await platform.device.facts()
      return {
        serial: facts.serial,
        macAddress: facts.macAddress,
        hostname: facts.hostname,
        ...(facts.appVersion ? { playerVersion: facts.appVersion } : {}),
      }
    },
  }
}
