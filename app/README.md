# CLESS-Player — modern renderer

Vue 3 + Vite + TypeScript + Tailwind renderer for the eCLESS Player.

This directory is additive. Nothing under `../src/assets/js` was modified, and
the legacy renderer remains the default. `../src/index.html` hands off to this
build only when a deployment opts in (see
[Enabling it](#enabling-it-on-a-device)).

## Commands

| Command | What it does |
| --- | --- |
| `npm install` | Install dependencies (run inside `app/`). |
| `npm run dev` | Vite dev server against a live CLESS-Server. |
| `npm run build` | Typecheck, then build into `../src/app-dist`. |
| `npm run typecheck` | `vue-tsc --noEmit`, no emit. |
| `npm test` | Vitest unit suite. |

The build writes to `../src/app-dist` with `base: './'` so the bundle loads
over `file://` in Electron and from the Capacitor web root without a server.

## Enabling it on a device

Precedence, highest first:

1. `?renderer=legacy` in the URL — always returns to the legacy renderer, so a
   device can be recovered without editing config.
2. `localStorage['cless:renderer'] = 'vue'` — per-device opt-in for field trials.
3. `"renderer": "vue"` in `config.json` — fleet or per-deployment opt-in.

Absent all three, the legacy renderer runs. `"transport"` selects the wire
format: `auto` (default, probe JSON then fall back to XML), `json`, or `xml`.

## Layers

Data flows in one direction: transport → schema → content models → stores →
components. Nothing flows back up.

```
core/comm        HTTP, transport negotiation, connectivity, realtime socket
core/schema      Zod wire contract + version gate (the only trusted boundary)
core/adapters    XML → schema compatibility layer (delete-able in one piece)
core/content     Content model classes (no DOM, no framework)
core/plugins     Content type registry: type -> model + component + validator
core/storage     Storage drivers, layout cache, asset cache, settings
core/services    Sync, playback, scheduling, airport display, device reporting
core/runtime     Composition root; the only place that wires services to stores
stores/          Pinia state; written by the runtime, read by components
components/      Rendering only
```

### Why the boundaries sit where they do

**Services never import stores.** `PlayerRuntime.wireStores()` subscribes to
service callbacks and writes the stores. A service can therefore be unit tested
without Pinia, and there is exactly one file to read to find out who mutates
state.

**Content models are plain classes held in `shallowRef`.** Layout data is
replaced wholesale on each sync, so per-property reactivity would cost a deep
proxy walk over every table row for no benefit. `renderGeneration` in
`useLayoutStore` is the invalidation signal.

**Business logic lives in the models and services, never in components.** A
renderer component reads getters and renders. For example `TickerContent`
converts the server's 1–5 speed into an animation duration; `TickerRenderer.vue`
only binds it to a CSS custom property.

**One inheritance level.** `BaseContent` owns the item cursor, lifecycle and
schedule-window evaluation because every content type needs all three. Each
concrete type extends it once. There are no deeper chains.

**Errors are values.** `HttpClient`, `LayoutTransport` and the schema validator
return discriminated unions rather than throwing, because the caller's decision
is always the same three-way branch: use it, keep the cache, or back off.

## Adding a content type

Implement `ContentPlugin` and register it. No renderer, service or store code
changes.

```ts
export const gaugePlugin: ContentPlugin<GaugeContent> = {
  type: 'gauge',
  displayName: 'Gauge',
  component: GaugeRenderer,
  configSchema: z.object({ min: z.number(), max: z.number() }),
  create: (slot, context) => new GaugeContent(slot, context),
}

registry.register(gaugePlugin)
```

Until a plugin exists, a slot of an unknown type is not an error: the adapter
passes the type through, `contentSlotSchema` accepts any type string, and the
registry degrades to `UnsupportedContent`, which renders nothing unless
diagnostics are on. A server can therefore ship a new content type before the
fleet updates.

## Offline behaviour

`PlayerRuntime.start()` loads the cache before it touches the network, so a
device with no connectivity renders immediately. The first sync is skipped
entirely when a cached document was restored. `adoptLegacyCache()` reads the
previous renderer's `localStorage` keys, so a device upgraded while offline
keeps playing without ever reaching the server.

Sync failures never clear the cache. Connectivity is three-state
(`online` / `degraded` / `offline`): transient failures move to `degraded` and
are absorbed silently, and only `offlineThreshold` consecutive failures show the
offline banner. Playback is never interrupted — the legacy behaviour of
navigating to `offline.html` is gone.

`LayoutRepository.setActiveLayoutId()` records the on-screen layout so
`PlaybackService.load(..., resumeLayoutId)` resumes where the device left off
after a restart, falling back to index 0 if that layout no longer exists.

## Diagnostics

| Shortcut | Action |
| --- | --- |
| `Ctrl+D` | Toggle the diagnostics overlay (transport, connectivity, revision, unsupported types, pending assets). |
| `Ctrl+R` | Force a sync now. |
| `Ctrl+ArrowRight` | Advance to the next layout. |

## Tests

`npm test` runs the suite in jsdom. The XML fixtures in `tests/fixtures/dsxml.ts`
are modelled on real `buildXML()` output from CLESS-Server, including an unknown
slot type and the three table cell encodings (`image:`, `fader:`,
`transition:`), so the compatibility layer is tested against the contract it
actually has to honour rather than an idealised one.
