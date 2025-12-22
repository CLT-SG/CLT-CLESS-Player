## Fix: VideoJS Source & Format Validation — Prevent Wrong Data Passed to Player

Addresses an issue where VideoJS could receive malformed or incorrect `src`/`type` values (including base64/data URIs or incorrectly inferred MIME types), causing playback failures, rejected promises, or silent errors. This change adds validation and sanitization before passing sources to VideoJS and unifies error handling across mobile and desktop players.

## Issues Fixed

1. VideoJS was sometimes given malformed or incorrect `src`/`type` causing play() to fail or reject
2. Incorrect inference of `contentType` for streaming vs. regular videos led to playback mismatches
3. Base64/data URIs and other unsupported values were occasionally passed to the player
4. Silent failures lacked diagnostic logs and consistent skip/recovery behavior

## Technical Changes

1. Validate `asset.originalUrl` and inferred `contentType` before calling `videojs.src()` or `player.play()`; skip invalid sources with logs and user notification
2. Sanitize and avoid passing base64/data URIs as normal video sources; use explicit detection for streaming protocols
3. Use `videojs.src({src, type})` only for recognized mime types and fall back to skip-on-error when unsupported
4. Add diagnostic console logs for src/type validation and play Promise rejections; handle rejected play promises by auto-skipping the slot
5. Applied the same validation and test updates to both mobile and desktop `slot-media.js` implementations for parity

## Files Changed Summary

**Mobile App:**
- mobile/www/assets/js/slot-media.js - Add src/type validation, defensive checks, improved logging, skip-on-error behavior

**Desktop App:**
- src/assets/js/slot-media.js - Synchronized validation fixes from mobile

**Documentation:**
- docs/STREAMING-IMPLEMENTATION-SUMMARY.md - Added guidance on content-type validation and play error handling

## Testing

- Verified malformed/unsupported src values are skipped and the next media item is played
- Confirmed play Promise rejection is handled gracefully with logs and auto-skip behavior
- Ensured parity across mobile and desktop implementations

