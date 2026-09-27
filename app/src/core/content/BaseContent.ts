import type { ContentItemDefinition, ContentSlotDefinition, ScheduleWindow } from '../schema'
import type { Geometry } from '../types'
import { ColorUtils, DateUtils, ValidationUtils } from '../utils'

export type ContentLifecycle = 'created' | 'active' | 'paused' | 'stopped' | 'error'

/**
 * One playable unit inside a content slot.
 *
 * Kept as a class rather than a plain object so the duration semantics
 * (`0` meaning "play to natural end") live with the data instead of being
 * re-derived by every renderer.
 */
export class ContentItem {
  private readonly definition: ContentItemDefinition

  constructor(definition: ContentItemDefinition) {
    this.definition = definition
  }

  get id(): string {
    return this.definition.id
  }

  get text(): string {
    return this.definition.text
  }

  get enabled(): boolean {
    return this.definition.enabled
  }

  get order(): number {
    return this.definition.order
  }

  /** Seconds as authored; `0` keeps its "no timer" meaning. */
  get durationSeconds(): number {
    return this.definition.duration
  }

  get durationMs(): number {
    return Math.round(this.definition.duration * 1000)
  }

  /** True when the item ends on its own (video/audio) rather than on a timer. */
  get endsNaturally(): boolean {
    return this.definition.duration <= 0
  }

  field<T = unknown>(key: string): T | undefined {
    return this.definition.data[key] as T | undefined
  }

  numberField(key: string, fallback = 0): number {
    return ValidationUtils.toNumber(this.definition.data[key], fallback)
  }

  stringField(key: string, fallback = ''): string {
    return ValidationUtils.toStringValue(this.definition.data[key], fallback)
  }

  booleanField(key: string, fallback = false): boolean {
    return ValidationUtils.toBoolean(this.definition.data[key], fallback)
  }

  toJSON(): ContentItemDefinition {
    return this.definition
  }
}

/**
 * Base class for every content type.
 *
 * Responsibilities deliberately kept here (and out of Vue components):
 *  - normalising the slot definition into typed accessors,
 *  - owning the item rotation cursor and lifecycle flags,
 *  - evaluating the slot's own schedule window.
 *
 * Subclasses add type-specific *derived configuration* only. There is exactly
 * one level of inheritance: a content type never extends another content type,
 * which keeps the hierarchy flat and avoids the fragile base class problem.
 *
 * Instances are intentionally not reactive. Pinia stores hold the definitions;
 * these objects are rebuilt when a definition changes, so there is no hidden
 * mutable state shared between a store and a component.
 */
export abstract class BaseContent {
  protected readonly definition: ContentSlotDefinition

  private cursor = 0
  private lifecycle: ContentLifecycle = 'created'
  private lastError: string | null = null
  private readonly playableItems: ContentItem[]

  constructor(definition: ContentSlotDefinition) {
    this.definition = definition
    this.playableItems = definition.items
      .filter((item) => item.enabled)
      .sort((a, b) => a.order - b.order)
      .map((item) => new ContentItem(item))
  }

  /** Content type key; must match the registered plugin. */
  abstract get type(): string

  get id(): string {
    return this.definition.id
  }

  get name(): string {
    return this.definition.name
  }

  get enabled(): boolean {
    return this.definition.enabled
  }

  get geometry(): Geometry {
    return this.definition.geometry
  }

  /** `null` when the slot is transparent, so the renderer can skip painting. */
  get backgroundColor(): string | null {
    if (this.definition.transparent) return null
    return ColorUtils.normalizeHex(this.definition.backgroundColor, '#00000000')
  }

  get transparent(): boolean {
    return this.definition.transparent
  }

  get items(): readonly ContentItem[] {
    return this.playableItems
  }

  get itemCount(): number {
    return this.playableItems.length
  }

  get hasContent(): boolean {
    return this.playableItems.length > 0
  }

  get currentItem(): ContentItem | null {
    return this.playableItems[this.cursor] ?? null
  }

  get currentIndex(): number {
    return this.cursor
  }

  get state(): ContentLifecycle {
    return this.lifecycle
  }

  get error(): string | null {
    return this.lastError
  }

  get scheduleWindow(): ScheduleWindow | null {
    return this.definition.schedule
  }

  /**
   * Whether the slot should be on screen at `now`.
   *
   * Evaluated per render tick rather than on a 20-second interval (which is
   * what `slot-widget.js` did) so a slot appears on its boundary instead of up
   * to 20 seconds late.
   */
  isScheduledAt(now: Date): boolean {
    const window = this.definition.schedule
    if (!window) return true

    const start = DateUtils.parseIsoDate(window.startDate)
    if (start && now < start) return false

    const end = DateUtils.parseIsoDate(window.endDate)
    if (end && now > end) return false

    if (window.days.length && !window.days.includes(DateUtils.isoWeekday(now))) return false

    const startMinutes = DateUtils.parseClockMinutes(window.startTime)
    const endMinutes = DateUtils.parseClockMinutes(window.endTime)
    if (startMinutes == null || endMinutes == null) return true

    const nowMinutes = DateUtils.minutesSinceMidnight(now)
    // An end before the start denotes a window that wraps past midnight.
    return endMinutes >= startMinutes
      ? nowMinutes >= startMinutes && nowMinutes <= endMinutes
      : nowMinutes >= startMinutes || nowMinutes <= endMinutes
  }

  /** Advances the rotation cursor, wrapping. Returns the new item. */
  advance(): ContentItem | null {
    if (!this.playableItems.length) return null
    this.cursor = (this.cursor + 1) % this.playableItems.length
    return this.currentItem
  }

  /** Returns `false` when `index` is out of range, leaving the cursor intact. */
  seek(index: number): boolean {
    if (index < 0 || index >= this.playableItems.length) return false
    this.cursor = index
    return true
  }

  markActive(): void {
    this.lifecycle = 'active'
    this.lastError = null
  }

  markPaused(): void {
    if (this.lifecycle === 'active') this.lifecycle = 'paused'
  }

  markStopped(): void {
    this.lifecycle = 'stopped'
  }

  markError(message: string): void {
    this.lifecycle = 'error'
    this.lastError = message
  }

  protected configString(key: string, fallback = ''): string {
    return ValidationUtils.toStringValue(this.definition.config[key], fallback)
  }

  protected configNumber(key: string, fallback = 0): number {
    return ValidationUtils.toNumber(this.definition.config[key], fallback)
  }

  protected configBoolean(key: string, fallback = false): boolean {
    return ValidationUtils.toBoolean(this.definition.config[key], fallback)
  }

  protected configRecord(key: string): Record<string, unknown> {
    const value = this.definition.config[key]
    return ValidationUtils.isRecord(value) ? value : {}
  }

  /** Raw config, exposed read-only for unsupported/pass-through content. */
  get rawConfig(): Readonly<Record<string, unknown>> {
    return this.definition.config
  }

  toJSON(): ContentSlotDefinition {
    return this.definition
  }
}
