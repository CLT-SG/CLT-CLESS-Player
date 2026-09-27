import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ConnectivityMonitor, type FetchOutcome, type LayoutTransport } from '@core/transports'
import { SyncService } from '@core/services'
import { AssetCache, LayoutRepository, MemoryStorageDriver } from '@core/storage'
import { XmlLayoutAdapter } from '@core/transports/xml'
import { SCHEMA_VERSION } from '@core/layouts/schema/version'
import { layoutDocumentSchema, type LayoutDocument } from '@core/layouts/schema/layout'
import { DEFAULT_PLAYER_CONFIGURATION, type PlayerConfiguration } from '@core/types'
import { SINGLE_LAYOUT_XML, parseXmlForTests } from './fixtures/dsxml'

function makeDocument(revision: string): LayoutDocument {
  return layoutDocumentSchema.parse({
    schemaVersion: SCHEMA_VERSION,
    origin: 'json-api',
    etag: revision,
    mode: 'layout',
    layout: {
      id: '42',
      name: 'Terminal Main',
      revision,
      refreshInterval: 90,
      resolution: { width: 1920, height: 1080 },
      background: { color: '#000000' },
      mediaBaseUrl: 'https://cms.example.com/media/uploads',
      slots: [],
      assets: [{ path: '7/promo.mp4', version: revision }],
    },
  })
}

const configuration: PlayerConfiguration = {
  ...DEFAULT_PLAYER_CONFIGURATION,
  hostserver: 'https://cms.example.com/demo',
  displayId: '5',
}

/** Transport stub that returns a scripted sequence of outcomes. */
function stubTransport(outcomes: FetchOutcome[]): LayoutTransport {
  let index = 0
  return {
    activeTransport: 'json',
    fetchDocument: vi.fn(async () => outcomes[Math.min(index++, outcomes.length - 1)]!),
  } as unknown as LayoutTransport
}

function makeService(outcomes: FetchOutcome[], overrides: Partial<PlayerConfiguration> = {}) {
  const driver = new MemoryStorageDriver()
  const repository = new LayoutRepository(driver)
  const assetCache = new AssetCache(driver)
  const connectivity = new ConnectivityMonitor()
  const service = new SyncService({
    transport: stubTransport(outcomes),
    repository,
    assetCache,
    connectivity,
    configuration: { ...configuration, ...overrides },
  })
  return { service, repository, assetCache, connectivity, driver }
}

describe('LayoutRepository', () => {
  let driver: MemoryStorageDriver
  let repository: LayoutRepository

  beforeEach(() => {
    driver = new MemoryStorageDriver()
    repository = new LayoutRepository(driver)
  })

  it('round-trips a document and marks it as cache-sourced on read', async () => {
    await repository.saveDocument('5', makeDocument('20260927101500'))
    const restored = await repository.loadDocument('5')

    expect(restored?.layout?.id).toBe('42')
    expect(restored?.origin).toBe('cache')
    expect(restored?.etag).toBe('20260927101500')
  })

  it('stores playlist members individually for direct lookup', async () => {
    await repository.saveDocument('5', makeDocument('rev-1'))
    const layout = await repository.loadLayout('42')

    expect(layout?.name).toBe('Terminal Main')
    expect(await repository.layoutRevision('42')).toBe('rev-1')
  })

  it('treats a corrupted entry as a miss and evicts it', async () => {
    await repository.saveDocument('5', makeDocument('rev-1'))
    await driver.setItem('cless:doc:5', '{not json')

    expect(await repository.loadDocument('5')).toBeNull()
    expect(await driver.getItem('cless:doc:5')).toBeNull()
  })

  it('evicts an entry whose payload no longer matches the schema', async () => {
    await driver.setItem(
      'cless:doc:5',
      JSON.stringify({ revision: 'x', storedAt: 1, payload: { schemaVersion: '99.0', mode: 'layout' } }),
    )

    expect(await repository.loadDocument('5')).toBeNull()
  })

  it('remembers the active layout so a restart resumes in place', async () => {
    await repository.setActiveLayoutId('43')
    expect(await repository.getActiveLayoutId()).toBe('43')

    await repository.setActiveLayoutId(null)
    expect(await repository.getActiveLayoutId()).toBeNull()
  })

  it('prunes cached layouts that are no longer referenced', async () => {
    await repository.saveLayout(makeDocument('a').layout!)
    await repository.saveLayout({ ...makeDocument('b').layout!, id: '99' })

    expect(await repository.prune(['42'])).toBe(1)
    expect(await repository.loadLayout('42')).not.toBeNull()
    expect(await repository.loadLayout('99')).toBeNull()
  })

  it('reads the cache written by the previous renderer', async () => {
    // The legacy player stored the parsed ds.xml under the bare display id.
    const legacy = parseXmlForTests(SINGLE_LAYOUT_XML)
    await driver.setItem('5', JSON.stringify(legacy))

    const adopted = await repository.readLegacyDocument('5')
    expect(adopted).not.toBeNull()

    const adapter = new XmlLayoutAdapter({ serverBaseUrl: configuration.hostserver, displayId: '5' })
    expect(adapter.adaptDocument(adopted).layout?.id).toBe('42')
  })

  it('falls back to the legacy offline layout key', async () => {
    await driver.setItem('layout-offline-42', JSON.stringify({ elements: [] }))
    expect(await repository.readLegacyLayout('42')).toEqual({ elements: [] })
  })
})

