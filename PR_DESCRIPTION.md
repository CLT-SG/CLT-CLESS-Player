## Fix: Mobile Touch Zoom Prevention and Viewport Scale Management

Addresses critical UX issues where touch interactions in the player area triggered unwanted zoom behavior and viewport scale resets on mobile devices. This fix implements comprehensive touch event handling, layout locking, and manual viewport restoration capabilities.

## Issues Fixed

1. Touch gestures in player area triggered pinch-zoom and double-tap zoom
2. Viewport maximum-scale was being reset to 1.0 after touch events
3. Mobile navigation buttons (mobile-nav) were removed during layout rendering
4. Resize events triggered by touch interactions caused viewport recalculation
5. No manual recovery mechanism when viewport scale gets accidentally reset

## Technical Changes

1. Add CSS touch-action: manipulation to prevent zoom while allowing other touches
2. Implement pointer-events: none on main container with auto on children
3. Add layout locking mechanism (isLayoutLocked flag) to prevent resize handling after initial layout
4. Remove resize event listener from constructor, only orientationchange listener remains
5. Preserve mobile-nav, loading-overlay, and no-network elements during DOM cleanup
6. Add restoreViewportScale() method for manual viewport restoration
7. Implement viewport monitoring system to detect external modifications
8. Add showNotification() helper for user feedback
9. Track lastAppliedScale to prevent redundant viewport updates
10. Add "Fix Zoom" button to mobile navigation for manual recovery

## Files Changed Summary

**Mobile App:**
- mobile/www/index.html - Add Fix Zoom button, CSS touch controls, pointer-events configuration
- mobile/www/assets/js/layoutxml.js - Preserve mobile-nav and loading-overlay during DOM cleanup
- mobile/www/assets/js/mobile/mobile-layout-handler.js - Add layout locking, viewport monitoring, and manual restore functionality

## Testing

- Verified touch interactions in player area do not trigger zoom
- Confirmed viewport scale persists after touch events
- Tested mobile-nav buttons remain visible and accessible after layout loads
- Ensured Fix Zoom button successfully restores viewport scale when reset
- Verified orientation changes still properly recalculate viewport
- Confirmed viewport monitoring detects and alerts on external modifications

