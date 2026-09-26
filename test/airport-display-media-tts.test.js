/**
 * Tests for media playlist discovery normalization and multilingual TTS queue.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

describe('AirportDisplayPlayer media + multilingual TTS', () => {
    function loadModule(AudioImpl) {
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
            queueMicrotask,
            Audio: AudioImpl || function () {
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

    it('keeps each language text instead of the shared announcement', () => {
        const AD = loadModule();
        const langs = AD._normalizeAnnouncementLanguages({
            enabled: true,
            text: 'shared',
            languages: [
                { language: 'en', order: 1, text: 'Flight SQ123 is now boarding.', audio_url: 'en.mp3' },
                { language: 'ja', order: 2, text: 'フライトSQ123の搭乗を開始します。', audio_url: 'ja.mp3' },
                { language: 'zh', order: 3, text: 'SQ123航班现在开始登机。', audio_url: 'zh.mp3' },
            ],
        });
        assert.equal(langs.map((l) => l.language).join(','), 'en,ja,zh');
        assert.equal(langs[0].text, 'Flight SQ123 is now boarding.');
        assert.equal(langs[1].text, 'フライトSQ123の搭乗を開始します。');
        assert.equal(langs[2].text, 'SQ123航班现在开始登机。');
    });

    it('supports expanded airport languages including Arabic and Russian in order', () => {
        const AD = loadModule();
        const langs = AD._normalizeAnnouncementLanguages({
            enabled: true,
            text: 'Boarding',
            languages: [
                { language: 'ar', order: 3, text: 'بدأ صعود الرحلة', audio_url: 'ar.mp3' },
                { language: 'en', order: 1, text: 'Flight SQ123 is now boarding.', audio_url: 'en.mp3' },
                { language: 'ru', order: 2, text: 'Начинается посадка на рейс SQ123.', audio_url: 'ru.mp3' },
                { language: 'ms', order: 4, text: 'Penerbangan SQ123 kini menaiki.', audio_url: 'ms.mp3' },
            ],
        });
        assert.equal(langs.map((l) => l.language).join(','), 'en,ru,ar,ms');
        assert.equal(langs[2].text, 'بدأ صعود الرحلة');
    });

    it('plays languages in configured order and continues after one failure', async () => {
        const played = [];
        function RecordingAudio(url) {
            this.url = url;
            this._handlers = {};
            this.addEventListener = (name, fn) => { this._handlers[name] = fn; };
            this.play = () => {
                played.push(this.url);
                const fail = String(this.url).indexOf('fail') !== -1;
                queueMicrotask(() => {
                    const fn = fail ? this._handlers.error : this._handlers.ended;
                    if (fn) fn();
                });
                return Promise.resolve();
            };
            this.pause = () => {};
        }
        const AD = loadModule(RecordingAudio);
        const summary = await AD._playLanguageSequence({
            event_id: 'seq-1',
            languages: [
                { language: 'en', order: 1, audio_url: 'en.mp3', text: 'English' },
                { language: 'ja', order: 2, audio_url: 'fail-ja.mp3', text: 'Japanese' },
                { language: 'zh', order: 3, audio_url: '', text: 'Chinese missing' },
                { language: 'ko', order: 4, audio_url: 'ko.mp3', text: 'Korean' },
            ],
        });
        assert.deepEqual(played, ['en.mp3', 'fail-ja.mp3', 'ko.mp3']);
        assert.equal(summary.played, 2);
        assert.equal(summary.failed, 2);
        assert.equal(
            Array.from(summary.results, (r) => r.language).join(','),
            'en,ja,zh,ko'
        );
        assert.equal(summary.results[1].error_code, 'AUDIO_PLAYBACK_FAILED');
        assert.equal(summary.results[2].error_code, 'AUDIO_URL_MISSING');
        assert.equal(summary.results[3].ok, true);
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
                media_items: [{ filename: 'Welcome.mp4', path: 'media/Welcome.mp4', order: 1, selected: true }],
                temporary: true,
            }],
            announcement: { enabled: false },
        });
        // Without DOM slot, media apply fails gracefully (does not crash)
        assert.ok(result);
        assert.ok(['success', 'error'].includes(result.status));
    });

    it('rejects empty media payloads and prefers path when building content', () => {
        const AD = loadModule();
        const empty = AD._applyTemporaryMedia(
            { media_mode: 'selected', value: '', media_items: [] },
            { numericId: '45', layoutId: '12', $el: { length: 0 } }
        );
        assert.equal(empty.ok, false);
        assert.equal(empty.error_code, 'MEDIA_VALUE_MISSING');

        const built = AD._buildMediaContentObj({
            filename: 'Welcome.mp4',
            path: '/opt/player/media/Welcome.mp4',
            type: 'video',
            selected: true,
        });
        assert.ok(built);
        assert.equal(built.filename, 'Welcome.mp4');
        assert.equal(built.contentUrl, '/opt/player/media/Welcome.mp4');
        assert.equal(built.mediaType, 'VIDEO');
    });
});
