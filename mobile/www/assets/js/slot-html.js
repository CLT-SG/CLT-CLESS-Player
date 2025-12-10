function htmlFunc(slotitem, index) {
    // Defensive checks to prevent undefined errors
    if (!slotitem || !Array.isArray(slotitem) || slotitem.length === 0) {
        console.error('[htmlFunc] Invalid slotitem:', slotitem, 'for slot:', index);
        return;
    }
    
    if (!slotitem[0]['elements'] || slotitem[0]['elements'].length === 0) {
        console.error('[htmlFunc] No elements in slotitem[0] for slot:', index);
        return;
    }
    
    if (!slotitem[0]['elements']['0'] || !slotitem[0]['elements']['0']['text']) {
        console.error('[htmlFunc] No text content in slotitem[0]["elements"]["0"] for slot:', index);
        return;
    }
    
    var src = slotitem[0]['elements']['0']['text']
    var renderEl = '<webview id="html-' + index +
        '"  src="' + src +
        '" class="html-slot"></webview>'
    $('#slot-' + index).html(renderEl)
}