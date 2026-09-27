import { describe, expect, it } from 'vitest'
import {
  ClockContent,
  EmbedContent,
  MediaContent,
  TableContent,
  TextContent,
  TickerContent,
  UnsupportedContent,
} from '@/core/content'
import { BUILTIN_CONTENT_PLUGINS, ContentPluginRegistry, type ContentBuildContext } from '@/core/plugins'
import { XmlLayoutAdapter } from '@/core/adapters'
import { contentSlotSchema, type ContentSlotDefinition, type DatasetDefinition } from '@/core/schema/layout'
import { SINGLE_LAYOUT_XML, parseXmlForTests } from './fixtures/dsxml'

const adapter = new XmlLayoutAdapter({ serverBaseUrl: 'https://cms.example.com/demo', displayId: '5' })
const layout = adapter.adaptDocument(parseXmlForTests(SINGLE_LAYOUT_XML)).layout!

function slotOfType(type: string): ContentSlotDefinition {
  const slot = layout.slots.find((candidate) => candidate.type === type)
  if (!slot) throw new Error(`fixture has no ${type} slot`)
  return slot
}

function buildContext(overrides: Partial<ContentBuildContext> = {}): ContentBuildContext {
  const datasets = new Map(layout.datasets.map((dataset) => [dataset.slotId, dataset]))
  return {
    layout,
    mediaBaseUrl: layout.mediaBaseUrl,
    serverOrigin: 'https://cms.example.com',
    datasetFor: (slotId) => datasets.get(slotId) ?? null,
    ...overrides,
  }
}

function makeRegistry(): ContentPluginRegistry {
  return new ContentPluginRegistry().registerAll(BUILTIN_CONTENT_PLUGINS)
}

function slot(partial: Record<string, unknown>): ContentSlotDefinition {
  return contentSlotSchema.parse({
    type: 'text',
    id: 's1',
    geometry: { top: 0, left: 0, width: 100, height: 100 },
    ...partial,
  })
}

describe('ContentPluginRegistry', () => {
  it('registers every built-in content type', () => {
    expect(makeRegistry().types).toEqual([
      'airport-display',
      'date',
      'datetime',
      'fader',
      'html',
      'media',
      'scroller',
      'table',
      'text',
      'ticker',
      'time',
      'widget',
    ])
  })

  it('builds the right content class for each type', () => {
    const registry = makeRegistry()
    const context = buildContext()

    expect(registry.create(slotOfType('media'), context)).toBeInstanceOf(MediaContent)
    expect(registry.create(slotOfType('text'), context)).toBeInstanceOf(TextContent)
    expect(registry.create(slotOfType('ticker'), context)).toBeInstanceOf(TickerContent)
    expect(registry.create(slotOfType('datetime'), context)).toBeInstanceOf(ClockContent)
    expect(registry.create(slotOfType('widget'), context)).toBeInstanceOf(EmbedContent)
    expect(registry.create(slotOfType('table'), context)).toBeInstanceOf(TableContent)
  })

  it('falls back to a placeholder for an unregistered content type', () => {
    const content = makeRegistry().create(slotOfType('holovideo'), buildContext())

    expect(content).toBeInstanceOf(UnsupportedContent)
    expect(content.type).toBe('holovideo')
  })

  it('reports unsupported types found in a layout', () => {
    expect(makeRegistry().unsupportedTypes(layout.slots)).toEqual(['holovideo'])
  })

  it('does not report a config error for an unknown type', () => {
    // An unknown type is a compatibility signal, not a misconfiguration.
    expect(makeRegistry().validate(slotOfType('holovideo'))).toEqual([])
  })

  it('surfaces plugin validation problems', () => {
    const registry = makeRegistry()
    const emptyMedia = slot({ type: 'media', id: 'm1', items: [] })

    expect(registry.validate(emptyMedia)).toContain('slot has no playable media items')
  })

  it('reports only the slots that have problems', () => {
    const registry = makeRegistry()
    const reports = registry.validateAll([
      slotOfType('text'),
      slot({ type: 'media', id: 'm1', items: [] }),
      slot({ type: 'table', id: 't1', config: {} }),
    ])

    expect(reports.map((report) => report.slotId)).toEqual(['m1', 't1'])
  })

  it('degrades to a placeholder when a plugin throws', () => {
    const registry = new ContentPluginRegistry().register({
      type: 'broken',
      displayName: 'Broken',
      component: {},
      create: () => {
        throw new Error('plugin exploded')
      },
    })

    const content = registry.create(slot({ type: 'broken' }), buildContext())
    expect(content).toBeInstanceOf(UnsupportedContent)
    expect(content.error).toBe('plugin exploded')
  })

  it('lets a late registration replace an earlier one', () => {
    const registry = makeRegistry()
    const marker = {}
    registry.register({ type: 'text', displayName: 'Custom Text', component: marker, create: (definition) => new TextContent(definition) })

    expect(registry.componentFor('text')).toBe(marker)
  })
})

