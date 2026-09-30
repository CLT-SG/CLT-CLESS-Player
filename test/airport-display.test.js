/**
 * Minimal unit-style checks for Airport Display player handler.
 * Run with: node --test test/airport-display.test.js
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

describe('AirportDisplayPlayer', () => {
    function loadModule(extras) {
        const code = fs.readFileSync(
            path.join(__dirname, '..', 'src', 'assets', 'js', 'airport-display.js'),
            'utf8'
        );
        const element = () => ({
            id: '',
            style: { cssText: '', display: 'none' },
            innerHTML: '',
        });
        const document = {
            body: {
                contains: () => false,
                appendChild: () => {},
            },
            getElementById: () => null,
            createElement: () => element(),
        };
        const jqueryStub = () => {
            const api = {
                length: 0,
                html: () => api,
                filter: () => api,
                attr: () => '',
            };
            return api;
        };
        const slotCatalog = {
            BoardingMsg: { slotid: '1', slottype: 'text', layoutid: '10' },
            InfoTicker: { slotid: '2', slottype: 'ticker', layoutid: '10' },
            TestSlot: { slotid: '3', slottype: 'text', layoutid: '11' },
            FlightInfo: { slotid: '45', slottype: 'text', layoutid: '12' },
            A: { slotid: '9', slottype: 'text', layoutid: '2' },
        };
        const timers = [];
        const sandbox = {
            window: {},
            document,
            $: jqueryStub,
            slotnameList: Object.keys(slotCatalog),
            currentPlayLayoutID: '12',
            currentlytID: '12',
            loopXMLCurIndex: 3,
            loopTimeout: null,
            loopTimeoutPaused: false,
            isLoopLyt: true,
            getCurrentLayoutID: (name) => slotCatalog[name] || null,
            updateTextSlotContent: () => true,
            resetLoopTimeoutState: () => {
                sandbox.loopTimeout = null;
            },
            restartLoopTimeoutForCurrentLayout: () => {
                sandbox._restartCount = (sandbox._restartCount || 0) + 1;
            },
            resumeLoopTimeout: () => {
                sandbox._resumeCount = (sandbox._resumeCount || 0) + 1;
            },
            syncCurrentPlayLayoutID: (id) => {
                sandbox.currentPlayLayoutID = String(id);
                sandbox.currentlytID = String(id);
            },
            switchToLayoutTemporarilyInLoop: (layoutId, cb) => {
                sandbox.currentPlayLayoutID = String(layoutId);
                sandbox.currentlytID = String(layoutId);
                if (typeof cb === 'function') cb(true, 'ok');
            },
            switchToLayoutOffline: (layoutId, cb) => {
                sandbox.currentPlayLayoutID = String(layoutId);
                sandbox.currentlytID = String(layoutId);
                if (typeof cb === 'function') cb(true, 'ok');
            },
            setTimeout: (fn, ms) => {
                const id = timers.length + 1;
                timers.push({ id, fn, ms });
                // Immediately run short settle timers used by layout switch.
                if (ms != null && ms <= 200) {
                    try { fn(); } catch (e) { /* ignore */ }
                }
                return id;
            },
            clearTimeout: (id) => {
                const idx = timers.findIndex((t) => t.id === id);
                if (idx >= 0) timers.splice(idx, 1);
            },
            Promise,
            Date,
            isFinite,
            Math,
            Number,
            String,
            Object,
            Array,
            JSON,
            console,
            ...(extras || {}),
        };
        sandbox.window = sandbox;
        sandbox._timers = timers;
        sandbox._restartCount = 0;
        sandbox._resumeCount = 0;
        vm.runInNewContext(code, sandbox, { timeout: 5000 });
        return sandbox;
    }

    it('accepts a multi-slot zone_trigger event', async () => {
        const sandbox = loadModule();
        const AD = sandbox.window.AirportDisplayPlayer;
        const result = await AD.handle({
            type: 'airport_display',
            event: 'zone_trigger',
            event_id: 'airport-zone-1-test-001',
            zone: 1,
            zone_name: 'Zone 1',
            slots: [
                { layout_id: '10', slot_type: 'text', slot_name: 'BoardingMsg', value: 'Boarding Now' },
                { layout_id: '10', slot_type: 'ticker', slot_name: 'InfoTicker', value: 'Gate A1' },
            ],
            announcement: { enabled: false, text: '', language: 'en' },
        });
        assert.equal(result.status, 'success');
        assert.equal(result.event_id, 'airport-zone-1-test-001');
    });

    it('accepts manual_test events without a zone', async () => {
        const sandbox = loadModule();
        const AD = sandbox.window.AirportDisplayPlayer;
        const result = await AD.handle({
            type: 'airport_display',
            event: 'manual_test',
            event_id: 'airport-manual-test-001',
            slots: [
                { layout_id: '11', slot_type: 'text', slot_name: 'TestSlot', value: 'Hello' },
            ],
            announcement: { enabled: false },
        });
        assert.equal(result.status, 'success');
    });

    it('accepts Layout+Slot identifiers', async () => {
        const sandbox = loadModule();
        const AD = sandbox.window.AirportDisplayPlayer;
        const result = await AD.handle({
            type: 'airport_display',
            event: 'manual_test',
            event_id: 'airport-layout-slot-001',
            slots: [
                {
                    layout_id: '12',
                    layout_name: 'Departure',
                    slot_id: '45',
                    slot_name: 'FlightInfo',
                    slot_type: 'text',
                    value: 'SQ123 - Boarding',
                },
            ],
            announcement: {
                enabled: true,
                text: 'Now boarding',
                language: 'en',
                audio_url: 'https://example.com/audio.mp3',
            },
        });
        assert.equal(result.status, 'success');
        assert.equal(result.slots.length, 1);
        assert.equal(result.slots[0].layout_id, '12');
        assert.equal(result.slots[0].slot_id, '45');
        assert.equal(result.slots[0].ok, true);
    });

    it('reports slot not found without crashing', async () => {
        const sandbox = loadModule();
        const AD = sandbox.window.AirportDisplayPlayer;
        const result = await AD.handle({
            type: 'airport_display',
            event: 'manual_test',
            event_id: 'airport-missing-slot-001',
            slots: [
                {
                    layout_id: '99',
                    slot_id: '999',
                    slot_name: 'DoesNotExist',
                    slot_type: 'text',
                    value: 'x',
                },
            ],
            announcement: { enabled: false },
        });
        assert.equal(result.status, 'error');
        assert.equal(result.slots[0].ok, false);
        assert.equal(result.slots[0].error_code, 'SLOT_NOT_FOUND');
    });

    it('ignores duplicate event_ids', async () => {
        const sandbox = loadModule();
        const AD = sandbox.window.AirportDisplayPlayer;
        const payload = {
            type: 'airport_display',
            event_id: 'dup-1',
            zone: 2,
            slots: [{ layout_id: '2', slot_type: 'text', slot_name: 'A', value: 'Final' }],
            announcement: { enabled: false },
        };
        assert.equal((await AD.handle(payload)).status, 'success');
        assert.equal((await AD.handle(payload)).status, 'duplicate');
    });

    it('defaults freeze_timeout to forever and blocks until resume', async () => {
        const sandbox = loadModule();
        const AD = sandbox.window.AirportDisplayPlayer;
        assert.equal(AD.normalizeFreezeTimeout(null), 'forever');
        assert.equal(AD.normalizeFreezeTimeout(''), 'forever');
        assert.equal(AD.normalizeFreezeTimeout('bogus'), 'forever');
        assert.equal(AD.normalizeFreezeTimeout(60), 60);

        const result = await AD.handle({
            type: 'airport_display',
            event: 'manual_test',
            event_id: 'freeze-forever-001',
            source: 'manual',
            slots: [
                {
                    layout_id: '12',
                    slot_id: '45',
                    slot_name: 'FlightInfo',
                    slot_type: 'text',
                    value: 'Frozen',
                },
            ],
            announcement: { enabled: false },
        });
        assert.equal(result.status, 'success');
        assert.ok(result.freeze);
        assert.equal(result.freeze.freeze_timeout, 'forever');
        assert.equal(AD.isFrozen(), true);
        assert.equal(sandbox._timers.length, 0);

        const resumed = AD.resumeFreeze('test-manual');
        assert.equal(resumed.resumed, true);
        assert.equal(AD.isFrozen(), false);
        assert.ok(sandbox._restartCount >= 1);
    });

    it('finite freeze_timeout schedules a single authoritative timer', async () => {
        const sandbox = loadModule();
        const AD = sandbox.window.AirportDisplayPlayer;

        await AD.handle({
            type: 'airport_display',
            event: 'manual_test',
            event_id: 'freeze-60-001',
            freeze_timeout: 60,
            slots: [
                {
                    layout_id: '12',
                    slot_id: '45',
                    slot_name: 'FlightInfo',
                    slot_type: 'text',
                    value: 'A',
                },
            ],
            announcement: { enabled: false },
        });
        assert.equal(AD.isFrozen(), true);
        assert.equal(sandbox._timers.length, 1);
        assert.equal(sandbox._timers[0].ms, 60000);
        const firstGen = AD.getFreezeState().generation;

        await AD.handle({
            type: 'airport_display',
            event: 'manual_test',
            event_id: 'freeze-60-002',
            freeze_timeout: 30,
            slots: [
                {
                    layout_id: '12',
                    slot_id: '45',
                    slot_name: 'FlightInfo',
                    slot_type: 'text',
                    value: 'B',
                },
            ],
            announcement: { enabled: false },
        });
        assert.equal(AD.isFrozen(), true);
        assert.equal(sandbox._timers.length, 1);
        assert.equal(sandbox._timers[0].ms, 30000);
        assert.ok(AD.getFreezeState().generation > firstGen);

        // Expire the new timer — old generation must not resume unexpectedly.
        const timerFn = sandbox._timers[0].fn;
        timerFn();
        assert.equal(AD.isFrozen(), false);
    });

    it('resume-layout reason clears freeze without restarting loop timer', () => {
        const sandbox = loadModule();
        const AD = sandbox.window.AirportDisplayPlayer;
        AD.activateFreeze({ freeze_timeout: 'forever', layout_id: '12' });
        assert.equal(AD.isFrozen(), true);
        const before = sandbox._restartCount;
        AD.resumeFreeze('resume-layout:resume', { restartLoop: false });
        assert.equal(AD.isFrozen(), false);
        assert.equal(sandbox._restartCount, before);
    });

    it('normalizes announcement.repeat to 1–9 total plays', () => {
        const sandbox = loadModule();
        const AD = sandbox.window.AirportDisplayPlayer;
        assert.equal(AD.normalizeAnnouncementRepeat(null), 1);
        assert.equal(AD.normalizeAnnouncementRepeat(0), 1);
        assert.equal(AD.normalizeAnnouncementRepeat(3), 3);
        assert.equal(AD.normalizeAnnouncementRepeat(9), 9);
        assert.equal(AD.normalizeAnnouncementRepeat(10), 9);
        assert.equal(AD.normalizeAnnouncementRepeat('2'), 2);
    });

    it('plays the full language sequence repeat times and reuses audio URLs', async () => {
        const playLog = [];
        const sandbox = loadModule({
            Audio: function (url) {
                this.url = url;
                playLog.push(url);
                this.addEventListener = (evt, cb) => {
                    if (evt === 'ended') {
                        setTimeout(cb, 0);
                    }
                };
                this.play = () => Promise.resolve();
                this.pause = () => {};
            },
        });
        // Immediate short timers already fire; also fire 0ms ended callbacks.
        const origSetTimeout = sandbox.setTimeout;
        sandbox.setTimeout = (fn, ms) => {
            const id = origSetTimeout(fn, ms);
            if (ms === 0) {
                try { fn(); } catch (e) { /* ignore */ }
            }
            return id;
        };

        const AD = sandbox.window.AirportDisplayPlayer;
        const summary = await AD._playLanguageSequence({
            event_id: 'rep-1',
            repeat: 3,
            languages: [
                { language: 'en', order: 1, audio_url: 'https://example.com/en.mp3' },
                { language: 'ms', order: 2, audio_url: 'https://example.com/ms.mp3' },
            ],
        });
        assert.equal(summary.repeat, 3);
        assert.equal(playLog.length, 6);
        assert.deepEqual(playLog, [
            'https://example.com/en.mp3',
            'https://example.com/ms.mp3',
            'https://example.com/en.mp3',
            'https://example.com/ms.mp3',
            'https://example.com/en.mp3',
            'https://example.com/ms.mp3',
        ]);
        assert.equal(summary.played, 6);
    });
});
