import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HttpClient, LayoutTransport, RealtimeClient, type RealtimeSocket } from '@core/transports'
import { PlaybackService } from '@core/services'
import { SchedulerService } from '@core/schedules'
import { AirportDisplayService } from '@core/airport-display'
import { SCHEMA_VERSION } from '@core/layouts/schema/version'
import { layoutSchema, type LayoutDefinition, type PlaylistDefinition } from '@core/layouts/schema/layout'
import { DEFAULT_PLAYER_CONFIGURATION, type PlayerConfiguration } from '@core/types'
import { LOOP_MEMBER_XML, LOOP_XML, SINGLE_LAYOUT_XML, parseXmlForTests } from './fixtures/dsxml'

function makeLayout(id: string, name = `Layout ${id}`): LayoutDefinition {
  return layoutSchema.parse({
    id,
    name,
    resolution: { width: 1920, height: 1080 },
    background: { color: '#000000' },
  })
}

function makePlaylist(entries: Array<{ layoutId: string; duration: number }>): PlaylistDefinition {
  return {
    id: 'p1',
    name: 'Rotation',
    revision: 'r1',
    transition: { style: 'fade', speedMs: 500, delayMs: 0 },
    entries: entries.map((entry, index) => ({
      layoutId: entry.layoutId,
      name: '',
      duration: entry.duration,
      order: index,
      enabled: true,
      source: null,
    })),
  }
}