describe('BaseContent', () => {
  it('excludes disabled items and orders the rest', () => {
    const content = new TextContent(
      slot({
        items: [
          { id: 'b', order: 2, text: 'second' },
          { id: 'a', order: 1, text: 'first' },
          { id: 'c', order: 0, text: 'skipped', enabled: false },
        ],
      }),
    )

    expect(content.items.map((item) => item.id)).toEqual(['a', 'b'])
    expect(content.currentItem?.text).toBe('first')
  })

  it('wraps the rotation cursor', () => {
    const content = new TextContent(
      slot({ items: [{ id: 'a', text: 'a' }, { id: 'b', text: 'b' }] }),
    )

    expect(content.advance()?.id).toBe('b')
    expect(content.advance()?.id).toBe('a')
  })

  it('rejects an out-of-range seek without moving the cursor', () => {
    const content = new TextContent(slot({ items: [{ id: 'a', text: 'a' }] }))

    expect(content.seek(5)).toBe(false)
    expect(content.currentIndex).toBe(0)
  })

  it('treats a slot with no schedule as always visible', () => {
    const content = new TextContent(slot({}))
    expect(content.isScheduledAt(new Date(2026, 0, 1, 3, 0))).toBe(true)
  })

  it('honours the time window and weekday list', () => {
    const content = new TextContent(
      slot({
        schedule: { startTime: '09:00', endTime: '17:00', days: [1, 2, 3, 4, 5] },
      }),
    )

    // Monday 2026-09-28
    expect(content.isScheduledAt(new Date(2026, 8, 28, 10, 0))).toBe(true)
    expect(content.isScheduledAt(new Date(2026, 8, 28, 18, 0))).toBe(false)
    // Sunday 2026-09-27 is outside the weekday list
    expect(content.isScheduledAt(new Date(2026, 8, 27, 10, 0))).toBe(false)
  })

  it('handles a window that wraps past midnight', () => {
    const content = new TextContent(slot({ schedule: { startTime: '22:00', endTime: '04:00' } }))

    expect(content.isScheduledAt(new Date(2026, 8, 27, 23, 0))).toBe(true)
    expect(content.isScheduledAt(new Date(2026, 8, 27, 2, 0))).toBe(true)
    expect(content.isScheduledAt(new Date(2026, 8, 27, 12, 0))).toBe(false)
  })

  it('honours the date window', () => {
    const content = new TextContent(slot({ schedule: { startDate: '2026-06-01', endDate: '2026-06-30' } }))

    expect(content.isScheduledAt(new Date(2026, 5, 15))).toBe(true)
    expect(content.isScheduledAt(new Date(2026, 6, 15))).toBe(false)
  })

  it('reports transparency instead of a background colour', () => {
    expect(new TextContent(slot({ transparent: true, backgroundColor: '#ff0000' })).backgroundColor).toBeNull()
  })
})

describe('MediaContent', () => {
  it('resolves every item source at construction', () => {
    const content = new MediaContent(slotOfType('media'), layout.mediaBaseUrl)

    expect(content.sources).toHaveLength(3)
    expect(content.sources[0]?.url).toBe('https://cms.example.com/media/uploads/7/promo-loop.mp4')
    expect(content.sources[2]?.isStreaming).toBe(true)
  })

  it('gives a still image a default dwell so it advances', () => {
    const content = new MediaContent(
      slot({ type: 'media', items: [{ id: 'i1', text: '7/a.jpg', duration: 0 }] }),
      'https://host/media',
    )

    expect(content.dwellMsFor(0)).toBe(10_000)
  })

  it('lets a video with no duration run to its natural end', () => {
    const content = new MediaContent(
      slot({ type: 'media', items: [{ id: 'i1', text: '7/a.mp4', duration: 0 }] }),
      'https://host/media',
    )

    expect(content.dwellMsFor(0)).toBe(0)
    expect(content.sources[0]?.endsNaturally).toBe(true)
  })

  it('uses the authored duration when one is given', () => {
    const content = new MediaContent(slotOfType('media'), layout.mediaBaseUrl)
    expect(content.dwellMsFor(0)).toBe(12_000)
  })

  it('defaults to muted playback', () => {
    expect(new MediaContent(slot({ type: 'media' }), '').muted).toBe(true)
  })
})

