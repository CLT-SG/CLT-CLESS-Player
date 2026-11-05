/**
 * Pins the shared Airport Display codec to the behaviour of the legacy
 * renderer, using the payload shapes CLESS-Server actually emits.
 *
 * The legacy functions are copied in verbatim from `src/assets/js/
 * airport-display.js` (`normalizeAnnouncementLanguages` and
 * `collectMediaTriggerItems`). Comparing against a copy rather than against
 * expected values is the point: the assertion is "the same event selects the
 * same tracks and the same images in both renderers", which is what section 8
 * of the migration plan requires, and hand-written expectations would only
 * encode what the author of this file believed.
 */
import { describe, expect, it } from 'vitest'
import { AirportDisplayService, AirportEventCodec } from '@core/airport-display'
import type { NormalisedAnnouncementLanguage } from '@core/airport-display'
import type { RealtimeClient } from '@core/transports'

/* -------------------------------------------------------------------------- */
/* Verbatim copies of the legacy implementations                              */
/* -------------------------------------------------------------------------- */

function legacyBasename(pathOrName: unknown): string {
  const s = String(pathOrName || '')
  const n = Math.max(s.lastIndexOf('/'), s.lastIndexOf('\\'))
  return n === -1 ? s : s.substring(n + 1)
}

function legacyNormalizeAnnouncementLanguages(ann: any): any[] {
  const list: any[] = []
  if (ann && Array.isArray(ann.languages) && ann.languages.length) {
    ann.languages.forEach(function (entry: any, idx: number) {
      if (!entry) return
      list.push({
        language: entry.language || entry.lang || 'en',
        voice: entry.voice || '',
        order: entry.order != null ? Number(entry.order) : idx + 1,
        audio_url: entry.audio_url || entry.audio || '',
        text: entry.text || ann.text || '',
      })
    })
    list.sort(function (a: any, b: any) {
      return a.order - b.order
    })
    list.forEach(function (item: any, i: number) {
      item.order = i + 1
    })
    return list
  }
  if (ann && (ann.audio_url || ann.text)) {
    return [
      {
        language: ann.language || 'en',
        voice: ann.voice || '',
        order: 1,
        audio_url: ann.audio_url || '',
        text: ann.text || '',
      },
    ]
  }
  return []
}

function legacyCollectMediaTriggerItems(slot: any): any[] {
  const mode = String(slot.media_mode || 'selected').toLowerCase()
  const items = Array.isArray(slot.media_items) ? slot.media_items.slice() : []
  items.sort(function (a: any, b: any) {
    return (Number(a.order) || 0) - (Number(b.order) || 0)
  })
  let selected: any[] = []
  if (mode === 'loop' || mode === 'play_all' || mode === 'all') {
    selected = items
  } else if (items.length) {
    items.forEach(function (it: any) {
      if (it && it.selected === false) return
      selected.push(it)
    })
    if (!selected.length && items[0]) selected = [items[0]]
  }
  if (!selected.length && slot.value) {
    selected = [
      { filename: legacyBasename(slot.value), path: String(slot.value), selected: true, order: 1 },
    ]
  }
  return selected
}

/* -------------------------------------------------------------------------- */

/**
 * Both sides reduced to the legacy field names, so the comparison covers every
 * field the legacy renderer goes on to use rather than just the ones that
 * happen to be named the same.
 */
function trackKeys(tracks: readonly NormalisedAnnouncementLanguage[]) {
  return tracks.map((track) => ({
    language: track.language,
    voice: track.voice,
    order: track.order,
    audio_url: track.audioUrl,
    text: track.text,
  }))
}

function legacyTrackKeys(tracks: readonly any[]) {
  return tracks.map((track) => ({
    language: track.language,
    voice: track.voice,
    order: track.order,
    audio_url: track.audio_url,
    text: track.text,
  }))
}

function itemKeys(items: readonly { filename: string; order: number }[]) {
  return items.map((item) => `${item.order}:${item.filename}`)
}

function legacyItemKeys(items: readonly any[]) {
  return items.map(
    (item) => `${item.order ?? 1}:${legacyBasename(item.filename || item.path || item.value)}`,
  )
}

