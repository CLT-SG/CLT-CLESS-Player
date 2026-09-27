/**
 * Colour helpers. Replaces the `hexToRgbA` copies that existed in
 * `layoutxml.js` and `slot-table.js` with one implementation that does not
 * throw on bad input (a malformed colour must not stop a layout from playing).
 */
export abstract class ColorUtils {
  private static readonly HEX_PATTERN = /^#?([a-f\d]{3}|[a-f\d]{6})$/i

  static normalizeHex(value: string | null | undefined, fallback = '#000000'): string {
    if (!value) return fallback
    const trimmed = value.trim()
    const match = ColorUtils.HEX_PATTERN.exec(trimmed)
    if (!match) return ColorUtils.isCssColor(trimmed) ? trimmed : fallback

    const digits = match[1]!
    const expanded =
      digits.length === 3
        ? digits
            .split('')
            .map((char) => char + char)
            .join('')
        : digits
    return `#${expanded.toLowerCase()}`
  }

  /** Accepts named colours and functional notations that CSS understands. */
  private static isCssColor(value: string): boolean {
    return /^(transparent|none|rgb|rgba|hsl|hsla|[a-z]+)$/i.test(value) || value.startsWith('rgb')
  }

  static toRgba(value: string | null | undefined, alpha: number): string {
    const hex = ColorUtils.normalizeHex(value)
    if (!hex.startsWith('#')) return hex

    const numeric = Number.parseInt(hex.slice(1), 16)
    const r = (numeric >> 16) & 255
    const g = (numeric >> 8) & 255
    const b = numeric & 255
    const clamped = Math.min(1, Math.max(0, alpha))
    return `rgba(${r},${g},${b},${clamped})`
  }

  /**
   * The XML transparency attribute is a three-level enum rather than a number.
   * `high` means fully see-through, matching the legacy behaviour.
   */
  static transparencyToAlpha(level: string | null | undefined): number {
    switch ((level ?? '').toLowerCase()) {
      case 'high':
        return 0
      case 'medium':
        return 0.5
      default:
        return 1
    }
  }
}
