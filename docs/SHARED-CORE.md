# Shared core

The modernisation is not two renderers that happen to look alike. It is one
framework-independent core that both renderers consume, so a bug fixed once
stays fixed under both.

```
src/core/  ──►  Vue renderer   (app/)          ──►  Electron / Capacitor
           ──►  Legacy bridge  (cless-core.js) ──►  jQuery renderer
```

## Layout

| Path | Owns |
| --- | --- |
| `src/core/layouts/` | Versioned layout schema, Zod validation, `LayoutService` |
| `src/core/models/` | Content classes (`TableContent`, `MediaContent`, …) |
| `src/core/plugins/` | Content-type registry (framework-free; Vue components live in `app/`) |
| `src/core/player/` | `PlayerRuntime`, host wiring from a `PlatformServices` bundle |
| `src/core/platform/` | Storage / Network / File / Media / Notification / Device services, with Electron, Capacitor and Web implementations |
| `src/core/services/` | Sync, playback, status reporting |
| `src/core/storage/` | Layout repository, asset cache, settings |
| `src/core/transports/` | HTTP, connectivity, realtime, XML adapter |
| `src/core/schedules/` | Scheduler |
| `src/core/airport-display/` | Airport Display event codec and service |
| `src/core/utilities/` | Colour, date, media, layout math, table cell codec, emitter |
| `src/core/legacy-bridge.ts` | Curated `window.ClessCore` surface for the jQuery renderer |

Nothing under `src/core` imports Vue, Pinia or Electron. The Vue app binds the
runtime's typed events to Pinia stores in `app/src/bindRuntime.ts`, and maps
content types to Vue components in `app/src/renderers.ts`. That is the whole
framework seam.

## Platform abstraction

`createPlatformServices()` detects Electron / Capacitor / Web and returns a
`PlatformServices` bundle. `createHost()` turns that into a `PlayerHost` for
`PlayerRuntime`. Platform-specific code (Preferences vs localStorage, Filesystem
vs Node `fs`, native HLS capability) stops at the service boundary; the rest of
the core talks only to the interfaces.

## What the legacy renderer has adopted

The bridge is curated. Offering a function is not the same as adopting it.

| Adopted | Why it is safe |
| --- | --- |
| `hexToRgbA` | Output is byte-identical to the previous inline copy |
| `decodeCellEntries` | Same colon rules the Vue table renderer uses |
| `airportAnnouncementLanguages` | Same track selection and order as the previous inline copy |

| Offered but not adopted | Why |
| --- | --- |
| `LayoutMath` autoscale | The legacy inline formula swaps axes (`top/width`, `left/height`). Switching would move every slot on every production screen |
| Airport Display media selection | Legacy `resolveMediaSource` reads an item `type` the normalised form does not carry |

Parity of the adopted surfaces is pinned by `app/tests/shared-core-parity.spec.ts`
and `app/tests/airport-parity.spec.ts`, which compare the shared code against
verbatim copies of the legacy functions.

## Capacitor

`mobile/build-mobile.cjs` syncs only generated artifacts (`cless-core.js`,
`app-dist/`) into `mobile/www`. It does not overwrite the diverged mobile forks
of `layoutxml.js` / `slot-*.js`. The Capacitor bootstrap is injected before the
first `<script>` so `window.Capacitor.Plugins` is populated before the Vue app
boots. One Vue codebase therefore runs on Electron, Android and iOS.
