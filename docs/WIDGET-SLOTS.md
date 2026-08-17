# Widget Slots

Widgets are configured on the CLESS server and published at their own URL
(`/demo/widget/<id>/preview`). The player does not know what a weather widget or a
KPI card is: it hosts the published page in a `<webview>`, rotates the widgets of a
slot, honours the slot schedule, keeps a copy of the data for offline use and reports
metrics back to the server. A new widget type therefore needs a server change only.

## Layout XML

Widget slots arrive as `<widget>` elements inside `<Configuration><display><slots>`,
next to `media`, `text`, `html` and `table` slots, so `layoutxml.js` handles them in the
same loop:

```xml
<widget id="7" name="Corner" top="0" left="0" width="480" height="320" layer="2"
        rotation="0" enabled="Y" transparent="Y" bgcolor="#000000" interactive="N"
        scheduled="Y" active="Y" days="0,1,2,3,4" starttime="09:00" endtime="17:00">
  <item id="12" widget="3" name="Lobby Weather" renderer="weather" duration="60"
        enabled="Y" refresh="600" transport="polling" cache="900" offline="Y"
        data="http://server:8000/demo/widget/3/data"
        stream="http://server:8000/demo/widget/3/stream"
        url="http://server:8000/demo/widget/3/preview"/>
</widget>
```

`src/assets/js/slot-widget.js` implements `widgetFunc(slot, slotid)`.

## Behaviour

| Concern | Implementation |
| --- | --- |
| Rendering | one `<webview partition="persist:widgets">` per slot; the src is swapped on rotation |
| Rotation | `setTimeout` per item using its `duration`; a single-item slot never swaps |
| Scheduling | `active` from the server is a hint only — the player re-evaluates `days` / `starttime` / `endtime` every 20 s, so a screen that was offline at the change-over still switches on time. Windows crossing midnight (`22:00 → 06:00`) are supported |
| Data refresh | the published page refreshes itself (polling, SSE, WebSocket or MQTT, as configured on the widget). The player additionally mirrors `data` into `localStorage` for the offline panel and to measure data source latency |
| Offline | if the widget page cannot be loaded, the player shows the widget name plus the last cached payload and retries with an exponential backoff (5 s → 2 min) |
| Analytics | `view`, `render` (with render time), `refresh_ok` / `refresh_fail` (with latency) and `error` events are batched and POSTed to `/widget/event/` every 30 s, together with player uptime, memory and CPU every 60 s. The queue survives a restart, so an offline screen reports once it is back |
| Rotation angle | the slot `rotation` attribute is applied as a CSS transform on the container |

## Keeping the display alive

* A widget page that crashes is reloaded rather than left blank (`crashed` and
  `did-fail-load` both fall back and retry).
* A layout change stops every widget slot (`widgetStopAll()`) before the DOM is
  rebuilt, so no timer of a removed slot keeps firing.
* `errorCode -3` (aborted) is ignored, because that is what a rotation swap produces.

## Tests

```bash
npm test
```

`test/slot-widget.test.js` covers item parsing, schedules (weekday sets, daily windows,
overnight windows, date ranges) and the offline fallback formatting.
