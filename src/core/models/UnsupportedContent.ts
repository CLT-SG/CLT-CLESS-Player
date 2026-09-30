import { BaseContent } from './BaseContent'
import type { ContentSlotDefinition } from '@core/layouts/schema'

/**
 * Fallback for a content type this player build does not know.
 *
 * Its existence is what makes the schema forward compatible: a server can
 * introduce a new slot type and older players will keep playing the rest of
 * the layout, showing a diagnostic placeholder (or nothing in production)
 * instead of failing to render the layout at all.
 */
export class UnsupportedContent extends BaseContent {
  constructor(definition: ContentSlotDefinition, private readonly declaredType: string) {
    super(definition)
  }

  override get type(): string {
    return this.declaredType
  }

  get reason(): string {
    return `No renderer registered for content type "${this.declaredType}"`
  }
}
