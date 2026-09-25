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
    function loadModule() {
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
        const sandbox = {
            window: {},
            document,
            $: jqueryStub,
            slotnameList: Object.keys(slotCatalog),
            currentPlayLayoutID: '12',
            getCurrentLayoutID: (name) => slotCatalog[name] || null,
            updateTextSlotContent: () => true,
            Audio: function () {
                this.addEventListener = () => {};
                this.play = () => Promise.resolve();
                this.pause = () => {};
            },
            XMLHttpRequest: function () {
                this.open = () => {};
                this.setRequestHeader = () => {};
                this.send = function () { this.onload && this.onload(); };
            },
            console,
        };
        sandbox.window = sandbox;
        vm.runInNewContext(code, sandbox);
        return sandbox.window.AirportDisplayPlayer;
    }

    it('accepts a multi-slot zone_trigger event', () => {
        const AD = loadModule();
        const result = AD.handle({
            type: 'airport_display',
            event: 'zone_trigger',
            event_id: 'airport-zone-1-test-001',
            zone: 1,
            zone_name: 'Zone 1',
            slots: [
                { slot_type: 'text', slot_name: 'BoardingMsg', value: 'Boarding Now' },
                { slot_type: 'ticker', slot_name: 'InfoTicker', value: 'Gate A1' },
            ],
            announcement: { enabled: false, text: '', language: 'en' },
        });
        assert.equal(result.status, 'success');
        assert.equal(result.event_id, 'airport-zone-1-test-001');
    });

    it('accepts manual_test events without a zone', () => {
        const AD = loadModule();
        const result = AD.handle({
            type: 'airport_display',
            event: 'manual_test',
            event_id: 'airport-manual-test-001',
            slots: [
                { slot_type: 'text', slot_name: 'TestSlot', value: 'Hello' },
            ],
            announcement: { enabled: false },
        });
        assert.equal(result.status, 'success');
    });

    it('accepts Layout+Slot identifiers', () => {
        const AD = loadModule();
        const result = AD.handle({
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

    it('reports slot not found without crashing', () => {
        const AD = loadModule();
        const result = AD.handle({
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

    it('ignores duplicate event_ids', () => {
        const AD = loadModule();
        const payload = {
            type: 'airport_display',
            event_id: 'dup-1',
            zone: 2,
            slots: [{ slot_type: 'text', slot_name: 'A', value: 'Final' }],
            announcement: { enabled: false },
        };
        assert.equal(AD.handle(payload).status, 'success');
        assert.equal(AD.handle(payload).status, 'duplicate');
    });
});
