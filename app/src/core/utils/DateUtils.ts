/**
 * Date and time formatting for signage slots.
 *
 * The legacy player mapped a fixed set of server format tokens (`dd/mm/yyyy`,
 * `HH:nn AM/PM`, ...) onto the `date-and-time` library inside each slot script.
 * Those mappings are centralised here so the date, time and datetime content
 * types cannot drift apart, and so the token table is testable in isolation.
 */
export abstract class DateUtils {
  private static readonly MONTHS_SHORT = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ]

  private static readonly MONTHS_LONG = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ]

  private static readonly DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  private static readonly DAYS_LONG = [
    'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
  ]

  /** Server-side legacy date tokens, in longest-first order (see `format`). */
  private static readonly TOKENS: ReadonlyArray<[string, (d: Date) => string]> = [
    ['dddd', (d) => DateUtils.DAYS_LONG[d.getDay()]!],
    ['ddd', (d) => DateUtils.DAYS_SHORT[d.getDay()]!],
    ['mmmmm', (d) => DateUtils.MONTHS_LONG[d.getMonth()]!],
    ['mmmm', (d) => DateUtils.MONTHS_LONG[d.getMonth()]!],
    ['mmm', (d) => DateUtils.MONTHS_SHORT[d.getMonth()]!],
    ['YYYY', (d) => String(d.getFullYear())],
    ['yyyy', (d) => String(d.getFullYear())],
    ['yy', (d) => String(d.getFullYear()).slice(-2)],
    ['MM', (d) => DateUtils.pad(d.getMonth() + 1)],
    ['DD', (d) => DateUtils.pad(d.getDate())],
    ['dd', (d) => DateUtils.pad(d.getDate())],
    ['mm', (d) => DateUtils.pad(d.getMonth() + 1)],
    ['HH', (d) => DateUtils.pad(DateUtils.to12Hour(d.getHours()))],
    ['hh', (d) => DateUtils.pad(d.getHours())],
    ['nn', (d) => DateUtils.pad(d.getMinutes())],
    ['ss', (d) => DateUtils.pad(d.getSeconds())],
    ['AM/PM', (d) => (d.getHours() < 12 ? 'AM' : 'PM')],
    ['A', (d) => (d.getHours() < 12 ? 'AM' : 'PM')],
  ]

  static pad(value: number, length = 2): string {
    return String(Math.abs(Math.trunc(value))).padStart(length, '0')
  }

  static to12Hour(hours24: number): number {
    const hour = hours24 % 12
    return hour === 0 ? 12 : hour
  }

  /**
   * Renders `date` using the legacy token vocabulary.
   *
   * Tokens are substituted longest-first into a placeholder array rather than
   * into the output string, so a replacement's own characters (e.g. the "d" in
   * "Wednesday") can never be re-matched by a later, shorter token.
   */
  static format(date: Date, pattern: string): string {
    if (!pattern) return date.toISOString()

    const replacements: string[] = []
    let working = pattern

    for (const [token, resolve] of DateUtils.TOKENS) {
      if (!working.includes(token)) continue
      const placeholder = `\u0000${replacements.length}\u0000`
      replacements.push(resolve(date))
      working = working.split(token).join(placeholder)
    }

    return working.replace(/\u0000(\d+)\u0000/g, (_match, index: string) => replacements[Number(index)] ?? '')
  }

  /** Minutes since midnight for an `HH:mm` string, or `null` when unparseable. */
  static parseClockMinutes(value: string | null | undefined): number | null {
    if (!value) return null
    const match = /^(\d{1,2}):(\d{2})/.exec(value.trim())
    if (!match) return null
    const hours = Number(match[1])
    const minutes = Number(match[2])
    if (hours > 23 || minutes > 59) return null
    return hours * 60 + minutes
  }

  static minutesSinceMidnight(date: Date): number {
    return date.getHours() * 60 + date.getMinutes()
  }

  /** ISO weekday, 1 = Monday .. 7 = Sunday (the convention the server uses). */
  static isoWeekday(date: Date): number {
    const day = date.getDay()
    return day === 0 ? 7 : day
  }

  static parseIsoDate(value: string | null | undefined): Date | null {
    if (!value) return null
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }

  /**
   * Compares the server's `YYYYMMDDHHMMSS` revision stamps. They are
   * lexicographically ordered by construction, so string comparison is enough
   * and avoids timezone parsing entirely.
   */
  static isRevisionNewer(candidate: string, current: string): boolean {
    if (!candidate) return false
    if (!current) return true
    return candidate > current
  }
}
