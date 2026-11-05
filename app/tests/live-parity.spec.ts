/**
 * Phase 5 parity proof, run against captured output from a live CLESS-Server.
 *
 * The migration promise is that the Vue renderer draws the same thing as the
 * legacy renderer. The renderers themselves cannot be diffed pixel-for-pixel
 * in CI, but the step before them can: both paths converge on one layout
 * document, and there are two independent converters producing it.
 *
 *   ds.xml  --[ XmlLayoutAdapter, TypeScript, in the player ]--> document
 *   ds.json --[ layout_schema.py, Python, on the server     ]--> document
 *
 * If those two agree on real data, then a player fed JSON and a player fed
 * XML render from identical input, and the legacy renderer is reading the very
 * XML that produced one side of the comparison. A disagreement is a rendering
 * difference waiting to happen, which is exactly what this caught twice:
 * colliding slot ids and unnamed table slots.
 *
 * The fixtures in `fixtures/live/` were captured from a seeded server built by
 * `python manage.py seed_validation_data` on CLESS-Server. Re-capture them with
 * `tests/fixtures/live/refresh.sh` when the seed data or either converter
 * changes.
 */
import { describe, expect, it } from 'vitest'
import { XmlLayoutAdapter } from '@core/transports/xml'
import { validateLayoutDocument } from '@core/layouts/schema'
import type { LayoutDocument } from '@core/layouts/schema'
import { parseXmlForTests } from './fixtures/dsxml'

import playlistXml from './fixtures/live/playlist.xml?raw'
import layout1Xml from './fixtures/live/layout-1.xml?raw'
import layout2Xml from './fixtures/live/layout-2.xml?raw'
import playlistJson from './fixtures/live/playlist.json'
import layout1Json from './fixtures/live/layout-1.json'
import layout2Json from './fixtures/live/layout-2.json'

const SERVER_BASE_URL = 'http://127.0.0.1:8099/demo'

/**
 * Server-clock fields, replaced with a constant before comparison. Everything
 * else has to match exactly.
 *
 * `generatedAt`, `etag`, layout `revision` and a table slot's `update` are all
 * stamped at the moment of the request, and the XML and JSON captures are
 * seconds apart, so these differ by construction rather than by disagreement.
 * An asset `version` is derived from `revision`, so it moves with it. `origin`
 * records which transport produced the document and is the one field that is
 * *supposed* to differ.
 */
const VOLATILE = new Set(['origin', 'generatedAt', 'etag', 'revision', 'version', 'update'])

function normalise(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalise)
  if (value === null || typeof value !== 'object') return value

  const source = value as Record<string, unknown>
  const result: Record<string, unknown> = {}

  for (const [key, entry] of Object.entries(source)) {
    result[key] = VOLATILE.has(key) && typeof entry === 'string' ? '<volatile>' : normalise(entry)
  }
  return result
}

function adaptXml(
  xml: string,
  options: { displayId?: string; members?: readonly string[] } = {},
): LayoutDocument {
  const adapter = new XmlLayoutAdapter({
    serverBaseUrl: SERVER_BASE_URL,
    displayId: options.displayId ?? '1',
  })
  return adapter.adaptDocument(
    parseXmlForTests(xml),
    (options.members ?? []).map((member) => parseXmlForTests(member)),
  )
}

describe('live server parity: single layout', () => {
  const cases = [
    { label: 'flight information layout', xml: layout1Xml, json: layout1Json },
    { label: 'gate announcements layout', xml: layout2Xml, json: layout2Json },
  ]

  for (const { label, xml, json } of cases) {
    it(`converts the ${label} to the same document the server does`, () => {
      // `/demo/layout/<id>/ds.*` is the layout-preview endpoint, which no
      // display owns; the server reports display id "0" there and so must a
      // player adapting the XML form of the same URL.
      expect(normalise(adaptXml(xml, { displayId: '0' }))).toEqual(normalise(json))
    })

    it(`produces a schema-valid document from the ${label} XML`, () => {
      expect(validateLayoutDocument(adaptXml(xml)).ok).toBe(true)
    })

    it(`accepts the server's own JSON for the ${label} against the schema`, () => {
      // The server is the only writer of this shape, so if it drifts from the
      // schema the player validates against, every JSON-mode player breaks.
      expect(validateLayoutDocument(json).ok).toBe(true)
    })
  }
})

