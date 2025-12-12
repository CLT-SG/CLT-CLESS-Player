// Global variables for ticker rotation
var tickerTimeout = new Array();
var tickerCurIndex = new Array();
var tickerloop = new Array();

//ticker function with multi-item rotation support
function tickerFunc(slotitem, index) {
    console.log('[tickerFunc] Starting for slot', index);
    console.log('[tickerFunc] Slotitem structure:', JSON.stringify(slotitem, null, 2));
    
    // Check if the slot element exists in the DOM
    if ($('#slot-' + index).length === 0) {
        console.warn('[tickerFunc] Slot element #slot-' + index + ' does not exist in DOM (probably disabled)');
        return;
    }
    
    // Defensive checks
    if (!slotitem || !slotitem['elements'] || !Array.isArray(slotitem['elements']) || slotitem['elements'].length === 0) {
        console.error('[tickerFunc] Invalid slotitem structure for slot', index);
        return;
    }
    
    // Initialize rotation variables
    tickerCurIndex[index] = 0;
    tickerloop[index] = [];
    
    //TICKER SPEED
    var txtSpeed;
    if (slotitem['attributes']['speed'] == '5') {
        txtSpeed = 25 * 10;
    } else if (slotitem['attributes']['speed'] == '4') {
        txtSpeed = 15 * 10;
    } else if (slotitem['attributes']['speed'] == '2') {
        txtSpeed = 7 * 10;
    } else if (slotitem['attributes']['speed'] == '1') {
        txtSpeed = 3 * 10;
    } else {
        txtSpeed = 100;
    }
    
    //TICKER DIRECTIONS
    var txtDirection;
    if (slotitem['attributes']['direction'] == 'righttoleft') {
        txtDirection = 'left';
    } else {
        txtDirection = 'right';
    }
    
    console.log('[tickerFunc] Processing', slotitem['elements'].length, 'items for slot', index);
    
    // Process all items in the ticker slot
    slotitem['elements'].forEach(function (item, itemIndex) {
        console.log('[tickerFunc] Processing item', itemIndex, ':', JSON.stringify(item));
        
        if (!item) {
            console.error('[tickerFunc] Invalid item at index', itemIndex);
            return;
        }
        
        var src = '';
        
        // Try to get text content - handle multiple possible structures
        if (item['elements']) {
            // Handle both array and object-based nested elements
            var firstElement = null;
            var hasNestedElements = false;
            
            if (Array.isArray(item['elements'])) {
                hasNestedElements = item['elements'].length > 0;
                firstElement = item['elements'][0];
            } else if (typeof item['elements'] === 'object') {
                hasNestedElements = item['elements']['0'] !== undefined;
                firstElement = item['elements']['0'];
            }
            
            if (hasNestedElements && firstElement && firstElement['text']) {
                src = firstElement['text'];
                console.log('[tickerFunc] Extracted nested text:', src);
            } else {
                // FALLBACK: Check if text exists directly on item
                if (item['text']) {
                    src = item['text'];
                    console.log('[tickerFunc] Found direct text property:', src);
                }
            }
        } else if (item['text']) {
            src = item['text'];
            console.log('[tickerFunc] Found direct text property (no elements):', src);
        }
        
        // Get duration from item attributes
        var duration = 10; // Default 10 seconds
        if (item['attributes'] && item['attributes']['duration']) {
            duration = parseInt(item['attributes']['duration']);
        }
        
        if (src && src !== '') {
            // Duplicate text for continuous scrolling based on length
            if (src.length <= 10) {
                src = src + ' ' + src + ' ' + src + ' ' + src + ' ' + src + ' ' + src + ' ' + src;
            } else if (src.length > 10 && src.length <= 25) {
                src = src + ' ' + src + ' ' + src + ' ' + src + ' ' + src + ' ' + src;
            } else if (src.length > 25 && src.length <= 40) {
                src = src + ' ' + src + ' ' + src + ' ' + src + ' ' + src + ' ' + src;
            } else if (src.length > 40 && src.length <= 60) {
                src = src + ' ' + src + ' ' + src + ' ' + src + ' ' + src;
            } else if (src.length > 60 && src.length <= 80) {
                src = src + ' ' + src + ' ' + src + ' ' + src;
            } else if (src.length > 80 && src.length <= 110) {
                src = src + ' ' + src + ' ' + src;
            } else if (src.length > 110 && src.length <= 130) {
                src = src + ' ' + src;
            }
            
            var contentObj = {
                text: src,
                duration: duration * 1000,
                speed: txtSpeed,
                direction: txtDirection
            };
            tickerloop[index].push(contentObj);
            console.log('[tickerFunc] Added item', itemIndex, 'to rotation:', src.substring(0, 50) + '...', 'duration:', duration, 's');
        } else {
            console.warn('[tickerFunc] No text content found for item', itemIndex);
        }
    });
    
    if (tickerloop[index].length === 0) {
        console.error('[tickerFunc] No valid items to display for slot', index);
        return;
    }
    
    console.log('[tickerFunc] Total items in rotation:', tickerloop[index].length);
    
    // Start displaying the first item
    displayTickerItem(index);
    
    // Function to change to next ticker item
    function changeTickerItem() {
        tickerCurIndex[index]++;
        if (tickerCurIndex[index] >= tickerloop[index].length) {
            tickerCurIndex[index] = 0; // Loop back to first item
        }
        displayTickerItem(index);
    }
    
    // Function to display current ticker item
    function displayTickerItem(slotIndex) {
        if (tickerTimeout[slotIndex]) {
            clearTimeout(tickerTimeout[slotIndex]);
        }
        
        var currentItem = tickerloop[slotIndex][tickerCurIndex[slotIndex]];
        console.log('[tickerFunc] Displaying item', tickerCurIndex[slotIndex], 'for slot', slotIndex);
        
        var $slotElement = $('#slot-' + slotIndex);
        
        // Stop any existing marquee before transition
        try {
            $slotElement.marquee('destroy');
        } catch (e) {
            // Marquee might not be initialized yet
        }
        
        // Apply marquee directly (marquee library handles the continuous scrolling transition)
        try {
            if (currentItem.text.length >= 200) {
                $slotElement.addClass('ticker-slot').html(currentItem.text).marquee({
                    duplicated: true,
                    direction: currentItem.direction,
                    duration: 30000,
                    delayBeforeStart: 0
                });
                console.log('[tickerFunc] Marquee applied (long text) for item', tickerCurIndex[slotIndex]);
            } else {
                $slotElement.addClass('ticker-slot').html(currentItem.text).marquee({
                    duplicated: true,
                    direction: currentItem.direction,
                    speed: currentItem.speed,
                    delayBeforeStart: 0
                });
                console.log('[tickerFunc] Marquee applied (short text) for item', tickerCurIndex[slotIndex]);
            }
        } catch (error) {
            console.error('[tickerFunc] Error applying marquee:', error.message);
        }
        
        console.log('[tickerFunc] Item displayed, will change after', currentItem.duration, 'ms');
        
        // Schedule next item change based on duration
        tickerTimeout[slotIndex] = setTimeout(changeTickerItem, currentItem.duration);
    }
}

