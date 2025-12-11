//ticker function
function tickerFunc(slotitem, index) {
    console.log('[tickerFunc] Starting for slot', index);
    console.log('[tickerFunc] Slotitem structure:', JSON.stringify(slotitem, null, 2));
    
    // Check if the slot element exists in the DOM
    if ($('#slot-' + index).length === 0) {
        console.warn('[tickerFunc] Slot element #slot-' + index + ' does not exist in DOM (probably disabled)');
        return;
    }
    
    // Defensive checks
    if (!slotitem || !slotitem['elements'] || !slotitem['elements'][0]) {
        console.error('[tickerFunc] Invalid slotitem structure for slot', index);
        return;
    }
    
    var txtDirection;
    var src = '';
    
    // Try to get text content - handle multiple possible structures
    if (slotitem['elements'][0]['elements']) {
        console.log('[tickerFunc] Found elements[0].elements');
        
        // Handle both array and object-based elements
        var firstElement = null;
        if (Array.isArray(slotitem['elements'][0]['elements'])) {
            console.log('[tickerFunc] Elements is an array');
            firstElement = slotitem['elements'][0]['elements'][0];
        } else if (typeof slotitem['elements'][0]['elements'] === 'object') {
            console.log('[tickerFunc] Elements is an object');
            firstElement = slotitem['elements'][0]['elements']['0'];
        }
        
        if (firstElement) {
            console.log('[tickerFunc] First element:', JSON.stringify(firstElement));
            if (firstElement['text']) {
                src = firstElement['text'];
                console.log('[tickerFunc] Found text:', src);
            } else {
                console.warn('[tickerFunc] No text property in first element');
            }
        } else {
            console.warn('[tickerFunc] Could not extract first element');
        }
    } else {
        console.warn('[tickerFunc] No elements property in slotitem[elements][0]');
    }
    
    // If still no source, return early
    if (!src || src === '') {
        console.error('[tickerFunc] No text content found for slot', index);
        return;
    }
    
    // If still no source, return early
    if (!src || src === '') {
        console.error('[tickerFunc] No text content found for slot', index);
        return;
    }
    
    //TICKER SPEED
    if (slotitem['attributes']['speed'] == '5') {
        var txtSpeed = 25 * 10
    } else if (slotitem['attributes']['speed'] == '4') {
        var txtSpeed = 15 * 10
    } else if (slotitem['attributes']['speed'] == '2') {
        var txtSpeed = 7 * 10
    } else if (slotitem['attributes']['speed'] == '1') {
        var txtSpeed = 3 * 10
    } else {
        var txtSpeed = 100
    }
    
    // Duplicate text for continuous scrolling based on length
    if (src.length <= 10){
        src = src + ' ' + src + ' ' + src + ' ' + src + ' ' + src + ' ' + src + ' ' + src
    } else if (src.length > 10 && src.length <= 25){
        src = src + ' ' + src + ' ' + src + ' ' + src + ' ' + src + ' ' + src
    } else if (src.length > 25 && src.length <= 40){
        src = src + ' ' + src + ' ' + src + ' ' + src+ ' ' + src + ' ' + src
    } else if (src.length > 40 && src.length <= 60) {
        src = src + ' ' + src + ' ' + src+ ' ' + src + ' ' + src
    } else if (src.length > 60 && src.length <= 80) {
        src = src + ' ' + src + ' ' + src+ ' ' + src
    } else if (src.length > 80 && src.length <= 110) {
        src = src + ' ' + src + ' ' + src
    } else if (src.length > 110 && src.length <= 130) {
        src = src + ' ' + src
    }
    
    //TICKER DIRECTIONS
    if (slotitem['attributes']['direction'] == 'righttoleft') {
        txtDirection = 'left'
    } else {
        txtDirection = 'right'
    }
    
    console.log('[tickerFunc] Rendering ticker with src length:', src.length, 'direction:', txtDirection);
    
    if (src.length >= 200) {
        $('#slot-' + index).addClass('ticker-slot').html(src).delay(5000).marquee({
            duplicated: true,
            direction: txtDirection,
            duration: 30000
        })
    } else {
        $('#slot-' + index).addClass('ticker-slot').html(src).delay(2000).marquee({
            duplicated: true,
            direction: txtDirection,
            speed: txtSpeed
        })
    }
    
    console.log('[tickerFunc] Ticker rendered successfully for slot', index);
}