describe('TickerContent', () => {
  it('maps the direction attribute per orientation', () => {
    const horizontal = new TickerContent(slot({ config: { direction: 'righttoleft' } }), 'horizontal')
    const vertical = new TickerContent(slot({ config: { direction: 'scrollup' } }), 'vertical')

    expect(horizontal.direction).toBe('left')
    expect(vertical.direction).toBe('up')
  })

  it('inverts the speed enum into an animation duration', () => {
    const slow = new TickerContent(slot({ config: { speed: 1 } }), 'horizontal')
    const fast = new TickerContent(slot({ config: { speed: 5 } }), 'horizontal')

    expect(fast.animationDurationSeconds).toBeLessThan(slow.animationDurationSeconds)
  })

  it('clamps an out-of-range speed', () => {
    expect(new TickerContent(slot({ config: { speed: 99 } }), 'horizontal').speedLevel).toBe(5)
    expect(new TickerContent(slot({ config: { speed: -3 } }), 'horizontal').speedLevel).toBe(1)
  })

  it('joins all items into one scrolling message', () => {
    const content = new TickerContent(
      slot({ items: [{ id: 'a', text: 'One' }, { id: 'b', text: 'Two' }] }),
      'horizontal',
    )

    expect(content.message).toContain('One')
    expect(content.message).toContain('Two')
  })
})

describe('ClockContent', () => {
  const sample = new Date(2026, 8, 27, 14, 5, 9)

  it('applies the server format attribute', () => {
    const content = new ClockContent(slotOfType('datetime'), 'datetime')
    expect(content.render(sample)).toBe('27/Sep/2026 02:05 PM')
  })

  it('uses a per-kind default when no format is given', () => {
    expect(new ClockContent(slot({}), 'date').render(sample)).toBe('27/09/2026')
    expect(new ClockContent(slot({}), 'time').render(sample)).toBe('14:05:09')
  })

  it('ticks a date slot less often than a clock', () => {
    expect(new ClockContent(slot({}), 'date').tickIntervalMs).toBe(30_000)
    expect(new ClockContent(slot({}), 'time').tickIntervalMs).toBe(1_000)
  })
})

describe('EmbedContent', () => {
  it('absolutises a server-relative widget URL', () => {
    const content = new EmbedContent(
      slot({ type: 'widget', items: [{ id: 'w1', text: '/demo/widget/1/preview' }] }),
      'widget',
      'https://cms.example.com',
    )

    expect(content.currentTarget?.url).toBe('https://cms.example.com/demo/widget/1/preview')
  })

  it('preserves an absolute URL', () => {
    const content = new EmbedContent(slotOfType('widget'), 'widget', 'https://cms.example.com')
    expect(content.currentTarget?.url).toBe('https://cms.example.com/demo/widget/55/preview')
  })

  it('carries the refresh interval and offline capability from the item', () => {
    const content = new EmbedContent(slotOfType('widget'), 'widget', 'https://cms.example.com')

    expect(content.currentTarget?.refreshSeconds).toBe(15)
    expect(content.currentTarget?.allowOffline).toBe(true)
  })

  it('never treats an HTML slot as interactive', () => {
    const content = new EmbedContent(
      slot({ type: 'html', config: { interactive: true } }),
      'html',
      'https://cms.example.com',
    )
    expect(content.interactive).toBe(false)
  })
})

