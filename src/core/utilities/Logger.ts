export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface LogRecord {
  readonly level: LogLevel
  readonly scope: string
  readonly message: string
  readonly timestamp: number
  readonly detail?: unknown
}

export type LogSink = (record: LogRecord) => void

const LEVEL_WEIGHT: Readonly<Record<LogLevel, number>> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
}

/**
 * Scoped logger with a pluggable sink.
 *
 * Electron's `electron-log` is only reachable through the preload bridge, and
 * the same bundle also runs in a browser (control panel preview) and in
 * Capacitor. A sink keeps the core layers free of any host assumption; the
 * host installs the real transport at boot.
 */
export class Logger {
  private static level: LogLevel = 'info'
  private static sinks: LogSink[] = [Logger.consoleSink]
  private static readonly ringBuffer: LogRecord[] = []
  private static readonly ringCapacity = 200

  private constructor(private readonly scope: string) {}

  static forScope(scope: string): Logger {
    return new Logger(scope)
  }

  static setLevel(level: LogLevel): void {
    Logger.level = level
  }

  static getLevel(): LogLevel {
    return Logger.level
  }

  /** Replaces the default console sink; pass `true` to keep it as well. */
  static setSink(sink: LogSink, keepConsole = false): void {
    Logger.sinks = keepConsole ? [Logger.consoleSink, sink] : [sink]
  }

  /** Most recent records, oldest first. Backs the diagnostics overlay. */
  static recent(): readonly LogRecord[] {
    return [...Logger.ringBuffer]
  }

  private static consoleSink(record: LogRecord): void {
    const prefix = `[${record.scope}]`
    const method = record.level === 'debug' ? 'log' : record.level
    // eslint-disable-next-line no-console
    const target = console[method] as ((...args: unknown[]) => void) | undefined
    target?.(prefix, record.message, record.detail ?? '')
  }

  private emit(level: LogLevel, message: string, detail?: unknown): void {
    if (LEVEL_WEIGHT[level] < LEVEL_WEIGHT[Logger.level]) return

    const record: LogRecord = { level, scope: this.scope, message, timestamp: Date.now(), detail }
    Logger.ringBuffer.push(record)
    if (Logger.ringBuffer.length > Logger.ringCapacity) Logger.ringBuffer.shift()

    for (const sink of Logger.sinks) {
      try {
        sink(record)
      } catch {
        // A failing sink must never break playback.
      }
    }
  }

  debug(message: string, detail?: unknown): void {
    this.emit('debug', message, detail)
  }

  info(message: string, detail?: unknown): void {
    this.emit('info', message, detail)
  }

  warn(message: string, detail?: unknown): void {
    this.emit('warn', message, detail)
  }

  error(message: string, detail?: unknown): void {
    this.emit('error', message, detail)
  }
}
