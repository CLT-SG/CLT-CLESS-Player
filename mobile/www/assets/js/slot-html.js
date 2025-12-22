function htmlFunc(slotitem, index) {
    // Defensive checks to prevent undefined errors
    if (!slotitem || !Array.isArray(slotitem) || slotitem.length === 0) {
        console.error('[htmlFunc] Invalid slotitem for slot:', index, '- Type:', typeof slotitem, 'Length:', slotitem ? slotitem.length : 'N/A');
        return;
    }
    
    if (!slotitem[0]) {
        console.error('[htmlFunc] slotitem[0] is undefined for slot:', index);
        return;
    }
    
    if (!slotitem[0]['elements']) {
        console.error('[htmlFunc] No elements property in slotitem[0] for slot:', index);
        console.error('[htmlFunc] slotitem[0] structure:', JSON.stringify(slotitem[0]));
        return;
    }
    
    // Check if elements is empty or has no items (handle both array and object)
    var hasElements = false;
    var firstElement = null;
    var src = null; // Declare src at function scope
    
    if (Array.isArray(slotitem[0]['elements'])) {
        hasElements = slotitem[0]['elements'].length > 0 && slotitem[0]['elements'][0];
        firstElement = slotitem[0]['elements'][0];
    } else if (typeof slotitem[0]['elements'] === 'object') {
        hasElements = slotitem[0]['elements']['0'] !== undefined;
        firstElement = slotitem[0]['elements']['0'];
    }
    
    if (!hasElements || !firstElement) {
        console.error('[htmlFunc] No elements in slotitem[0] for slot:', index);
        console.error('[htmlFunc] Elements type:', Array.isArray(slotitem[0]['elements']) ? 'array' : typeof slotitem[0]['elements']);
        console.error('[htmlFunc] Elements structure:', JSON.stringify(slotitem[0]['elements']));
        
        // FALLBACK: Check if text is directly in slotitem[0] or attributes
        if (slotitem[0]['text']) {
            console.log('[htmlFunc] Found text directly in slotitem[0]');
            src = slotitem[0]['text'];
        } else if (slotitem[0]['attributes'] && slotitem[0]['attributes']['src']) {
            console.log('[htmlFunc] Found src in attributes');
            src = slotitem[0]['attributes']['src'];
        } else if (slotitem[0]['attributes'] && slotitem[0]['attributes']['url']) {
            console.log('[htmlFunc] Found url in attributes');
            src = slotitem[0]['attributes']['url'];
        } else {
            console.error('[htmlFunc] Cannot find HTML source anywhere in slotitem[0]');
            console.error('[htmlFunc] Full slotitem[0]:', JSON.stringify(slotitem[0]));
            return;
        }
    } else {
        if (!firstElement['text']) {
            console.error('[htmlFunc] No text content in slotitem[0]["elements"]["0"] for slot:', index);
            console.error('[htmlFunc] First element structure:', JSON.stringify(firstElement));
            return;
        }
        
        src = firstElement['text'];
    }
    
    // Validate URL format (src is now defined in either branch above)
    if (!src || typeof src !== 'string' || src.trim() === '') {
        console.error('[htmlFunc] Invalid URL for HTML slot:', index, '- URL:', src);
        return;
    }
    
    try {
        // Check if running on mobile platform
        const isMobile = !!(window.capacitorAPI || window.mobileAPI);
        
        if (isMobile) {
            // USE IFRAME FOR MOBILE (respects slot positioning and dimensions)
            console.log('[htmlFunc] Mobile platform detected, using iframe for slot:', index);
            
            var renderEl = '<iframe id="html-' + index +
                '" src="' + src +
                '" class="html-slot mobile-html-iframe" ' +
                'style="width: 100%; height: 100%; border: none; display: block;" ' +
                'frameborder="0" ' +
                'allowfullscreen ' +
                'allow="geolocation; microphone; camera; midi; encrypted-media; autoplay; fullscreen"' +
                '></iframe>';
            
            $('#slot-' + index).html(renderEl);
            
            console.log('[htmlFunc] Mobile iframe HTML slot rendered successfully for slot:', index, 'URL:', src);
            
            // Add load event listener for error handling
            $('#html-' + index).on('load', function() {
                console.log('[htmlFunc] iframe loaded successfully for slot:', index);
            });
            
            $('#html-' + index).on('error', function(e) {
                console.error('[htmlFunc] iframe failed to load for slot:', index, e);
            });
            
        } else {
            // USE WEBVIEW (Electron desktop app)
            console.log('[htmlFunc] Desktop platform detected, using webview for slot:', index);
            
            var renderEl = '<webview id="html-' + index +
                '"  src="' + src +
                '" class="html-slot"></webview>'
            $('#slot-' + index).html(renderEl);
            console.log('[htmlFunc] HTML slot rendered successfully for slot:', index, 'URL:', src);
        }
        
    } catch (error) {
        console.error('[htmlFunc] Error rendering HTML slot:', index, 'Error:', error.message);
    }
}