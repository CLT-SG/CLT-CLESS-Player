# CLESS-Player modernization plan

Phased migration from the XML-driven jQuery renderer to a Vue 3 + TypeScript
platform, derived from [ARCHITECTURE-REVIEW.md](ARCHITECTURE-REVIEW.md).

Two rules constrain every phase:

1. **No phase may require a server upgrade or a device upgrade to happen in
   lockstep.** Every combination of (old / new player) × (old / new server)
   must play content.
2. **No phase may remove a capability before its replacement is proven on
   devices.** XML support and the legacy renderer stay until the fleet has
   moved.

Status legend: **done** · **ready** (implemented, awaiting rollout) ·
**planned**.

---

## Phase 0 — Assessment · done

Architecture review of the current Player, documenting the XML contract,
rendering pipeline, layout and playlist system, media handling, scheduling,
Airport Display integration, socket/HTTP communication and the offline cache.
See [ARCHITECTURE-REVIEW.md](ARCHITECTURE-REVIEW.md).

Deliverable: findings F1–F8 and the decision to migrate rather than rewrite.

## Phase 1 — Modern build system · done

Vite 5 + TypeScript 5.6 (strict) + Tailwind 3.4 + Vitest 2 in `app/`, building
to `src/app-dist` with `base: './'` so the bundle loads over `file://` in
Electron and from the Capacitor web root.

Additive by construction: no file under `src/assets/js` was modified, so the
legacy renderer is byte-identical and this phase cannot regress a device.

- `app/vite.config.ts`, `app/tsconfig*.json`, `app/tailwind.config.ts`
- `.gitignore` gained `!app/**/*.ts`; the pre-existing `*.ts` rule (for MPEG-TS
  segments) would otherwise have silently excluded every TypeScript source file

Bundle: 222 kB (70 kB gzipped) against roughly 1 MB for jQuery + video.js +
flv.js + DataTables today.

## Phase 2 — Vue rendering layer · done

A declarative renderer replacing the HTML-string builders.

- `LayoutRenderer.vue` scales the whole design surface with one CSS transform
  (`LayoutMath.fitScale` + `centerOffset`) instead of per-slot percentage
  arithmetic. This also fixes the legacy axis bug where the vertical offset was
  divided by the layout width.
- `SlotFrame.vue` positions slots in design pixels and gates them on their
  schedule window.
- `ContentHost.vue` is the single place a content type maps to a component.
- `components/renderers/*` replace the `slot-*.js` files. Third-party
  dependencies removed along the way: jQuery.Marquee (now CSS keyframes in
  `style.css`), pagination.js (now `TableContent.columnWidths` plus a computed
  page slice), DataTables.

Business logic stays out of components: `TickerContent` converts the server's
1–5 speed into an animation duration and the component only binds it.

## Phase 3 — Application layer and state management · done

The five layers the review called for, with dependencies pointing one way only.

| Layer | Location | Notes |
| --- | --- | --- |
| Renderer | `app/src/components` | Rendering only |
| State | `app/src/stores` | Pinia; written by the runtime, read by components |
| Service | `app/src/core/services` | Sync, playback, scheduling, airport display, device reporting |
| Storage | `app/src/core/storage` | Drivers, layout cache, asset cache, settings |
| Communication | `app/src/core/comm` | HTTP, transport negotiation, connectivity, realtime |

`PlayerRuntime` is the composition root and the only module that wires services
to stores, which answers F4: there is exactly one file to read to find out who
mutates state. Services never import stores, so they are testable without Pinia.

Specific fixes to review findings:

- One wall-clock-aligned `SchedulerService` ticker drives every clock slot and
  all schedule evaluation, replacing one timer per slot (F7).
- `RealtimeClient` tracks its handlers so re-attaching cannot leave a duplicate
  listener, removing the double-application bug (F4).
- `ConnectivityMonitor` is three-state (`online` / `degraded` / `offline`) so a
  transient failure no longer escalates to a navigation to `offline.html` (F5).
- Content models are classes in `shallowRef`, so replacing a layout wholesale
  does not deep-proxy every table row.

## Phase 4 — JSON layout schema · done (player) · ready (server)

A versioned wire contract, defined once in
[LAYOUT-JSON-SCHEMA.md](LAYOUT-JSON-SCHEMA.md) and enforced by Zod in
`app/src/core/schema`.

