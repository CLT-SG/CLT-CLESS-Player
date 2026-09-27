import { BaseContent } from './BaseContent'
import type { ContentSlotDefinition } from '../schema'
import { ColorUtils, FormatUtils } from '../utils'

export interface TextTypography {
  readonly fontFamily: string
  readonly fontSize: string
  readonly color: string
  readonly textAlign: 'left' | 'center' | 'right' | 'justify'
  readonly justifyContent: 'flex-start' | 'center' | 'flex-end'
  readonly fontWeight: 'bold' | 'normal'
  readonly fontStyle: 'italic' | 'normal'
  readonly textDecoration: 'underline' | 'none'
}

/**
 * Static or rotating text pages.
 *
 * Also the base for the ticker/scroller/fader types in terms of typography:
 * they share the same styling attributes, so the resolution lives here and is
 * reused via composition (`typography`) rather than inheritance.
 */
export class TextContent extends BaseContent {
  constructor(definition: ContentSlotDefinition) {
    super(definition)
  }

  override get type(): string {
    return 'text'
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

  /** Server content may embed markup, so renderers treat it as trusted HTML. */
  get currentHtml(): string {
    return this.currentItem?.text ?? ''
  }

  get currentDwellMs(): number {
    const item = this.currentItem
    if (!item) return 0
    return item.durationMs > 0 ? item.durationMs : 0
  }
}
