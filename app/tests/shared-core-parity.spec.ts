import { describe, expect, it } from 'vitest'
// Imported as text so the path is resolved relative to this file at transform
// time; reading it at run time would depend on the working directory.
import bundleSource from '../../src/assets/js/cless-core.js?raw'
import { ColorUtils, TableCellCodec } from '@core/utilities'

/**
 * Parity tests for the logic the legacy renderer now delegates to the shared
 * core.
 *
 * Each `legacy*` function below is the implementation that was in
 * `src/assets/js` before the change, copied verbatim. The point is not to test
 * the old code — it is to pin the new code to the old behaviour, so a future
 * refactor of the core cannot quietly change what a production screen draws.
 *
 * These are the only two call sites adopted so far, and they were chosen
 * because parity is provable. `slot-media.js` is not here: its 300-line
 * resolution logic genuinely diverges from `MediaUtils`, so sharing it would
 * be a behaviour change dressed up as deduplication.
 */

/** Verbatim from `layoutxml.js` before the change. */
function legacyHexToRgbA(hex: string, transparent: string): string {
  let alpha: number
  if (transparent == 'high') {
    alpha = 0
  } else if (transparent == 'medium') {
    alpha = 0.5
  } else {
    alpha = 1
  }
  let c: string[] | string
  if (/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)) {
    c = hex.substring(1).split('')
    if (c.length == 3) {
      c = [c[0]!, c[0]!, c[1]!, c[1]!, c[2]!, c[2]!]
    }
    const numeric = Number('0x' + (c as string[]).join(''))
    return 'rgba(' + [(numeric >> 16) & 255, (numeric >> 8) & 255, numeric & 255].join(',') + ',' + alpha + ')'
  }
  throw new Error('Bad Hex')
}

/** Verbatim from the three cell-decode sites in `slot-table.js`. */
function legacyImageEntries(cell: string): string[] {
  const n = cell.lastIndexOf(':')
  return cell
    .substring(n + 1)
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry != '')
}

function legacyFirstColonEntries(cell: string): string[] {
  const n = cell.indexOf(':')
  return cell
    .slice(n + 1)
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry != '')
}

function sharedHexToRgbA(hex: string, transparent: string): string {
  return ColorUtils.toRgba(hex, ColorUtils.transparencyToAlpha(transparent))
}

describe('hexToRgbA parity', () => {
  const colors = ['#000000', '#ffffff', '#FF8800', '#abc', '#ABC', '#123456', '#0f0']
  const levels = ['high', 'medium', 'low', 'Normal', '']

  it('matches the legacy output for every colour and transparency combination', () => {
    for (const color of colors) {
      for (const level of levels) {
        expect(sharedHexToRgbA(color, level)).toBe(legacyHexToRgbA(color, level))
      }
    }
  })

  it('returns black instead of throwing on a malformed colour', () => {
    expect(() => legacyHexToRgbA('not-a-colour', 'low')).toThrow()
    expect(sharedHexToRgbA('#12345', 'low')).toBe('rgba(0,0,0,1)')
  })

  it('treats an unknown transparency word as opaque, as the legacy else-branch did', () => {
    expect(sharedHexToRgbA('#112233', 'anything-else')).toBe('rgba(17,34,51,1)')
  })
})

describe('table cell decoding parity', () => {
  const imageCells = [
    'image:res/a.png',
    'image:scroll-up:res/a.png,res/b.png',
    'image:scroll-up:res/a.png, res/b.png , ',
    'image:fade:',
    'image:a:b:c:one.png,two.png',
  ]

  const listCells = [
    'fader:one,two,three',
    'fader: one , two ,, three ',
    'fader:',
    'transition:alpha,beta',
    'transition:http://example.com/x,http://example.com/y',
    'transition: only ',
  ]

  it('splits image cells after the last colon, exactly as the legacy site did', () => {
    for (const cell of imageCells) {
      expect(TableCellCodec.entries(cell)).toEqual(legacyImageEntries(cell))
    }
  })

  it('splits fader and transition cells after the first colon', () => {
    for (const cell of listCells) {
      expect(TableCellCodec.entries(cell)).toEqual(legacyFirstColonEntries(cell))
    }
  })

  it('keeps a value containing colons intact for transition cells', () => {
    expect(TableCellCodec.entries('transition:http://a/1,http://b/2')).toEqual([
      'http://a/1',
      'http://b/2',
    ])
  })

  it('drops metadata before the final colon for image cells', () => {
    expect(TableCellCodec.entries('image:scroll-up:one.png,two.png')).toEqual(['one.png', 'two.png'])
  })

  it('leaves a plain cell untouched', () => {
    const decoded = TableCellCodec.decode('SQ318 Singapore')
    expect(decoded.kind).toBe('text')
    expect(decoded.text).toBe('SQ318 Singapore')
    expect(decoded.rotate).toBe(false)
  })

  it('only rotates when there is more than one entry', () => {
    expect(TableCellCodec.decode('fader:only').rotate).toBe(false)
    expect(TableCellCodec.decode('fader:one,two').rotate).toBe(true)
    expect(TableCellCodec.decode('image:a.png').rotate).toBe(false)
    expect(TableCellCodec.decode('image:a.png,b.png').rotate).toBe(true)
  })
})

/**
 * The legacy renderer loads a *built* file, so the source passing its tests
 * is not enough: the committed bundle has to expose the names the legacy call
 * sites use, and has to behave the same. This evaluates the shipped artifact.
 */
describe('committed cless-core.js bundle', () => {
  function loadBundle(): Record<string, unknown> {
    const scope: Record<string, unknown> = {}
    new Function('globalThis', 'window', `${bundleSource}\n;return globalThis.ClessCore`)(scope, scope)
    return scope['ClessCore'] as Record<string, unknown>
  }

  it('publishes the members the legacy renderer calls', () => {
    const bridge = loadBundle()
    expect(typeof bridge['hexToRgbA']).toBe('function')
    expect(typeof bridge['decodeCellEntries']).toBe('function')
    expect(typeof bridge['airportAnnouncementLanguages']).toBe('function')
  })

  it('agrees with the core it was built from', () => {
    const bridge = loadBundle() as {
      hexToRgbA(hex: string, transparency: string): string
      decodeCellEntries(raw: string): string[]
      airportAnnouncementLanguages(announcement: unknown): Array<Record<string, unknown>>
    }

    expect(bridge.hexToRgbA('#FF8800', 'medium')).toBe(sharedHexToRgbA('#FF8800', 'medium'))
    expect(bridge.decodeCellEntries('image:fade:a.png,b.png')).toEqual([
      ...TableCellCodec.entries('image:fade:a.png,b.png'),
    ])
    // The legacy field names, because `airport-display.js` hands this result
    // straight on to its announcement queue.
    expect(
      bridge.airportAnnouncementLanguages({
        enabled: true,
        text: 'Boarding',
        language: 'en',
        audio_url: '/tts/en.mp3',
      }),
    ).toEqual([{ language: 'en', voice: '', order: 1, audio_url: '/tts/en.mp3', text: 'Boarding' }])
  })
})
