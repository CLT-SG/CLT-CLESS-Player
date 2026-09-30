/**
 * Tests for media playlist discovery normalization and multilingual TTS queue.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

describe('AirportDisplayPlayer media + multilingual TTS', () => {
    function loadModule(AudioImpl, extras) {
        const code = fs.readFileSync(
            path.join(__dirname, '..', 'src', 'assets', 'js', 'airport-display.js'),
            'utf8'
        );
        const existingFiles = new Set([
            '/home/player/clessapp/res/Welcome.mp4',
            '/home/player/clessapp/res/boarding.jpg',
            '/opt/player/media/Welcome.mp4',
        ]);
        let currentPlayLayoutID = (extras && extras.currentPlayLayoutID) || '12';
        let currentlytID = (extras && extras.currentlytID) || currentPlayLayoutID;
        const switchLog = (extras && extras._switchLog) || [];
        const sandbox = Object.assign({
            window: {},
            document: {
                body: { contains: () => false, appendChild: () => {} },
                getElementById: () => null,
                createElement: () => ({ style: {}, id: '', innerHTML: '' }),
            },
            $: () => ({ length: 0, html: () => {}, attr: () => '', find: () => ({ length: 0, first: () => ({ length: 0, on: () => {} }) }) }),
            console,
            queueMicrotask,
            setTimeout: (fn) => { fn(); return 1; },
            clearTimeout: () => {},
            homedir: '/home/player',
            isLoopLyt: true,
            fs: {
                existsSync: (p) => existingFiles.has(String(p)),
            },
            localStorage: {
                getItem: (k) => (k === 'currentPlayLayoutID' ? currentPlayLayoutID : null),
                setItem: () => {},
            },
            syncCurrentPlayLayoutID: (id) => {
                currentPlayLayoutID = String(id);
                currentlytID = String(id);
            },
            switchToLayoutTemporarilyInLoop: (layoutId, cb) => {
                switchLog.push(String(layoutId));
                currentPlayLayoutID = String(layoutId);
                currentlytID = String(layoutId);
                cb(true, 'ok');
            },
            switchToLayoutOffline: (layoutId, cb) => {
                switchLog.push(String(layoutId));
                currentPlayLayoutID = String(layoutId);
                currentlytID = String(layoutId);
                cb(true, 'ok');
            },
            restartLoopTimeoutForCurrentLayout: () => true,
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
        }, extras || {});
        Object.defineProperty(sandbox, 'currentPlayLayoutID', {
            get: () => currentPlayLayoutID,
            set: (v) => { currentPlayLayoutID = v; },
            configurable: true,
        });
        Object.defineProperty(sandbox, 'currentlytID', {
            get: () => currentlytID,
            set: (v) => { currentlytID = v; },
            configurable: true,
        });
        sandbox._switchLog = switchLog;
        sandbox._getLayoutId = () => currentPlayLayoutID;
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

    it('applies temporary media selected mode without requiring layout persist helpers', async () => {
        const AD = loadModule();
        // No medialoop in sandbox — DOM path should still accept media payload shape
        const result = await AD.handle({
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

    it('resolves relative layout paths to clessapp/res basename like Control Panel', () => {
        const AD = loadModule();
        assert.equal(AD._getMediaResFolder(), '/home/player/clessapp/res');

        const relative = AD._resolveMediaSource({
            filename: 'Welcome.mp4',
            path: 'media/Welcome.mp4',
            type: 'video',
        });
        assert.equal(relative.filename, 'Welcome.mp4');
        assert.equal(relative.mediaLocalPath, '/home/player/clessapp/res/Welcome.mp4');
        assert.equal(relative.resolution, 'resfolder');

        const bare = AD._buildMediaContentObj({
            filename: 'boarding.jpg',
            path: 'boarding.jpg',
            type: 'image',
            selected: true,
        });
        assert.ok(bare);
        assert.equal(bare.contentUrl, '/home/player/clessapp/res/boarding.jpg');
        assert.equal(bare.mediaType, 'IMAGE');
    });

    it('maps /media web paths to res cache instead of treating them as filesystem paths', () => {
        const AD = loadModule();
        assert.equal(AD._isWebMediaPath('/media/Welcome.mp4'), true);
        assert.equal(AD._isWebMediaPath('/opt/player/media/Welcome.mp4'), false);

        const web = AD._resolveMediaSource({
            filename: 'Welcome.mp4',
            path: '/media/Welcome.mp4',
            asset_url: 'https://cless.example/media/Welcome.mp4',
            type: 'video',
        });
        assert.equal(web.mediaLocalPath, '/home/player/clessapp/res/Welcome.mp4');
        assert.equal(web.resolution, 'webpath-resfolder');
        assert.equal(
            AD._resolveDownloadUrl({
                filename: 'Welcome.mp4',
                path: 'Welcome.mp4',
                layout_path: 'media/Welcome.mp4',
                asset_url: 'https://cless.example/media/Welcome.mp4',
            }, web),
            'https://cless.example/media/Welcome.mp4'
        );
    });

    it('keeps absolute paths and remote URLs intact', () => {
        const AD = loadModule();
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

        const remote = AD._resolveMediaSource({
            filename: 'remote.jpg',
            path: 'https://cdn.example/media/remote.jpg',
            type: 'image',
        });
        assert.equal(remote.mediaLocalPath, 'https://cdn.example/media/remote.jpg');
        assert.equal(remote.resolution, 'remote');
    });

    it('rejects missing cached media and preserves previous content', async () => {
        const AD = loadModule();
        const htmlState = { value: '<img src="previous.jpg">' };
        const $el = {
            length: 1,
            html: (v) => {
                if (v === undefined) return htmlState.value;
                htmlState.value = v;
            },
            find: () => ({ length: 0, first: () => ({ length: 0, on: () => {} }) }),
        };
        const missing = await AD._applyTemporaryMedia(
            {
                media_mode: 'selected',
                value: 'Missing.jpg',
                media_items: [{ filename: 'Missing.jpg', path: 'media/Missing.jpg', selected: true }],
                slot_name: 'MainMedia',
            },
            { numericId: '45', layoutId: '12', $el: $el }
        );
        assert.equal(missing.ok, false);
        assert.equal(missing.error_code, 'MEDIA_NOT_FOUND');
        assert.equal(htmlState.value, '<img src="previous.jpg">');

        const empty = await AD._applyTemporaryMedia(
            { media_mode: 'selected', value: '', media_items: [] },
            { numericId: '45', layoutId: '12', $el: { length: 0 } }
        );
        assert.equal(empty.ok, false);
        assert.equal(empty.error_code, 'MEDIA_VALUE_MISSING');
    });

    it('requires layout_id and switches layout before updating slots', async () => {
        const switchLog = [];
        let currentPlayLayoutID = 'C';
        let currentlytID = 'C';
        let lastHtml = '';
        const existingFiles = new Set([
            '/home/player/clessapp/res/Welcome.mp4',
            '/home/player/clessapp/res/boarding.jpg',
        ]);
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
            $: (sel) => {
                if (String(sel) === '#slot-45' && String(currentPlayLayoutID) === 'A') {
                    return {
                        length: 1,
                        html: (v) => { if (v !== undefined) lastHtml = v; return lastHtml; },
                        attr: () => 'slot-45',
                        find: () => ({ length: 1, first: () => ({ length: 1, on: () => {} }) }),
                    };
                }
                return {
                    length: 0,
                    html: () => {},
                    attr: () => '',
                    find: () => ({ length: 0, first: () => ({ length: 0, on: () => {} }) }),
                };
            },
            console,
            queueMicrotask,
            setTimeout: (fn) => { fn(); return 1; },
            clearTimeout: () => {},
            homedir: '/home/player',
            isLoopLyt: true,
            fs: { existsSync: (p) => existingFiles.has(String(p)) },
            syncCurrentPlayLayoutID: (id) => {
                currentPlayLayoutID = String(id);
                currentlytID = String(id);
            },
            switchToLayoutTemporarilyInLoop: (layoutId, cb) => {
                switchLog.push(String(layoutId));
                currentPlayLayoutID = String(layoutId);
                currentlytID = String(layoutId);
                cb(true, 'ok');
            },
            restartLoopTimeoutForCurrentLayout: () => true,
            updateTextSlotContent: () => {},
            Audio: function () { this.addEventListener = () => {}; this.play = () => Promise.resolve(); this.pause = () => {}; },
            XMLHttpRequest: function () { this.open = () => {}; this.setRequestHeader = () => {}; this.send = () => {}; },
            localStorage: {
                getItem: (k) => (k === 'currentPlayLayoutID' ? currentPlayLayoutID : null),
                setItem: () => {},
            },
        };
        Object.defineProperty(sandbox, 'currentPlayLayoutID', {
            get: () => currentPlayLayoutID,
            set: (v) => { currentPlayLayoutID = v; },
            configurable: true,
        });
        Object.defineProperty(sandbox, 'currentlytID', {
            get: () => currentlytID,
            set: (v) => { currentlytID = v; },
            configurable: true,
        });
        sandbox.window = sandbox;
        vm.runInNewContext(code, sandbox);
        const ADP = sandbox.window.AirportDisplayPlayer;

        const missingLayout = await ADP.handle({
            type: 'airport_display',
            event_id: 'layout-missing-1',
            slots: [{ slot_id: '45', slot_name: 'MainMedia', slot_type: 'text', value: 'Hi' }],
            announcement: { enabled: false },
        });
        assert.equal(missingLayout.status, 'error');
        assert.equal(missingLayout.slots[0].error_code, 'LAYOUT_ID_MISSING');

        const result = await ADP.handle({
            type: 'airport_display',
            event_id: 'layout-switch-1',
            slots: [{
                layout_id: 'A',
                layout_name: 'Layout A',
                slot_id: '45',
                slot_name: 'MainMedia',
                slot_type: 'media',
                media_mode: 'selected',
                value: 'boarding.jpg',
                media_items: [{ filename: 'boarding.jpg', path: 'boarding.jpg', selected: true, type: 'image' }],
                temporary: true,
            }],
            announcement: { enabled: false },
        });
        assert.deepEqual(switchLog, ['A']);
        assert.equal(currentPlayLayoutID, 'A');
        assert.ok(result.slots[0].ok);
        assert.equal(result.slots[0].layout_switched, true);
        assert.match(lastHtml, /boarding\.jpg/);
    });

    it('downloads missing media via asset_url before applying', async () => {
        const downloaded = [];
        const existingFiles = new Set([
            '/home/player/clessapp/res/Welcome.mp4',
            '/home/player/clessapp/res/boarding.jpg',
            '/opt/player/media/Welcome.mp4',
        ]);
        const AD = loadModule(null, {
            config: { hostserver: 'https://cless.example/demo' },
            ipcRenderer: {
                invoke: async (channel, args) => {
                    assert.equal(channel, 'app-downloadmedia');
                    downloaded.push(args);
                    existingFiles.add(args.mediaPathSrc);
                    return args.mediaPathSrc;
                },
            },
            fs: {
                existsSync: (p) => existingFiles.has(String(p)),
            },
        });

        const htmlState = { value: '<img src="previous.jpg">' };
        const $el = {
            length: 1,
            html: (v) => {
                if (v === undefined) return htmlState.value;
                htmlState.value = v;
            },
            find: () => ({ length: 0, first: () => ({ length: 0, on: () => {} }) }),
        };
        const result = await AD._applyTemporaryMedia(
            {
                media_mode: 'selected',
                value: 'GateA.jpg',
                media_items: [{
                    filename: 'GateA.jpg',
                    path: 'GateA.jpg',
                    layout_path: 'media/GateA.jpg',
                    asset_url: 'https://cless.example/media/GateA.jpg',
                    selected: true,
                    type: 'image',
                }],
                slot_name: 'MainMedia',
            },
            { numericId: '45', layoutId: '12', $el: $el }
        );
        assert.equal(result.ok, true);
        assert.equal(result.downloaded, true);
        assert.equal(downloaded.length, 1);
        assert.equal(downloaded[0].mediaURL, 'https://cless.example/media/GateA.jpg');
        assert.equal(downloaded[0].mediaPathSrc, '/home/player/clessapp/res/GateA.jpg');
        assert.match(htmlState.value, /GateA\.jpg/);
    });
});
