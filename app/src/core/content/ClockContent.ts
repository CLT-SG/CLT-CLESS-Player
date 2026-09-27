import { BaseContent } from './BaseContent'
import type { ContentSlotDefinition } from '../schema'
import { ColorUtils, DateUtils, FormatUtils } from '../utils'
import type { TextTypography } from './TextContent'

export type ClockKind = 'date' | 'time' | 'datetime'

/**
 * The `date`, `time` and `datetime` slot types.
 *
 * All three differ only in which server format attribute they read, so they
 * share one class parameterised by `kind` instead of three near-identical
 * ones. This is the case the brief calls out: reuse without a deep hierarchy.
 */
export class ClockContent extends BaseContent {
  constructor(definition: ContentSlotDefinition, private readonly kind: ClockKind) {
    super(definition)
  }

  override get type(): string {
    return this.kind
  }

  private get defaultPattern(): string {
    switch (this.kind) {
      case 'date':
        return 'dd/mm/yyyy'
      case 'time':
        return 'hh:nn:ss'
      default:
        return 'YYYY-MM-DD hh:nn:ss'
    }
  }

  get pattern(): string {
    return this.configString('format', this.defaultPattern) || this.defaultPattern
  }

  /** A date-only slot does not need a per-second tick. */
  get tickIntervalMs(): number {
    return this.kind === 'date' ? 30_000 : 1_000
  }

  render(now: Date): string {
    return DateUtils.format(now, this.pattern)
  }

  get typography(): TextTypography {
    const styles = FormatUtils.fontStyles(this.configString('fontStyle'))
    return {
      fontFamily: this.configString('font', 'inherit') || 'inherit',
      fontSize: `${this.configNumber('fontSize', 48)}px`,
      color: ColorUtils.normalizeHex(this.configString('fontColor', '#ffffff'), '#ffffff'),
      textAlign: FormatUtils.textAlign(this.configString('align')),
      justifyContent: FormatUtils.verticalAlign(this.configString('valign')),
      ...styles,
    }
  }
}