- `LayoutTransport` prefers `ds.json` and falls back to `ds.xml`. Only a
  definitive 404/405/501 marks a server XML-only; a timeout or 5xx does not, so
  a transient fault cannot permanently downgrade a modern server. The
  negotiated transport is memoised, so the JSON endpoint is probed once rather
  than on every poll.
- `XmlLayoutAdapter` converts legacy XML into the same schema, so the two
  transports are indistinguishable above the boundary (F1). `XmlNode` is a
  total cursor over the parse tree, replacing the positional index chains.
- Unknown content types are not errors: the adapter passes the type through,
  `contentSlotSchema` accepts any type string, and the registry degrades to
  `UnsupportedContent`. A server can ship a new type before the fleet updates
  (F3).
- Server side: a pure-Python transform over `buildXML()` output, so JSON cannot
  drift from XML, exposed as `ds.json` with ETag / `If-None-Match` support and
  an asset manifest carrying per-file version tokens (F6).

Phase 8 of the original request (sync and caching) lands here too:
`LayoutRepository` stores revisioned envelopes and evicts unparseable entries;
`AssetCache` skips assets whose version token is unchanged; `SyncService`
coalesces concurrent syncs, backs off with full jitter, and never clears the
cache on failure.

## Phase 5 — Rollout · planned

Ordered so that each step is individually reversible.

1. **Ship both renderers, legacy default.** `src/index.html` hands off to
   `app-dist/index.html` only when `config.renderer === 'vue'`, with
   `localStorage['cless:renderer']` for per-device trials and
   `?renderer=legacy` as an unconditional escape hatch.
2. **Pilot.** Enable on a small number of displays covering each content type
   in production use — in particular table slots with live SQL data, playlists
   with transitions, and at least one Airport Display zone.
3. **Deploy the server JSON endpoint.** Pilot players negotiate to JSON;
   everything else keeps receiving XML from the same `buildXML()` source.
4. **Fleet enable.** Flip the default in `config.json` at deployment scope,
   keeping the legacy renderer in the artifact for rollback.
5. **Retire the legacy renderer.** Delete `src/assets/js/slot-*.js`,
   `layoutxml.js`, `looplayout.js` and the jQuery/video.js/DataTables bundle
   once no deployment reports `renderer: legacy`.

## Phase 6 — XML compatibility layer removal · planned

Deferred deliberately: XML support is retained while customers depend on it.

Exit criteria, all of which must hold:

- No deployment is served by a CLESS-Server without the JSON endpoint.
- No player in the field reports `transport: xml` in its status heartbeat
  (`DeviceService.buildReport`).
- No cached document with `origin: 'xml-adapter'` remains, i.e. every device has
  completed at least one JSON sync.

Removal is then confined to deleting `app/src/core/adapters/`, the `parseXml`
host capability, the `transport: 'xml'` configuration branch and the
`xml-js` dependency. Nothing else imports XML, by design.

---

## Compatibility matrix

| Player | Server | Result |
| --- | --- | --- |
| Legacy | Legacy | Unchanged; no code path modified |
| Legacy | JSON-capable | Unchanged; `ds.xml` still served from `buildXML()` |
| Vue | Legacy | JSON probe returns 404, transport negotiates to XML, adapter converts |
| Vue | JSON-capable | JSON with conditional requests and asset versioning |
| Vue, offline, upgraded in place | — | `adoptLegacyCache()` reads the old renderer's `localStorage` and resumes the layout recorded in `currentPlayLayoutID` |

## Preserved behaviour

Verified by the unit suite in `app/tests` (172 tests) against fixtures modelled
on real `buildXML()` output:

- Offline playback, including boot with no network at all
- Restart resume, including resume from the legacy cache
- Playlist rotation, per-member duration, transition styles and the
  single-layout suppression
- Table slots: `image:` / `fader:` / `transition:` cell encodings, relative
  column widths, pagination, live dataset refresh preserving the page cursor
- Media resolution: `{protocol:url}` braces, YouTube embeds, HLS, FLV,
  library-relative paths
- Clock slots and the legacy date/time token vocabulary
- Slot schedule windows, including windows that wrap midnight
- Airport Display overrides, announcement language ordering, event-id
  de-duplication and status acknowledgement
- Device registration identity and status reporting
- Socket-driven refresh, restart and layout-update events
