# Pull Request Description

## Summary
Enhanced the Offline Layout Manager with a friendly multi-item card editor that allows operators to edit, reorder, and manage content for multi-content slots (media, image, video, audio, text, ticker, scroller, fader, html) without touching JSON.

## Problem
Editing multi-content slots in the Offline Layout Manager required manual JSON editing, making it inaccessible to non-developer operators. There was no way to:
- Reorder items to change playback/layer sequence
- Set per-item duration
- Select media files from the local res cache
- Add or remove items with proper structure preservation

## Solution
Replaced the raw text editor with a per-item card editor for all multi-content slot types. Each item is displayed as a card with:
- Drag handle for native HTML5 drag-and-drop reordering
- Content field (text input for media slots, textarea for text slots) with datalist suggestions from local res cache
- Duration field (in seconds) that maps directly to the item's XML duration attribute
- Remove button to delete items
- +Add Item button to create new items with sensible defaults

The editor preserves all existing item attributes and slot attributes on save, only modifying duration and the first inner text node. The Advanced (JSON) tab remains available as an escape hatch.

## Files Changed
- src/assets/js/offline-layout-manager.js
- src/assets/css/offline-layout-manager.css
- mobile/www/assets/js/offline-layout-manager.js
- mobile/www/assets/css/offline-layout-manager.css
- CHANGELOG.md

## Testing
- Verified syntax with node --check on both JS files
- Tested CTRL+2 shortcut opens the manager in Electron
- Confirmed media file picker lists files from ~/clessapp/res on Electron
- Confirmed drag-and-drop reordering works
- Confirmed add/remove items and duration editing
- Confirmed changes persist to both layout-offline-XX and layout-XX localStorage keys
