import type { RealtimeClient } from '@core/transports'
import { AirportDisplayContent } from './AirportDisplayContent'
import { contentSlotSchema } from '@core/layouts/schema/layout'
import { Logger, ValidationUtils } from '@core/utilities'

const logger = Logger.forScope('airport')

export interface AirportSlotOverride {
  readonly slotName: string
  readonly slotType: string
  readonly value: string
  readonly mediaItems: readonly string[]
  readonly temporary: boolean
  readonly appliedAt: number
}

export interface AirportEvent {
  readonly eventId: string
  readonly kind: string
  readonly content: AirportDisplayContent
  readonly receivedAt: number
}

export type AirportEventListener = (event: AirportEvent) => void

/**
 * Handles Airport Display events pushed from CLESS-Server.
 *
 * Two behaviours are preserved from the existing implementation because
 * operations depend on them: events are de-duplicated by `event_id` (the
 * server retries delivery, and an announcement must not play twice), and
 * announcement audio plays strictly in the server's language order.
 *
 * The event is normalised into a regular content definition so the Airport
 * Display renderer is an ordinary content plugin rather than a special case
 * wired into the renderer.
 */
export class AirportDisplayService {
  private static readonly EVENT_NAME = 'airport-display'
  private static readonly DEDUPE_LIMIT = 64

  private readonly seenEventIds: string[] = []
  private readonly listeners = new Set<AirportEventListener>()
  private readonly overrides = new Map<string, AirportSlotOverride>()
  private detachRealtime: (() => void) | null = null
  private lastEvent: AirportEvent | null = null

  constructor(private readonly realtime: RealtimeClient) {}

  get activeOverrides(): readonly AirportSlotOverride[] {
    return [...this.overrides.values()]
  }

  get mostRecentEvent(): AirportEvent | null {
    return this.lastEvent
  }

  onEvent(listener: AirportEventListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  start(): void {
    if (this.detachRealtime) return
    this.detachRealtime = this.realtime.on(AirportDisplayService.EVENT_NAME, (payload) => {
      this.handle(payload)
    })
    logger.info('Listening for Airport Display events')
  }

  stop(): void {
    this.detachRealtime?.()
    this.detachRealtime = null
  }

  /**
   * Processes one event payload. Public so the local HTTP control API can feed
   * events in when the socket is not connected.
   *
   * Returns `null` for a duplicate or unusable payload.
   */
  handle(payload: unknown): AirportEvent | null {
    if (!ValidationUtils.isRecord(payload)) {
      logger.warn('Ignored a non-object Airport Display payload')
      return null
    }

    const eventId = ValidationUtils.toStringValue(payload['event_id'] ?? payload['eventId'])
    if (eventId && this.seenEventIds.includes(eventId)) {
      logger.debug(`Ignored duplicate Airport Display event ${eventId}`)
      return null
    }
    if (eventId) this.rememberEventId(eventId)

    const content = AirportDisplayService.toContent(payload, eventId)
    if (!content) return null

    for (const override of content.overrides) {
      if (!override.slotName) continue
      this.overrides.set(override.slotName, { ...override, appliedAt: Date.now() })
    }

    const event: AirportEvent = {
      eventId,
      kind: content.eventKind,
      content,
      receivedAt: Date.now(),
    }
    this.lastEvent = event

    for (const listener of this.listeners) {
      try {
        listener(event)
      } catch (error) {
        logger.warn('Airport Display listener failed', error)
      }
    }

    this.reportStatus(event, 'applied')
    return event
  }

  /** Drops a temporary override so the slot reverts to its layout content. */
  clearOverride(slotName: string): boolean {
    return this.overrides.delete(slotName)
  }

  clearTemporaryOverrides(): number {
    let cleared = 0
    for (const [slotName, override] of this.overrides) {
      if (!override.temporary) continue
      this.overrides.delete(slotName)
      cleared += 1
    }
    return cleared
  }

  /** Acknowledges the event so the server can stop retrying delivery. */
  private reportStatus(event: AirportEvent, status: string): void {
    this.realtime.emit('airport-display-status', {
      event_id: event.eventId,
      status,
      at: new Date().toISOString(),
    })
  }

  private rememberEventId(eventId: string): void {
    this.seenEventIds.push(eventId)
    if (this.seenEventIds.length > AirportDisplayService.DEDUPE_LIMIT) this.seenEventIds.shift()
  }

  /**
   * Maps the server's snake_case event payload onto a content definition.
   *
   * Done here rather than in the content class so the wire format of the
   * Airport Display API can change without touching the content model.
   */
  private static toContent(payload: Record<string, unknown>, eventId: string): AirportDisplayContent | null {
    const rawSlots = Array.isArray(payload['slots']) ? payload['slots'] : []
    const slots = rawSlots.filter(ValidationUtils.isRecord).map((slot) => {
      const rawMedia = slot['media_items'] ?? slot['mediaItems']
      return {
        slotName: ValidationUtils.toStringValue(slot['slot_name'] ?? slot['slotName']),
        slotType: ValidationUtils.toStringValue(slot['slot_type'] ?? slot['slotType'], 'text'),
        value: ValidationUtils.toStringValue(slot['value']),
        mediaItems: Array.isArray(rawMedia)
          ? rawMedia.map((entry) => ValidationUtils.toStringValue(entry)).filter(Boolean)
          : [],
        temporary: ValidationUtils.toBoolean(slot['temporary'], true),
      }
    })

    const announcementRaw = ValidationUtils.isRecord(payload['announcement']) ? payload['announcement'] : {}
    const languagesRaw = Array.isArray(announcementRaw['languages']) ? announcementRaw['languages'] : []

    const parsed = contentSlotSchema.safeParse({
      type: 'airport-display',
      id: eventId || `airport-${Date.now()}`,
      name: 'airport-display',
      geometry: { top: 0, left: 0, width: 0, height: 0, layer: 999 },
      config: {
        eventId,
        event: ValidationUtils.toStringValue(payload['event'], 'zone_trigger'),
        flightInfo: ValidationUtils.isRecord(payload['flight_info']) ? payload['flight_info'] : {},
        slots,
        announcement: { languages: languagesRaw },
      },
    })

    if (!parsed.success) {
      logger.warn('Airport Display payload did not satisfy the slot schema', parsed.error.issues)
      return null
    }
    return new AirportDisplayContent(parsed.data)
  }
}