describe('live server parity: playlist', () => {
  function adaptPlaylist(): LayoutDocument {
    return adaptXml(playlistXml, { members: [layout1Xml, layout2Xml] })
  }

  it('converts the loop and its inlined members to the same document', () => {
    expect(normalise(adaptPlaylist())).toEqual(normalise(playlistJson))
  })

  it('reads the loop as a playlist of both seeded layouts', () => {
    const document = adaptPlaylist()

    expect(document.mode).toBe('playlist')
    expect(document.playlist?.name).toBe('Validation Loop')
    expect(document.playlist?.entries.map((entry) => entry.layoutId)).toEqual(['1', '2'])
    expect(document.playlist?.entries.map((entry) => entry.duration)).toEqual([45, 30])
    expect(document.layouts.map((layout) => layout.id)).toEqual(['1', '2'])
  })

  it('carries the fade transition the seed configured', () => {
    expect(adaptPlaylist().playlist?.transition).toEqual({
      style: 'fade',
      speedMs: 1200,
      delayMs: 0,
    })
  })
})

describe('live server parity: table slot backed by SQL rows', () => {
  function flightTable(document: LayoutDocument) {
    const layout = document.layout ?? document.layouts.find((entry) => entry.id === '1')!
    const slot = layout.slots.find((entry) => entry.type === 'table')!
    const dataset = layout.datasets.find((entry) => entry.slotId === slot.id)
    return { slot, dataset }
  }

  it('binds the spooled rows to the table slot rather than orphaning them', () => {
    // The join is on slot id, which is the thing that used to collide.
    const { slot, dataset } = flightTable(adaptXml(layout1Xml))

    expect(slot.name).toBe('Departures')
    expect(dataset).toBeDefined()
    expect(dataset?.rows).toHaveLength(6)
    expect(dataset?.columns).toEqual(['col01', 'col02', 'col03', 'col04', 'col05'])
  })

  it('agrees with the server on every cell of every row', () => {
    const fromXml = flightTable(adaptXml(layout1Xml)).dataset
    const fromJson = flightTable(layout1Json as unknown as LayoutDocument).dataset

    expect(fromXml?.rows).toEqual(fromJson?.rows)
  })

  it('leaves the four cell encodings verbatim for the shared decoder', () => {
    // The adapter must not interpret cells: `TableCellCodec` does that, and it
    // is the same code in both renderers. Anything decoded early would be
    // decoded differently here than in `slot-table.js`.
    const rows = flightTable(adaptXml(layout1Xml)).dataset!.rows

    expect(rows[0]?.['col04']).toBe('transition:Boarding,Final Call')
    expect(rows[0]?.['col05']).toBe('image:logos/sq.png')
    expect(rows[1]?.['col05']).toBe('image:fade:logos/mh.png,logos/mh-alt.png')
    expect(rows[2]?.['col04']).toBe('fader:Delayed,New time 18:40')
    expect(rows[3]?.['col04']).toBe('Gate Closed')
  })

  it('keeps the columns that carry transition and image rendering flags', () => {
    const columns = flightTable(adaptXml(layout1Xml)).slot.config['columns'] as Array<
      Record<string, Record<string, unknown>>
    >

    expect(columns.map((column) => column['label'])).toEqual([
      'Flight',
      'Destination',
      'Gate',
      'Status',
      'Airline',
    ])
    // The seed enables text transitions on Status and images on Airline, which
    // is what makes the `transition:`/`fader:` and `image:` cells above render
    // as anything other than literal text.
    expect(columns[3]?.['textTransition']?.['enabled']).toBe(true)
    expect(columns[4]?.['image']?.['enabled']).toBe(true)
    expect(columns[0]?.['textTransition']?.['enabled']).toBe(false)
  })
})
