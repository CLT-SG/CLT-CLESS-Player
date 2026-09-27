import { layoutDocumentSchema, layoutSchema, type LayoutDefinition, type LayoutDocument } from '@core/layouts/schema/layout'
import { Logger } from '@core/utilities'
import type { StorageDriver } from './StorageDriver'

const logger = Logger.forScope('layout-repo')

export interface CacheEntryMeta {
  readonly key: string
  readonly revision: string
  readonly storedAt: number
  readonly sizeBytes: number
}

interface CacheEnvelope<T> {
  readonly revision: string
  readonly storedAt: number
  readonly schemaVersion: string
  readonly payload: T
}

/**
 * Durable cache for layout documents and individual layouts.
 *
 * Offline playback is a hard requirement, so this class is the storage
 * contract that guarantees it: every successful sync writes here first, and
 * boot reads from here before any network call is attempted. The player can
 * therefore start and play with the server, the VPN and the internet all
 * unavailable, and it restores the exact layout it was showing before a
 * restart.
 *
 * Reads never throw. A corrupted or schema-incompatible entry is treated as a
 * miss and evicted, because falling back to "no cache" is always better than
 * refusing to boot.
 */
export class LayoutRepository {
  /** Legacy-compatible prefixes; see `legacyDocumentKey`. */
  private static readonly DOCUMENT_PREFIX = 'cless:doc:'
  private static readonly LAYOUT_PREFIX = 'cless:layout:'
  private static readonly ACTIVE_KEY = 'cless:active-layout-id'

  constructor(private readonly driver: StorageDriver) {}

  private documentKey(displayId: string): string {
    return `${LayoutRepository.DOCUMENT_PREFIX}${displayId}`
  }

  private layoutKey(layoutId: string): string {
    return `${LayoutRepository.LAYOUT_PREFIX}${layoutId}`
  }

  /**
   * Key the legacy player used for the display document (the raw display id).
   * Read-only: the modern cache never writes it, so rolling back to the old
   * renderer leaves its cache exactly as it was.
   */
  private static legacyDocumentKey(displayId: string): string {
    return displayId
  }

  async saveDocument(displayId: string, document: LayoutDocument): Promise<void> {
    await this.writeEnvelope(this.documentKey(displayId), document.etag || document.generatedAt, document)

    // Layouts are also stored individually so a playlist member can be read
    // back without deserialising (and revalidating) the whole document.
    const layouts = document.mode === 'playlist' ? document.layouts : document.layout ? [document.layout] : []
    await Promise.all(layouts.map((layout) => this.saveLayout(layout)))
  }

  async loadDocument(displayId: string): Promise<LayoutDocument | null> {
    const key = this.documentKey(displayId)
    const envelope = await this.readEnvelope<unknown>(key)
    if (!envelope) return null

    const parsed = layoutDocumentSchema.safeParse(envelope.payload)
    if (!parsed.success) {
      logger.warn(`Evicting unreadable cached document for display ${displayId}`)
      await this.driver.removeItem(key)
      return null
    }
    return { ...parsed.data, origin: 'cache' }
  }

  async saveLayout(layout: LayoutDefinition): Promise<void> {
    await this.writeEnvelope(this.layoutKey(layout.id), layout.revision, layout)
  }

  async loadLayout(layoutId: string): Promise<LayoutDefinition | null> {
    const key = this.layoutKey(layoutId)
    const envelope = await this.readEnvelope<unknown>(key)
    if (!envelope) return null

    const parsed = layoutSchema.safeParse(envelope.payload)
    if (!parsed.success) {
      logger.warn(`Evicting unreadable cached layout ${layoutId}`)
      await this.driver.removeItem(key)
      return null
    }
    return parsed.data
  }

  /** Cached revision for a layout, used to skip redundant downloads. */
  async layoutRevision(layoutId: string): Promise<string | null> {
    const envelope = await this.readEnvelope<unknown>(this.layoutKey(layoutId))
    return envelope?.revision ?? null
  }

  async documentRevision(displayId: string): Promise<string | null> {
    const envelope = await this.readEnvelope<unknown>(this.documentKey(displayId))
    return envelope?.revision ?? null
  }

  /**
   * Remembers which layout was on screen so a restart resumes there instead of
   * restarting the playlist from the beginning.
   */
  async setActiveLayoutId(layoutId: string | null): Promise<void> {
    if (layoutId == null) {
      await this.driver.removeItem(LayoutRepository.ACTIVE_KEY)
      return
    }
    await this.driver.setItem(LayoutRepository.ACTIVE_KEY, layoutId)
  }