describe('PlaybackService', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('emits the first layout on start', () => {
    const service = new PlaybackService()
    const listener = vi.fn()
    service.onChange(listener)

    service.load([makeLayout('1'), makeLayout('2')], makePlaylist([
      { layoutId: '1', duration: 10 },
      { layoutId: '2', duration: 10 },
    ]))
    service.start()

    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener.mock.calls[0]?.[1].id).toBe('1')
    service.stop()
  })

  it('advances to the next layout when the dwell time elapses', () => {
    const service = new PlaybackService()
    const listener = vi.fn()
    service.onChange(listener)

    service.load([makeLayout('1'), makeLayout('2')], makePlaylist([
      { layoutId: '1', duration: 10 },
      { layoutId: '2', duration: 5 },
    ]))
    service.start()

    vi.advanceTimersByTime(10_000)
    expect(service.position.layoutId).toBe('2')

    vi.advanceTimersByTime(5_000)
    expect(service.position.layoutId).toBe('1')
    service.stop()
  })

  it('resumes at the layout recorded before a restart', () => {
    const service = new PlaybackService()
    service.load([makeLayout('1'), makeLayout('2'), makeLayout('3')], null, '3')

    expect(service.position.index).toBe(2)
    expect(service.currentLayout?.id).toBe('3')
  })

  it('starts from the beginning when the recorded layout is gone', () => {
    const service = new PlaybackService()
    service.load([makeLayout('1'), makeLayout('2')], null, '99')
    expect(service.position.index).toBe(0)
  })

  it('preserves the remaining dwell time across pause and resume', () => {
    const service = new PlaybackService()
    service.load([makeLayout('1'), makeLayout('2')], makePlaylist([
      { layoutId: '1', duration: 10 },
      { layoutId: '2', duration: 10 },
    ]))
    service.start()

    vi.advanceTimersByTime(4_000)
    expect(service.pause('announcement')).toBe(true)

    // Time passing while paused must not advance the layout.
    vi.advanceTimersByTime(60_000)
    expect(service.position.layoutId).toBe('1')

    service.resume('announcement finished')
    vi.advanceTimersByTime(5_999)
    expect(service.position.layoutId).toBe('1')
    vi.advanceTimersByTime(2)
    expect(service.position.layoutId).toBe('2')
    service.stop()
  })

  it('ignores a resume when playback was never paused', () => {
    const service = new PlaybackService()
    service.load([makeLayout('1')], null)
    expect(service.resume('noop')).toBe(false)
  })

  it('does not transition or rotate a single-layout playlist', () => {
    const service = new PlaybackService()
    service.load([makeLayout('1')], makePlaylist([{ layoutId: '1', duration: 10 }]))
    service.start()

    // A single layout has nothing to transition to, and animating anyway
    // produced a visible flash in the legacy renderer.
    expect(service.transition.style).toBe('none')

    vi.advanceTimersByTime(60_000)
    expect(service.position.layoutId).toBe('1')
    service.stop()
  })

  it('keeps the current layout on screen when the playlist is refreshed', () => {
    const service = new PlaybackService()
    const listener = vi.fn()
    const playlist = makePlaylist([
      { layoutId: '1', duration: 10 },
      { layoutId: '2', duration: 10 },
    ])

    service.load([makeLayout('1'), makeLayout('2')], playlist)
    service.start()
    vi.advanceTimersByTime(10_000)
    expect(service.position.layoutId).toBe('2')

    service.onChange(listener)
    service.applyUpdate([makeLayout('1'), makeLayout('2', 'Renamed')], playlist)

    // Re-anchored by layout id, so a content update does not restart the loop.
    expect(service.position.layoutId).toBe('2')
    expect(listener.mock.calls[0]?.[1].name).toBe('Renamed')
    service.stop()
  })

  it('restarts cleanly when the layout on screen is removed from the playlist', () => {
    const service = new PlaybackService()
    service.load([makeLayout('1'), makeLayout('2')], makePlaylist([
      { layoutId: '1', duration: 10 },
      { layoutId: '2', duration: 10 },
    ]))
    service.start()
    vi.advanceTimersByTime(10_000)
    expect(service.position.layoutId).toBe('2')

    service.applyUpdate([makeLayout('7')], makePlaylist([{ layoutId: '7', duration: 10 }]))
    expect(service.position.layoutId).toBe('7')
    service.stop()
  })

  it('jumps to a layout by id and refuses an unknown one', () => {
    const service = new PlaybackService()
    service.load([makeLayout('1'), makeLayout('2')], null)
    service.start()

    expect(service.jumpTo('2')).toBe(true)
    expect(service.position.layoutId).toBe('2')
    expect(service.jumpTo('404')).toBe(false)
    expect(service.position.layoutId).toBe('2')
    service.stop()
  })

  it('stops scheduling once stopped', () => {
    const service = new PlaybackService()
    service.load([makeLayout('1'), makeLayout('2')], makePlaylist([
      { layoutId: '1', duration: 10 },
      { layoutId: '2', duration: 10 },
    ]))
    service.start()
    service.stop()

    vi.advanceTimersByTime(60_000)
    expect(service.position.layoutId).toBe('1')
  })
})

describe('SchedulerService', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('drives every listener from one shared timer', () => {
    const scheduler = new SchedulerService(1_000)
    const first = vi.fn()
    const second = vi.fn()
    scheduler.onTick(first)
    scheduler.onTick(second)
    scheduler.start()

    vi.advanceTimersByTime(3_000)

    expect(first.mock.calls.length).toBeGreaterThan(0)
    expect(first.mock.calls.length).toBe(second.mock.calls.length)
    scheduler.stop()
  })

  it('stops ticking after stop, leaving no orphaned timer', () => {
    const scheduler = new SchedulerService(1_000)
    const listener = vi.fn()
    scheduler.onTick(listener)
    scheduler.start()
    vi.advanceTimersByTime(2_000)

    const countAtStop = listener.mock.calls.length
    scheduler.stop()
    vi.advanceTimersByTime(10_000)

    expect(listener.mock.calls.length).toBe(countAtStop)
  })

  it('removes a listener through its unsubscribe function', () => {
    const scheduler = new SchedulerService(1_000)
    const unsubscribe = scheduler.onTick(vi.fn())
    expect(scheduler.listenerCount).toBe(1)

    unsubscribe()
    expect(scheduler.listenerCount).toBe(0)
  })

  it('keeps ticking when one listener throws', () => {
    const scheduler = new SchedulerService(1_000)
    const healthy = vi.fn()
    scheduler.onTick(() => {
      throw new Error('bad clock listener')
    })
    scheduler.onTick(healthy)
    scheduler.start()

    vi.advanceTimersByTime(3_000)
    expect(healthy.mock.calls.length).toBeGreaterThan(0)
    scheduler.stop()
  })
})

