/**
 * Minimal unit-style checks for Airport Display player handler.
 * Run with: node --test test/airport-display.test.js
 * (Loads the IIFE in a fake window.)
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
        const document = {
            body: {
                contains: () => false,
                appendChild: () => {},
            },
            getElementById: () => null,
            createElement: () => {
                return {
                    id: '',
                    style: { cssText: '', display: 'none' },
                    innerHTML: '',
                };
            },
        };
        const sandbox = {
            window: {},
            document,
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

    it('accepts a normalized zone_trigger event', () => {
        const AD = loadModule();
        const result = AD.handle({
            type: 'airport_display',
            event: 'zone_trigger',
            event_id: 'airport-zone-1-test-001',
            zone: 1,
            zone_name: 'Zone 1',
            text: 'Boarding Now',
            announcement: { enabled: false, text: '', language: 'en' },
        });
        assert.equal(result.status, 'success');
        assert.equal(result.event_id, 'airport-zone-1-test-001');
    });

    it('ignores duplicate event_ids', () => {
        const AD = loadModule();
        const payload = {
            type: 'airport_display',
            event_id: 'dup-1',
            zone: 2,
            text: 'Final',
            announcement: { enabled: false },
        };
        assert.equal(AD.handle(payload).status, 'success');
        assert.equal(AD.handle(payload).status, 'duplicate');
    });
});