describe('SyncService offline resilience', () => {
  it('reports an update and caches the document', async () => {
    const document = makeDocument('rev-1')
    const { service, repository } = makeService([
      { status: 'updated', document, etag: 'rev-1', transport: 'json' },
    ])

    const result = await service.syncNow()

    expect(result.outcome).toBe('updated')
    expect(await repository.documentRevision('5')).toBe('rev-1')
  })

  it('keeps the cached layout when the server becomes unreachable', async () => {
    const document = makeDocument('rev-1')
    const { service, repository, connectivity } = makeService([
      { status: 'updated', document, etag: 'rev-1', transport: 'json' },
      { status: 'unreachable', message: 'ECONNREFUSED' },
    ])

    await service.syncNow()
    const failure = await service.syncNow()

    expect(failure.outcome).toBe('error')
    expect(failure.document).toBeNull()
    // The cache is the offline guarantee: a failed poll must never clear it.
    expect(await repository.loadDocument('5')).not.toBeNull()
    expect(connectivity.state).toBe('degraded')
  })

  it('keeps the cached layout when the server returns an invalid payload', async () => {
    const { service, repository, connectivity } = makeService([
      { status: 'updated', document: makeDocument('rev-1'), etag: 'rev-1', transport: 'json' },
      { status: 'invalid', message: 'layout: Required', transport: 'json' },
    ])

    await service.syncNow()
    const result = await service.syncNow()

    expect(result.outcome).toBe('invalid')
    expect(await repository.loadDocument('5')).not.toBeNull()
    // The server answered, so connectivity is healthy even though the payload
    // was rejected.
    expect(connectivity.state).toBe('online')
  })

  it('treats an unchanged layout as a cheap no-op', async () => {
    const { service } = makeService([{ status: 'not-modified', transport: 'json' }])
    const result = await service.syncNow()

    expect(result.outcome).toBe('unchanged')
    expect(result.document).toBeNull()
  })

  it('restores the cached document without any network access', async () => {
    const { service, repository } = makeService([{ status: 'unreachable', message: 'offline' }])
    await repository.saveDocument('5', makeDocument('rev-cached'))

    const restored = await service.restoreFromCache()

    expect(restored?.etag).toBe('rev-cached')
    expect(restored?.origin).toBe('cache')
  })

  it('never polls when the player is configured for offline mode', async () => {
    const { service, connectivity } = makeService([], { mode: 'offline' })
    service.start()

    const result = await service.syncNow()
    expect(result.outcome).toBe('offline')
    expect(connectivity.state).toBe('offline')
    service.stop()
  })

  it('backs off further on each consecutive failure', async () => {
    const { service } = makeService([{ status: 'unreachable', message: 'timeout' }])

    await service.syncNow()
    const firstBackoff = service.nextPollSeconds
    await service.syncNow()
    const secondBackoff = service.nextPollSeconds

    expect(firstBackoff).toBeGreaterThan(0)
    expect(secondBackoff).toBeGreaterThanOrEqual(firstBackoff)
  })

  it('adopts the server refresh interval after a successful sync', async () => {
    const { service } = makeService([
      { status: 'updated', document: makeDocument('rev-1'), etag: 'rev-1', transport: 'json' },
    ])

    await service.syncNow()
    expect(service.nextPollSeconds).toBe(90)
  })

  it('coalesces concurrent sync requests into one round trip', async () => {
    const { service } = makeService([
      { status: 'updated', document: makeDocument('rev-1'), etag: 'rev-1', transport: 'json' },
    ])

    const [first, second] = await Promise.all([service.syncNow(), service.syncNow()])
    expect(first).toBe(second)
  })
})