describe('LayoutTransport negotiation', () => {
  const configuration: PlayerConfiguration = {
    ...DEFAULT_PLAYER_CONFIGURATION,
    hostserver: 'https://cms.example.com/demo',
    displayId: '5',
    playerVersion: '4.0.0',
  }

  function jsonDocument() {
    return {
      schemaVersion: SCHEMA_VERSION,
      mode: 'layout',
      etag: 'rev-json',
      layout: {
        id: '42',
        name: 'From JSON',
        revision: 'rev-json',
        resolution: { width: 1920, height: 1080 },
        background: { color: '#000000' },
      },
    }
  }

  /** Builds a `fetch` stub that answers by URL suffix. */
  function stubFetch(handlers: Record<string, () => Response>) {
    return vi.fn(async (url: string | URL) => {
      const target = String(url)
      for (const [suffix, respond] of Object.entries(handlers)) {
        if (target.includes(suffix)) return respond()
      }
      return new Response('not found', { status: 404 })
    }) as unknown as typeof fetch
  }

  function jsonResponse(body: unknown, etag = 'rev-json'): Response {
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ETag: etag },
    })
  }

  function xmlResponse(xml: string): Response {
    return new Response(xml, { status: 200, headers: { 'Content-Type': 'text/xml' } })
  }

  function makeTransport(fetchImpl: typeof fetch, overrides: Partial<PlayerConfiguration> = {}) {
    return new LayoutTransport({
      http: new HttpClient(5_000, fetchImpl),
      configuration: { ...configuration, ...overrides },
      parseXml: parseXmlForTests,
    })
  }

  it('prefers the JSON Layout Definition API when the server offers it', async () => {
    const transport = makeTransport(stubFetch({ 'ds.json': () => jsonResponse(jsonDocument()) }))
    const outcome = await transport.fetchDocument()

    expect(outcome.status).toBe('updated')
    if (outcome.status !== 'updated') return
    expect(outcome.transport).toBe('json')
    expect(outcome.document.layout?.name).toBe('From JSON')
    expect(transport.activeTransport).toBe('json')
  })

  it('falls back to XML when the JSON endpoint does not exist', async () => {
    // This is the compatibility path that lets an updated player run against
    // an untouched CLESS-Server.
    const transport = makeTransport(
      stubFetch({
        'ds.json': () => new Response('', { status: 404 }),
        'ds.xml': () => xmlResponse(SINGLE_LAYOUT_XML),
      }),
    )

    const outcome = await transport.fetchDocument()

    expect(outcome.status).toBe('updated')
    if (outcome.status !== 'updated') return
    expect(outcome.transport).toBe('xml')
    expect(outcome.document.origin).toBe('xml-adapter')
    expect(outcome.document.layout?.name).toBe('Terminal Main')
  })

  it('remembers the negotiated transport instead of re-probing every poll', async () => {
    const fetchImpl = stubFetch({
      'ds.json': () => new Response('', { status: 404 }),
      'ds.xml': () => xmlResponse(SINGLE_LAYOUT_XML),
    })
    const transport = makeTransport(fetchImpl)

    await transport.fetchDocument()
    const callsAfterProbe = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls.length
    await transport.fetchDocument()
    const calls = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls
    const jsonProbes = calls.filter(([url]) => String(url).includes('ds.json')).length

    expect(calls.length).toBeGreaterThan(callsAfterProbe)
    expect(jsonProbes).toBe(1)
  })

  it('does not downgrade a modern server because of a transient 5xx', async () => {
    const transport = makeTransport(stubFetch({ 'ds.json': () => new Response('', { status: 503 }) }))
    const outcome = await transport.fetchDocument()

    expect(outcome.status).toBe('unreachable')
    expect(transport.activeTransport).toBeNull()
  })

  it('fetches loop members and inlines them when the root is a playlist', async () => {
    const transport = makeTransport(
      stubFetch({
        'ds.json': () => new Response('', { status: 404 }),
        '5/ds.xml': () => xmlResponse(LOOP_XML),
        'layout/42/ds.xml': () => xmlResponse(SINGLE_LAYOUT_XML),
        'layout/43/ds.xml': () => xmlResponse(LOOP_MEMBER_XML),
      }),
    )

    const outcome = await transport.fetchDocument()

    expect(outcome.status).toBe('updated')
    if (outcome.status !== 'updated') return
    expect(outcome.document.mode).toBe('playlist')
    expect(outcome.document.layouts.map((layout) => layout.id).sort()).toEqual(['42', '43'])
  })

  it('still plays a playlist when one member cannot be fetched', async () => {
    const transport = makeTransport(
      stubFetch({
        'ds.json': () => new Response('', { status: 404 }),
        '5/ds.xml': () => xmlResponse(LOOP_XML),
        'layout/42/ds.xml': () => xmlResponse(SINGLE_LAYOUT_XML),
        'layout/43/ds.xml': () => new Response('', { status: 500 }),
      }),
    )

    const outcome = await transport.fetchDocument()

    expect(outcome.status).toBe('updated')
    if (outcome.status !== 'updated') return
    expect(outcome.document.layouts).toHaveLength(1)
    expect(outcome.document.playlist?.entries).toHaveLength(2)
  })

  it('reports an invalid JSON document instead of accepting it', async () => {
    const transport = makeTransport(
      stubFetch({ 'ds.json': () => jsonResponse({ schemaVersion: SCHEMA_VERSION, mode: 'layout' }) }),
    )

    const outcome = await transport.fetchDocument()
    expect(outcome.status).toBe('invalid')
  })

  it('rejects a document whose schema major version is unknown', async () => {
    const transport = makeTransport(
      stubFetch({ 'ds.json': () => jsonResponse({ ...jsonDocument(), schemaVersion: '9.0' }) }),
    )

    const outcome = await transport.fetchDocument()
    expect(outcome.status).toBe('invalid')
  })

  it('accepts a newer minor version, since additions are backward compatible', async () => {
    const transport = makeTransport(
      stubFetch({
        'ds.json': () => jsonResponse({ ...jsonDocument(), schemaVersion: '1.7', futureField: 'ignored' }),
      }),
    )

    const outcome = await transport.fetchDocument()
    expect(outcome.status).toBe('updated')
  })

  it('passes an ETag through and reports a 304 as unchanged', async () => {
    const seenHeaders: Array<Record<string, string>> = []
    const fetchImpl = vi.fn(async (_url: string | URL, init?: RequestInit) => {
      seenHeaders.push((init?.headers ?? {}) as Record<string, string>)
      return new Response(null, { status: 304, headers: { ETag: 'rev-json' } })
    }) as unknown as typeof fetch

    const transport = makeTransport(fetchImpl, { transport: 'json' })
    const outcome = await transport.fetchDocument('rev-json')

    expect(outcome.status).toBe('not-modified')
    expect(seenHeaders[0]?.['If-None-Match']).toBe('rev-json')
  })

  it('reports the player version so the server can record a heartbeat', async () => {
    const fetchImpl = stubFetch({ 'ds.json': () => jsonResponse(jsonDocument()) })
    const transport = makeTransport(fetchImpl)
    await transport.fetchDocument()

    const requestedUrl = String((fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0]?.[0])
    expect(requestedUrl).toContain('v=4.0.0')
  })

  it('honours an explicit xml transport setting without probing JSON', async () => {
    const fetchImpl = stubFetch({ 'ds.xml': () => xmlResponse(SINGLE_LAYOUT_XML) })
    const transport = makeTransport(fetchImpl, { transport: 'xml' })

    await transport.fetchDocument()
    const calls = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls
    expect(calls.every(([url]) => !String(url).includes('ds.json'))).toBe(true)
  })

  it('reports XML as unavailable when the host has no parser', async () => {
    const transport = new LayoutTransport({
      http: new HttpClient(5_000, stubFetch({ 'ds.xml': () => xmlResponse(SINGLE_LAYOUT_XML) })),
      configuration: { ...configuration, transport: 'xml' },
      parseXml: null,
    })

    const outcome = await transport.fetchDocument()
    expect(outcome.status).toBe('unreachable')
  })
})

