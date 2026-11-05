# Layout Definition Schema v1

The wire contract between CLESS-Server and CLESS-Player. It replaces
positional, stringly typed XML with a validated structure, and it is the shape
both transports converge on: the server's `ds.json` endpoint emits it directly,
and the player's XML compatibility adapter produces it from legacy `ds.xml`.

Authoritative definition: `app/src/core/schema/layout.ts` (Zod). This document
describes it; the schema enforces it.

## Versioning

`schemaVersion` is `"<major>.<minor>"`.

- **Minor** increments are additive: new optional fields, new content types, new
  enum members in fields the player already tolerates. A player accepts any
  minor at or above its own — `"1.7"` is valid for a player built against
  `"1.0"`, and the unknown fields are ignored.
- **Major** increments are breaking. A player rejects a major it does not list
  in `SUPPORTED_SCHEMA_MAJORS` and keeps serving its cache rather than
  rendering something it does not understand.

Rejection is a validation outcome, never an exception: `validateLayoutDocument`
returns `{ ok: false, errors }` and the caller keeps the last good document.

## Document

```json
{
  "schemaVersion": "1.0",
  "origin": "json-api",
  "generatedAt": "2026-09-27T09:15:00Z",
  "etag": "20260927091500",
  "display": {
    "id": "206",
    "name": "Terminal 2 Departures",
    "scheduleId": "14",
    "syncMasterIp": null
  },
  "mode": "layout",
  "layout": { "…": "see Layout" },
  "playlist": null,
  "layouts": []
}
```

