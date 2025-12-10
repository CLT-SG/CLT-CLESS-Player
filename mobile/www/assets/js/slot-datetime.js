//date function Interval to repeatly update the date time element
var dateInterval
var timeInterval

function dateFunc(slotitem, index) {
    // Defensive check for slotitem
    if (!slotitem || !slotitem['attributes']) {
        console.error('[dateFunc] Invalid slotitem for slot:', index);
        return;
    }
    
    const now = new Date()
    var srcformat = slotitem['attributes']['format'] || 'dd/mm/yyyy'
    if (srcformat == 'dd/mm/yy') {
        srcformat = datetime.format(now, 'DD/MM/YY')
    } else if (srcformat == 'dd/mm/yyyy') {
        srcformat = datetime.format(now, 'DD/MM/YYYY')
    } else if (srcformat == 'dd/mmm/yy') {
        srcformat = datetime.format(now, 'DDD/MMM/YY')
    } else if (srcformat == 'dd/mmm/yyyy') {
        srcformat = datetime.format(now, 'DDD/MMM/YYYY')
    } else if (srcformat == 'dd mm yy') {
        srcformat = datetime.format(now, 'DD MM YY')
    } else if (srcformat == 'dd mm yyyy') {
        srcformat = datetime.format(now, 'DD MM YYYY')
    } else if (srcformat == 'dd mmm yy') {
        srcformat = datetime.format(now, 'DDD MMM YY')
    } else if (srcformat == 'dd mmm yyyy') {
        srcformat = datetime.format(now, 'DDD MMM YYYY')
    } else if (srcformat == 'ddd, dd mmm yyyy') {
        srcformat = datetime.format(now, 'ddd, DDD MMM YYYY')
    } else if (srcformat == 'dddd, dd mmm yyyy') {
        srcformat = datetime.format(now, 'dddd, DDD MMM YYYY')
    } else if (srcformat == 'dddd, dd mmmmm yyyy') {
        srcformat = datetime.format(now, 'dddd, DDD MMMM YYYY')
    }
    var renderEl = '<div id="date-' + index + '" class="date-slot">' + srcformat + '</div>'
    $('#slot-' + index).html(renderEl)
    setTimeout(function () {
        dateFunc(slotitem, index)
    }, 1000)
}

//time function
function timeFunc(slotitem, index) {
    // Defensive check for slotitem
    if (!slotitem || !slotitem['attributes']) {
        console.error('[timeFunc] Invalid slotitem for slot:', index);
        return;
    }
    
    const now = new Date()
    var srcformat = slotitem['attributes']['format'] || 'hh:nn'
    if (srcformat == 'hh:nn') {
        srcformat = datetime.format(now, 'HH:mm')
    } else if (srcformat == 'hh:nn:ss') {
        srcformat = datetime.format(now, 'hh:mm:ss')
    } else if (srcformat == 'HH:nn AM/PM') {
        srcformat = datetime.format(now, 'hh:mm A')
    } else if (srcformat == 'HH:nn:ss AM/PM') {
        srcformat = datetime.format(now, 'hh:mm:ss A')
    }
    var renderEl = '<div id="time-' + index + '" class="time-slot">' + srcformat + '</div>'
    $('#slot-' + index).html('')
    $('#slot-' + index).html(renderEl)
    setTimeout(function () {
        timeFunc(slotitem, index)
    }, 1000)
}