describe('AirportDisplayService', () => {
  /** In-memory socket that records emissions and can inject events. */
  function fakeSocket() {
    const handlers = new Map<string, Set<(payload: unknown) => void>>()
    const emitted: Array<{ event: string; payload: unknown }> = []

    const socket: RealtimeSocket = {
      connected: true,
      on(event, handler) {
        const set = handlers.get(event) ?? new Set()
        set.add(handler)
        handlers.set(event, set)
      },
      off(event, handler) {
        handlers.get(event)?.delete(handler)
      },
      emit(event, payload) {
        emitted.push({ event, payload })
      },
    }

    function dispatch(event: string, payload: unknown): void {
      for (const handler of handlers.get(event) ?? []) handler(payload)
    }

    return { socket, emitted, dispatch, handlers }
  }

  function zoneEvent(eventId: string) {
    return {
      type: 'airport_display',
      event: 'zone_trigger',
      event_id: eventId,
      flight_info: { flight: 'SQ318', gate: 'A12' },
      slots: [
        { slot_name: 'headline', slot_type: 'text', value: 'Now boarding zone 2', temporary: true },
        { slot_name: 'hero', slot_type: 'media', media_items: ['7/boarding.jpg'], temporary: true },
      ],
      announcement: {
        enabled: true,
        text: 'Now boarding',
        language: 'en',
        languages: [
          { language: 'en', text: 'Now boarding', audio_url: 'https://cms/a-en.mp3', order: 1 },
          { language: 'zh', text: '开始登机', audio_url: 'https://cms/a-zh.mp3', order: 2 },
        ],
      },
    }
  }

  it('applies slot overrides from a zone trigger', () => {
    const { socket, dispatch } = fakeSocket()
    const realtime = new RealtimeClient()
    realtime.attach(socket)
    const service = new AirportDisplayService(realtime)
    service.start()

    dispatch('airport-display', zoneEvent('evt-1'))

    const overrides = service.activeOverrides
    expect(overrides.map((override) => override.slotName).sort()).toEqual(['headline', 'hero'])

    const hero = overrides.find((override) => override.slotName === 'hero')
    expect(hero?.mediaItems.map((item) => item.path)).toEqual(['7/boarding.jpg'])
    expect(hero?.mediaItems.map((item) => item.filename)).toEqual(['boarding.jpg'])
  })

  it('preserves the server announcement language order', () => {
    const { socket, dispatch } = fakeSocket()
    const realtime = new RealtimeClient()
    realtime.attach(socket)
    const service = new AirportDisplayService(realtime)
    service.start()

    dispatch('airport-display', zoneEvent('evt-2'))

    const languages = service.mostRecentEvent?.content.announcementLanguages ?? []
    expect(languages.map((language) => language.language)).toEqual(['en', 'zh'])
    expect(languages[0]?.audioUrl).toBe('https://cms/a-en.mp3')
  })

  it('ignores a redelivered event so an announcement never plays twice', () => {
    const { socket, dispatch } = fakeSocket()
    const realtime = new RealtimeClient()
    realtime.attach(socket)
    const service = new AirportDisplayService(realtime)
    const listener = vi.fn()
    service.onEvent(listener)
    service.start()

    dispatch('airport-display', zoneEvent('evt-3'))
    dispatch('airport-display', zoneEvent('evt-3'))

    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('acknowledges the event so the server can stop retrying', () => {
    const { socket, dispatch, emitted } = fakeSocket()
    const realtime = new RealtimeClient()
    realtime.attach(socket)
    const service = new AirportDisplayService(realtime)
    service.start()

    dispatch('airport-display', zoneEvent('evt-4'))

    expect(emitted.some((entry) => entry.event === 'airport-display-status')).toBe(true)
  })

  it('clears temporary overrides but keeps permanent ones', () => {
    const realtime = new RealtimeClient()
    const service = new AirportDisplayService(realtime)

    service.handle({
      event_id: 'evt-5',
      slots: [
        { slot_name: 'a', value: 'temp', temporary: true },
        { slot_name: 'b', value: 'permanent', temporary: false },
      ],
    })

    expect(service.clearTemporaryOverrides()).toBe(1)
    expect(service.activeOverrides.map((override) => override.slotName)).toEqual(['b'])
  })

  it('rejects a payload that is not an object', () => {
    const service = new AirportDisplayService(new RealtimeClient())
    expect(service.handle('not-an-event')).toBeNull()
  })

  it('removes its listener on stop', () => {
    const { socket, dispatch, handlers } = fakeSocket()
    const realtime = new RealtimeClient()
    realtime.attach(socket)
    const service = new AirportDisplayService(realtime)
    const listener = vi.fn()
    service.onEvent(listener)

    service.start()
    service.stop()
    dispatch('airport-display', zoneEvent('evt-6'))

    expect(listener).not.toHaveBeenCalled()
    expect(handlers.get('airport-display')?.size ?? 0).toBe(0)
  })
})

describe('RealtimeClient', () => {
  function fakeSocket() {
    const handlers = new Map<string, Set<(payload: unknown) => void>>()
    const socket: RealtimeSocket = {
      connected: true,
      on(event, handler) {
        const set = handlers.get(event) ?? new Set()
        set.add(handler)
        handlers.set(event, set)
      },
      off(event, handler) {
        handlers.get(event)?.delete(handler)
      },
      emit: vi.fn(),
    }
    return { socket, handlers }
  }

  it('re-attaching does not leave a duplicate listener behind', () => {
    // The legacy player applied some socket events twice for exactly this
    // reason after a layout change re-registered its handlers.
    const client = new RealtimeClient()
    const first = fakeSocket()
    const listener = vi.fn()

    client.attach(first.socket)
    client.on('content-update', listener)
    client.attach(first.socket)

    expect(first.handlers.get('content-update')?.size).toBe(1)
  })

  it('moves subscriptions onto a replacement socket', () => {
    const client = new RealtimeClient()
    const first = fakeSocket()
    const second = fakeSocket()

    client.attach(first.socket)
    client.on('content-update', vi.fn())
    client.attach(second.socket)

    expect(first.handlers.get('content-update')?.size).toBe(0)
    expect(second.handlers.get('content-update')?.size).toBe(1)
  })

  it('keeps delivering events after a handler throws', () => {
    const client = new RealtimeClient()
    const { socket, handlers } = fakeSocket()
    client.attach(socket)

    const healthy = vi.fn()
    client.on('tick', () => {
      throw new Error('handler exploded')
    })
    client.on('tick', healthy)

    for (const handler of handlers.get('tick') ?? []) handler({})
    expect(healthy).toHaveBeenCalledTimes(1)
  })

  it('drops emissions when no socket is connected', () => {
    const client = new RealtimeClient()
    expect(client.emit('player-status', {})).toBe(false)
  })
})
