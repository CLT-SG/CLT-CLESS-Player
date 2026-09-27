import { BaseContent, type ContentItem } from './BaseContent'
import type { ContentSlotDefinition } from '../schema'
import { MediaUtils, type ParsedMediaSource } from '../utils'

export interface ResolvedMediaItem extends ParsedMediaSource {
  readonly itemId: string
  readonly durationMs: number
  readonly endsNaturally: boolean
  readonly muted: boolean
}

/**
 * Image / video / stream playlist inside a single slot.
 *
 * Media references are resolved once here, at construction, rather than each
 * time the renderer paints. That is what makes the renderer component free of
 * URL and protocol logic.
 */
export class MediaContent extends BaseContent {
  private readonly resolved: ResolvedMediaItem[]

  constructor(definition: ContentSlotDefinition, private readonly mediaBaseUrl: string) {
    super(definition)
    this.resolved = this.items.map((item) => this.resolveItem(item))
  }

  override get type(): string {
    return 'media'
  }

  get sources(): readonly ResolvedMediaItem[] {
    return this.resolved
  }

  get currentSource(): ResolvedMediaItem | null {
    return this.resolved[this.currentIndex] ?? null
  }

  /** Slot-level mute. Defaults to muted: signage audio is opt-in. */
  get muted(): boolean {
    return this.configBoolean('muted', true)
  }

  get objectFit(): 'cover' | 'contain' | 'fill' {
    const value = this.configString('fit', 'contain')
    return value === 'cover' || value === 'fill' ? value : 'contain'
  }

  /** Only meaningful in multi-screen deployments; see `syncMasterIp`. */
  get syncEnabled(): boolean {
    return this.configBoolean('videoSync', false)
  }

  private resolveItem(item: ContentItem): ResolvedMediaItem {
    const parsed = MediaUtils.parse(item.text, this.mediaBaseUrl)
    return {
      ...parsed,
      itemId: item.id,
      durationMs: item.durationMs,
      // A still image with no duration would otherwise never advance, so it
      // falls back to the conventional 10 second dwell.
      endsNaturally: item.endsNaturally && parsed.kind !== 'image',
      muted: item.booleanField('muted', this.muted),
    }
  }

  /** Effective dwell time, accounting for images that declare no duration. */
  dwellMsFor(index: number): number {
    const source = this.resolved[index]
    if (!source) return 0
    if (source.durationMs > 0) return source.durationMs
    return source.kind === 'image' ? 10_000 : 0
  }
}
