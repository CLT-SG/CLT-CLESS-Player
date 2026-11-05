# Phase 6 — XML compatibility retirement plan

XML support stays until every exit criterion below is met. This document is the
retirement plan; it is not permission to remove anything.

## What must not be removed yet

- XML transport (`LayoutTransport` XML branch, `parseXml` host capability)
- XML parser dependency (`xml-js` in Electron, DOMParser elsewhere)
- `XmlLayoutAdapter` and `XmlNode`
- Server `ds.xml` / `layout/*/ds.xml` / `layoutloop/*/loop.xml` routes
- The legacy renderer (`src/assets/js/slot-*.js`, `layoutxml.js`, `looplayout.js`)

Rollback must remain a configuration change (`"renderer": "legacy"`,
`localStorage['cless:renderer'] = 'legacy'`, or `?renderer=legacy`), not a
new release. Vue is the player default; those switches are the only way back
onto the legacy renderer.

## Current XML usage (inventory)

| Surface | Who still needs it |
| --- | --- |
| `GET /<ds>/ds.xml` | Every legacy renderer; every Vue player whose server has no JSON endpoint; Vue players forced to `transport: 'xml'` |
| `GET /layout/<id>/ds.xml` | Playlist member fetches (legacy and Vue-on-XML); layout preview |
| `GET /layoutloop/<id>/loop.xml` | Playlist preview |
| Offline XML cache in `localStorage` | Devices that last synced under the legacy renderer and have not completed a JSON sync since |
| Airport Display over the control socket | Independent of layout transport — not an XML dependency |

Measure live usage from the server:

```
GET /demo/player-transport.json
GET /demo/player-transport.json?staleDays=14
```

The report lists every display's last transport (`xml` / `json` / `unknown`),
last renderer (`legacy` / `vue` / `unknown`), last check-in, and a single
`xmlRetirementReady` boolean. Stale and unknown displays count against
readiness: silence from a display nobody has heard from is not evidence that
XML is unused.

Players report identity on every layout poll:

| Header | Set by |
| --- | --- |
| `X-CLESS-Player-Renderer: vue` | Vue `LayoutTransport` (JSON and XML branches) |
| `X-CLESS-Player-Renderer: legacy` | Legacy `looplayout.js` / `layoutxml.js` ajax |
| `X-CLESS-Player-Version` | Both, when known |
| Transport | Inferred from the URL (`ds.json` vs `ds.xml`); `dsjson` marks the request so the shared heartbeat records `json` |

## Migration readiness checklist

Before any removal is scheduled:

- [ ] JSON Layout Definition API deployed on every CLESS-Server that serves players
- [ ] Offline playback verified under JSON (cache restore, asset versions)
- [ ] Airport Display verified under the Vue renderer (slot overrides, multilingual TTS order)
- [ ] Playlist transitions verified under the Vue renderer
- [ ] Scheduling / default-layout fallback verified under the Vue renderer
- [ ] `player-transport.json` shows `xmlRetirementReady: true` for the agreed stale window
- [ ] No open incident attributed to the Vue renderer or the JSON transport

## Exit criteria

All of the following must hold simultaneously:

1. **No XML-dependent deployments remaining.**
   `player-transport.json` reports `totals.transport.xml == 0` and
   `totals.transport.unknown == 0`, with `stale == 0` for the agreed window
   (default 7 days; operators may widen it).
2. **No legacy renderer remaining.**
   `totals.renderer.legacy == 0` and `totals.renderer.unknown == 0`.
3. **Every server in the estate speaks JSON.**
   No player in the field is negotiating down to XML because the endpoint is
   missing.
4. **Every device has completed at least one JSON sync.**
   No cached document with `origin: 'xml-adapter'` remains as the sole offline
   source on an active display.

Only then: delete the XML transport branch, the adapter, the `parseXml` host
capability, the `xml-js` dependency, and — separately, under its own change —
the legacy renderer artifact. The server XML routes stay one release longer
than the player XML client, so a late-recovering device still has something to
talk to while it is upgraded.

## What "ready" is not

- A quiet week on the JSON endpoint while legacy players are powered off.
- A lab fleet with no stale displays.
- A single pilot that has been on Vue/JSON for months.

The report exists specifically so those cannot be mistaken for readiness.
