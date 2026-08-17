/**
 * Widget slot renderer.
 *
 * A widget slot is a layout region filled with one or more widgets published by
 * the server at /<prefix>/widget/<id>/preview. The player hosts each widget in a
 * <webview>, rotates the widgets of a slot by their duration, honours the slot
 * schedule, keeps a local copy of every widget so a screen keeps something on
 * display while the network is down, and reports render/refresh metrics back to
 * the server.
 *
 * Called from layoutxml.js for every <widget> element of a layout.
 */

var widgetSlotRegistry = {}      // slotid -> slot runtime state
var widgetDataCache = {}         // widget id -> last known payload
var widgetMetricQueue = []       // events waiting to be posted to the server
var widgetMetricTimer = null
var widgetPlayerTimer = null
var widgetStartedAt = Date.now()

var WIDGET_CACHE_PREFIX = 'widget-cache-'
var WIDGET_QUEUE_KEY = 'widget-metric-queue'
var WIDGET_METRIC_INTERVAL = 30000
var WIDGET_PLAYER_INTERVAL = 60000
var WIDGET_RETRY_MIN = 5000
var WIDGET_RETRY_MAX = 120000
var WIDGET_SCHEDULE_INTERVAL = 20000

function widgetLog(level, message) {
    try {
        if (typeof log !== 'undefined' && log[level]) {
            log[level]('Widget slot : ' + message)
            return
        }
    } catch (e) { /* electron-log unavailable */ }
    console.log('[widget] ' + message)
}

/**
 * Absolute widget URL. The server already writes absolute URLs, but a layout
 * exported from another host may carry a relative path.
 */
