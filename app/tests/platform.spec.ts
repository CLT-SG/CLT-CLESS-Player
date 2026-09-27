import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  CapacitorStorageService,
  WebFileService,
  createPlatformServices,
  createWebPlatform,
  detectPlatform,
  fileServiceBlobStore,
} from '@core/platform'
import { createHostFromPlatform } from '@core/player'

/**
 * The platform layer exists to keep platform differences out of everything
 * above it, so these tests are mostly about *absence*: a missing plugin, a
 * browser with no filesystem, an Electron build without the file bridge. Each
 * has to degrade into a less capable player rather than a broken one, because
 * a signage device that throws at boot shows a black screen in an airport.
 */

const globals = globalThis as Record<string, unknown>

afterEach(() => {
  delete globals['Capacitor']
  delete globals['remote']
  delete globals['ipcRenderer']
  vi.restoreAllMocks()
})

function fakeCapacitor(platform: string, native = true, plugins: Record<string, unknown> = {}) {
  globals['Capacitor'] = {
    getPlatform: () => platform,
    isNativePlatform: () => native,
    Plugins: plugins,
  }
}

describe('detectPlatform', () => {
  it('reports the Capacitor platform when a native bridge is present', () => {
    fakeCapacitor('android')
    expect(detectPlatform()).toBe('android')

    fakeCapacitor('ios')
    expect(detectPlatform()).toBe('ios')
  })

  it('ignores a Capacitor bridge that is running in a browser', () => {
    fakeCapacitor('web', false)
    expect(detectPlatform()).toBe('web')
  })

  it('identifies Electron by its preload surface rather than the user agent', () => {
    globals['remote'] = { app: { getVersion: () => '3.13.5' } }
    expect(detectPlatform()).toBe('electron')
  })

  it('falls back to the browser platform', () => {
    expect(detectPlatform()).toBe('web')
  })

  it('prefers Capacitor over Electron when both look present', () => {
    // An Android build can carry a `process` polyfill; only Capacitor
    // installs a native bridge, so the bridge wins.
    fakeCapacitor('android')
    globals['remote'] = {}
    expect(detectPlatform()).toBe('android')
  })
})

describe('createPlatformServices', () => {
  it('builds the requested platform regardless of where it is running', () => {
    expect(createPlatformServices('web').kind).toBe('web')
  })

  it('exposes all six services plus the transport capabilities', () => {
    const platform = createPlatformServices('web')
    expect(platform.storage.name).toBeTruthy()
    expect(platform.network.name).toBe('web')
    expect(platform.files.name).toBe('web')
    expect(platform.media.name).toBe('web')
    expect(platform.notifications.name).toBe('web')
    expect(platform.device.name).toBe('web')
    expect(platform.parseXml).toBeTypeOf('function')
  })
})

describe('web platform degradation', () => {
  it('reports no local filesystem and streams media instead', async () => {
    const files = new WebFileService()
    expect(files.available).toBe(false)
    expect(await files.write('res/clip.mp4', 'https://cms/res/clip.mp4')).toBe('https://cms/res/clip.mp4')
    expect(await files.uriFor('res/clip.mp4')).toBeNull()
    expect(await files.list()).toEqual([])
  })

  it('offers no asset blob store when the platform cannot persist bytes', () => {
    expect(fileServiceBlobStore(new WebFileService())).toBeNull()
  })

  it('resolves media to the remote URL when nothing is cached', async () => {
    const platform = createWebPlatform()
    expect(await platform.media.resolve('res/a.png', 'https://cms/res/a.png')).toBe('https://cms/res/a.png')
  })

  it('parses XML into the same tree shape the xml-js parser produces', () => {
    const platform = createWebPlatform()
    const parsed = platform.parseXml?.('<Configuration id="7"><slot name="a"/></Configuration>') as {
      elements: Array<{ name: string; attributes: Record<string, string>; elements: Array<{ name: string }> }>
    }

    expect(parsed.elements[0]?.name).toBe('Configuration')
    expect(parsed.elements[0]?.attributes['id']).toBe('7')
    expect(parsed.elements[0]?.elements[0]?.name).toBe('slot')
  })
})

describe('Capacitor storage', () => {
  it('uses Preferences when the plugin is installed', async () => {
    const store = new Map<string, string>()
    fakeCapacitor('android', true, {
      Preferences: {
        get: async ({ key }: { key: string }) => ({ value: store.get(key) ?? null }),
        set: async ({ key, value }: { key: string; value: string }) => void store.set(key, value),
        remove: async ({ key }: { key: string }) => void store.delete(key),
        keys: async () => ({ keys: [...store.keys()] }),
      },
    })

    const storage = CapacitorStorageService.create()
    expect(storage.name).toBe('capacitor-preferences')

    await storage.setItem('cless:doc', '{"a":1}')
    expect(await storage.getItem('cless:doc')).toBe('{"a":1}')
    expect(await storage.keys()).toEqual(['cless:doc'])
  })

  it('falls back to memory rather than throwing when the plugin is absent', async () => {
    fakeCapacitor('android', true, {})
    const storage = CapacitorStorageService.create()
    expect(storage.name).toBe('memory')
    await storage.setItem('k', 'v')
    expect(await storage.getItem('k')).toBe('v')
  })
})

describe('createHostFromPlatform', () => {
  it('maps platform services onto the capabilities the runtime asks for', () => {
    const platform = createWebPlatform()
    const host = createHostFromPlatform(platform)

    expect(host.platform).toBe(platform)
    expect(host.storage).toBe(platform.storage)
    expect(host.parseXml).toBeTypeOf('function')
    // The browser cannot persist bytes, so the runtime is told there is no
    // blob store rather than being handed one that silently does nothing.
    expect(host.assetBlobStore).toBeUndefined()
    expect(host.realtimeSocket).toBeUndefined()
  })

  it('derives device identity from the platform, whatever the platform knows', async () => {
    const platform = createWebPlatform()
    const identity = await createHostFromPlatform(platform).identitySource?.read()

    // A browser knows no MAC address and no serial; the shape is still the
    // one the status report expects.
    expect(identity).toMatchObject({ serial: null, macAddress: null })
  })
})