// Global variables for scroller rotation
var scrollerTimeout = new Array();
var scrollerCurIndex = new Array();
var scrollerloop = new Array();

//scroller function with multi-item rotation support
function scrollerFunc(slotitem, index) {
    console.log('[scrollerFunc] Starting for slot', index);
    console.log('[scrollerFunc] Slotitem structure:', JSON.stringify(slotitem, null, 2));
    
    // Check if the slot element exists in the DOM
    if ($('#slot-' + index).length === 0) {
        console.warn('[scrollerFunc] Slot element #slot-' + index + ' does not exist in DOM (probably disabled)');
        return;
    }
    
    // Defensive checks
    if (!slotitem || !slotitem['elements'] || !Array.isArray(slotitem['elements']) || slotitem['elements'].length === 0) {
        console.error('[scrollerFunc] Invalid slotitem structure for slot', index);
        return;
    }
    
    // Initialize rotation variables
    scrollerCurIndex[index] = 0;
    scrollerloop[index] = [];
    
    //SCROLLER SPEED
    var txtSpeed;
    if (slotitem['attributes']['speed'] == '5') {
        txtSpeed = 1 * 2000;
    } else if (slotitem['attributes']['speed'] == '4') {
        txtSpeed = 2 * 2000;
    } else if (slotitem['attributes']['speed'] == '2') {
        txtSpeed = 4 * 2000;
    } else if (slotitem['attributes']['speed'] == '1') {
        txtSpeed = 5 * 2000;
    } else {
        txtSpeed = 6000;
    }
    
    //SCROLLER DIRECTIONS
    var txtDirection;
    if (slotitem['attributes']['direction'] == 'scrollup') {
        txtDirection = 'up';
    } else {
        txtDirection = 'down';
    }
    
    console.log('[scrollerFunc] Processing', slotitem['elements'].length, 'items for slot', index);
    
    // Process all items in the scroller slot
    slotitem['elements'].forEach(function (item, itemIndex) {
        console.log('[scrollerFunc] Processing item', itemIndex, ':', JSON.stringify(item));
        
        if (!item) {
            console.error('[scrollerFunc] Invalid item at index', itemIndex);
            return;
        }
        
        var src = '';
        
        // Try to get text content - handle multiple possible structures
        if (item['elements']) {
            // Handle both array and object-based nested elements
            var firstElement = null;
            var hasNestedElements = false;
            
            if (Array.isArray(item['elements'])) {
                hasNestedElements = item['elements'].length > 0;
                firstElement = item['elements'][0];
            } else if (typeof item['elements'] === 'object') {
                hasNestedElements = item['elements']['0'] !== undefined;
                firstElement = item['elements']['0'];
            }
            
            if (hasNestedElements && firstElement && firstElement['text']) {
                src = firstElement['text'];
                console.log('[scrollerFunc] Extracted nested text:', src);
            } else {
                // FALLBACK: Check if text exists directly on item
                if (item['text']) {
                    src = item['text'];
                    console.log('[scrollerFunc] Found direct text property:', src);
                }
            }
        } else if (item['text']) {
            src = item['text'];
            console.log('[scrollerFunc] Found direct text property (no elements):', src);
        }
        
        // Get duration from item attributes
        var duration = 10; // Default 10 seconds
        if (item['attributes'] && item['attributes']['duration']) {
            duration = parseInt(item['attributes']['duration']);
        }
        
        if (src && src !== '') {
            var contentObj = {
                text: src,
                duration: duration * 1000,
                speed: txtSpeed,
                direction: txtDirection
            };
            scrollerloop[index].push(contentObj);
            console.log('[scrollerFunc] Added item', itemIndex, 'to rotation:', src, 'duration:', duration, 's');
        } else {
            console.warn('[scrollerFunc] No text content found for item', itemIndex);
        }
    });
    
    if (scrollerloop[index].length === 0) {
        console.error('[scrollerFunc] No valid items to display for slot', index);
        return;
    }
    
    console.log('[scrollerFunc] Total items in rotation:', scrollerloop[index].length);
    
    // Start displaying the first item
    displayScrollerItem(index);
    
    // Function to change to next scroller item
    function changeScrollerItem() {
        scrollerCurIndex[index]++;
        if (scrollerCurIndex[index] >= scrollerloop[index].length) {
            scrollerCurIndex[index] = 0; // Loop back to first item
        }
        displayScrollerItem(index);
    }
    
    // Function to display current scroller item
    function displayScrollerItem(slotIndex) {
        if (scrollerTimeout[slotIndex]) {
            clearTimeout(scrollerTimeout[slotIndex]);
        }
        
        var currentItem = scrollerloop[slotIndex][scrollerCurIndex[slotIndex]];
        console.log('[scrollerFunc] Displaying item', scrollerCurIndex[slotIndex], 'for slot', slotIndex);
        
        var $slotElement = $('#slot-' + slotIndex);
        
        // Stop any existing marquee before transition
        try {
            $slotElement.marquee('destroy');
        } catch (e) {
            // Marquee might not be initialized yet
        }
        
        // Apply marquee directly (marquee library handles the continuous scrolling transition)
        try {
            $slotElement.addClass('scroller-slot').html(currentItem.text).marquee({
                direction: currentItem.direction,
                duration: currentItem.speed,
                delayBeforeStart: 0
            });
            $slotElement.find($('.js-marquee')).css({
                "text-align": 'center'
            });
            console.log('[scrollerFunc] Marquee applied for item', scrollerCurIndex[slotIndex]);
        } catch (error) {
            console.error('[scrollerFunc] Error applying marquee:', error.message);
        }
        
        console.log('[scrollerFunc] Item displayed, will change after', currentItem.duration, 'ms');
        
        // Schedule next item change based on duration
        scrollerTimeout[slotIndex] = setTimeout(changeScrollerItem, currentItem.duration);
    }
}