describe('TableContent', () => {
  function makeTable(dataset: DatasetDefinition | null = layout.datasets[0] ?? null) {
    return new TableContent(slotOfType('table'), dataset)
  }

  it('reads columns and their labels from the config', () => {
    expect(makeTable().columns.map((column) => column.label)).toEqual(['Flight', 'Destination', 'Airline'])
  })

  it('normalises relative column widths into percentages that fill the slot', () => {
    const widths = makeTable().columnWidths.map((width) => Number.parseFloat(width))
    expect(widths.reduce((sum, width) => sum + width, 0)).toBeCloseTo(100, 2)
  })

  it('shares width equally when no column declares one', () => {
    const table = new TableContent(
      slot({ type: 'table', config: { columns: [{ key: 'col01' }, { key: 'col02' }] } }),
      null,
    )
    expect(table.columnWidths).toEqual(['50.0000%', '50.0000%'])
  })

  it('decodes plain text cells', () => {
    expect(makeTable().rows[0]?.cells[0]).toEqual({
      text: 'SQ318',
      values: ['SQ318'],
      imagePaths: [],
      rotate: false,
    })
  })

  it('takes an image cell file list from after the last colon', () => {
    // `image:fade:4:sq.png,sq-alt.png` — the transition metadata is skipped.
    const cell = makeTable().rows[0]?.cells[2]
    expect(cell?.imagePaths).toEqual(['sq.png', 'sq-alt.png'])
    expect(cell?.rotate).toBe(true)
  })

  it('takes a transition cell value list from after the first colon', () => {
    const cell = makeTable().rows[2]?.cells[2]
    expect(cell?.text).toBe('On Time')
    expect(cell?.values).toEqual(['On Time', 'Boarding'])
    expect(cell?.imagePaths).toEqual([])
  })

  it('keeps colons inside a fader value intact', () => {
    // A fader payload is split on the first colon only, so a time like
    // "18:40" in the text survives.
    const cell = makeTable().rows[3]?.cells[2]
    expect(cell?.values).toEqual(['Delayed', 'New time 18:40'])
  })

  it('preserves the per-row inline style the server emits', () => {
    expect(makeTable().rows[0]?.inlineStyle).toBe('color:#ff9900')
  })

  it('caps rows when the row limit is enabled', () => {
    const table = new TableContent(
      slot({ type: 'table', config: { columns: [{ key: 'col01' }], maxRowsEnabled: true, maxRows: 2 } }),
      { slotId: 't', revision: '', columns: ['col01'], rows: [{ col01: 'a' }, { col01: 'b' }, { col01: 'c' }] },
    )

    expect(table.rows).toHaveLength(2)
  })

  it('paginates and wraps back to the first page', () => {
    const table = new TableContent(
      slot({ type: 'table', config: { columns: [{ key: 'col01' }], rowsPerPage: 2 } }),
      { slotId: 't', revision: '', columns: ['col01'], rows: [{ col01: 'a' }, { col01: 'b' }, { col01: 'c' }] },
    )

    expect(table.pageCount).toBe(2)
    expect(table.visibleRows).toHaveLength(2)

    expect(table.advancePage()).toBe(false)
    expect(table.visibleRows).toHaveLength(1)
    expect(table.advancePage()).toBe(true)
    expect(table.currentPage).toBe(0)
  })

  it('replaces rows without resetting the page when it is still valid', () => {
    const table = new TableContent(
      slot({ type: 'table', config: { columns: [{ key: 'col01' }], rowsPerPage: 1 } }),
      { slotId: 't', revision: 'r1', columns: ['col01'], rows: [{ col01: 'a' }, { col01: 'b' }] },
    )

    table.setPage(1)
    table.applyDataset({ slotId: 't', revision: 'r2', columns: ['col01'], rows: [{ col01: 'x' }, { col01: 'y' }] })

    // A silent data refresh must not throw the viewer back to page one.
    expect(table.currentPage).toBe(1)
    expect(table.visibleRows[0]?.cells[0]?.text).toBe('y')
    expect(table.datasetRevision).toBe('r2')
  })

  it('resets the page when the new data has fewer pages', () => {
    const table = new TableContent(
      slot({ type: 'table', config: { columns: [{ key: 'col01' }], rowsPerPage: 1 } }),
      { slotId: 't', revision: 'r1', columns: ['col01'], rows: [{ col01: 'a' }, { col01: 'b' }] },
    )

    table.setPage(1)
    table.applyDataset({ slotId: 't', revision: 'r2', columns: ['col01'], rows: [{ col01: 'x' }] })

    expect(table.currentPage).toBe(0)
  })

  it('reports an empty table rather than failing with no dataset', () => {
    const table = makeTable(null)
    expect(table.rows).toEqual([])
    expect(table.pageCount).toBe(1)
  })
})
