import { describe, expect, it } from 'vitest'
import { XmlLayoutAdapter } from '@core/transports/xml'
import { validateLayoutDocument } from '@core/layouts/schema'
import { LOOP_MEMBER_XML, LOOP_XML, SINGLE_LAYOUT_XML, parseXmlForTests } from './fixtures/dsxml'

const adapter = new XmlLayoutAdapter({
  serverBaseUrl: 'https://cms.example.com/demo',
  displayId: '5',
})

function adaptSingleLayout() {
  return adapter.adaptDocument(parseXmlForTests(SINGLE_LAYOUT_XML))
}

describe('XmlLayoutAdapter', () => {
  it('produces a document that satisfies the layout schema', () => {
    const result = validateLayoutDocument(adaptSingleLayout())
    expect(result.ok).toBe(true)
  })

  it('maps layout-level attributes including the bgscretch spelling', () => {
    const layout = adaptSingleLayout().layout!

    expect(layout.id).toBe('42')
    expect(layout.name).toBe('Terminal Main')
    expect(layout.revision).toBe('20260927101500')
    expect(layout.refreshInterval).toBe(90)
    expect(layout.autoscale).toBe(true)
    expect(layout.background.stretch).toBe(true)
    expect(layout.background.color).toBe('#101418')
  })

  it('parses the underscored resolution format with orientation', () => {
    const layout = adaptSingleLayout().layout!
    expect(layout.resolution).toEqual({ width: 1920, height: 1080, orientation: 'landscape' })
  })

  it('absolutises the media base and the background image', () => {
    const layout = adaptSingleLayout().layout!
    expect(layout.mediaBaseUrl).toBe('https://cms.example.com/media/uploads')
    expect(layout.background.image).toBe('https://cms.example.com/media/uploads/lobby-bg.jpg')
  })

  it('carries the display identity and schedule from the root element', () => {
    const document = adaptSingleLayout()
    expect(document.display?.name).toBe('Gate A12')
    expect(document.display?.scheduleId).toBe('7')
  })

  it('converts every slot element in document order', () => {
    const slots = adaptSingleLayout().layout!.slots
    expect(slots.map((slot) => slot.type)).toEqual([
      'table',
      'html',
      'widget',
      'media',
      'text',
      'ticker',
      'scroller',
      'fader',
      'datetime',
      'holovideo',
    ])
  })

  it('stacks slots by document order, ignoring the layer attribute', () => {
    // The server pre-sorts slots by layer and several types emit layer="0",
    // so document order is what reproduces the legacy z-index exactly.
    const slots = adaptSingleLayout().layout!.slots
    const media = slots[3]!
    const widget = slots[2]!

    expect(media.geometry.layer).toBe(3)
    expect(widget.geometry.layer).toBe(2)
    expect(slots.map((slot) => slot.geometry.layer)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
  })

  it('keeps disabled slots in the definition so tooling can still see them', () => {
    const scroller = adaptSingleLayout().layout!.slots.find((slot) => slot.type === 'scroller')
    expect(scroller?.enabled).toBe(false)
  })

  it('reads Y/N attributes as booleans', () => {
    const text = adaptSingleLayout().layout!.slots.find((slot) => slot.type === 'text')!
    expect(text.enabled).toBe(true)
    expect(text.transparent).toBe(true)
  })

  it('normalises typography attributes onto the schema vocabulary', () => {
    const text = adaptSingleLayout().layout!.slots.find((slot) => slot.type === 'text')!
    expect(text.config['fontSize']).toBe(42)
    expect(text.config['fontColor']).toBe('#f4f7fa')
    expect(text.config['fontStyle']).toBe('bold,italic')
    expect(text.config['align']).toBe('c')
  })

  it('maps media items with durations and stream syntax intact', () => {
    const media = adaptSingleLayout().layout!.slots.find((slot) => slot.type === 'media')!
    expect(media.items).toHaveLength(3)
    expect(media.items[0]).toMatchObject({ id: '101', duration: 12, text: '7/promo-loop.mp4' })
    expect(media.items[2]?.text).toBe('{rtsp:cam-01.local/stream1}')
  })

  it('extracts widget schedule windows only when the slot opts in', () => {
    const slots = adaptSingleLayout().layout!.slots
    const widget = slots.find((slot) => slot.type === 'widget')!
    const media = slots.find((slot) => slot.type === 'media')!

    expect(widget.schedule).toEqual({
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      startTime: '06:00',
      endTime: '23:30',
      days: [1, 2, 3, 4, 5],
    })
    expect(media.schedule).toBeNull()
  })

  it('camelCases unmapped item attributes into item data', () => {
    const widget = adaptSingleLayout().layout!.slots.find((slot) => slot.type === 'widget')!
    expect(widget.items[0]?.data).toMatchObject({ refresh: '15', offline: 'Y', renderer: 'webview' })
  })

  it('builds table columns keyed to the record column names', () => {
    const table = adaptSingleLayout().layout!.slots.find((slot) => slot.type === 'table')!
    const columns = table.config['columns'] as Array<Record<string, unknown>>

    expect(columns.map((column) => column['key'])).toEqual(['col01', 'col02', 'col03'])
    expect(columns.map((column) => column['label'])).toEqual(['Flight', 'Destination', 'Airline'])
    expect(columns[2]?.['backgroundEnabled']).toBe(true)
  })

  it('moves the records block into a dataset bound to its table slot', () => {
    const layout = adaptSingleLayout().layout!
    const table = layout.slots.find((slot) => slot.type === 'table')!
    const datasets = layout.datasets

    expect(datasets).toHaveLength(1)
    expect(datasets[0]?.slotId).toBe(table.id)
    expect(datasets[0]?.rows).toHaveLength(4)
    expect(datasets[0]?.rows[0]?.['col01']).toBe('SQ318')
    expect(datasets[0]?.columns).toEqual(['col01', 'col02', 'col03'])
  })

  it('qualifies slot ids by element name so per-type primary keys cannot collide', () => {
    // The `id` attribute is a primary key from a per-type table, so two slots
    // of different types in one layout can both claim id "1". Unqualified,
    // one would overwrite the other in every id-keyed lookup.
    const xml = parseXmlForTests(
      '<Configuration update="1" id="1" layout="Collision">' +
        '<display><slots><table id="1" title="Departures"/><text id="1" name="Heading"/></slots></display>' +
        '</Configuration>',
    )
    const slots = adapter.adaptDocument(xml).layout!.slots

    expect(slots.map((slot) => slot.id)).toEqual(['table-1', 'text-1'])
  })

  it('reads a table slot name from title, where the server puts it', () => {
    // Every other slot type carries its name in `name`; `table` uses `title`.
    // Both have to land on `name` or an Airport Display override, which
    // addresses a slot by name, can never target a table.
    const table = adaptSingleLayout().layout!.slots.find((slot) => slot.type === 'table')!
    expect(table.name).toBe('Departures')
  })

  it('derives an asset manifest from library media, excluding streams', () => {
    const assets = adaptSingleLayout().layout!.assets
    expect(assets.map((asset) => asset.path)).toEqual(['7/promo-loop.mp4', '7/gate-signage.jpg'])
    expect(assets.every((asset) => asset.version === '20260927101500')).toBe(true)
  })

  it('passes an unknown slot element through as an unknown content type', () => {
    // This is the forward-compatibility guarantee: the server can ship a new
    // slot type and an older player keeps rendering the rest of the layout.
    const future = adaptSingleLayout().layout!.slots.find((slot) => slot.type === 'holovideo')

    expect(future).toBeDefined()
    expect(future?.config).toMatchObject({ depth: '3', codec: 'av1' })
    expect(future?.items[0]?.text).toBe('future/asset.hvid')
  })
})

describe('XmlLayoutAdapter loop handling', () => {
  function adaptLoop() {
    return adapter.adaptDocument(parseXmlForTests(LOOP_XML), [parseXmlForTests(LOOP_MEMBER_XML)])
  }

  it('recognises the Configure/loop root as a playlist', () => {
    const document = adaptLoop()
    expect(document.mode).toBe('playlist')
    expect(validateLayoutDocument(document).ok).toBe(true)
  })

  it('maps loop entries with their durations and layout ids', () => {
    const playlist = adaptLoop().playlist!
    expect(playlist.name).toBe('Terminal Rotation')
    expect(playlist.entries).toEqual([
      expect.objectContaining({ layoutId: '42', duration: 25, order: 0 }),
      expect.objectContaining({ layoutId: '43', duration: 15, order: 1 }),
    ])
  })

  it('maps loop transition attributes', () => {
    expect(adaptLoop().playlist!.transition).toEqual({ style: 'fade', speedMs: 1200, delayMs: 150 })
  })

  it('inlines the member layouts that were supplied', () => {
    const layouts = adaptLoop().layouts
    expect(layouts).toHaveLength(1)
    expect(layouts[0]?.id).toBe('43')
    expect(layouts[0]?.autoscale).toBe(false)
    expect(layouts[0]?.background.image).toBeNull()
  })

  it('carries the cluster sync master address', () => {
    expect(adaptLoop().display?.syncMasterIp).toBe('10.4.1.20')
  })

  it('extracts a layout id from a preview URL', () => {
    expect(XmlLayoutAdapter.layoutIdFromUrl('https://host/demo/layout/42/ds.xml')).toBe('42')
    expect(XmlLayoutAdapter.layoutIdFromUrl('https://host/demo/ds.xml')).toBeNull()
  })
})

describe('XmlLayoutAdapter resilience', () => {
  it('adapts a document whose display and slots are missing entirely', () => {
    const minimal = parseXmlForTests('<Configuration update="1" id="1" layout="Empty"/>')
    const document = adapter.adaptDocument(minimal)

    expect(document.layout?.slots).toEqual([])
    expect(document.layout?.datasets).toEqual([])
    expect(validateLayoutDocument(document).ok).toBe(true)
  })

  it('tolerates a loop whose members could not be fetched', () => {
    const document = adapter.adaptDocument(parseXmlForTests(LOOP_XML), [])
    expect(document.mode).toBe('playlist')
    expect(document.layouts).toEqual([])
    expect(document.playlist?.entries).toHaveLength(2)
  })
})
