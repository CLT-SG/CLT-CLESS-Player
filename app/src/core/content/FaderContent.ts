import { BaseContent } from './BaseContent'
import type { ContentSlotDefinition } from '../schema'
import { ColorUtils, FormatUtils, LayoutMath } from '../utils'
import type { TextTypography } from './TextContent'

/**
 * Text that cross-fades between pages (the `fader` slot type).
 *
 * Unlike `TextContent`, the dwell time is a slot-level property rather than
 * per item, matching the server model where the fader exposes a single speed.
 */
export class FaderContent extends BaseContent {
  constructor(definition: ContentSlotDefinition) {
    super(definition)
  }

  override get type(): string {
    return 'fader'
  }

  get speedLevel(): number {
    return LayoutMath.clamp(this.configNumber('speed', 3), 1, 5)
  }

  /** How long each page is fully visible. */
  get dwellMs(): number {
    const item = this.currentItem
    if (item && item.durationMs > 0) return item.durationMs
    return 12_000 - this.speedLevel * 1_500
  }

  /** Cross-fade length; capped so it can never exceed the dwell time. */
  get fadeMs(): number {
    return Math.min(2_000, Math.max(200, this.dwellMs / 4))
  }

  get typography(): TextTypography {
    const styles = FormatUtils.fontStyles(this.configString('fontStyle'))
    return {
      fontFamily: this.configString('font', 'inherit') || 'inherit',
      fontSize: `${this.configNumber('fontSize', 32)}px`,
      color: ColorUtils.normalizeHex(this.configString('fontColor', '#ffffff'), '#ffffff'),
      textAlign: FormatUtils.textAlign(this.configString('align')),
      justifyContent: FormatUtils.verticalAlign(this.configString('valign')),
      ...styles,
    }
  }
}
