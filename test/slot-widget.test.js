/**
 * Widget slot parsing and scheduling tests.
 *
 * Run with: npm test
 */

const test = require('node:test')
const assert = require('node:assert')

const widget = require('../src/assets/js/slot-widget.js')

function slot(attributes, items) {
    return {
        name: 'widget',
        attributes: attributes,
        elements: (items || []).map(function (item) {
            return { name: 'item', attributes: item }
        })
    }
}

test('items are read from the widget element', () => {
    const items = widget.widgetSlotItems(slot({}, [
        {
            id: '1', widget: '3', name: 'Weather', renderer: 'weather', duration: '45',
            refresh: '600', enabled: 'Y', offline: 'Y',
            url: 'http://server:8000/demo/widget/3/preview',
            data: 'http://server:8000/demo/widget/3/data'
        },
        { id: '2', widget: '4', enabled: 'N', url: 'http://server:8000/demo/widget/4/preview' }
    ]))

    assert.strictEqual(items.length, 1)
    assert.strictEqual(items[0].name, 'Weather')
    assert.strictEqual(items[0].duration, 45000)
    assert.strictEqual(items[0].refresh, 600)
    assert.strictEqual(items[0].dataUrl, 'http://server:8000/demo/widget/3/data')
})

test('an item url may be the element text instead of an attribute', () => {
    const items = widget.widgetSlotItems({
        name: 'widget',
        attributes: {},
        elements: [{
            name: 'item',
            attributes: { widget: '3' },
            elements: [{ type: 'text', text: 'http://server:8000/demo/widget/3/preview' }]
        }]
    })
    assert.strictEqual(items[0].url, 'http://server:8000/demo/widget/3/preview')
})

test('an unscheduled slot is always active', () => {
    const schedule = widget.widgetScheduleOf({})
    assert.strictEqual(widget.widgetSlotActive(schedule, new Date('2026-01-12T03:00:00')), true)
})

test('weekdays and the daily window are honoured', () => {
    const schedule = widget.widgetScheduleOf({
        scheduled: 'Y', days: '0,1,2,3,4', starttime: '09:00', endtime: '17:00'
    })
    // 2026-01-12 is a Monday
    assert.strictEqual(widget.widgetSlotActive(schedule, new Date('2026-01-12T10:00:00')), true)
    assert.strictEqual(widget.widgetSlotActive(schedule, new Date('2026-01-12T18:00:00')), false)
    // 2026-01-17 is a Saturday
    assert.strictEqual(widget.widgetSlotActive(schedule, new Date('2026-01-17T10:00:00')), false)
})

test('a window crossing midnight stays active overnight', () => {
    const schedule = widget.widgetScheduleOf({
        scheduled: 'Y', starttime: '22:00', endtime: '06:00'
    })
    assert.strictEqual(widget.widgetSlotActive(schedule, new Date('2026-01-12T23:30:00')), true)
    assert.strictEqual(widget.widgetSlotActive(schedule, new Date('2026-01-12T05:30:00')), true)
    assert.strictEqual(widget.widgetSlotActive(schedule, new Date('2026-01-12T12:00:00')), false)
})

test('a slot outside its date range is inactive', () => {
    const schedule = widget.widgetScheduleOf({
        scheduled: 'Y', start: '2026-01-10 00:00:00', end: '2026-01-20 00:00:00'
    })
    assert.strictEqual(widget.widgetSlotActive(schedule, new Date('2026-01-15T12:00:00')), true)
    assert.strictEqual(widget.widgetSlotActive(schedule, new Date('2026-01-21T12:00:00')), false)
})

test('the offline fallback escapes and truncates the cached payload', () => {
    assert.strictEqual(widget.widgetEscape('<b>&</b>'), '&lt;b&gt;&amp;&lt;/b&gt;')
    assert.strictEqual(widget.widgetSummarise('27 C'), '27 C')
    assert.ok(widget.widgetSummarise({ rows: new Array(500).fill({ a: 1 }) }).length <= 800)
})

test('a malformed time is ignored instead of hiding the slot', () => {
    assert.strictEqual(widget.widgetMinutes('bad'), null)
    const schedule = widget.widgetScheduleOf({ scheduled: 'Y', starttime: 'bad', endtime: 'bad' })
    assert.strictEqual(widget.widgetSlotActive(schedule, new Date('2026-01-12T12:00:00')), true)
})
