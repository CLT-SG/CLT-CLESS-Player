import { BaseContent } from './BaseContent'
import type { ContentSlotDefinition } from '@core/layouts/schema'
import { NetworkUtils, ValidationUtils } from '@core/utilities'

export type EmbedKind = 'html' | 'widget'

export interface EmbedTarget {
  readonly itemId: string
  readonly url: string
  readonly dwellMs: number
  /** Seconds between forced reloads; `0` disables refreshing. */
  readonly refreshSeconds: number
  readonly allowOffline: boolean
  readonly label: string
}

/**
 * Externally rendered content shown in a webview/iframe: the `html` slot and
 * server-side `widget` slots.
 *
 * Both are URL rotations with a schedule and an offline fallback, so they
 * share one class. Widgets additionally carry a cached-data payload, exposed
 * through `cachedData`, which is what keeps them alive when the server is
 * unreachable.
 */
export class EmbedContent extends BaseContent {
  private readonly targets: EmbedTarget[]

  constructor(definition: ContentSlotDefinition, private readonly kind: EmbedKind, serverOrigin: string) {
    super(definition)
    this.targets = this.items.map((item) => {
      const rawUrl = item.stringField('url', item.text)
      return {
        itemId: item.id,
        url: EmbedContent.absolutize(rawUrl, serverOrigin),
        dwellMs: item.durationMs,
        refreshSeconds: item.numberField('refresh', 0),
        allowOffline: item.booleanField('offline', false),
        label: item.stringField('name', item.stringField('widget', '')),
      }
    })
  }

  override get type(): string {
    return this.kind
  }

  get embedKind(): EmbedKind {
    return this.kind
  }

  get rotation(): readonly EmbedTarget[] {
    return this.targets
  }

  get currentTarget(): EmbedTarget | null {
    return this.targets[this.currentIndex] ?? null
  }

  /** Widget slots may accept input; HTML slots never do. */
  get interactive(): boolean {
    return this.kind === 'widget' && this.configBoolean('interactive', false)
  }

  /**
   * Last-known widget payload, kept so an offline-capable widget can render
   * from cache instead of showing an error frame.
   */
  get cachedData(): Record<string, unknown> | null {
    const value = this.rawConfig['cachedData']
    return ValidationUtils.isRecord(value) ? value : null
  }

  private static absolutize(url: string, serverOrigin: string): string {
    const trimmed = (url ?? '').trim()
    if (!trimmed) return ''
    if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return trimmed
    if (!serverOrigin) return trimmed
    return NetworkUtils.joinUrl(serverOrigin, trimmed)
  }
}
