/**
 * Coercion helpers for untrusted payloads.
 *
 * Both transports hand us loosely typed data: XML attributes are always
 * strings (`"Y"`, `"1920"`, `""`) and JSON from an older server may omit
 * fields entirely. These helpers give every adapter one set of total functions
 * so no call site has to invent its own `parseInt || 0` fallback.
 */
export abstract class ValidationUtils {
  static isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
  }

  static toStringValue(value: unknown, fallback = ''): string {
    if (typeof value === 'string') return value
    if (typeof value === 'number' && Number.isFinite(value)) return String(value)
    if (typeof value === 'boolean') return value ? 'Y' : 'N'
    return fallback
  }

  static toNumber(value: unknown, fallback = 0): number {
    if (typeof value === 'number') return Number.isFinite(value) ? value : fallback
    if (typeof value === 'string') {
      const parsed = Number.parseFloat(value.trim())
      return Number.isFinite(parsed) ? parsed : fallback
    }
    return fallback
  }

  static toInteger(value: unknown, fallback = 0): number {
    const parsed = ValidationUtils.toNumber(value, fallback)
    return Math.trunc(parsed)
  }

  /** Understands the XML `Y`/`N` convention alongside normal truthy strings. */
  static toBoolean(value: unknown, fallback = false): boolean {
    if (typeof value === 'boolean') return value
    if (typeof value === 'number') return value !== 0
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase()
      if (['y', 'yes', 'true', '1', 'on'].includes(normalized)) return true
      if (['n', 'no', 'false', '0', 'off', ''].includes(normalized)) return false
    }
    return fallback
  }

  static toArray<T>(value: T | readonly T[] | null | undefined): T[] {
    if (value == null) return []
    return Array.isArray(value) ? [...value] : [value as T]
  }

  static nonEmpty(value: string | null | undefined): string | null {
    if (typeof value !== 'string') return null
    const trimmed = value.trim()
    return trimmed.length ? trimmed : null
  }

  /** Parses `"1,3,5"` weekday lists, dropping anything outside 1..7. */
  static toWeekdays(value: unknown): number[] {
    if (Array.isArray(value)) {
      return value.map((entry) => ValidationUtils.toInteger(entry, 0)).filter((day) => day >= 1 && day <= 7)
    }
    if (typeof value !== 'string') return []
    return value
      .split(/[,\s]+/)
      .map((entry) => Number.parseInt(entry, 10))
      .filter((day) => Number.isFinite(day) && day >= 1 && day <= 7)
  }

  static clampInt(value: unknown, min: number, max: number, fallback: number): number {
    const parsed = ValidationUtils.toInteger(value, fallback)
    return Math.min(max, Math.max(min, parsed))
  }
}
