# Phase 5 validation report

Phase 5 is the production-validation gate in
[MODERNIZATION-PLAN.md](MODERNIZATION-PLAN.md). The migration is not complete
until the Vue renderer has been exercised against a real server with real data.
This document records what was validated, how, and what it found.

## Environment

| Piece | Detail |
| --- | --- |
| Server | CLESS-Server `runserver` on `127.0.0.1:8099`, `ENVIRONMENT=development` |
| Database | Fresh SQLite migrated from empty, then seeded |
| Seed | `python manage.py seed_validation_data --reset` |
| Fixture | Display 1, layouts 1–2, playlist "Validation Loop", Airport Display zone, table slot with six spooled SQL rows covering plain / `image:` / `image:fade:` / `fader:` / `transition:` cell encodings |

Live external-DB SQL (`sqlQueryBuffer == 0`) could not be exercised in this
environment (no MySQL/MariaDB/Docker). The spool path is itself a real
production configuration and is what the seed uses.

## Automations

| Harness | Proves |
| --- | --- |
| `app/tests/live-parity.spec.ts` | Player `XmlLayoutAdapter` and server `layout_schema.py` produce the same document from the same live fixtures (server-clock fields normalised). 13 tests. |
| `app/tests/airport-parity.spec.ts` | Airport Display announcement and media selection match verbatim copies of the legacy functions, against the payload shapes the server actually emits. 23 tests. |
| `app/tests/override-host.spec.ts` | Vue `ContentHost` substitutes text and media overrides and restores layout content when they clear. 6 tests. |
| `app/tools/validate-live.mjs` (`npm run validate:live`) | Live server: JSON negotiation, XML fallback parity, ETag 304s, cache stability across 20 polls, outage survival, degraded→offline escalation, reconnect recovery. |

Re-capture the live fixtures after seed or converter changes:

```bash
# on the server
python manage.py seed_validation_data --reset
python manage.py runserver 127.0.0.1:8099

# on the player
./app/tests/fixtures/live/refresh.sh
npm --prefix app run validate:live
```

## Results

### XML ↔ JSON converter parity

Exact equality on the playlist and both member layouts once `origin`,
`generatedAt`, `etag`, `revision`, `version` and table `update` are normalised.
Writing this is what surfaced two live-data schema bugs:

1. Slot ids collided — a `table` and a `text` both claiming id `"1"` overwrote
   each other in every id-keyed lookup, including the dataset-to-slot join.
   Fixed by qualifying ids as `table-1` / `text-1` in both converters.
2. Table slot names were empty — `<table>` carries its name in `title`, every
   other slot in `name`. Airport Display overrides address slots by name, so
   unnamed tables were unreachable. Fixed by reading both attributes.

### Live SQL / table slots

Six spooled rows bind to `table-1` / `Departures`. Cell encodings survive
verbatim for `TableCellCodec` (shared by both renderers). Column flags for
text transition (Status) and image (Airline) are present.

### Playlists and transitions

Playlist mode, entries `[1, 2]` with durations `[45, 30]`, fade transition at
1200 ms / 0 ms delay — identical across XML and JSON.

### Airport Display

Against the server's real `NormalizedAirportDisplayEvent.to_dict` payload:

- Single-language announcements (inline track, no `languages` array) now play;
  the previous `languages`-only reader left every one-language zone silent.
- Language field is `language`, not `code`.
- Media items are objects with order / duration / selection; stringifying them
  produced `"[object Object]"`. `AirportEventCodec` selects by `media_mode`.
- Vue `ContentHost` now substitutes `MediaContent` for media overrides (it
  previously returned early, so a media zone trigger drew nothing).
- Legacy `normalizeAnnouncementLanguages` delegates to the shared codec via
  `ClessCore`.

### Offline / reconnect / long-duration stability

`validate-live.mjs` against a real stop/restart of the Django process:

```
28/28 checks passed
```

Including: JSON negotiation, XML transport agreement on mode / layout ids /
playlist entries, twenty consecutive `unchanged` polls with a stable cache
size, cache byte-identical through the outage, connectivity `degraded` then
`offline`, first poll after reconnect recovers.

### ETag finding

Before the matching server fix, four consecutive requests for an unchanged
playlist returned four different ETags — the revision of any layout with a
table slot is stamped with `datetime.now()`, so conditional requests never
saved work. The validator is now a content digest that excludes server-clock
fields; table rows remain part of it, so live SQL still invalidates the cache
the moment it moves.

## What this does *not* cover

- Pixel-level comparison of the two renderers on a physical display.
- Live external-DB SQL (`sqlQueryBuffer == 0`) — no MySQL/MariaDB available.
- Multilingual TTS audio playback end-to-end (codec and queue parity are
  covered; actual audio device playback is not).
- Fleet-scale soak beyond the 20-poll / single-outage harness.

Those remain pilot-deployment work under Phase 5 steps 2–4 of the plan.
