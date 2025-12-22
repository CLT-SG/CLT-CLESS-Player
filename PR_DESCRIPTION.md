## Fix: Mobile Table Slot Data Duplication and Pagination Issues

Addresses critical issues where table slot data accumulated instead of refreshing, and pagination counters kept increasing on mobile. This fix ensures proper cleanup and state management when table data is updated or layouts are switched.

## Issues Fixed

1. Table rows were duplicating and accumulating on each refresh instead of being replaced
2. Pagination page numbers kept increasing beyond total pages after multiple refreshes
3. Multiple page flip intervals were running simultaneously causing erratic pagination behavior
4. Table state was not properly reset when switching between loop layouts
5. Old pagination plugin instances remained in memory causing conflicts with new instances

## Technical Changes

1. Add cleanupTableState() function to properly destroy all table-related state before recreation
2. Clear pageAutoInterval, colImageTimeout, and colFaderTimeout intervals before creating new ones
3. Reset pagerow, pageincrease, checkpage, and pageLengthTime arrays when table is recreated
4. Destroy old jQuery pagination plugin instances before initializing new ones
5. Remove tbody and colgroup DOM elements before appending new ones to prevent accumulation
6. Enhance layoutxml.js to call cleanupTableState when table content is updated
7. Enhance looplayout.js to reset all table state arrays when switching layouts
8. Add comprehensive console logging for debugging table lifecycle

## Files Changed Summary

**Mobile App:**
- mobile/www/assets/js/slot-table.js - Add cleanupTableState function, cleanup intervals and state before recreation
- mobile/www/assets/js/layoutxml.js - Call cleanupTableState when table updates
- mobile/www/assets/js/looplayout.js - Reset table state arrays when switching layouts

## Testing

- Verified table rows refresh correctly without duplication across multiple updates
- Confirmed pagination counters reset properly and do not exceed total pages
- Tested page auto-flip works smoothly with only one interval running
- Ensured layout loop transitions properly reset table state
- Verified console logs show proper cleanup sequence during table recreation