describe('AssetCache', () => {
  it('skips assets whose version has not changed', async () => {
    const driver = new MemoryStorageDriver()
    const cache = new AssetCache(driver)
    const assets = [{ path: '7/promo.mp4', version: 'v1', sizeBytes: null, mimeType: null }]

    const first = await cache.synchronize(assets, 'https://cms.example.com/media/uploads')
    const second = await cache.synchronize(assets, 'https://cms.example.com/media/uploads')

    expect(first.downloaded).toBe(1)
    expect(second.downloaded).toBe(0)
    expect(second.reused).toBe(1)
  })

  it('re-fetches an asset when its version token changes', async () => {
    const driver = new MemoryStorageDriver()
    const cache = new AssetCache(driver)
    const base = 'https://cms.example.com/media/uploads'

    await cache.synchronize([{ path: 'a.jpg', version: 'v1', sizeBytes: null, mimeType: null }], base)
    const second = await cache.synchronize(
      [{ path: 'a.jpg', version: 'v2', sizeBytes: null, mimeType: null }],
      base,
    )

    expect(second.downloaded).toBe(1)
  })

  it('reports which assets still need fetching', async () => {
    const cache = new AssetCache(new MemoryStorageDriver())
    const assets = [
      { path: 'a.jpg', version: 'v1', sizeBytes: null, mimeType: null },
      { path: 'b.jpg', version: 'v1', sizeBytes: null, mimeType: null },
    ]

    expect(await cache.pendingAssets(assets)).toHaveLength(2)
    await cache.synchronize([assets[0]!], 'https://host/media')
    expect(await cache.pendingAssets(assets)).toHaveLength(1)
  })

  it('prunes records for assets no longer referenced', async () => {
    const cache = new AssetCache(new MemoryStorageDriver())
    await cache.synchronize(
      [
        { path: 'a.jpg', version: 'v1', sizeBytes: null, mimeType: null },
        { path: 'b.jpg', version: 'v1', sizeBytes: null, mimeType: null },
      ],
      'https://host/media',
    )

    expect(await cache.prune(['a.jpg'])).toBe(1)
    expect(await cache.record('b.jpg')).toBeNull()
  })
})

describe('ConnectivityMonitor', () => {
  it('absorbs isolated failures as degraded before declaring offline', () => {
    const monitor = new ConnectivityMonitor({ offlineThreshold: 3 })

    monitor.reportFailure('timeout')
    expect(monitor.state).toBe('degraded')
    monitor.reportFailure('timeout')
    expect(monitor.state).toBe('degraded')
    monitor.reportFailure('timeout')
    expect(monitor.state).toBe('offline')
  })

  it('recovers immediately on the first success', () => {
    const monitor = new ConnectivityMonitor({ offlineThreshold: 1 })
    monitor.reportFailure('down')
    expect(monitor.state).toBe('offline')

    monitor.reportSuccess()
    expect(monitor.state).toBe('online')
    expect(monitor.failureStreak).toBe(0)
  })

  it('notifies listeners only on an actual state change', () => {
    const monitor = new ConnectivityMonitor({ offlineThreshold: 1 })
    const listener = vi.fn()
    monitor.onChange(listener)

    monitor.reportSuccess()
    monitor.reportFailure('a')
    monitor.reportFailure('b')

    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener).toHaveBeenCalledWith('offline', 'online')
  })

  it('keeps the server considered reachable while degraded', () => {
    const monitor = new ConnectivityMonitor({ offlineThreshold: 5 })
    monitor.reportFailure('blip')
    expect(monitor.isServerReachable).toBe(true)
  })
})
