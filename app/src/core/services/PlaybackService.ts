import type { LayoutDefinition, PlaylistDefinition, TransitionDefinition } from '../schema'
import { Logger } from '../utils'

const logger = Logger.forScope('playback')

export interface PlaybackPosition {
  readonly index: number
  readonly layoutId: string
  readonly total: number
}

export type PlaybackListener = (position: PlaybackPosition, layout: LayoutDefinition) => void

/**
 * Drives layout rotation for a playlist.
 *
 * Replaces the global `loopTimeout` / `loopXMLCurIndex` pair that three
 * different legacy files read and wrote. Owning the cursor and the timer in
 * one object removes the class of bug where a layout advanced twice because
 * two code paths each scheduled an advance.
 *
 * Pause and resume preserve the remaining dwell time, so a temporary takeover
 * (an Airport Display announcement, a control-panel preview) does not truncate
 * or restart the layout that was on screen.
 */
export class PlaybackService {
  private layouts: readonly LayoutDefinition[] = []
  private playlist: PlaylistDefinition | null = null
  private cursor = 0
  private timer: ReturnType<typeof setTimeout> | null = null
  private dwellStartedAt = 0
  private remainingMs = 0
  private paused = false
  private readonly listeners = new Set<PlaybackListener>()

  get isPaused(): boolean {
    return this.paused
  }

  get position(): PlaybackPosition {
    return {
      index: this.cursor,
      layoutId: this.layouts[this.cursor]?.id ?? '',
      total: this.layouts.length,
    }
  }

  get currentLayout(): LayoutDefinition | null {
    return this.layouts[this.cursor] ?? null
  }

  get transition(): TransitionDefinition {
    // A single-layout playlist has nothing to transition between, and running
    // the animation anyway produced a visible flash in the legacy player.
    if (this.layouts.length <= 1) return { style: 'none', speedMs: 0, delayMs: 0 }
    return this.playlist?.transition ?? { style: 'none', speedMs: 1000, delayMs: 0 }
  }

  onChange(listener: PlaybackListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /**
   * Loads a playlist.
   *
   * `resumeLayoutId` restores the position recorded before a restart, so a
   * device that reboots mid-playlist continues where it left off instead of
   * jumping back to the first layout.
   */
  load(
    layouts: readonly LayoutDefinition[],
    playlist: PlaylistDefinition | null,
    resumeLayoutId: string | null = null,
  ): void {
    this.stop()
    this.layouts = layouts
    this.playlist = playlist

    const resumeIndex = resumeLayoutId ? layouts.findIndex((layout) => layout.id === resumeLayoutId) : -1
    this.cursor = resumeIndex >= 0 ? resumeIndex : 0
    logger.info(`Loaded ${layouts.length} layout(s), starting at index ${this.cursor}`)
  }

  /** Starts (or restarts) playback at the current cursor. */
  start(): void {
    if (!this.layouts.length) {
      logger.warn('Nothing to play: playlist is empty')
      return
    }
    this.paused = false
    this.emit()
    this.scheduleAdvance(this.dwellMsFor(this.cursor))
  }

  stop(): void {
    this.clearTimer()
    this.paused = false
    this.remainingMs = 0
  }

  /** Advances immediately, cancelling the pending timer. */
  next(): void {
    if (this.layouts.length <= 1) {
      // Re-emit so the renderer still picks up refreshed content for the one
      // layout it is showing.
      this.emit()
      this.scheduleAdvance(this.dwellMsFor(this.cursor))
      return
    }
    this.cursor = (this.cursor + 1) % this.layouts.length
    this.emit()
    this.scheduleAdvance(this.dwellMsFor(this.cursor))
  }

  /** Jumps to a layout by id. Returns `false` when it is not in the playlist. */
  jumpTo(layoutId: string): boolean {
    const index = this.layouts.findIndex((layout) => layout.id === layoutId)
    if (index < 0) return false

    this.cursor = index
    this.emit()
    this.scheduleAdvance(this.dwellMsFor(this.cursor))
    return true
  }

  /** Freezes rotation, remembering how much of the current dwell is left. */
  pause(reason: string): boolean {
    if (this.paused || this.timer == null) return false

    this.remainingMs = Math.max(0, this.remainingMs - (Date.now() - this.dwellStartedAt))
    this.clearTimer()
    this.paused = true
    logger.info(`Playback paused (${reason}); ${this.remainingMs}ms remaining`)
    return true
  }

  resume(reason: string): boolean {
    if (!this.paused) return false

    this.paused = false
    logger.info(`Playback resumed (${reason})`)
    this.scheduleAdvance(this.remainingMs > 0 ? this.remainingMs : this.dwellMsFor(this.cursor))
    return true
  }

  /**
   * Swaps in refreshed definitions without interrupting the current layout.
   *
   * The cursor is re-anchored by layout id rather than index, so a playlist
   * that gained or lost members does not cause the wrong layout to be shown.
   */
  applyUpdate(layouts: readonly LayoutDefinition[], playlist: PlaylistDefinition | null): void {
    const currentId = this.currentLayout?.id ?? null
    this.layouts = layouts
    this.playlist = playlist

    const index = currentId ? layouts.findIndex((layout) => layout.id === currentId) : -1
    if (index >= 0) {
      this.cursor = index
      this.emit()
      return
    }

    // The layout being shown is gone; restart cleanly at the beginning.
    this.cursor = 0
    this.emit()
    this.scheduleAdvance(this.dwellMsFor(this.cursor))
  }

  private dwellMsFor(index: number): number {
    const layout = this.layouts[index]
    if (!layout) return 0

    const entry = this.playlist?.entries.find((candidate) => candidate.layoutId === layout.id)
    const seconds = entry?.duration ?? 0
    // A single layout with no playlist duration should simply stay on screen;
    // the sync service refreshes its content independently.
    if (seconds <= 0) return this.layouts.length > 1 ? 10_000 : 0
    return seconds * 1000
  }

  private scheduleAdvance(dwellMs: number): void {
    this.clearTimer()
    if (dwellMs <= 0 || this.layouts.length <= 1) return

    this.remainingMs = dwellMs
    this.dwellStartedAt = Date.now()
    this.timer = setTimeout(() => {
      this.timer = null
      this.next()
    }, dwellMs)
  }

  private clearTimer(): void {
    if (this.timer != null) {
      clearTimeout(this.timer)
      this.timer = null
    }
  }

  private emit(): void {
    const layout = this.currentLayout
    if (!layout) return

    const position = this.position
    for (const listener of this.listeners) {
      try {
        listener(position, layout)
      } catch (error) {
        logger.warn('Playback listener failed', error)
      }
    }
  }
}
