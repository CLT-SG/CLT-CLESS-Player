import { BaseContent } from './BaseContent'
import type { ContentSlotDefinition } from '../schema'
import { ColorUtils, FormatUtils, LayoutMath } from '../utils'
import type { TextTypography } from './TextContent'

export type TickerAxis = 'horizontal' | 'vertical'
export type TickerDirection = 'left' | 'right' | 'up' | 'down'

/**
 * Continuously moving text: the `ticker` (horizontal) and `scroller`
 * (vertical) slot types.
 *
 * The legacy implementation delegated to jQuery.Marquee and translated the
 * server's 1..5 speed enum into plugin options in two places. Here the enum is
 * converted once into a CSS animation duration, which lets the renderer use a
 * plain keyframe animation and drop the jQuery dependency.
 */
export class TickerContent extends BaseContent {
  constructor(definition: ContentSlotDefinition, private readonly axis: TickerAxis) {
    super(definition)
  }

  override get type(): string {
    return this.axis === 'horizontal' ? 'ticker' : 'scroller'
  }

  get orientation(): TickerAxis {
    return this.axis
  }

  get direction(): TickerDirection {
    const raw = this.configString('direction').toLowerCase()
    if (this.axis === 'horizontal') {
      return raw === 'lefttoright' ? 'right' : 'left'
    }
    return raw === 'scrolldown' ? 'down' : 'up'
  }

  /** Server speed enum, 1 (slowest) .. 5 (fastest). */
  get speedLevel(): number {
    return LayoutMath.clamp(this.configNumber('speed', 3), 1, 5)
  }

  /**
   * Seconds for one full pass. Level 5 is the fastest, so the duration is
   * inverted; the range (40s down to 8s) reproduces the legacy marquee feel.
   */
  get animationDurationSeconds(): number {
    return 48 - this.speedLevel * 8
  }

  get antialias(): boolean {
    return this.configBoolean('antialias', true)
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

  /** All enabled items joined into the single string the marquee scrolls. */
  get message(): string {
    return this.items
      .map((item) => item.text)
      .filter(Boolean)
      .join('   •   ')
  }
}
