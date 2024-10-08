function htmlFunc(slotitem, index) {
    var src = slotitem[0]['elements']['0']['text']
    var renderEl = '<webview id="html-' + index +
        '"  src="' + src +
        '" class="html-slot"></webview>'
    $('#slot-' + index).html(renderEl)
}