  async getActiveLayoutId(): Promise<string | null> {
    return this.driver.getItem(LayoutRepository.ACTIVE_KEY)
  }

  /**
   * Reads the cache written by the pre-migration renderer.
   *
   * Used once at boot when the modern cache is empty, so an upgraded player is
   * never left without offline content. The caller is responsible for running
   * the result through the XML adapter.
   */
  async readLegacyDocument(displayId: string): Promise<unknown | null> {
    const raw = await this.driver.getItem(LayoutRepository.legacyDocumentKey(displayId))
    if (!raw) return null
    try {
      return JSON.parse(raw)
    } catch {
      return null
    }
  }

  /**
   * Layout the pre-migration renderer had on screen.
   *
   * Adopted at boot so upgrading a device does not restart its playlist.
   */
  async readLegacyActiveLayoutId(): Promise<string | null> {
    const raw = await this.driver.getItem('currentPlayLayoutID')
    return raw ? raw.replace(/^"|"$/g, '') : null
  }

  /** Reads a legacy `layout-<id>` entry, in the same spirit as above. */
  async readLegacyLayout(layoutId: string): Promise<unknown | null> {
    const raw =
      (await this.driver.getItem(`layout-${layoutId}`)) ??
      (await this.driver.getItem(`layout-offline-${layoutId}`))
    if (!raw) return null
    try {
      return JSON.parse(raw)
    } catch {
      return null
    }
  }

  async inventory(): Promise<readonly CacheEntryMeta[]> {
    const keys = await this.driver.keys()
    const owned = keys.filter(
      (key) => key.startsWith(LayoutRepository.DOCUMENT_PREFIX) || key.startsWith(LayoutRepository.LAYOUT_PREFIX),
    )

    const entries: CacheEntryMeta[] = []
    for (const key of owned) {
      const raw = await this.driver.getItem(key)
      if (!raw) continue
      const envelope = LayoutRepository.parseEnvelope<unknown>(raw)
      entries.push({
        key,
        revision: envelope?.revision ?? '',
        storedAt: envelope?.storedAt ?? 0,
        sizeBytes: raw.length * 2,
      })
    }
    return entries
  }

  /** Removes cached layouts that are not referenced by `keepLayoutIds`. */
  async prune(keepLayoutIds: readonly string[]): Promise<number> {
    const keep = new Set(keepLayoutIds.map((id) => this.layoutKey(id)))
    const keys = await this.driver.keys()
    let removed = 0
    for (const key of keys) {
      if (!key.startsWith(LayoutRepository.LAYOUT_PREFIX) || keep.has(key)) continue
      await this.driver.removeItem(key)
      removed += 1
    }
    return removed
  }

  private async writeEnvelope<T>(key: string, revision: string, payload: T): Promise<void> {
    const envelope: CacheEnvelope<T> = {
      revision,
      storedAt: Date.now(),
      schemaVersion: layoutDocumentSchema.description ?? '1',
      payload,
    }
    try {
      await this.driver.setItem(key, JSON.stringify(envelope))
    } catch (error) {
      // Storage quota is the realistic failure here. Losing a cache write is
      // recoverable; throwing out of a sync tick is not.
      logger.error(`Failed to cache ${key}`, error)
    }
  }

  /**
   * Reads an envelope, evicting it when the stored text is not parseable.
   *
   * Eviction matters here: a truncated write (the usual outcome of hitting the
   * storage quota) would otherwise be re-read and rejected on every boot,
   * leaving the slot permanently unusable for a fresh cache write.
   */
  private async readEnvelope<T>(key: string): Promise<CacheEnvelope<T> | null> {
    const raw = await this.driver.getItem(key)
    if (!raw) return null

    const envelope = LayoutRepository.parseEnvelope<T>(raw)
    if (!envelope) {
      logger.warn(`Evicting unparseable cache entry ${key}`)
      await this.driver.removeItem(key)
    }
    return envelope
  }

  private static parseEnvelope<T>(raw: string): CacheEnvelope<T> | null {
    try {
      const parsed = JSON.parse(raw) as CacheEnvelope<T>
      if (typeof parsed !== 'object' || parsed === null || !('payload' in parsed)) return null
      return parsed
    } catch {
      return null
    }
  }
}
