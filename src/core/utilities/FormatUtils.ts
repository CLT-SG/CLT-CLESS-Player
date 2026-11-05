/**
 * Presentation formatting helpers shared by content renderers.
 */
export abstract class FormatUtils {
  private static readonly HTML_ESCAPES: Readonly<Record<string, string>> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }

  static escapeHtml(value: string): string {
    return value.replace(/[&<>"']/g, (char) => FormatUtils.HTML_ESCAPES[char] ?? char)
  }

  static bytes(value: number | null | undefined): string {
    if (value == null || !Number.isFinite(value)) return '—'
    const units = ['B', 'KB', 'MB', 'GB', 'TB']
    let size = Math.max(0, value)
    let unit = 0
    while (size >= 1024 && unit < units.length - 1) {
      size /= 1024
      unit += 1
    }
    return `${size.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`
  }

  static duration(seconds: number | null | undefined): string {
    if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return '0s'
    const total = Math.round(seconds)
    const hours = Math.floor(total / 3600)
    const minutes = Math.floor((total % 3600) / 60)
    const secs = total % 60
    if (hours > 0) return `${hours}h ${minutes}m`
    if (minutes > 0) return `${minutes}m ${secs}s`
    return `${secs}s`
  }

  static truncate(value: string, maxLength: number): string {
    if (value.length <= maxLength) return value
    return `${value.slice(0, Math.max(0, maxLength - 1))}…`
  }

  /**
   * Maps the server's alignment codes (`c`, `l`, `r` plus full words) to CSS
   * values. Unknown codes fall back to `left` so text is never invisible.
   */
  static textAlign(code: string | null | undefined): 'left' | 'center' | 'right' | 'justify' {
    switch ((code ?? '').trim().toLowerCase()) {
      case 'c':
      case 'center':
      case 'centre':
        return 'center'
      case 'r':
      case 'right':
        return 'right'
      case 'j':
      case 'justify':
        return 'justify'
      default:
        return 'left'
    }
  }

  static verticalAlign(code: string | null | undefined): 'flex-start' | 'center' | 'flex-end' {
    switch ((code ?? '').trim().toLowerCase()) {
      case 'middle':
      case 'center':
      case 'm':
        return 'center'
      case 'bottom':
      case 'b':
        return 'flex-end'
      default:
        return 'flex-start'
    }
  }

  /** Font styles arrive as a comma separated list (`bold,italic,underline`). */
  static fontStyles(value: string | null | undefined): {
    fontWeight: 'bold' | 'normal'
    fontStyle: 'italic' | 'normal'
    textDecoration: 'underline' | 'none'
  } {
    const styles = (value ?? '')
      .split(',')
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean)
    return {
      fontWeight: styles.includes('bold') ? 'bold' : 'normal',
      fontStyle: styles.includes('italic') ? 'italic' : 'normal',
      textDecoration: styles.includes('underline') ? 'underline' : 'none',
    }
  }
}