//scroller function
function scrollerFunc(slotitem, index) {
    console.log('[scrollerFunc] Starting for slot', index);
    console.log('[scrollerFunc] Slotitem structure:', JSON.stringify(slotitem, null, 2));
    
    // Check if the slot element exists in the DOM
    if ($('#slot-' + index).length === 0) {
        console.warn('[scrollerFunc] Slot element #slot-' + index + ' does not exist in DOM (probably disabled)');
        return;
    }
    
    // Defensive checks
    if (!slotitem || !slotitem['elements'] || !slotitem['elements'][0] || 
        !slotitem['elements'][0]['elements']) {
        console.error('[scrollerFunc] Invalid slotitem structure for slot', index);
        return;
    }
    
    var txtDirection;
    
    //SCROLLER SPEED
    if (slotitem['attributes']['speed'] == '5') {
        var txtSpeed = 1 * 2000
    } else if (slotitem['attributes']['speed'] == '4') {
        var txtSpeed = 2 * 2000
    } else if (slotitem['attributes']['speed'] == '2') {
        var txtSpeed = 4 * 2000
    } else if (slotitem['attributes']['speed'] == '1') {
        var txtSpeed = 5 * 2000
    } else {
        var txtSpeed = 6000
    }
    
    // Handle both array and object-based elements
    var firstElement = null;
    if (Array.isArray(slotitem['elements'][0]['elements'])) {
        console.log('[scrollerFunc] Elements is an array');
        firstElement = slotitem['elements'][0]['elements'][0];
    } else if (typeof slotitem['elements'][0]['elements'] === 'object') {
        console.log('[scrollerFunc] Elements is an object');
        firstElement = slotitem['elements'][0]['elements']['0'];
    }
    
    if (!firstElement || !firstElement['text']) {
        console.error('[scrollerFunc] No text content found for slot', index);
        return;
    }
    
    var src = firstElement['text'];
    console.log('[scrollerFunc] Text content:', src);
    
    //SCROLLER DIRECTIONS
    if (slotitem['attributes']['direction'] == 'scrollup') {
        txtDirection = 'up'
    } else {
        txtDirection = 'down'
    }
    
    console.log('[scrollerFunc] Rendering scroller with direction:', txtDirection, 'speed:', txtSpeed);
    
    $('#slot-' + index).addClass('scroller-slot').html(src).marquee({
        direction: txtDirection,
        duration: txtSpeed
    })
    $('#slot-' + index).find($('.js-marquee')).css({
        "text-align": 'center'
    })
    
    console.log('[scrollerFunc] Scroller rendered successfully for slot', index);
}

//text fader function
function faderFunc(slotitem, index) {
    console.log('[faderFunc] Starting for slot', index);
    console.log('[faderFunc] Slotitem structure:', JSON.stringify(slotitem, null, 2));
    
    // Check if the slot element exists in the DOM
    if ($('#slot-' + index).length === 0) {
        console.warn('[faderFunc] Slot element #slot-' + index + ' does not exist in DOM (probably disabled)');
        return;
    }
    
    // Defensive checks
    if (!slotitem || !slotitem['elements'] || !slotitem['elements'][0] || 
        !slotitem['elements'][0]['elements']) {
        console.error('[faderFunc] Invalid slotitem structure for slot', index);
        return;
    }
    
    //FADER SPEED
    if (slotitem['attributes']['speed'] == '5') {
        var txtSpeed = 1 * 1500
    } else if (slotitem['attributes']['speed'] == '4') {
        var txtSpeed = 3 * 1500
    } else if (slotitem['attributes']['speed'] == '2') {
        var txtSpeed = 6 * 1500
    } else if (slotitem['attributes']['speed'] == '1') {
        var txtSpeed = 8 * 1500
    } else {
        var txtSpeed = 4500
    }
    
    // Handle both array and object-based elements
    var firstElement = null;
    if (Array.isArray(slotitem['elements'][0]['elements'])) {
        console.log('[faderFunc] Elements is an array');
        firstElement = slotitem['elements'][0]['elements'][0];
    } else if (typeof slotitem['elements'][0]['elements'] === 'object') {
        console.log('[faderFunc] Elements is an object');
        firstElement = slotitem['elements'][0]['elements']['0'];
    }
    
    if (!firstElement || !firstElement['text']) {
        console.error('[faderFunc] No text content found for slot', index);
        return;
    }
    
    var src = firstElement['text'];
    console.log('[faderFunc] Text content:', src, 'speed:', txtSpeed);
    
    var faderParent = '<div id="fader-parent-' + index + '"></div>'
    $('#slot-' + index).append(faderParent)
    var renderEl = '<div id="fader-' + index + '" class="fader-slot">' + src + '</div>'
    $('#fader-parent-' + index).html(function () {
        fadeLoop('#fader-parent-' + index, txtSpeed)
        return renderEl
    })
    
    console.log('[faderFunc] Fader rendered successfully for slot', index);
}

//repeat text fader effect
function fadeLoop(element, txtSpeed) {
    $(element).fadeOut(txtSpeed, function () {
        $(element).fadeIn(txtSpeed, function () {
            fadeLoop(element, txtSpeed)
        });
    });
}