function widgetAbsoluteUrl(url) {
    if (!url) return ''
    if (/^https?:\/\//i.test(url)) return url
    var host = ''
    try {
        host = (config && config.hostserver) || ''
    } catch (e) { host = '' }
    if (!host) return url
    var parts = host.split('/')
    var origin = parts[0] + '//' + parts[2]
    return origin + (url.charAt(0) === '/' ? url : '/' + url)
}

function widgetPlayerId() {
    try {
        if (typeof dsid !== 'undefined' && dsid) return String(dsid)
        if (config && config.id) return String(config.id)
    } catch (e) { /* config not loaded yet */ }
    return 'unknown'
}

/**
 * Read the <item> children of a <widget> element into plain objects.
 */
function widgetSlotItems(slot) {
    var items = []
    var elements = slot['elements']
    if (!elements) return items
    Object.keys(elements).forEach(function (key) {
        var element = elements[key]
        if (!element || element['name'] !== 'item') return
        var attributes = element['attributes'] || {}
        if (attributes['enabled'] === 'N') return
        var url = attributes['url'] || ''
        if (!url && element['elements'] && element['elements'][0]) {
            url = element['elements'][0]['text'] || ''
        }
        if (!url) return
        items.push({
            id: attributes['id'],
            widget: attributes['widget'],
            name: attributes['name'] || '',
            renderer: attributes['renderer'] || 'custom',
            duration: (parseInt(attributes['duration'], 10) || 60) * 1000,
            refresh: parseInt(attributes['refresh'], 10) || 0,
            offline: attributes['offline'] !== 'N',
            url: widgetAbsoluteUrl(url),
            dataUrl: widgetAbsoluteUrl(attributes['data'] || '')
        })
    })
    return items
}

/**
 * Re-evaluate the slot schedule locally: a player that was offline when the
 * layout XML was generated must still switch the slot on and off on time.
 */
function widgetSlotActive(schedule, now) {
    if (!schedule || !schedule.enabled) return true
    now = now || new Date()
    if (schedule.start && now < schedule.start) return false
    if (schedule.end && now > schedule.end) return false
    if (schedule.days && schedule.days.length) {
        // python weekday(): Monday is 0
        var weekday = (now.getDay() + 6) % 7
        if (schedule.days.indexOf(String(weekday)) === -1) return false
    }
    if (schedule.starttime && schedule.endtime) {
        var minutes = now.getHours() * 60 + now.getMinutes()
        var from = widgetMinutes(schedule.starttime)
        var to = widgetMinutes(schedule.endtime)
        if (from === null || to === null) return true
        if (from <= to) {
            if (minutes < from || minutes > to) return false
        } else if (minutes < from && minutes > to) {
            // window crossing midnight, e.g. 22:00 -> 06:00
            return false
        }
    }
    return true
}

function widgetMinutes(value) {
    var parts = String(value).split(':')
    if (parts.length < 2) return null
    var hours = parseInt(parts[0], 10)
    var minutes = parseInt(parts[1], 10)
    if (isNaN(hours) || isNaN(minutes)) return null
    return hours * 60 + minutes
}

function widgetScheduleOf(attributes) {
    var days = (attributes['days'] || '').split(',').filter(function (d) { return d !== '' })
    return {
        enabled: attributes['scheduled'] === 'Y',
        days: days,
        starttime: attributes['starttime'] || '',
        endtime: attributes['endtime'] || '',
        start: attributes['start'] ? new Date(attributes['start'].replace(' ', 'T')) : null,
        end: attributes['end'] ? new Date(attributes['end'].replace(' ', 'T')) : null
    }
}

/**
 * Render a widget slot. ``slot`` is the parsed <widget> element, ``slotid`` the
 * id used for the #slot-<id> container already placed by layoutxml.js.
 */
function widgetFunc(slot, slotid) {
    var attributes = slot['attributes'] || {}
    var items = widgetSlotItems(slot)
    var container = $('#slot-' + slotid)

    if (!items.length) {
        widgetLog('warn', 'slot ' + slotid + ' has no enabled widget')
        return
    }

    widgetStopSlot(slotid)

    var state = {
        slotid: slotid,
        name: attributes['name'] || '',
        items: items,
        index: 0,
        schedule: widgetScheduleOf(attributes),
        interactive: attributes['interactive'] === 'Y',
        rotation: parseInt(attributes['rotation'], 10) || 0,
        rotateTimer: null,
        scheduleTimer: null,
        retry: WIDGET_RETRY_MIN,
        startedAt: 0
    }
    widgetSlotRegistry[slotid] = state

    if (state.rotation) {
        container.css({
            'transform': 'rotate(' + state.rotation + 'deg)',
            'transform-origin': 'center center'
        })
    }
    container.addClass('widget-slot')
    container.html(
        '<webview id="widget-' + slotid + '" class="widget-slot-view" ' +
        'partition="persist:widgets" ' +
        (state.interactive ? '' : 'disablewebsecurity="off" ') +
        'src="about:blank"></webview>' +
        '<div id="widget-fallback-' + slotid + '" class="widget-slot-fallback"></div>'
    )

    var view = document.getElementById('widget-' + slotid)
    if (view) {
        view.addEventListener('dom-ready', function () {
            state.retry = WIDGET_RETRY_MIN
            widgetHideFallback(slotid)
            var item = state.items[state.index]
            if (item && state.startedAt) {
                widgetReport({
                    widget: item.widget,
                    slot: slotid,
                    type: 'render',
                    render_time: Date.now() - state.startedAt
                })
            }
        })
        view.addEventListener('did-fail-load', function (event) {
            if (event.errorCode === -3) return   // aborted, e.g. a rotation swap
            widgetLog('warn', 'slot ' + slotid + ' failed to load: ' + event.errorDescription)
            widgetShowFallback(slotid, event.errorDescription)
            widgetRetryLater(slotid)
        })
        view.addEventListener('crashed', function () {
            widgetLog('warn', 'slot ' + slotid + ' webview crashed')
            widgetShowFallback(slotid, 'renderer crashed')
            widgetRetryLater(slotid)
        })
    }

    widgetApplySchedule(slotid)
    state.scheduleTimer = setInterval(function () {
        widgetApplySchedule(slotid)
    }, WIDGET_SCHEDULE_INTERVAL)

    widgetStartMetrics()
}

function widgetApplySchedule(slotid) {
    var state = widgetSlotRegistry[slotid]
    if (!state) return
    var active = widgetSlotActive(state.schedule)
    var container = $('#slot-' + slotid)
    if (active) {
        if (container.is(':hidden')) {
            container.show()
        }
        if (!state.startedAt) {
            widgetShowItem(slotid, state.index)
        }
    } else {
        container.hide()
        widgetPauseSlot(slotid)
    }
}

function widgetShowItem(slotid, index) {
    var state = widgetSlotRegistry[slotid]
    if (!state) return
    var item = state.items[index]
    if (!item) return

    state.index = index
    state.startedAt = Date.now()

    var view = document.getElementById('widget-' + slotid)
    if (view) {
        try {
            view.setAttribute('src', item.url)
        } catch (e) {
            widgetLog('warn', 'unable to set widget url: ' + e.message)
        }
    }
    widgetReport({ widget: item.widget, slot: slotid, type: 'view' })
    widgetCacheData(item)

    if (state.rotateTimer) clearTimeout(state.rotateTimer)
    if (state.items.length > 1) {
        state.rotateTimer = setTimeout(function () {
            widgetShowItem(slotid, (index + 1) % state.items.length)
        }, item.duration)
    }
}

function widgetPauseSlot(slotid) {
    var state = widgetSlotRegistry[slotid]
    if (!state) return
    if (state.rotateTimer) {
        clearTimeout(state.rotateTimer)
        state.rotateTimer = null
    }
    state.startedAt = 0
    var view = document.getElementById('widget-' + slotid)
    if (view) {
        try { view.setAttribute('src', 'about:blank') } catch (e) { /* torn down */ }
    }
}

function widgetStopSlot(slotid) {
    var state = widgetSlotRegistry[slotid]
    if (!state) return
    if (state.rotateTimer) clearTimeout(state.rotateTimer)
    if (state.scheduleTimer) clearInterval(state.scheduleTimer)
    if (state.retryTimer) clearTimeout(state.retryTimer)
    delete widgetSlotRegistry[slotid]
}

function widgetStopAll() {
    Object.keys(widgetSlotRegistry).forEach(widgetStopSlot)
}

function widgetRetryLater(slotid) {
    var state = widgetSlotRegistry[slotid]
    if (!state) return
    if (state.retryTimer) clearTimeout(state.retryTimer)
    var delay = state.retry
    state.retry = Math.min(state.retry * 2, WIDGET_RETRY_MAX)
    state.retryTimer = setTimeout(function () {
        if (!widgetSlotRegistry[slotid]) return
        widgetShowItem(slotid, state.index)
    }, delay)
}

/**
 * Offline fallback: the published page caches its own data, but when the page
 * itself cannot be reached the player still shows the widget name and the last
 * payload it saw, instead of an error page.
 */
function widgetShowFallback(slotid, reason) {
    var state = widgetSlotRegistry[slotid]
    if (!state) return
    var item = state.items[state.index]
    var cached = item ? widgetReadCache(item.widget) : null
    var body = ''
    if (cached && cached.data) {
        body = '<pre class="widget-slot-fallback-data">' +
            widgetEscape(widgetSummarise(cached.data)) + '</pre>' +
            '<div class="widget-slot-fallback-time">last updated ' +
            widgetEscape(cached.fetched_at || '') + '</div>'
    } else {
        body = '<div class="widget-slot-fallback-time">' + widgetEscape(reason || 'offline') + '</div>'
    }
    $('#widget-fallback-' + slotid)
        .html('<div class="widget-slot-fallback-name">' + widgetEscape(item ? item.name : '') + '</div>' + body)
        .show()
    if (item) {
        widgetReport({ widget: item.widget, slot: slotid, type: 'error', message: reason || 'offline' })
    }
}

function widgetHideFallback(slotid) {
    $('#widget-fallback-' + slotid).hide().empty()
}

function widgetSummarise(data) {
    if (data === null || data === undefined) return ''
    if (typeof data === 'string' || typeof data === 'number') return String(data)
    try {
        return JSON.stringify(data, null, 2).slice(0, 800)
    } catch (e) {
        return ''
    }
}

function widgetEscape(value) {
    return String(value === undefined || value === null ? '' : value)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/**
 * Keep a player-side copy of the widget payload for the offline fallback and
 * measure the data source latency for the server analytics.
 */
function widgetCacheData(item) {
    if (!item.dataUrl || !item.offline) return
    var started = Date.now()
    $.ajax({
        url: item.dataUrl,
        type: 'GET',
        dataType: 'json',
        timeout: 15000,
        success: function (payload) {
            var latency = Date.now() - started
            if (payload && payload.ok) {
                widgetDataCache[item.widget] = payload
                try {
                    localStorage.setItem(WIDGET_CACHE_PREFIX + item.widget, JSON.stringify(payload))
                } catch (e) { /* quota */ }
                widgetReport({
                    widget: item.widget,
                    type: 'refresh_ok',
                    latency: latency
                })
            } else {
                widgetReport({
                    widget: item.widget,
                    type: 'refresh_fail',
                    latency: latency,
                    message: (payload && payload.error) || 'no data'
                })
            }
        },
        error: function (xhr, status) {
            widgetReport({
                widget: item.widget,
                type: 'refresh_fail',
                latency: Date.now() - started,
                message: status || 'request failed'
            })
        }
    })
}

function widgetReadCache(widgetid) {
    if (widgetDataCache[widgetid]) return widgetDataCache[widgetid]
    try {
        var raw = localStorage.getItem(WIDGET_CACHE_PREFIX + widgetid)
        if (!raw) return null
        widgetDataCache[widgetid] = JSON.parse(raw)
        return widgetDataCache[widgetid]
    } catch (e) {
        return null
    }
}

/**
 * Analytics. Events are batched and survive a restart, so a screen that loses
 * the network still reports what happened once it is back.
 */
function widgetReport(event) {
    event.at = new Date().toISOString()
    widgetMetricQueue.push(event)
    if (widgetMetricQueue.length > 500) {
        widgetMetricQueue = widgetMetricQueue.slice(-500)
    }
    try {
        localStorage.setItem(WIDGET_QUEUE_KEY, JSON.stringify(widgetMetricQueue))
    } catch (e) { /* quota */ }
}

function widgetEventUrl() {
    var host = ''
    try { host = (config && config.hostserver) || '' } catch (e) { host = '' }
    if (!host) return ''
    // hostserver looks like https://server:8000/demo
    return host.replace(/\/$/, '') + '/widget/event/'
}

function widgetFlushMetrics(metrics) {
    var url = widgetEventUrl()
    if (!url) return
    if (!widgetMetricQueue.length && !metrics) return

    var events = widgetMetricQueue
    widgetMetricQueue = []
    var payload = { player: widgetPlayerId(), events: events }
    if (typeof dsid !== 'undefined' && dsid) payload.ds = dsid
    if (metrics) payload.metrics = metrics

    $.ajax({
        url: url,
        type: 'POST',
        contentType: 'application/json',
        data: JSON.stringify(payload),
        timeout: 15000,
        success: function () {
            try { localStorage.removeItem(WIDGET_QUEUE_KEY) } catch (e) { /* quota */ }
        },
        error: function () {
            // keep the events for the next attempt
            widgetMetricQueue = events.concat(widgetMetricQueue)
            try {
                localStorage.setItem(WIDGET_QUEUE_KEY, JSON.stringify(widgetMetricQueue))
            } catch (e) { /* quota */ }
        }
    })
}

function widgetPlayerMetrics() {
    var metrics = {
        uptime: Math.round((Date.now() - widgetStartedAt) / 1000),
        widgets_active: Object.keys(widgetSlotRegistry).length
    }
    if (window.performance && window.performance.memory) {
        metrics.memory = Math.round(
            window.performance.memory.usedJSHeapSize / window.performance.memory.jsHeapSizeLimit * 100
        )
    }
    if (typeof process !== 'undefined' && process.getCPUUsage) {
        metrics.cpu = Math.round(process.getCPUUsage().percentCPUUsage * 100) / 100
    }
    return metrics
}

function widgetStartMetrics() {
    if (widgetMetricTimer) return
    try {
        var stored = localStorage.getItem(WIDGET_QUEUE_KEY)
        if (stored) widgetMetricQueue = JSON.parse(stored).concat(widgetMetricQueue)
    } catch (e) { /* corrupt cache */ }

    widgetMetricTimer = setInterval(function () {
        widgetFlushMetrics(null)
    }, WIDGET_METRIC_INTERVAL)
    widgetPlayerTimer = setInterval(function () {
        widgetFlushMetrics(widgetPlayerMetrics())
    }, WIDGET_PLAYER_INTERVAL)
}

if (typeof module !== 'undefined' && module && module.exports) {
    // exported for the unit tests, the player itself uses the globals
    module.exports = {
        widgetSlotActive: widgetSlotActive,
        widgetSlotItems: widgetSlotItems,
        widgetScheduleOf: widgetScheduleOf,
        widgetMinutes: widgetMinutes,
        widgetSummarise: widgetSummarise,
        widgetEscape: widgetEscape
    }
}