describe('announcement language parity', () => {
  // As emitted by AirportDisplayAnnouncement.to_dict on the server: the
  // `languages` array is present only for a multilingual announcement.
  const multilingual = {
    enabled: true,
    text: 'Now boarding',
    language: 'en',
    languages: [
      { language: 'ta', order: 3, audio_url: '/tts/ta.mp3', text: 'ஏறுதல்' },
      { language: 'en', order: 1, audio_url: '/tts/en.mp3', text: 'Now boarding' },
      { language: 'zh', order: 2, audio_url: '/tts/zh.mp3' },
    ],
  }

  const singleLanguage = {
    enabled: true,
    text: 'Gate change for SQ318',
    language: 'en',
    voice: 'en-SG-Wavenet-A',
    audio_url: '/tts/sq318.mp3',
  }

  const disabled = { enabled: false, text: '', language: 'en' }

  const cases = [
    { label: 'a multilingual announcement', announcement: multilingual },
    { label: 'a single-language announcement', announcement: singleLanguage },
    { label: 'a disabled announcement', announcement: disabled },
    { label: 'an announcement with no languages and no audio', announcement: { enabled: true } },
    { label: 'an absent announcement', announcement: undefined },
  ]

  for (const { label, announcement } of cases) {
    it(`selects the same tracks as the legacy renderer for ${label}`, () => {
      expect(trackKeys(AirportEventCodec.announcementLanguages(announcement))).toEqual(
        legacyTrackKeys(legacyNormalizeAnnouncementLanguages(announcement)),
      )
    })
  }

  it('plays multilingual tracks in the order the server asked for', () => {
    const tracks = AirportEventCodec.announcementLanguages(multilingual)
    expect(tracks.map((track) => track.language)).toEqual(['en', 'zh', 'ta'])
    // Renumbered 1..N after sorting, as the legacy status report does.
    expect(tracks.map((track) => track.order)).toEqual([1, 2, 3])
  })

  it('falls back to the announcement text for a track that carries none', () => {
    const chinese = AirportEventCodec.announcementLanguages(multilingual)[1]!
    expect(chinese.text).toBe('Now boarding')
  })

  it('finds the inline track of a single-language announcement', () => {
    // This is the case a `languages`-only reader misses entirely, which would
    // have left every one-language zone silent in the Vue renderer.
    const tracks = AirportEventCodec.announcementLanguages(singleLanguage)
    expect(tracks).toHaveLength(1)
    expect(tracks[0]).toMatchObject({
      language: 'en',
      voice: 'en-SG-Wavenet-A',
      audioUrl: '/tts/sq318.mp3',
      order: 1,
    })
  })
})

describe('media trigger selection parity', () => {
  const objectItems = [
    { filename: 'gate-b.jpg', path: 'uploads/gate-b.jpg', order: 2, duration: 8 },
    { filename: 'gate-a.jpg', path: 'uploads/gate-a.jpg', order: 1, duration: 6 },
    { filename: 'gate-c.jpg', path: 'uploads/gate-c.jpg', order: 3, selected: false },
  ]

  const cases = [
    { label: 'selected mode with a deselected item', slot: { media_mode: 'selected', media_items: objectItems } },
    { label: 'loop mode', slot: { media_mode: 'loop', media_items: objectItems } },
    { label: 'play_all mode', slot: { media_mode: 'play_all', media_items: objectItems } },
    {
      label: 'a slot with only a value',
      slot: { slot_type: 'media', value: 'uploads/override/notice.png' },
    },
    { label: 'a slot with nothing to play', slot: { slot_type: 'media' } },
    {
      label: 'every item deselected',
      slot: {
        media_mode: 'selected',
        media_items: objectItems.map((item) => ({ ...item, selected: false })),
      },
    },
  ]

  for (const { label, slot } of cases) {
    it(`selects the same items as the legacy renderer for ${label}`, () => {
      expect(itemKeys(AirportEventCodec.mediaItems(slot))).toEqual(
        legacyItemKeys(legacyCollectMediaTriggerItems(slot)),
      )
    })
  }

  it('keeps the per-item duration the server sent', () => {
    const items = AirportEventCodec.mediaItems({ media_mode: 'loop', media_items: objectItems })
    expect(items.map((item) => item.duration)).toEqual([6, 8, 0])
  })

  it('accepts bare filenames as well as item objects', () => {
    // The zone slot's media_items is a JSONField, and older zones stored
    // plain filenames in it.
    const items = AirportEventCodec.mediaItems({
      media_mode: 'loop',
      media_items: ['uploads/a.jpg', 'uploads/b.jpg'],
    })
    expect(items.map((item) => item.filename)).toEqual(['a.jpg', 'b.jpg'])
  })
})

