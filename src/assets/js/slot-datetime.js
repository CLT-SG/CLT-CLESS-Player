//date function Interval to repeatly update the date time element
var dateInterval
var timeInterval
var datetimeInterval

function dateFunc(slotitem, index) {
    const now = new Date()
    var srcformat = slotitem['attributes']['format']
    if (srcformat == 'dd/mm/yy') {
        srcformat = datetime.format(now, 'DD/MM/YY')
    } else if (srcformat == 'dd/mm/yyyy') {
        srcformat = datetime.format(now, 'DD/MM/YYYY')
    } else if (srcformat == 'dd/mmm/yy') {
        srcformat = datetime.format(now, 'DD/MMM/YY')
    } else if (srcformat == 'dd/mmm/yyyy') {
        srcformat = datetime.format(now, 'DD/MMM/YYYY')
    } else if (srcformat == 'dd mm yy') {
        srcformat = datetime.format(now, 'DD MM YY')
    } else if (srcformat == 'dd mm yyyy') {
        srcformat = datetime.format(now, 'DD MM YYYY')
    } else if (srcformat == 'dd mmm yy') {
        srcformat = datetime.format(now, 'DD MMM YY')
    } else if (srcformat == 'dd mmm yyyy') {
        srcformat = datetime.format(now, 'DD MMM YYYY')
    } else if (srcformat == 'ddd, dd mmm yyyy') {
        srcformat = datetime.format(now, 'ddd, DD MMM YYYY')
    } else if (srcformat == 'dddd, dd mmm yyyy') {
        srcformat = datetime.format(now, 'dddd, DD MMM YYYY')
    } else if (srcformat == 'dddd, dd mmmmm yyyy') {
        srcformat = datetime.format(now, 'dddd, DD MMMM YYYY')
    }
    var renderEl = '<div id="date-' + index + '" class="date-slot">' + srcformat + '</div>'
    $('#slot-' + index).html(renderEl)
    setTimeout(function () {
        dateFunc(slotitem, index)
    }, 1000)
}

//time function
function timeFunc(slotitem, index) {
    const now = new Date()
    var srcformat = slotitem['attributes']['format']
    if (srcformat == 'hh:nn') {
        srcformat = datetime.format(now, 'HH:mm')
    } else if (srcformat == 'hh:nn:ss') {
        srcformat = datetime.format(now, 'HH:mm:ss')
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

//datetime function - Combined date and time with custom format
// Supports any custom datetime format pattern using these tokens:
// Year: YYYY (2026), YY (26)
// Month: MMMM (January), MMM (Jan), MM (01-12), M (1-12)
// Day: DD (01-31), D (1-31), DDD (1st, 2nd, 3rd), dddd (Thursday), ddd (Thu)
// Hour: HH (00-23), H (0-23), hh (01-12), h (1-12)
// Minute: mm (00-59), m (0-59)
// Second: ss (00-59), s (0-59)
// Meridiem: A (AM/PM), a (am/pm)
// Escape text: [text] - Example: YYYY-MM-DD [at] HH:mm → 2026-01-09 at 14:30
function datetimeFunc(slotitem, index) {
    const now = new Date()
    var srcformat = slotitem['attributes']['format']
    // Use the custom format directly - supports any datetime format pattern
    // Examples: 'YYYY-MM-DD HH:mm:ss', 'DD/MM/YYYY, HH:mm', 'MMMM DDD, YYYY [at] hh:mm A'
    var formattedOutput = datetime.format(now, srcformat)
    var renderEl = '<div id="datetime-' + index + '" class="datetime-slot">' + formattedOutput + '</div>'
    $('#slot-' + index).html(renderEl)
    setTimeout(function () {
        datetimeFunc(slotitem, index)
    }, 1000)
}