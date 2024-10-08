//ticker function
function tickerFunc(slotitem, index) {
    var txtDirection
    if (slotitem['elements'][0]['elements']) {
        var src = slotitem['elements'][0]['elements']['0']['text']
    } else {
        var src = ''
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
    
}

//scroller function
function scrollerFunc(slotitem, index) {
    var txtDirection
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
    var src = slotitem['elements'][0]['elements']['0']['text']
    if (slotitem['attributes']['direction'] == 'scrollup') {
        txtDirection = 'up'
    } else {
        txtDirection = 'down'
    }
    $('#slot-' + index).addClass('scroller-slot').html(src).marquee({
        direction: txtDirection,
        duration: txtSpeed
    })
    $('#slot-' + index).find($('.js-marquee')).css({
        "text-align": 'center'
    })

}

//text fader function
function faderFunc(slotitem, index) {
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
    var src = slotitem['elements'][0]['elements']['0']['text']
    var faderParent = '<div id="fader-parent-' + index + '"></div>'
    $('#slot-' + index).append(faderParent)
    var renderEl = '<div id="fader-' + index + '" class="fader-slot">' + src + '</div>'
    $('#fader-parent-' + index).html(function () {
        fadeLoop('#fader-parent-' + index, txtSpeed)
        return renderEl
    })

}

//repeat text fader effect
function fadeLoop(element, txtSpeed) {
    $(element).fadeOut(txtSpeed, function () {
        $(element).fadeIn(txtSpeed, function () {
            fadeLoop(element, txtSpeed)
        });
    });
}