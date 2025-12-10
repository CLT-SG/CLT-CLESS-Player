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
        return;
    }
    
    if (!firstElement['text']) {
        console.error('[htmlFunc] No text content in slotitem[0]["elements"]["0"] for slot:', index);
        console.error('[htmlFunc] First element structure:', JSON.stringify(firstElement));
        return;
    }
    
    var src = firstElement['text'];
    
    // Validate URL format
    if (!src || typeof src !== 'string' || src.trim() === '') {
        console.error('[htmlFunc] Invalid URL for HTML slot:', index, '- URL:', src);
        return;
    }
    
    try {
        var renderEl = '<webview id="html-' + index +
            '"  src="' + src +
            '" class="html-slot"></webview>'
        $('#slot-' + index).html(renderEl);
        console.log('[htmlFunc] HTML slot rendered successfully for slot:', index, 'URL:', src);
    } catch (error) {
        console.error('[htmlFunc] Error rendering HTML slot:', index, 'Error:', error.message);
    }
}