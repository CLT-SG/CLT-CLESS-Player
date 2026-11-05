import { BaseContent } from '@core/models/BaseContent'
import { ValidationUtils } from '@core/utilities'
import { AirportEventCodec } from './AirportEventCodec'
import type { NormalisedAnnouncementLanguage, NormalisedMediaItem } from './AirportEventCodec'

export type AirportAnnouncementLanguage = NormalisedAnnouncementLanguage

export interface AirportOverride {
  readonly slotName: string
  readonly slotType: string
  readonly value: string
  /**
   * Media to play for a media-slot override, already reduced to the items the
   * zone's mode selects. Structured rather than filenames because the server
   * sends per-item order and duration that decide playback.
   */
  readonly mediaItems: readonly NormalisedMediaItem[]
  /** Temporary overrides revert when the event's dwell time expires. */
  readonly temporary: boolean
}

/**
 * Airport Display content: boarding-zone driven slot overrides plus
 * multilingual announcements.
 *
 * CLESS-Server pushes these events directly to the player's local control API
 * rather than embedding them in the layout, so this content type models the
 * *event* payload. It is registered like any other plugin, which is what lets
 * the feature evolve without touching the renderer core.
 */
export class AirportDisplayContent extends BaseContent {
  override get type(): string {
    return 'airport-display'
  }

  get eventId(): string {
    return this.configString('eventId')
  }

  get eventKind(): string {
    return this.configString('event', 'zone_trigger')
  }

  get flightInfo(): Readonly<Record<string, unknown>> {
    return this.configRecord('flightInfo')
  }

  get overrides(): readonly AirportOverride[] {
    const raw = this.rawConfig['slots']
    if (!Array.isArray(raw)) return []
    return raw.map((entry) => {
      const record = ValidationUtils.isRecord(entry) ? entry : {}
      return {
        slotName: ValidationUtils.toStringValue(record['slotName']),
        slotType: ValidationUtils.toStringValue(record['slotType'], 'text'),
        value: ValidationUtils.toStringValue(record['value']),
        mediaItems: AirportEventCodec.mediaItems(record),
        temporary: ValidationUtils.toBoolean(record['temporary'], true),
      }
    })
  }

  /** Announcement tracks ordered as the server wants them played. */
  get announcementLanguages(): readonly AirportAnnouncementLanguage[] {
    return AirportEventCodec.announcementLanguages(this.configRecord('announcement'))
  }

  /**
   * Whether the zone asked for an announcement at all. Separate from having
   * tracks, because an event can carry a disabled announcement and the player
   * must stay silent rather than play the text it happens to contain.
   */
  get announcementEnabled(): boolean {
    return ValidationUtils.toBoolean(this.configRecord('announcement')['enabled'], false)
  }

  get hasAnnouncement(): boolean {
    return this.announcementEnabled && this.announcementLanguages.length > 0
  }

  /** Tracks with audio the player can actually play. */
  get playableAnnouncementLanguages(): readonly AirportAnnouncementLanguage[] {
    return this.announcementLanguages.filter((language) => Boolean(language.audioUrl))
  }
}