describe('AirportDisplayService on real server payloads', () => {
  function stubRealtime() {
    const emitted: Array<{ event: string; payload: unknown }> = []
    const realtime = {
      on: () => () => undefined,
      emit: (event: string, payload: unknown) => emitted.push({ event, payload }),
    } as unknown as RealtimeClient
    return { realtime, emitted }
  }

  // Shaped exactly as NormalizedAirportDisplayEvent.to_dict emits it.
  const event = {
    type: 'airport_display',
    event: 'zone_trigger',
    event_id: 'evt-7781',
    zone: 4,
    zone_name: 'Zone 4',
    timestamp: '2026-09-28T08:15:00',
    flight_info: { flight: 'SQ318', gate: 'A11' },
    slots: [
      {
        layout_id: '1',
        layout_name: 'Validation Flight Information',
        slot_id: 'text-1',
        slot_name: 'FlightHeading',
        slot_type: 'text',
        value: 'BOARDING SQ318',
      },
      {
        layout_id: '2',
        layout_name: 'Validation Gate Announcements',
        slot_id: 'media-1',
        slot_name: 'GateVisual',
        slot_type: 'media',
        value: '',
        media_mode: 'loop',
        temporary: true,
        media_items: [
          { filename: 'boarding.jpg', path: 'uploads/boarding.jpg', order: 1, duration: 10 },
          { filename: 'final-call.jpg', path: 'uploads/final-call.jpg', order: 2, duration: 10 },
        ],
      },
    ],
    announcement: {
      enabled: true,
      text: 'Now boarding flight SQ318 at gate A11',
      language: 'en',
      languages: [
        { language: 'en', order: 1, audio_url: '/tts/evt-7781-en.mp3' },
        { language: 'zh', order: 2, audio_url: '/tts/evt-7781-zh.mp3' },
      ],
    },
  }

  it('accepts the payload and exposes both slot overrides', () => {
    const { realtime } = stubRealtime()
    const service = new AirportDisplayService(realtime)
    const accepted = service.handle(event)

    expect(accepted).not.toBeNull()
    expect(accepted?.eventId).toBe('evt-7781')
    expect(accepted?.kind).toBe('zone_trigger')
    expect(service.activeOverrides.map((override) => override.slotName)).toEqual([
      'FlightHeading',
      'GateVisual',
    ])
  })

  it('reduces the media override to playable items rather than stringified objects', () => {
    const { realtime } = stubRealtime()
    const service = new AirportDisplayService(realtime)
    service.handle(event)

    const media = service.activeOverrides.find((override) => override.slotType === 'media')!
    expect(media.mediaItems.map((item) => item.filename)).toEqual([
      'boarding.jpg',
      'final-call.jpg',
    ])
    expect(media.mediaItems.map((item) => item.path)).toEqual([
      'uploads/boarding.jpg',
      'uploads/final-call.jpg',
    ])
  })

  it('carries both announcement tracks through to the content model', () => {
    const { realtime } = stubRealtime()
    const service = new AirportDisplayService(realtime)
    const accepted = service.handle(event)

    expect(accepted?.content.announcementEnabled).toBe(true)
    expect(accepted?.content.hasAnnouncement).toBe(true)
    expect(accepted?.content.playableAnnouncementLanguages.map((track) => track.language)).toEqual([
      'en',
      'zh',
    ])
  })

  it('stays silent for an event whose announcement is disabled', () => {
    const { realtime } = stubRealtime()
    const service = new AirportDisplayService(realtime)
    const accepted = service.handle({
      ...event,
      event_id: 'evt-7782',
      announcement: { enabled: false, text: 'Do not play me', language: 'en' },
    })

    expect(accepted?.content.announcementEnabled).toBe(false)
    expect(accepted?.content.hasAnnouncement).toBe(false)
  })

  it('ignores a redelivered event so an announcement cannot play twice', () => {
    const { realtime } = stubRealtime()
    const service = new AirportDisplayService(realtime)

    expect(service.handle(event)).not.toBeNull()
    expect(service.handle(event)).toBeNull()
  })

  it('acknowledges the event so the server stops retrying', () => {
    const { realtime, emitted } = stubRealtime()
    new AirportDisplayService(realtime).handle(event)

    expect(emitted).toHaveLength(1)
    expect(emitted[0]?.event).toBe('airport-display-status')
    expect(emitted[0]?.payload).toMatchObject({ event_id: 'evt-7781', status: 'applied' })
  })

  it('reverts temporary overrides while keeping permanent ones', () => {
    const { realtime } = stubRealtime()
    const service = new AirportDisplayService(realtime)
    service.handle({
      ...event,
      slots: [
        { slot_name: 'Permanent', slot_type: 'text', value: 'stays', temporary: false },
        { slot_name: 'Temporary', slot_type: 'text', value: 'goes', temporary: true },
      ],
    })

    expect(service.clearTemporaryOverrides()).toBe(1)
    expect(service.activeOverrides.map((override) => override.slotName)).toEqual(['Permanent'])
  })
})
