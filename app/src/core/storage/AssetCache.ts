import type { AssetDefinition } from '../schema'
import { Logger, MediaUtils, NetworkUtils } from '../utils'
import type { StorageDriver } from './StorageDriver'

const logger = Logger.forScope('asset-cache')

export interface AssetRecord {
  readonly path: string
  readonly version: string
  readonly cachedAt: number
  /** Local URL when the host could persist bytes, else the remote URL. */
  readonly localUrl: string | null
}

export interface AssetSyncSummary {
  readonly total: number
  readonly downloaded: number
  readonly reused: number
  readonly failed: number
}

/**
 * Backend that can actually persist asset bytes.
 *
 * In Electron this is the existing on-disk media folder (reached through the
 * preload bridge) and in Capacitor it is the Filesystem plugin. Neither is
 * available in a plain browser, so the interface is optional: without it the
 * cache still performs version bookkeeping and the renderer streams assets
 * from the server, which is the correct degraded behaviour.
 */
export interface AssetBlobStore {
  readonly name: string
  has(path: string, version: string): Promise<boolean>
  /** Persists the asset and returns a URL the renderer can load. */
  put(path: string, version: string, url: string): Promise<string>
  resolve(path: string, version: string): Promise<string | null>
  remove(path: string): Promise<void>
}

/**
 * Tracks asset versions and, where the host supports it, their local copies.
 *
 * This is the class that implements "avoid re-downloading large media": the
 * version token from the layout's asset manifest is compared against the
 * recorded one, and unchanged assets are skipped entirely. Version bookkeeping
 * is kept separate from byte storage so the comparison logic is testable and
 * host-independent.
 */
export class AssetCache {
  private static readonly PREFIX = 'cless:asset:'

  constructor(
    private readonly driver: StorageDriver,
    private readonly blobStore: AssetBlobStore | null = null,
  ) {}

  private key(path: string): string {
    return `${AssetCache.PREFIX}${path}`
  }

  async record(path: string): Promise<AssetRecord | null> {
    const raw = await this.driver.getItem(this.key(path))
    if (!raw) return null
    try {
      return JSON.parse(raw) as AssetRecord
    } catch {
      return null
    }
  }

  /** True when the cached copy matches `version` and its bytes still exist. */
  async isFresh(asset: AssetDefinition): Promise<boolean> {
    const record = await this.record(asset.path)
    if (!record || record.version !== asset.version) return false
    if (!this.blobStore) return true
    return this.blobStore.has(asset.path, asset.version)
  }

  /** URL the renderer should load: the local copy when present, else remote. */
  async resolveUrl(path: string, mediaBaseUrl: string): Promise<string> {
    const remote = MediaUtils.joinUrl(mediaBaseUrl, path)
    if (!this.blobStore) return remote

    const record = await this.record(path)
    if (!record) return remote
    const local = await this.blobStore.resolve(path, record.version)
    return local ?? remote
  }

  /**
   * Brings the cache in line with a layout's asset manifest.
   *
   * Runs in the background after a layout is already playing, so a slow or
   * partial download never blocks playback. Individual failures are counted
   * and retried on the next sync rather than aborting the batch.
   */
  async synchronize(assets: readonly AssetDefinition[], mediaBaseUrl: string): Promise<AssetSyncSummary> {
    let downloaded = 0
    let reused = 0
    let failed = 0

    for (const asset of assets) {
      try {
        if (await this.isFresh(asset)) {
          reused += 1
          continue
        }

        const remote = MediaUtils.joinUrl(mediaBaseUrl, asset.path)
        let localUrl: string | null = null
        if (this.blobStore) {
          localUrl = await this.blobStore.put(asset.path, asset.version, remote)
        }

        await this.writeRecord({
          path: asset.path,
          version: asset.version,
          cachedAt: Date.now(),
          localUrl,
        })
        downloaded += 1
      } catch (error) {
        failed += 1
        logger.warn(`Asset sync failed for ${asset.path}`, error)
      }
    }

    return { total: assets.length, downloaded, reused, failed }
  }

  /** Drops records (and bytes) for assets no longer referenced by any layout. */
  async prune(keepPaths: readonly string[]): Promise<number> {
    const keep = new Set(keepPaths)
    const keys = await this.driver.keys()
    let removed = 0

    for (const key of keys) {
      if (!key.startsWith(AssetCache.PREFIX)) continue
      const path = key.slice(AssetCache.PREFIX.length)
      if (keep.has(path)) continue

      await this.driver.removeItem(key)
      await this.blobStore?.remove(path).catch(() => undefined)
      removed += 1
    }
    return removed
  }

  /** Assets in the manifest that still need fetching. */
  async pendingAssets(assets: readonly AssetDefinition[]): Promise<readonly AssetDefinition[]> {
    const pending: AssetDefinition[] = []
    for (const asset of assets) {
      if (!(await this.isFresh(asset))) pending.push(asset)
    }
    return pending
  }

  get backendName(): string {
    return this.blobStore?.name ?? 'metadata-only'
  }

  static remoteUrlFor(asset: AssetDefinition, mediaBaseUrl: string): string {
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(asset.path)) return asset.path
    return NetworkUtils.joinUrl(mediaBaseUrl, asset.path)
  }

  private async writeRecord(record: AssetRecord): Promise<void> {
    await this.driver.setItem(this.key(record.path), JSON.stringify(record))
  }
}
