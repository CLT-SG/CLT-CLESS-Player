import { describe, expect, it } from 'vitest'
import {
  ColorUtils,
  DateUtils,
  FormatUtils,
  LayoutMath,
  MediaUtils,
  NetworkUtils,
  ValidationUtils,
} from '@/core/utils'

describe('DateUtils.format', () => {
  const sample = new Date(2026, 8, 27, 14, 5, 9) // Sun 27 Sep 2026, 14:05:09

  it('renders the legacy date patterns', () => {
    expect(DateUtils.format(sample, 'dd/mm/yyyy')).toBe('27/09/2026')
    expect(DateUtils.format(sample, 'dd/mm/yy')).toBe('27/09/26')
    expect(DateUtils.format(sample, 'dd/mmm/yyyy')).toBe('27/Sep/2026')
  })

  it('renders the legacy time patterns including 12-hour form', () => {
    expect(DateUtils.format(sample, 'hh:nn:ss')).toBe('14:05:09')
    expect(DateUtils.format(sample, 'hh:nn')).toBe('14:05')
    expect(DateUtils.format(sample, 'HH:nn AM/PM')).toBe('02:05 PM')
  })

  it('does not re-match tokens inside an already-substituted value', () => {
    // "Sunday" contains "d" and "n"; a naive sequential replace corrupts it.
    expect(DateUtils.format(sample, 'dddd, dd mmmmm yyyy')).toBe('Sunday, 27 September 2026')
    expect(DateUtils.format(sample, 'ddd')).toBe('Sun')
  })

  it('maps midnight to 12 in 12-hour output', () => {
    const midnight = new Date(2026, 0, 1, 0, 30, 0)
    expect(DateUtils.format(midnight, 'HH:nn AM/PM')).toBe('12:30 AM')
  })

  it('parses clock strings and rejects impossible ones', () => {
    expect(DateUtils.parseClockMinutes('06:30')).toBe(390)
    expect(DateUtils.parseClockMinutes('23:59')).toBe(1439)
    expect(DateUtils.parseClockMinutes('25:00')).toBeNull()
    expect(DateUtils.parseClockMinutes('')).toBeNull()
  })

  it('reports ISO weekdays with Sunday as 7', () => {
    expect(DateUtils.isoWeekday(new Date(2026, 8, 27))).toBe(7)
    expect(DateUtils.isoWeekday(new Date(2026, 8, 28))).toBe(1)
  })

  it('compares the server revision stamps lexicographically', () => {
    expect(DateUtils.isRevisionNewer('20260927101500', '20260927101400')).toBe(true)
    expect(DateUtils.isRevisionNewer('20260927101400', '20260927101500')).toBe(false)
    expect(DateUtils.isRevisionNewer('20260927101400', '')).toBe(true)
    expect(DateUtils.isRevisionNewer('', '20260927101400')).toBe(false)
  })
})

describe('MediaUtils.parse', () => {
  const base = 'https://cms.example.com/media/uploads'

  it('joins a library path onto the media base', () => {
    const parsed = MediaUtils.parse('7/promo.jpg', base)
    expect(parsed).toMatchObject({ kind: 'image', url: `${base}/7/promo.jpg`, isStreaming: false })
  })

  it('classifies video by extension', () => {
    expect(MediaUtils.parse('7/clip.mp4', base).kind).toBe('video')
    expect(MediaUtils.parse('7/clip.webm', base).kind).toBe('video')
  })

  it('decodes the braced stream syntax the server emits', () => {
    const rtsp = MediaUtils.parse('{rtsp:cam-01.local/stream1}', base)
    expect(rtsp).toMatchObject({ url: 'rtsp://cam-01.local/stream1', protocol: 'rtsp', isStreaming: true })

    const hls = MediaUtils.parse('{m3u8:cdn.example.com/live.m3u8}', base)
    expect(hls.isStreaming).toBe(true)
  })

  it('treats a braced file reference as a local, non-streaming path', () => {
    const parsed = MediaUtils.parse('{file:/opt/media/clip.mp4}', base)
    expect(parsed).toMatchObject({ kind: 'video', url: '/opt/media/clip.mp4', isStreaming: false })
  })

  it('converts YouTube links into an autoplaying embed', () => {
    const parsed = MediaUtils.parse('https://www.youtube.com/watch?v=dQw4w9WgXcQ', base)
    expect(parsed.kind).toBe('youtube')
    expect(parsed.url).toContain('/embed/dQw4w9WgXcQ')
    expect(parsed.url).toContain('autoplay=1')
  })

  it('leaves an absolute URL untouched', () => {
    const parsed = MediaUtils.parse('https://cdn.example.com/a.jpg', base)
    expect(parsed.url).toBe('https://cdn.example.com/a.jpg')
  })

  it('treats empty and "none" references as unusable', () => {
    expect(MediaUtils.parse('', base).url).toBe('')
    expect(MediaUtils.parse('none', base).url).toBe('')
  })

  it('joins URLs without doubling or dropping separators', () => {
    expect(MediaUtils.joinUrl('https://h/media/', '/a.jpg')).toBe('https://h/media/a.jpg')
    expect(MediaUtils.joinUrl('https://h/media', 'a.jpg')).toBe('https://h/media/a.jpg')
  })
})

