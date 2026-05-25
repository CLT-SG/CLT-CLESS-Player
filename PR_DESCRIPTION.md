# Pull Request Description

## Summary
Implemented server-side live preview with full feature parity. The Electron player can now load layouts via a Django-rendered endpoint instead of client-side XML parsing, enabling browser-based preview and simplified debugging.

## Problem
The Electron player rendered layouts entirely client-side from XML files, requiring complex JavaScript implementations for media playback, table pagination, layout transitions, and cross-player synchronization. This approach had several limitations:
- Browser-based preview was not possible without the full Electron app
- Debugging layout rendering issues required running the complete Electron environment
- Feature updates needed to be implemented twice (server templates and client JS)
- No way for non-technical users to preview layouts without installing the player

## Solution
Added a server-side live preview system with full feature parity across six implementation phases:

Phase 1 - Scaffolding:
- Django endpoint /live/ds/<id> with server-rendered template
- Class-based slot engine (SlotBase, SlotRegistry, LayoutEngine)
- Socket.IO sync client for cross-player synchronization

Phase 2 - Media Parity:
- VideoJS integration for MP4, WebM, HLS streaming, FLV playback
- YouTube embed support with autoplay
- Error handling with auto-skip on decode/network errors
- AV1 codec detection and last-frame freeze on transition

Phase 3 - Table Parity:
- Pagination modes (page flip, line scroll)
- Table transitions (fade, slide-left/right, scroll-up/down)
- Per-column styling, row coloring, cell content parsing

Phase 4 - Layout Transitions:
- Fade, slide, scroll transitions between loop layouts
- CSS keyframe injection with configurable speed/delay

Phase 5 - Sync Hardening:
- Drift correction with 500ms threshold
- Reconnect resync via ds:request-state/ds:current-state events
- Staleness detection with 10s warning threshold
- cpanel emitters for ds:loop-advance events

Phase 6 - Text Substitutions:
- Counter substitution from /counter.xml
- Date/time formatting with pattern support

Electron Integration:
- New live-preview.html page loading server endpoint via webview
- IPC-based window resize to match layout dimensions
- Config flag livePreview.enabled to toggle between modes

## Files Changed

cless458:
- core/views/live_preview.py (new)
- core/urls.py
- core/templates/live/ds.html (new)
- media/js/live-preview-0.1/js/slot-base-livepreview.js (new)
- media/js/live-preview-0.1/js/layout-engine-livepreview.js (new)
- media/js/live-preview-0.1/js/sync-client-livepreview.js (new)
- media/js/live-preview-0.1/js/slot-media-livepreview.js (new)
- media/js/live-preview-0.1/js/slot-table-livepreview.js (new)
- media/js/live-preview-0.1/js/slot-text-livepreview.js (new)
- media/js/live-preview-0.1/js/slot-html-livepreview.js (new)
- media/js/live-preview-0.1/js/slot-datetime-livepreview.js (new)
- media/js/live-preview-0.1/js/slot-tickerscrollerfader-livepreview.js (new)
- media/js/live-preview-0.1/js/socketio-cpanel.js (modified)
- media/js/live-preview-0.1/README.md (new)
- media/js/live-preview-0.1/PROGRESS.md (new)

ecless-player-electron:
- src/live-preview.html (new)
- index.js
- config-example.json
- CHANGELOG.md

## Testing
- Verified syntax with node --check on all JavaScript files
- Tested live preview endpoint loads in browser at /live/ds/<id>
- Confirmed Electron loads live-preview.html when livePreview.enabled is true
- Verified window resizes to match layout dimensions
- Tested layout loop transitions and sync events
- Confirmed media playback (video, HLS, YouTube)
- Tested table pagination and transitions
- Verified counter and date/time substitutions
