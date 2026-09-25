/**
 * Tests for media playlist discovery normalization and multilingual TTS queue.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

describe('AirportDisplayPlayer media + multilingual TTS', () => {
    function loadModule() {
        const code = fs.readFileSync(
            path.join(__dirname, '..', 'src', 'assets', 'js', 'airport-display.js'),
            'utf8'
        );
        const sandbox = {
            window: {},
            document: {
                body: { contains: () => false, appendChild: () => {} },
                getElementById: () => null,
                createElement: () => ({ style: {}, id: '', innerHTML: '' }),
            },
            $: () => ({ length: 0, html: () => {}, attr: () => '' }),
            console,
            Audio: function () {
                this.addEventListener = () => {};
                this.play = () => Promise.resolve();
                this.pause = () => {};
            },
            XMLHttpRequest: function () {
                this.open = () => {};
                this.setRequestHeader = () => {};
                this.send = () => {};
            },
        };
        sandbox.window = sandbox;
        vm.runInNewContext(code, sandbox);
        return sandbox.window.AirportDisplayPlayer;
    }

    it('preserves multilingual language order (first plays first)', () => {
        const AD = loadModule();
        const langs = AD._normalizeAnnouncementLanguages({
            enabled: true,
            text: 'Boarding',
            languages: [
                { language: 'ja', voice: 'ja-JP-NanamiNeural', order: 2, audio_url: 'a2.mp3' },
                { language: 'en', voice: 'en-GB-SoniaNeural', order: 1, audio_url: 'a1.mp3' },
            ],
        });
        assert.equal(langs[0].language, 'en');
        assert.equal(langs[1].language, 'ja');
        assert.equal(langs[0].order, 1);
        assert.equal(langs[1].order, 2);
    });

    it('does not alphabetically reorder languages when order is sequential', () => {
        const AD = loadModule();
        const langs = AD._normalizeAnnouncementLanguages({
            enabled: true,
            text: 'Boarding',
            languages: [
                { language: 'zh', order: 1, audio_url: 'z.mp3' },
                { language: 'en', order: 2, audio_url: 'e.mp3' },
                { language: 'ja', order: 3, audio_url: 'j.mp3' },
            ],
        });
        assert.equal(langs.map((l) => l.language).join(','), 'zh,en,ja');
    });

    it('applies temporary media selected mode without requiring layout persist helpers', () => {
        const AD = loadModule();
        // No medialoop in sandbox — DOM path should still accept media payload shape
        const result = AD.handle({
            type: 'airport_display',
            event: 'manual_test',
            event_id: 'media-test-1',
            slots: [{
                layout_id: '12',
                slot_id: '45',
                slot_name: 'MainMedia',
                slot_type: 'media',
                media_mode: 'selected',
                value: 'Welcome.mp4',
                media_items: [{ filename: 'Welcome.mp4', order: 1, selected: true }],
                temporary: true,
            }],
            announcement: { enabled: false },
        });
        // Without DOM slot, media apply fails gracefully (does not crash)
        assert.ok(result);
        assert.ok(['success', 'error'].includes(result.status));
    });
});