describe('LayoutMath', () => {
  it('parses both resolution formats the server emits', () => {
    expect(LayoutMath.parseResolution('1920x1080')).toEqual({ width: 1920, height: 1080, orientation: 'landscape' })
    expect(LayoutMath.parseResolution('1080_1920_portrait')).toEqual({
      width: 1080,
      height: 1920,
      orientation: 'portrait',
    })
  })

  it('falls back to 1080p for unusable input', () => {
    expect(LayoutMath.parseResolution('')).toEqual({ width: 1920, height: 1080, orientation: 'landscape' })
    expect(LayoutMath.parseResolution('garbage')).toEqual({ width: 1920, height: 1080, orientation: 'landscape' })
  })

  it('fits a design surface without distortion', () => {
    // A 1080p layout on a 1280x1024 screen is width-constrained.
    const scale = LayoutMath.fitScale({ width: 1920, height: 1080 }, { width: 1280, height: 1024 })
    expect(scale).toBeCloseTo(1280 / 1920, 5)
  })

  it('centres the scaled surface in the leftover space', () => {
    const offset = LayoutMath.centerOffset({ width: 1920, height: 1080 }, { width: 1920, height: 1200 }, 1)
    expect(offset).toEqual({ x: 0, y: 60 })
  })

  it('scales geometry on the correct axes', () => {
    // The legacy renderer divided `top` by the layout width; this asserts the
    // corrected axis mapping.
    const scaled = LayoutMath.scaleGeometry({ top: 100, left: 200, width: 400, height: 50, layer: 2 }, 2, 3)
    expect(scaled).toEqual({ top: 300, left: 400, width: 800, height: 150, layer: 2 })
  })
})

describe('ValidationUtils', () => {
  it('reads the XML Y/N convention', () => {
    expect(ValidationUtils.toBoolean('Y')).toBe(true)
    expect(ValidationUtils.toBoolean('N')).toBe(false)
    expect(ValidationUtils.toBoolean('')).toBe(false)
    expect(ValidationUtils.toBoolean('true')).toBe(true)
    expect(ValidationUtils.toBoolean(undefined, true)).toBe(true)
  })

  it('coerces numeric attribute strings', () => {
    expect(ValidationUtils.toNumber('42')).toBe(42)
    expect(ValidationUtils.toNumber('12.5')).toBe(12.5)
    expect(ValidationUtils.toNumber('', 7)).toBe(7)
    expect(ValidationUtils.toNumber('abc', 7)).toBe(7)
  })

  it('parses weekday lists and discards out-of-range days', () => {
    expect(ValidationUtils.toWeekdays('1,2,5')).toEqual([1, 2, 5])
    expect(ValidationUtils.toWeekdays('0,8,3')).toEqual([3])
    expect(ValidationUtils.toWeekdays('')).toEqual([])
  })

  it('clamps integers into range', () => {
    expect(ValidationUtils.clampInt('500', 1, 100, 10)).toBe(100)
    expect(ValidationUtils.clampInt('-5', 1, 100, 10)).toBe(1)
    expect(ValidationUtils.clampInt('bad', 1, 100, 10)).toBe(10)
  })
})