| Field | Type | Notes |
| --- | --- | --- |
| `schemaVersion` | string | Required. See [Versioning](#versioning). |
| `origin` | `json-api` \| `xml-adapter` \| `cache` \| `local` | Set by the producer. Drives compatibility diagnostics; a server always sends `json-api`. |
| `generatedAt` | string | ISO 8601. |
| `etag` | string | Whole-document validator, mirrors the HTTP `ETag`. |
| `display` | object \| null | The target display. |
| `mode` | `layout` \| `playlist` | Required. |
| `layout` | Layout \| null | Required when `mode` is `layout`. |
| `playlist` | Playlist \| null | Required when `mode` is `playlist`. |
| `layouts` | Layout[] | Inlined playlist members. Saves one request per member at boot. |

The mode/payload agreement is enforced, so a document cannot claim `playlist`
and carry nothing playable.

## Layout

```json
{
  "id": "42",
  "name": "Terminal Main",
  "revision": "20260927091500",
  "refreshInterval": 60,
  "resolution": { "width": 1920, "height": 1080, "orientation": "landscape" },
  "autoscale": true,
  "background": { "color": "#101820", "image": "bg.jpg", "stretch": true },
  "mediaBaseUrl": "https://cless.example.com/media/206/",
  "slots": [],
  "datasets": [],
  "assets": []
}
```

`revision` is the cache key for the whole layout and the value compared to
decide whether a re-download is needed. `refreshInterval` is in seconds and
drives the poll cadence for this layout specifically.

`mediaBaseUrl` replaces the legacy `mediapath` attribute. Asset paths are
resolved against it unless they are absolute URLs or streams.

## Content slot

Every content type shares one envelope, so the renderer dispatches generically.

```json
{
  "type": "media",
  "id": "s7",
  "name": "Hero",
  "enabled": true,
  "transparent": false,
  "backgroundColor": null,
  "geometry": { "top": 0, "left": 0, "width": 1920, "height": 620, "layer": 0 },
  "schedule": null,
  "items": [
    { "id": "s7-0", "duration": 12, "enabled": true, "order": 0, "text": "promo.mp4", "data": {} }
  ],
  "config": { "fit": "cover", "muted": true }
}
```

| Field | Notes |
| --- | --- |
| `type` | Any non-empty string. Matched against the content plugin registry; an unrecognised value renders a placeholder rather than failing. |
| `geometry` | Design pixels, relative to `resolution`. `layer` is the stacking order. |
| `schedule` | `null` means always. See [Schedule window](#schedule-window). |
| `items` | Playable units in a rotation: one image, one text page, one widget. |
| `config` | Type-specific, validated by the owning plugin. |

`duration` is in seconds; `0` means "play to natural end" for video and "never
rotate" otherwise.

Accepting any `type` string is deliberate and is what decouples the two
rollouts: the server may introduce a content type before the fleet updates, and
older players degrade to an empty placeholder instead of crashing.

### Schedule window

```json
{
  "startDate": "2026-10-01",
  "endDate": "2026-10-31",
  "startTime": "22:00",
  "endTime": "06:00",
  "days": [1, 2, 3, 4, 5]
}
```

`days` uses ISO weekdays, 1 = Monday, and an empty array means every day. A
window whose `endTime` is earlier than its `startTime` wraps midnight, which
the legacy XML also allowed and which `BaseContent.isScheduledAt` handles
explicitly.

### Config by content type

Unlisted keys are preserved, so a plugin can read fields this table does not
mention.

| `type` | Config keys |
| --- | --- |
| `media` | `fit` (`cover` \| `contain` \| `fill`), `muted`, `videoSync` |
| `text` | `font`, `fontSize`, `fontColor`, `fontStyle`, `align`, `valign` |
| `ticker`, `scroller` | typography, plus `speed` (1–5), `direction`, `antialias` |
| `fader` | typography, plus `speed` (1–5) |
| `date`, `time`, `datetime` | typography, plus `format` (legacy token vocabulary, e.g. `dd/mm/yyyy`, `HH:MM:ss`) |
| `html` | none; the source URL is the item text or `data.url` |
| `widget` | `interactive` |
| `table` | `columns[]`, `header`, `pageFlipSeconds`, `maxRows` |
| `airport-display` | none; driven by pushed events. Exclusive — one per layout |

`speed` is 1–5 as the server has always expressed it; the player converts it to
an animation duration.

## Dataset

Tabular payload is kept beside the slots rather than inside them, so rows can
refresh on the SQL interval without re-rendering the slot or resetting its page
cursor.

```json
{
  "slotId": "s3",
  "revision": "20260927091500",
  "columns": ["col01", "col02", "col03"],
  "rows": [
    { "col01": "SQ318", "col02": "London", "col03": "transition:On Time,Boarding" }
  ]
}
```

Cell values may carry the legacy structural encodings, which the player decodes:

| Prefix | Meaning | Parsing |
| --- | --- | --- |
| `image:` | One or more image paths, optionally preceded by size hints | Payload is everything after the **last** colon |
| `fader:` | Values cross-faded in place | Payload is everything after the **first** colon |
| `transition:` | Values rotated with a transition | Payload is everything after the **first** colon |

The asymmetry is load-bearing: `fader:New time 18:40,Delayed` must keep the
colon inside its value, while `image:fade:4:sq.png,sq-alt.png` must not treat
the size hints as a path.

## Asset

```json
{ "path": "promo.mp4", "version": "a91c4f", "sizeBytes": 18442240, "mimeType": "video/mp4" }
```

`version` is an opaque token that changes whenever the bytes change. It is what
allows the player to skip re-downloading unchanged media: `AssetCache` compares
tokens, not URLs or timestamps. `path` is relative to `mediaBaseUrl`, or an
absolute URL for streams.

## Playlist

```json
{
  "id": "5",
  "name": "Departures loop",
  "revision": "20260927091500",
  "transition": { "style": "fade", "speedMs": 1000, "delayMs": 0 },
  "entries": [
    { "layoutId": "42", "name": "Main", "duration": 20, "order": 0, "enabled": true, "source": null }
  ]
}
```

`style` is one of `none`, `fade`, `slide-left`, `slide-right`, `scroll-up`,
`scroll-down` — the same set the legacy renderer supported. A single-entry
playlist plays without a transition, matching existing behaviour (animating a
one-layout loop produced a visible flash).

`source` holds a member's URL when the server does not inline it in
`layouts[]`, in which case the player fetches it separately.

## HTTP behaviour

| Endpoint | Purpose |
| --- | --- |
| `GET /<ds_id>/ds.json` | Document for a display |
| `GET /layout/<id>/ds.json` | A single layout |
| `GET /layoutloop/<id>/loop.json` | A playlist |
| `GET /layout-schema.json` | Schema version and content types this server speaks |

- `ETag` is returned on every response; the player sends it back as
  `If-None-Match` and a `304` costs nothing but headers. This is what makes
  frequent polling affordable on constrained links.
- `v=<player version>` is appended to requests so the server can record a
  heartbeat, matching the existing XML behaviour.
- A `404`, `405` or `501` on `ds.json` means "this server is XML-only" and the
  player negotiates down to `ds.xml` permanently. Any other failure — timeout,
  `5xx`, malformed body — leaves JSON selected and is retried with exponential
  backoff, so a transient fault cannot downgrade a modern server.

## XML equivalence

Mapping applied by `XmlLayoutAdapter` when talking to a server that predates
the JSON endpoint.

| XML | JSON |
| --- | --- |
| `<Configuration>` root | `mode: "layout"` |
| `<Configure><loop>` root | `mode: "playlist"` |
| `@update` | `layout.refreshInterval` |
| `@serverRefresh`, `@sqlQueryRefresh` | poll cadence and `dataset.revision` checks |
| `@mediapath` | `layout.mediaBaseUrl` |
| `@id`, `@schedule_id`, `@sync_master_ip` | `display.*` |
| `<display @bgcolor @bgimage @bgscretch>` | `layout.background.*` |
| `<display @resolution>` (`1920x1080`, `1080_1920_portrait`) | `layout.resolution` |
| `<display @autoscale>` (`Y`/`N`) | `layout.autoscale` (boolean) |
| `<slots>` child element name | `slot.type` |
| `<wintv>` | `type: "media"` |
| `<bookingsystem>` | `type: "html"` |
| unrecognised slot element | `type` kept verbatim → placeholder |
| slot element index | `geometry.layer` |
| `<records><table id><row col01=…>` | `layout.datasets[]` |
| transparency `high` / `medium` / `low` | alpha `0` / `0.5` / `1` |

Slot stacking follows **document order**, not the `layer` attribute. The server
already sorts slots by layer before emitting them, several slot types emit
`layer="0"` while others omit the attribute entirely, and the legacy renderer
used the element index as the z-index. Honouring `layer` here would silently
restack existing layouts.
