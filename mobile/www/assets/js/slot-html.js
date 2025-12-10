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
    
    if (!slotitem[0]['elements'] || slotitem[0]['elements'].length === 0) {
        console.error('[htmlFunc] No elements in slotitem[0] for slot:', index);
        return;
    }
    
    if (!slotitem[0]['elements']['0'] || !slotitem[0]['elements']['0']['text']) {
        console.error('[htmlFunc] No text content in slotitem[0]["elements"]["0"] for slot:', index);
        console.error('[htmlFunc] Element structure:', slotitem[0]['elements']);
        return;
    }
    
    var src = slotitem[0]['elements']['0']['text'];
    
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