describe('ColorUtils', () => {
  it('normalises and expands hex colours', () => {
    expect(ColorUtils.normalizeHex('#ABC')).toBe('#aabbcc')
    expect(ColorUtils.normalizeHex('112233')).toBe('#112233')
    expect(ColorUtils.normalizeHex(null, '#fff')).toBe('#fff')
  })

  it('maps the transparency enum onto alpha', () => {
    expect(ColorUtils.transparencyToAlpha('high')).toBe(0)
    expect(ColorUtils.transparencyToAlpha('medium')).toBe(0.5)
    expect(ColorUtils.transparencyToAlpha('low')).toBe(1)
  })

  it('converts hex to rgba', () => {
    expect(ColorUtils.toRgba('#ff8800', 0.5)).toBe('rgba(255,136,0,0.5)')
  })

  it('does not throw on malformed input', () => {
    expect(() => ColorUtils.normalizeHex('##not-a-colour')).not.toThrow()
  })
})

describe('FormatUtils', () => {
  it('maps the server alignment codes to CSS', () => {
    expect(FormatUtils.textAlign('c')).toBe('center')
    expect(FormatUtils.textAlign('l')).toBe('left')
    expect(FormatUtils.textAlign('r')).toBe('right')
    expect(FormatUtils.textAlign('unknown')).toBe('left')
  })

  it('maps vertical alignment to flex values', () => {
    expect(FormatUtils.verticalAlign('middle')).toBe('center')
    expect(FormatUtils.verticalAlign('top')).toBe('flex-start')
    expect(FormatUtils.verticalAlign('bottom')).toBe('flex-end')
  })

  it('parses the comma separated font style list', () => {
    expect(FormatUtils.fontStyles('bold,italic')).toEqual({
      fontWeight: 'bold',
      fontStyle: 'italic',
      textDecoration: 'none',
    })
    expect(FormatUtils.fontStyles('')).toEqual({
      fontWeight: 'normal',
      fontStyle: 'normal',
      textDecoration: 'none',
    })
  })

  it('escapes HTML metacharacters', () => {
    expect(FormatUtils.escapeHtml('<b>"x"&</b>')).toBe('&lt;b&gt;&quot;x&quot;&amp;&lt;/b&gt;')
  })
})

describe('NetworkUtils.backoffDelay', () => {
  it('grows with each attempt and stays within the cap', () => {
    const first = NetworkUtils.backoffDelay(1, 2_000, 60_000, () => 0.5)
    const later = NetworkUtils.backoffDelay(5, 2_000, 60_000, () => 0.5)

    expect(later).toBeGreaterThan(first)
    expect(NetworkUtils.backoffDelay(50, 2_000, 60_000, () => 1)).toBeLessThanOrEqual(60_000)
  })

  it('applies jitter so players do not retry in lockstep', () => {
    const low = NetworkUtils.backoffDelay(4, 2_000, 60_000, () => 0)
    const high = NetworkUtils.backoffDelay(4, 2_000, 60_000, () => 1)
    expect(high).toBeGreaterThan(low)
  })

  it('classifies retryable HTTP statuses', () => {
    expect(NetworkUtils.isTransient(0)).toBe(true)
    expect(NetworkUtils.isTransient(503)).toBe(true)
    expect(NetworkUtils.isTransient(429)).toBe(true)
    expect(NetworkUtils.isTransient(404)).toBe(false)
  })

  it('extracts the origin from a server base URL', () => {
    expect(NetworkUtils.origin('https://cms.example.com/demo')).toBe('https://cms.example.com')
    expect(NetworkUtils.origin('/relative')).toBe('')
  })

  it('appends query parameters, respecting an existing query string', () => {
    expect(NetworkUtils.withQuery('https://h/a', { v: '1.2' })).toBe('https://h/a?v=1.2')
    expect(NetworkUtils.withQuery('https://h/a?b=1', { v: '2' })).toBe('https://h/a?b=1&v=2')
    expect(NetworkUtils.withQuery('https://h/a', { v: null })).toBe('https://h/a')
  })
})
