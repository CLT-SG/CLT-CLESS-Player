Android Mobile App - Text Slot Rendering and Multi-Item Rotation Fix

This PR fixes text-based slot rendering in the mobile CMS player and adds multi-item rotation support for ticker, scroller, and fader slots.

## Summary of Key Issues Fixed

1. **Text Slots Not Rendering** - Static text slots failed to display content in mobile app
2. **Ticker Slots Not Appearing** - Ticker text animation slots showed no content
3. **Scroller Slots Not Working** - Vertical scrolling text slots remained blank
4. **Fader Slots Not Displaying** - Text fading animation slots showed no content
5. **Single Item Only Display** - Ticker, scroller, and fader slots only displayed first item instead of rotating through all items
6. **Instant Item Transitions** - No smooth transitions between items when rotating content

## Core Technical Improvements

1. **Enhanced Text Extraction Logic**
   - Fixed handling of XML data structure where text is directly on item.text property
   - Added fallback logic to check item.text when item.elements array is empty
   - Supports both nested elements[0].elements[0].text and direct item.text formats
   - Proper validation before accessing nested properties

2. **Multi-Item Rotation Support**
   - Refactored tickerFunc to process all items in elements array and rotate based on duration
   - Refactored scrollerFunc to support multiple scrolling text items with timed rotation
   - Refactored faderFunc to cycle through all fade items with individual durations
   - Added rotation state management with timeout arrays and index tracking

3. **Smooth Item Transitions**
   - Fader slots transition with fade-out then fade-in effect between items
   - Ticker slots use continuous scrolling motion without interruption
   - Scroller slots maintain seamless vertical scrolling between items
   - Proper cleanup of marquee animations before showing next item

4. **Comprehensive Debugging Support**
   - Added detailed console logging throughout text extraction process
   - Logs rotation state including current item index and total items
   - Tracks item durations and transition timing
   - Clear error messages for troubleshooting

## Files Changed Summary

**Mobile JavaScript Modified**
- mobile/www/assets/js/slot-tickerscrollerfader.js - Complete refactor with multi-item rotation and smooth transitions
- mobile/www/assets/js/slot-text.js - Enhanced text extraction with direct property fallback

## Compatibility

- Desktop Electron app unchanged
- Works on Android 5.0 to 14+
- No breaking changes
- No server-side changes required
- Backward compatible with existing layouts
- Supports both single-item and multi-item slot configurations

## Testing Checklist

- Text slots display content correctly
- Ticker slots render and rotate through multiple items
- Scroller slots display and rotate with continuous scrolling
- Fader slots rotate with smooth fade transitions
- Item durations respected during rotation
- Seamless looping back to first item after last item
- Console logs show rotation state and timing