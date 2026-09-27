import { Logger } from '@core/utilities'

const logger = Logger.forScope('scheduler')

export type ClockListener = (now: Date) => void

/**
 * Single shared clock for time-driven content.
 *
 * The legacy player created one recursive `setTimeout` per date, time and
 * datetime slot, so a layout with several clocks ran several drifting timers
 * and none of them were cleaned up on a layout change. One ticker here means
 * every clock updates on the same edge, slot schedules are re-evaluated at a
 * known cadence, and teardown is a single `stop()`.
 *
 * The tick is aligned to the wall-clock second so a displayed clock changes
 * when the second actually changes, not up to a second late.
 */
export class SchedulerService {
  private timer: ReturnType<typeof setTimeout> | null = null
  private readonly listeners = new Set<ClockListener>()
  private running = false

  constructor(private readonly intervalMs = 1_000) {}

  get isRunning(): boolean {
    return this.running
  }

  get listenerCount(): number {
    return this.listeners.size
  }

  onTick(listener: ClockListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  start(): void {
    if (this.running) return
    this.running = true
    this.scheduleNext()
  }

  stop(): void {
    this.running = false
    if (this.timer != null) {
      clearTimeout(this.timer)
      this.timer = null
    }
  }

  private scheduleNext(): void {
    const now = Date.now()
    const delay = this.intervalMs - (now % this.intervalMs)
    this.timer = setTimeout(() => {
      this.timer = null
      this.tick()
      if (this.running) this.scheduleNext()
    }, delay)
  }

  private tick(): void {
    const now = new Date()
    for (const listener of this.listeners) {
      try {
        listener(now)
      } catch (error) {
        logger.warn('Clock listener failed', error)
      }
    }
  }
}
