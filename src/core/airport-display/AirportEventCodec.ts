import { ValidationUtils } from '@core/utilities'

export interface NormalisedAnnouncementLanguage {
  readonly language: string
  readonly voice: string
  readonly order: number
  readonly audioUrl: string
  readonly text: string
}

export interface NormalisedMediaItem {
  readonly filename: string
  readonly path: string
  readonly order: number
  readonly duration: number
  readonly selected: boolean
}

/**
 * Decodes the wire shape of an Airport Display event.
 *
 * CLESS-Server's event payload is not the tidy structure the content model
 * wants: announcement languages may be a list or a single inline track, media
 * items may be objects or bare filenames, and both carry ordering rules that
 * decide what the player actually plays. `airport-display.js` has always
 * implemented those rules; this is the same logic, so the Vue renderer cannot
 * pick a different track or a different image than the legacy renderer for the
 * same event.
 *
 * `tests/airport-parity.spec.ts` pins these against verbatim copies of the
 * legacy functions.
 */
export abstract class AirportEventCodec {
  static basename(pathOrName: unknown): string {
    const value = String(pathOrName ?? '')
    const cut = Math.max(value.lastIndexOf('/'), value.lastIndexOf('\\'))
    return cut === -1 ? value : value.substring(cut + 1)
  }

  /**
   * Flattens an announcement to the tracks to play, in play order.
   *
   * The single-track fallback is the important half: the server only includes
   * a `languages` array for a multilingual announcement, so reading `languages`
   * alone means a plain one-language announcement produces nothing at all.
   */
  static announcementLanguages(announcement: unknown): readonly NormalisedAnnouncementLanguage[] {
    const record = ValidationUtils.isRecord(announcement) ? announcement : {}
    const fallbackText = ValidationUtils.toStringValue(record['text'])
    const raw = Array.isArray(record['languages']) ? record['languages'] : []

    if (raw.length) {
      const list = raw
        .filter((entry) => Boolean(entry))
        .map((entry, index) => {
          const language = ValidationUtils.isRecord(entry) ? entry : {}
          return {
            language: ValidationUtils.toStringValue(
              language['language'] ?? language['lang'] ?? language['code'],
              'en',
            ),
            voice: ValidationUtils.toStringValue(language['voice']),
            order: ValidationUtils.toInteger(language['order'], index + 1),
            audioUrl: ValidationUtils.toStringValue(language['audio_url'] ?? language['audioUrl']),
            text: ValidationUtils.toStringValue(language['text']) || fallbackText,
          }
        })
        .sort((left, right) => left.order - right.order)

      // Renumbered 1..N after sorting so status reports read cleanly, matching
      // what the server is told by the legacy renderer.
      return list.map((entry, index) => ({ ...entry, order: index + 1 }))
    }

    const audioUrl = ValidationUtils.toStringValue(record['audio_url'] ?? record['audioUrl'])
    if (!audioUrl && !fallbackText) return []

    return [
      {
        language: ValidationUtils.toStringValue(record['language'], 'en'),
        voice: ValidationUtils.toStringValue(record['voice']),
        order: 1,
        audioUrl,
        text: fallbackText,
      },
    ]
  }

  /**
   * Picks the media items a media-slot override should play.
   *
   * `loop` plays everything; any other mode plays the explicitly selected
   * items, falling back to the first item so a zone configured without an
   * explicit selection still shows something. A slot with no items at all but
   * a `value` is treated as a single-file override, which is how the simpler
   * zones are configured.
   */
  static mediaItems(slot: unknown): readonly NormalisedMediaItem[] {
    const record = ValidationUtils.isRecord(slot) ? slot : {}
    const mode = ValidationUtils.toStringValue(
      record['media_mode'] ?? record['mediaMode'],
      'selected',
    ).toLowerCase()

    const rawItems = record['media_items'] ?? record['mediaItems']
    const items = (Array.isArray(rawItems) ? rawItems : [])
      .map((entry, index) => AirportEventCodec.toMediaItem(entry, index))
      .filter((entry): entry is NormalisedMediaItem => entry !== null)
      .sort((left, right) => left.order - right.order)

    let selected: NormalisedMediaItem[] = []
    if (mode === 'loop' || mode === 'play_all' || mode === 'all') {
      selected = [...items]
    } else if (items.length) {
      selected = items.filter((entry) => entry.selected)
      if (!selected.length && items[0]) selected = [items[0]]
    }

    const value = ValidationUtils.toStringValue(record['value'])
    if (!selected.length && value) {
      selected = [
        {
          filename: AirportEventCodec.basename(value),
          path: value,
          order: 1,
          duration: 0,
          selected: true,
        },
      ]
    }
    return selected
  }

  private static toMediaItem(entry: unknown, index: number): NormalisedMediaItem | null {
    if (typeof entry === 'string') {
      const value = entry.trim()
      if (!value) return null
      return {
        filename: AirportEventCodec.basename(value),
        path: value,
        order: index + 1,
        duration: 0,
        selected: true,
      }
    }
    if (!ValidationUtils.isRecord(entry)) return null

    const path = ValidationUtils.toStringValue(
      entry['path'] ?? entry['file_path'] ?? entry['url'] ?? entry['contentUrl'],
    ).trim()
    const named = ValidationUtils.toStringValue(
      entry['filename'] ?? entry['value'] ?? entry['name'],
    )
    const filename = AirportEventCodec.basename(named || path)
    if (!filename && !path) return null

    return {
      filename: filename || AirportEventCodec.basename(path),
      path: path || filename,
      // `order` is 0-based here only when absent; the server emits 1-based.
      order: ValidationUtils.toInteger(entry['order'], index + 1),
      duration: ValidationUtils.toInteger(entry['duration'], 0),
      // Absent means selected: a zone that lists items without ticking any is
      // asking for all of them, not for none.
      selected: entry['selected'] !== false,
    }
  }
}