// Global variables for fader rotation
var faderTimeout = new Array();
var faderCurIndex = new Array();
var faderloop = new Array();
var faderSpeed = new Array();

//text fader function with multi-item rotation support
function faderFunc(slotitem, index) {
    console.log('[faderFunc] Starting for slot', index);
    console.log('[faderFunc] Slotitem structure:', JSON.stringify(slotitem, null, 2));
    
    // Check if the slot element exists in the DOM
    if ($('#slot-' + index).length === 0) {
        console.warn('[faderFunc] Slot element #slot-' + index + ' does not exist in DOM (probably disabled)');
        return;
    }
    
    // Defensive checks
    if (!slotitem || !slotitem['elements'] || !Array.isArray(slotitem['elements']) || slotitem['elements'].length === 0) {
        console.error('[faderFunc] Invalid slotitem structure for slot', index);
        return;
    }
    
    // Initialize rotation variables
    faderCurIndex[index] = 0;
    faderloop[index] = [];
    
    //FADER SPEED (fade animation speed)
    if (slotitem['attributes']['speed'] == '5') {
        faderSpeed[index] = 1 * 1500;
    } else if (slotitem['attributes']['speed'] == '4') {
        faderSpeed[index] = 3 * 1500;
    } else if (slotitem['attributes']['speed'] == '2') {
        faderSpeed[index] = 6 * 1500;
    } else if (slotitem['attributes']['speed'] == '1') {
        faderSpeed[index] = 8 * 1500;
    } else {
        faderSpeed[index] = 4500;
    }
    
    console.log('[faderFunc] Processing', slotitem['elements'].length, 'items for slot', index);
    
    // Process all items in the fader slot
    slotitem['elements'].forEach(function (item, itemIndex) {
        console.log('[faderFunc] Processing item', itemIndex, ':', JSON.stringify(item));
        
        if (!item) {
            console.error('[faderFunc] Invalid item at index', itemIndex);
            return;
        }
        
        var src = '';
        
        // Try to get text content - handle multiple possible structures
        if (item['elements']) {
            // Handle both array and object-based nested elements
            var firstElement = null;
            var hasNestedElements = false;
            
            if (Array.isArray(item['elements'])) {
                hasNestedElements = item['elements'].length > 0;
                firstElement = item['elements'][0];
            } else if (typeof item['elements'] === 'object') {
                hasNestedElements = item['elements']['0'] !== undefined;
                firstElement = item['elements']['0'];
            }
            
            if (hasNestedElements && firstElement && firstElement['text']) {
                src = firstElement['text'];
                console.log('[faderFunc] Extracted nested text:', src);
            } else {
                // FALLBACK: Check if text exists directly on item
                if (item['text']) {
                    src = item['text'];
                    console.log('[faderFunc] Found direct text property:', src);
                }
            }
        } else if (item['text']) {
            src = item['text'];
            console.log('[faderFunc] Found direct text property (no elements):', src);
        }
        
        // Get duration from item attributes
        var duration = 10; // Default 10 seconds
        if (item['attributes'] && item['attributes']['duration']) {
            duration = parseInt(item['attributes']['duration']);
        }
        
        if (src && src !== '') {
            var contentObj = {
                text: src,
                duration: duration * 1000
            };
            faderloop[index].push(contentObj);
            console.log('[faderFunc] Added item', itemIndex, 'to rotation:', src, 'duration:', duration, 's');
        } else {
            console.warn('[faderFunc] No text content found for item', itemIndex);
        }
    });
    
    if (faderloop[index].length === 0) {
        console.error('[faderFunc] No valid items to display for slot', index);
        return;
    }
    
    console.log('[faderFunc] Total items in rotation:', faderloop[index].length);
    
    // Start displaying the first item
    displayFaderItem(index);
    
    // Function to change to next fader item
    function changeFaderItem() {
        faderCurIndex[index]++;
        if (faderCurIndex[index] >= faderloop[index].length) {
            faderCurIndex[index] = 0; // Loop back to first item
        }
        displayFaderItem(index);
    }
    
    // Function to display current fader item
    function displayFaderItem(slotIndex) {
        if (faderTimeout[slotIndex]) {
            clearTimeout(faderTimeout[slotIndex]);
        }
        
        var currentItem = faderloop[slotIndex][faderCurIndex[slotIndex]];
        console.log('[faderFunc] Displaying item', faderCurIndex[slotIndex], 'for slot', slotIndex, ':', currentItem.text);
        
        // Check if content already exists (not first time)
        var existingContent = $('#fader-parent-' + slotIndex);
        
        if (existingContent.length > 0) {
            // Fade out existing content before showing new content
            existingContent.stop(true, true).fadeOut(faderSpeed[slotIndex], function() {
                // After fade out completes, show new content with fade in
                showNewFaderContent(slotIndex, currentItem);
            });
        } else {
            // First time - show content directly with fade in
            showNewFaderContent(slotIndex, currentItem);
        }
    }
    
    // Helper function to show new fader content with fade in
    function showNewFaderContent(slotIndex, item) {
        var faderParent = '<div id="fader-parent-' + slotIndex + '" style="display:none;"></div>';
        $('#slot-' + slotIndex).html(faderParent);
        var renderEl = '<div id="fader-' + slotIndex + '" class="fader-slot">' + item.text + '</div>';
        $('#fader-parent-' + slotIndex).html(renderEl);
        
        // Fade in the new content
        $('#fader-parent-' + slotIndex).fadeIn(faderSpeed[slotIndex], function() {
            // After fade in completes, start the continuous fade loop
            fadeLoop('#fader-parent-' + slotIndex, faderSpeed[slotIndex]);
        });
        
        console.log('[faderFunc] Item displayed, will change after', item.duration, 'ms');
        
        // Schedule next item change based on duration
        faderTimeout[slotIndex] = setTimeout(changeFaderItem, item.duration);
    }
}

//repeat text fader effect
function fadeLoop(element, txtSpeed) {
    $(element).fadeOut(txtSpeed, function () {
        $(element).fadeIn(txtSpeed, function () {
            fadeLoop(element, txtSpeed)
        });
    });
}