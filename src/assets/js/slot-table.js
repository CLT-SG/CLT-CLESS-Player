var zeroPad = (num, places) => String(num).padStart(places, '0')
var columnStyle = []

//head row
var headRowEvenColor
var headRowOddColor
var headRowHeight
var bodyRowHeight
var tableStyleVAlign

// Animation configuration
var colAnimationInterval = [] // stores animation interval per table
var colAnimationDuration = [] // stores animation duration per table

var pagerow = []
var pageAutoInterval = []
var pageLengthTime = []
var pageincrease = []
var checkpage = []
var tableTransition = [] // stores transition type per table (none, fade, slide-right, slide-left, scroll-up, scroll-down)
var tableFlipMode = [] // stores flip mode per table (1 = pagination, 2 = line)
var tableHidePagination = [] // stores hide pagination flag per table (Y/N)
var tableHideHeader = [] // stores hide header flag per table (Y/N)
var tableWrap = [] // stores wrap text flag per table (Y/N)
var tableFixedHeight = [] // stores fixed height flag per table (Y = fixed height, N = dynamic height with fixed row height)

function tableFunc(slotitem, index, slotattr) {
    columnStyle = []
    //create table
    var tableid = slotattr['id']
    pageLengthTime[tableid] = parseInt(slotattr['pageflip']) * 1000
    
    // Animation configuration - read from attributes or use defaults
    // animationInterval: how long to display each item (in seconds) - default 10 seconds
    // animationDuration: how long the transition animation takes (in milliseconds) - default 800ms
    colAnimationInterval[tableid] = (slotattr['animationInterval'] ? parseInt(slotattr['animationInterval']) : 25) * 1000
    colAnimationDuration[tableid] = slotattr['animationDuration'] ? parseInt(slotattr['animationDuration']) : 4000
    
    // Table pagination configuration
    tableFlipMode[tableid] = slotattr['flipmode'] ? parseInt(slotattr['flipmode']) : 1 // 1 = pagination (default), 2 = line type
    tableHidePagination[tableid] = slotattr['hidepagination'] || 'N' // Y = hide pagination numbers, N = show (default)
    tableTransition[tableid] = slotattr['transition'] || 'none' // none (default), fade, slide-right, slide-left, scroll-up, scroll-down
    tableHideHeader[tableid] = slotitem[0]['attributes']['hideheader'] || 'N' // Y = hide header, N = show (default)
    tableWrap[tableid] = slotattr['wrap'] || 'N' // Y = wrap text, N = clip text (default)
    tableFixedHeight[tableid] = slotattr['fixedHeight'] || 'N' // Y = fixed height (default), N = dynamic height with fixed row height
    
    tableolddate = slotattr['update']
    tableStyleBgColor = slotattr['bgcolor']
    var tableStylefontName = slotattr['font']
    var tableStylefontColor = slotattr['fontcolor']
    var tableStylefontSize = slotattr['fontsize']
    var tableStyleBgColorTransp = slotattr['transparentbg']
    var tableStyleSpacing = slotattr['cellspacing']
    var tableStyleWidth = slotattr['width']
    var tableStyleHeight = slotattr['height']
    tableStyleVAlign = slotattr['valign']
    var headStyleBgColor = slotitem[0]['attributes']['bgcolor']
    var headStylefontName = slotitem[0]['attributes']['font']
    var headStylefontColor = slotitem[0]['attributes']['fontcolor']
    var headStylefontSize = slotitem[0]['attributes']['fontsize']
    bodyRowHeight = slotattr['bodyrowHeight']

    //create pagination page at the top
    $('#slot-' + index).append('<div class="clearfix"><div class="pagination-pages"></div></div>')

    //create table element
    $('#slot-' + index).append('<table border="0" cellpadding="0" cellspacing="0" class="slot-table-' + tableid + '"><thead class="slot-thead-' + tableid + '"></thead></table>')

    //create pagination element
    $('#slot-' + index).append('<div id="pagination-' + tableid + '" class"pagination-js"></div>')

    tableStyleBgColor = hexToRgbA(tableStyleBgColor, tableStyleBgColorTransp)
    
    // Build CSS object based on fixedHeight setting
    var tableCssConfig = {
        "background-color": tableStyleBgColor,
        "font-family": tableStylefontName,
        "color": tableStylefontColor,
        "font-size": tableStylefontSize + 'px',
        "padding": "0",
        "overflow": "hidden",
        "table-layout": "fixed",
        "border-collapse": "collapse",
        "border-spacing": tableStyleSpacing + 'px',
        "width": tableStyleWidth + 'px'
    }
    
    // Apply height constraints based on fixedHeight setting
    if (tableFixedHeight[tableid] === 'Y') {
        // Fixed height mode - table has fixed height and max-height
        tableCssConfig["height"] = tableStyleHeight + 'px'
        tableCssConfig["max-height"] = tableStyleHeight + 'px'
    } else {
        // Dynamic height mode - table grows with content, but rows have fixed height
        tableCssConfig["height"] = "auto"
        tableCssConfig["max-height"] = "none"
    }
    
    $('.slot-table-' + tableid).css(tableCssConfig)

    //head row
    headRowEvenColor = hexToRgbA(slotitem[2]['attributes']['evencolor'], "Normal")
    headRowOddColor = hexToRgbA(slotitem[2]['attributes']['oddcolor'], "Normal")
    headRowHeight = slotitem[2]['attributes']['margin']

    //custom head style
    $('.slot-thead-' + tableid).css({
        "background-color": headStyleBgColor,
        "font-family": headStylefontName,
        "color": headStylefontColor,
        "font-size": headStylefontSize + 'px',
        "height": "100%",
        "overflow": "hidden",
        "text-overflow": "clip",
        "white-space": "nowrap",
        "max-height": headRowHeight + "px !important",
        'line-height': headRowHeight + 'px'
    })

    $('.pagination-pages').css({
        "background-color": headRowEvenColor,
        "font-family": headStylefontName,
        "color": headStylefontColor,
        "font-size": headStylefontSize + 'px',
        "line-height": headStylefontSize + 'px', // line height for pagination numbers
        "padding": "10px",
        "border-radius": "5px 20px 5px",
        "float": "right",
        "text-align": "right"
    })

    $('.slot-thead-' + tableid).append('<tr class="first-row"></tr>')

    // Hide header if hideheader = 'Y'
    if (tableHideHeader[tableid] === 'Y') {
        $('.slot-thead-' + tableid).hide()
    }

    //head column
    slotitem[1]['elements'].forEach(function (column, cindex) {
        var columnIndex = cindex + 1
        var columnText = column['elements'][0]['text']
        var columnAlign = column['attributes']['align']
        var columnWidth = column['attributes']['width']
        var cellTopRightRadius = column['attributes']['tlradius']
        var cellTopLeftRadius = column['attributes']['trradius']
        var cellBottomRightRadius = column['attributes']['blradius']
        var cellBottomLeftRadius = column['attributes']['brradius']
        
        // New column-level settings
        var bgColorEnabled = column['attributes']['bgcolor_enabled'] || 'N'
        var bgColor = column['attributes']['bgcolor'] || ''
        // Fader settings (for fader: format - original scroll effect)
        var faderEnabled = column['attributes']['fader_enabled'] || 'N'
        var faderSwitchingTime = column['attributes']['fader_switching_time'] || 10 // Default: 10 seconds
        var faderSpeed = column['attributes']['fader_speed'] || 800 // Default: 800 ms
        var faderDelay = column['attributes']['fader_delay'] || 0 // Default: 0 ms (starts immediately)
        // Text transition settings (for transition: format - multiple effects)
        var textTransitionEnabled = column['attributes']['text_transition_enabled'] || 'N'
        var textTransitionSwitchingTime = column['attributes']['text_transition_switching_time'] || 10 // Default: 10 seconds
        var textTransitionSpeed = column['attributes']['text_transition_speed'] || 800 // Default: 800 ms
        var textTransitionStyle = column['attributes']['text_transition_style'] || 'scroll-up'
        var textTransitionDelay = column['attributes']['text_transition_delay'] || 0 // Default: 0 ms (starts immediately)
        var imageEnabled = column['attributes']['image_enabled'] || 'N'
        var imageTransition = column['attributes']['image_transition'] || 'scroll-up'
        var imageSwitchingTime = column['attributes']['image_switching_time'] || 10 // Default: 10 seconds
        var imageTransitionSpeed = column['attributes']['image_transition_speed'] || 800 // Default: 800 ms
        var imageTransitionDelay = column['attributes']['image_transition_delay'] || 0 // Default: 0 ms (starts immediately)
        var fillToColumn = column['attributes']['fill_to_column'] || 'N'
        
        if (columnAlign == 'c') {
            columnAlign = 'center'
        } else if (columnAlign == 'l') {
            columnAlign = 'left'
        } else {
            columnAlign = 'right'
        }
        $('.first-row').append('<td class="col' + zeroPad(columnIndex, 2) + '">' + columnText + '</td>)')
        var colSytleObj = new Object()
        colSytleObj.colid = 'col' + zeroPad(columnIndex, 2)
        colSytleObj.textalign = columnAlign
        colSytleObj.tlradius = cellTopLeftRadius
        colSytleObj.trradius = cellTopRightRadius
        colSytleObj.blradius = cellBottomLeftRadius
        colSytleObj.brradius = cellBottomRightRadius
        colSytleObj.width = columnWidth
        colSytleObj.bgColorEnabled = bgColorEnabled
        colSytleObj.bgColor = bgColor
        colSytleObj.faderEnabled = faderEnabled
        colSytleObj.faderSwitchingTime = faderSwitchingTime
        colSytleObj.faderSpeed = faderSpeed
        colSytleObj.faderDelay = faderDelay
        colSytleObj.textTransitionEnabled = textTransitionEnabled
        colSytleObj.textTransitionSwitchingTime = textTransitionSwitchingTime
        colSytleObj.textTransitionSpeed = textTransitionSpeed
        colSytleObj.textTransitionStyle = textTransitionStyle
        colSytleObj.textTransitionDelay = textTransitionDelay
        colSytleObj.imageEnabled = imageEnabled
        colSytleObj.imageTransition = imageTransition
        colSytleObj.imageSwitchingTime = imageSwitchingTime
        colSytleObj.imageTransitionSpeed = imageTransitionSpeed
        colSytleObj.imageTransitionDelay = imageTransitionDelay
        colSytleObj.fillToColumn = fillToColumn
        columnStyle.push(colSytleObj)
        if (cindex == slotitem[1]['elements'].length - 1) {

        }
        // Apply header column styles (NO bgcolor - header uses headStyleBgColor)
        $('.slot-thead-' + tableid + ' .col' + zeroPad(columnIndex, 2)).css({
            'text-align': columnAlign,
            "border-radius": cellTopRightRadius + "px " + cellTopLeftRadius + "px " + cellBottomLeftRadius + "px " + cellBottomRightRadius + "px",
            'width': columnWidth + "px",
            'height': bodyRowHeight + "px",
            'max-height': bodyRowHeight + "px",
            'line-height': bodyRowHeight + "px"
        })
    })
}

//Image column global settings
var colImageTimeout = new Array()
var colImageCurIndex = new Array()
var colImageloop = new Array()
var colImageFirstRender = new Array() // Track if column has rendered at least once
//Fader column global settings (for fader: format - original scroll effect)
var colFaderTimeout = new Array()
var colFaderCurIndex = new Array()
var colFaderloop = new Array()
var colFaderFirstRender = new Array() // Track if column has rendered at least once
// Per-column fader settings
var colFaderSettings = new Array()
//Text Transition column global settings (for transition: format - multiple effects)
var colTextTransitionTimeout = new Array()
var colTextTransitionCurIndex = new Array()
var colTextTransitionloop = new Array()
var colTextTransitionFirstRender = new Array() // Track if column has rendered at least once
// Per-column text transition settings
var colTextTransitionSettings = new Array()
// Per-column image settings
var colImageSettings = new Array()

//table record
function tableNorecords(slotitem, slotid, slotattr) {
    //create table
    var tableid = slotattr['id']
    pageLengthTime[tableid] = 9999 * 1000
    tableFixedHeight[tableid] = slotattr['fixedHeight'] || 'Y' // Y = fixed height (default), N = dynamic height
    tableolddate = slotattr['update']
    tableStyleBgColor = slotattr['bgcolor']
    var tableStylefontName = slotattr['font']
    var tableStylefontColor = slotattr['fontcolor']
    var tableStylefontSize = slotattr['fontsize']
    var tableStyleSpacing = slotattr['cellspacing']
    var tableStyleWidth = slotattr['width']
    var tableStyleHeight = slotattr['height']
    var headStyleBgColor = slotitem[0]['attributes']['bgcolor']
    var headStylefontName = slotitem[0]['attributes']['font']
    var headStylefontColor = slotitem[0]['attributes']['fontcolor']
    var headStylefontSize = slotitem[0]['attributes']['fontsize']

    //create table element
    $('#slot-' + slotid).append('<table border="0" cellpadding="0" cellspacing="0" class="slot-table-' + tableid + '"><thead class="slot-thead-' + tableid + '">' +
        '<tr><td>No dataset to show.</td></tr></thead></table>')

    // Build CSS object based on fixedHeight setting
    var tableCssConfig = {
        "background-color": "rgba(255, 255, 255, 0)",
        "font-family": tableStylefontName,
        "color": tableStylefontColor,
        "font-size": tableStylefontSize + 'px',
        "padding": "0",
        "overflow": "hidden",
        "line-height": tableStylefontSize + 'px',
        "table-layout": "fixed",
        "border-collapse": "collapse",
        "border-spacing": tableStyleSpacing + 'px',
        "width": tableStyleWidth + 'px'
    }
    
    // Apply height constraints based on fixedHeight setting
    if (tableFixedHeight[tableid] === 'Y') {
        // Fixed height mode
        tableCssConfig["height"] = tableStyleHeight + 'px'
        tableCssConfig["max-height"] = tableStyleHeight + 'px'
    } else {
        // Dynamic height mode
        tableCssConfig["height"] = "auto"
        tableCssConfig["max-height"] = "none"
    }
    
    //custom table element
    $('.slot-table-' + tableid).css(tableCssConfig)
    //custom head style
    $('.slot-thead-' + tableid).css({
        "background-color": headStyleBgColor,
        "font-family": headStylefontName,
        "text-align": "center",
        "color": headStylefontColor,
        "font-size": headStylefontSize + 'px',
        "height": "100%",
        "overflow": "hidden",
        "text-overflow": "clip",
        "white-space": "nowrap",
        "max-height": headRowHeight + "px !important",
        'line-height': headRowHeight + 'px'
    })
}

function tableRecord(slotitem, index, table) {
    var tableid = table['id']
    pagerow[tableid] = [] // set page row array with table id
    pageincrease[tableid] = 1
    checkpage[tableid] = true

    var mediaLocalPath = homedir + '/clessapp/res/'

    $('.slot-table-' + tableid).append('<tbody class="slot-tbody-' + tableid + '"></tbody>')
    $('.slot-table-' + tableid).append('<colgroup class="slot-colgroup-' + tableid + '"></colgroup>')

    // Append <col> with width, and apply other styles to <td>/<th>
    columnStyle.forEach(function (checkres1, vindex) {
        // Append the <col> with width only
        $('.slot-table-' + tableid + ' .slot-colgroup-' + tableid).append('<col class="colgroup-' + checkres1['colid'] + '" style="width:' + checkres1['width'] + 'px;"></col>');
    })

    //start to render table items
    if (slotitem) {
        slotitem.forEach(function (row, xindex) {
            var colRowIndex = xindex
            var colList = row['attributes']
            var objColList = Object.entries(colList)
            $('.slot-tbody-' + tableid).append('<tr> </tr>')
            objColList.forEach(function (col, zindex) {
                zindex++
                $('.slot-table-' + tableid + ' tbody tr:last').append('<td nowrap class="col' + zeroPad(zindex, 2) + '"></td>')
            })
            objColList.forEach(function (col, zindex) {

                var colNumber = col[0]
                // Create unique key for each cell (row + column combination)
                var cellKey = 'row-' + colRowIndex + '-' + colNumber

                colImageCurIndex[cellKey] = 0
                colImageloop[cellKey] = []
                colFaderCurIndex[cellKey] = 0
                colFaderloop[cellKey] = []
                colTextTransitionCurIndex[cellKey] = 0
                colTextTransitionloop[cellKey] = []
                if (colFaderTimeout[cellKey]) { //clear colFaderTimeout to reset
                    clearTimeout(colFaderTimeout[cellKey])
                }
                if (colTextTransitionTimeout[cellKey]) { //clear colTextTransitionTimeout to reset
                    clearTimeout(colTextTransitionTimeout[cellKey])
                }
                if (colImageTimeout[cellKey]) { //clear colImageTimeout to reset
                    clearTimeout(colImageTimeout[cellKey])
                }
                
                // Store per-column settings for this cell
                // Find the column configuration from columnStyle
                var columnIndex = zindex + 1
                var colClass = 'col' + zeroPad(columnIndex, 2)
                var columnConfig = columnStyle.find(function(style) {
                    return style.colid === colClass
                })
                
                if (columnConfig) {
                    // Store fader settings for this cell (fader: format)
                    colFaderSettings[cellKey] = {
                        enabled: columnConfig.faderEnabled === 'Y',
                        switchingTime: columnConfig.faderSwitchingTime ? parseInt(columnConfig.faderSwitchingTime) * 1000 : null,
                        speed: columnConfig.faderSpeed ? parseInt(columnConfig.faderSpeed) : null,
                        delay: columnConfig.faderDelay ? parseInt(columnConfig.faderDelay) : 0
                    }
                    
                    // Store text transition settings for this cell (transition: format)
                    colTextTransitionSettings[cellKey] = {
                        enabled: columnConfig.textTransitionEnabled === 'Y',
                        switchingTime: columnConfig.textTransitionSwitchingTime ? parseInt(columnConfig.textTransitionSwitchingTime) * 1000 : null,
                        speed: columnConfig.textTransitionSpeed ? parseInt(columnConfig.textTransitionSpeed) : null,
                        style: columnConfig.textTransitionStyle || 'scroll-up',
                        delay: columnConfig.textTransitionDelay ? parseInt(columnConfig.textTransitionDelay) : 0
                    }
                    
                    // Store image settings for this cell
                    colImageSettings[cellKey] = {
                        enabled: columnConfig.imageEnabled === 'Y',
                        transition: columnConfig.imageTransition || 'scroll-up',
                        switchingTime: columnConfig.imageSwitchingTime ? parseInt(columnConfig.imageSwitchingTime) * 1000 : null,
                        transitionSpeed: columnConfig.imageTransitionSpeed ? parseInt(columnConfig.imageTransitionSpeed) : null,
                        fillToColumn: columnConfig.fillToColumn === 'Y',
                        delay: columnConfig.imageTransitionDelay ? parseInt(columnConfig.imageTransitionDelay) : 0
                    }
                }
                
                var colFormat = col[1].substring(0, 6)
                if (colFormat == 'image:') {
                    var n = col[1].lastIndexOf(':')
                    var colImageList = col[1].substring(n + 1)
                    colImageList = colImageList.split(',') // split and create array
                    $('.slot-tbody-' + tableid + ' tr:last .' + colNumber).html('<div class="imagecol-' + colRowIndex + '"></div>') //create image td
                    colImageList.forEach(function (ele, resId) { //create foreach to create fading animation
                        var coltext = ele.trim() // trim whitespace instead of removing all spaces
                        if (coltext != '') { // cancel if string empty
                            var contentObj = new Object()
                            contentObj.text = coltext
                            colImageloop[cellKey].push(contentObj)
                        }
                        if (resId === colImageList.length - 1) {
                            // Only start animation if there are multiple images
                            if (colImageloop[cellKey].length > 0) {
                                // Get delay from settings
                                var imageSettings = colImageSettings[cellKey] || {}
                                var imageDelay = imageSettings.delay || 0
                                
                                // Apply delay before first render
                                setTimeout(function() {
                                    appendColumnImage(colImageloop[cellKey][0], cellKey)
                                    // Start cycling if more than one image
                                    if (colImageloop[cellKey].length > 1) {
                                        colImageCurIndex[cellKey] = 1
                                    }
                                }, imageDelay)
                            }
                        }
                    })
                } else if (colFormat == 'fader:') { //create fader animation for this column (original scroll effect)
                    var n = col[1].indexOf(":") // remove first string before : symbol
                    var colTextFaderList = col[1].slice(n + 1) // combine all text when have ,
                    colTextFaderList = colTextFaderList.split(',') // split and create array
                    $('.slot-tbody-' + tableid + ' tr:last .' + col[0]).html('<div class="fadercol-' + colRowIndex + '"></div>') //create td
                    colTextFaderList.forEach(function (ele, resId) { //create foreach to create fading animation
                        var coltext = ele.trim() // trim whitespace instead of removing all spaces
                        if (coltext != '') { // cancel if string empty
                            var contentObj = new Object()
                            contentObj.text = coltext
                            colFaderloop[cellKey].push(contentObj)
                        }
                        if (resId === colTextFaderList.length - 1) {
                            // Only start animation if there are items
                            if (colFaderloop[cellKey].length > 0) {
                                // Get delay from settings
                                var faderSettings = colFaderSettings[cellKey] || {}
                                var faderDelay = faderSettings.delay || 0
                                
                                // Apply delay before first render
                                setTimeout(function() {
                                    appendColumnFader(colFaderloop[cellKey][0], cellKey)
                                    // Start cycling if more than one text item
                                    if (colFaderloop[cellKey].length > 1) {
                                        colFaderCurIndex[cellKey] = 1
                                    }
                                }, faderDelay)
                            }
                        }
                    })
                } else if (col[1].substring(0, 11) == 'transition:') { //create text transition animation for this column (new multi-style effects)
                    var n = col[1].indexOf(":") // remove first string before : symbol
                    var colTextTransitionList = col[1].slice(n + 1) // combine all text when have ,
                    colTextTransitionList = colTextTransitionList.split(',') // split and create array
                    $('.slot-tbody-' + tableid + ' tr:last .' + col[0]).html('<div class="text-transition-col-' + colRowIndex + '"></div>') //create td
                    colTextTransitionList.forEach(function (ele, resId) { //create foreach to create transition animation
                        var coltext = ele.trim() // trim whitespace instead of removing all spaces
                        if (coltext != '') { // cancel if string empty
                            var contentObj = new Object()
                            contentObj.text = coltext
                            colTextTransitionloop[cellKey].push(contentObj)
                        }
                        if (resId === colTextTransitionList.length - 1) {
                            // Only start animation if there are items
                            if (colTextTransitionloop[cellKey].length > 0) {
                                // Get delay from settings
                                var transitionSettings = colTextTransitionSettings[cellKey] || {}
                                var textTransitionDelay = transitionSettings.delay || 0
                                
                                // Apply delay before first render
                                setTimeout(function() {
                                    appendColumnTextTransition(colTextTransitionloop[cellKey][0], cellKey)
                                    // Start cycling if more than one text item
                                    if (colTextTransitionloop[cellKey].length > 1) {
                                        colTextTransitionCurIndex[cellKey] = 1
                                    }
                                }, textTransitionDelay)
                            }
                        }
                    })
                } else {
                    $('.slot-tbody-' + tableid + ' tr:last .' + col[0]).html(col[1])
                }
            })
            //play next column image after current column image has finished
            function changeColImageMedia(cellKey) {
                if (colImageloop[cellKey].length == 1) {
                    colImageCurIndex[cellKey] = 0
                }
                if (colImageCurIndex[cellKey] >= colImageloop[cellKey].length) {
                    // modified this so it would display the first column when looping
                    colImageCurIndex[cellKey] = 0
                }
                // Mark that this column has been rendered before (not first render)
                if (colImageFirstRender[cellKey] === undefined) {
                    colImageFirstRender[cellKey] = true
                }
                appendColumnImage(colImageloop[cellKey][colImageCurIndex[cellKey]], cellKey)
                colImageCurIndex[cellKey]++
            }

            //render every column image slot
            function appendColumnImage(item, cellKey) {
                if (colImageTimeout[cellKey]) { //clear colImageTimeout to reset
                    clearTimeout(colImageTimeout[cellKey])
                }
                
                // Get per-column image settings or use global defaults
                var imageSettings = colImageSettings[cellKey] || {}
                var transitionType = (imageSettings.enabled && imageSettings.transition) 
                    ? imageSettings.transition 
                    : 'scroll-up'
                var transitionSpeed = (imageSettings.enabled && imageSettings.transitionSpeed) 
                    ? imageSettings.transitionSpeed 
                    : (colAnimationDuration[tableid] * 0.75)
                var switchingTime = (imageSettings.enabled && imageSettings.switchingTime) 
                    ? imageSettings.switchingTime 
                    : colAnimationInterval[tableid]
                var fillToColumn = imageSettings.fillToColumn || false
                
                var targetContainer = $('.' + cellKey.split('-')[2] + ' .imagecol-' + colRowIndex)
                var renderEl = ''
                
                if (fs.existsSync(mediaLocalPath + item.text)) {
                    renderEl = '<img src="' + mediaLocalPath + item.text + '">'
                    //file exists
                } else {
                    renderEl = '<img src="" alt="Image not found" style="display:none;">'
                }
                
                // Function to apply vertical alignment and sizing styles
                function applyImageStyles() {
                    //row table height
                    $('.slot-tbody-' + tableid).find('tr').css({
                        "white-space": "nowrap",
                        "overflow": "hidden",
                        "text-overflow": "clip",
                        "height": bodyRowHeight + "px",
                        "max-height": bodyRowHeight + "px",
                        'line-height': bodyRowHeight + 'px'
                    })
                    //fit all elements size inside td
                    $('.slot-tbody-' + tableid).find('td').css({
                        "white-space": "nowrap",
                        "overflow": "hidden",
                        "text-overflow": "clip",
                        "vertical-align": tableStyleVAlign,
                        "height": bodyRowHeight + "px",
                        "max-height": bodyRowHeight + "px"
                    })

                    $('.slot-tbody-' + tableid).find('tr td *').css({
                        "max-height": bodyRowHeight + "px !important",
                        "white-space": "nowrap",
                        "overflow": "hidden",
                        "text-overflow": "clip",
                        "vertical-align": tableStyleVAlign,
                    })

                    // Specifically target images inside the cells
                    $('.imagecol-' + colRowIndex).css({
                        "white-space": "nowrap",
                        "width": "auto",
                        "height": bodyRowHeight + "px",
                        "max-height": bodyRowHeight + "px",
                        "display": "inline-block",
                        "vertical-align": tableStyleVAlign
                    })
                    
                    // Apply image sizing based on fill_to_column setting
                    if (fillToColumn) {
                        // Fill entire column - ignore aspect ratio
                        $('.imagecol-' + colRowIndex + ' img').css({
                            "object-fit": "cover",
                            "width": "100%",
                            "height": bodyRowHeight + "px",
                            "max-height": bodyRowHeight + "px",
                            "vertical-align": tableStyleVAlign
                        })
                    } else {
                        // Constrain to row height, maintain aspect ratio
                        $('.imagecol-' + colRowIndex + ' img').css({
                            "object-fit": "contain",
                            "max-height": bodyRowHeight + "px",
                            "height": "auto",
                            "width": "auto",
                            "vertical-align": tableStyleVAlign
                        })
                    }
                }
                
                // Map transition types to CSS animation classes
                var transitionClassMap = {
                    'fade': { out: 'image-fade-out', in: 'image-fade-in' },
                    'slide-right': { out: 'image-slide-right-out', in: 'image-slide-right-in' },
                    'slide-left': { out: 'image-slide-left-out', in: 'image-slide-left-in' },
                    'scroll-up': { out: 'image-scroll-up-out', in: 'image-scroll-up-in' },
                    'scroll-down': { out: 'image-scroll-down-out', in: 'image-scroll-down-in' }
                }
                
                var transitionClasses = transitionClassMap[transitionType] || transitionClassMap['scroll-up']
                
                // Check if this is NOT the first render and multiple images exist
                // Use firstRender flag instead of index to ensure transitions work when looping from last to first
                var isFirstRender = colImageFirstRender[cellKey] !== true
                if (!isFirstRender && colImageloop[cellKey].length > 1) {
                    // Apply transition animation based on configured type
                    var $oldImage = targetContainer.find('img')
                    if ($oldImage.length > 0) {
                        $oldImage.addClass(transitionClasses.out)
                        $oldImage.css('animation-duration', transitionSpeed + 'ms')
                    }
                    
                    // Wait for transition-out animation to complete, then update content
                    setTimeout(function() {
                        targetContainer.html(renderEl)
                        var $newImage = targetContainer.find('img')
                        $newImage.addClass(transitionClasses.in)
                        $newImage.css('animation-duration', transitionSpeed + 'ms')
                        
                        // Apply image styles after new image is inserted
                        applyImageStyles()
                        
                        // Remove animation class after it completes
                        setTimeout(function() {
                            targetContainer.find('img').removeClass(transitionClasses.in)
                        }, transitionSpeed)
                    }, transitionSpeed)
                } else {
                    // First render - no animation
                    targetContainer.html(renderEl)
                    // Apply image styles after first render
                    applyImageStyles()
                    // Mark this as rendered
                    if (isFirstRender) {
                        colImageFirstRender[cellKey] = true
                    }
                }

                // Only cycle to next if there are multiple images
                if (colImageloop[cellKey].length > 1) {
                    // go to the next column image using per-column or global interval
                    colImageTimeout[cellKey] = setTimeout(function () {
                        changeColImageMedia(cellKey)
                    }, switchingTime)
                }
            }

            //play next column fader after current column fader has finished (original fader: format)
            function changeColTextFader(cellKey) {
                if (colFaderloop[cellKey].length == 1) {
                    colFaderCurIndex[cellKey] = 0
                }
                if (colFaderCurIndex[cellKey] >= colFaderloop[cellKey].length) {
                    // modified this so it would display the first column when looping
                    colFaderCurIndex[cellKey] = 0
                }
                // Mark that this column has been rendered before (not first render)
                if (colFaderFirstRender[cellKey] === undefined) {
                    colFaderFirstRender[cellKey] = true
                }
                appendColumnFader(colFaderloop[cellKey][colFaderCurIndex[cellKey]], cellKey)
                colFaderCurIndex[cellKey]++
            }

            //render every column fader slot (original fader: format with scroll effect)
            function appendColumnFader(item, cellKey) {
                if (colFaderTimeout[cellKey]) { //clear colFaderTimeout to reset
                    clearTimeout(colFaderTimeout[cellKey])
                }
                
                // Get per-column fader settings or use defaults
                var faderSettings = colFaderSettings[cellKey] || {}
                var animationDuration = (faderSettings.enabled && faderSettings.speed) 
                    ? faderSettings.speed 
                    : 4000
                var animationInterval = (faderSettings.enabled && faderSettings.switchingTime) 
                    ? faderSettings.switchingTime 
                    : 25000
                
                var targetContainer = $('.' + cellKey.split('-')[2] + ' .fadercol-' + colRowIndex)
                
                // Check if this is NOT the first render
                var isFirstRender = colFaderFirstRender[cellKey] !== true
                if (!isFirstRender && targetContainer.find('.column-fader').length > 0) {
                    // Animate out the old content with original fader scroll effect
                    var $oldElement = targetContainer.find('.column-fader')
                    $oldElement.addClass('fader-scroll-out')
                    $oldElement.css('animation-duration', (animationDuration * 0.75) + 'ms')
                    
                    // Wait for animation to complete, then update content
                    setTimeout(function() {
                        var renderEl = '<div id="col-' + colRowIndex + '" class="column-fader fader-scroll-in">' + item.text + '</div>'
                        targetContainer.html(renderEl)
                        var $newElement = targetContainer.find('.column-fader')
                        $newElement.css('animation-duration', (animationDuration * 0.75) + 'ms')
                        
                        // Remove animation class after it completes
                        setTimeout(function() {
                            targetContainer.find('.column-fader').removeClass('fader-scroll-in')
                        }, animationDuration * 0.75)
                    }, animationDuration * 0.75)
                } else {
                    // First render - no animation
                    var renderEl = '<div id="col-' + colRowIndex + '" class="column-fader">' + item.text + '</div>'
                    targetContainer.html(renderEl)
                    // Mark this as rendered
                    if (isFirstRender) {
                        colFaderFirstRender[cellKey] = true
                    }
                }

                //row table height
                $('.slot-tbody-' + tableid).find('tr').css({
                    "white-space": "nowrap",
                    "overflow": "hidden !important",
                    "text-overflow": "clip",
                    "height": bodyRowHeight + "px !important",
                    "max-height": bodyRowHeight + "px !important",
                    'line-height': bodyRowHeight + 'px'
                })
                //fit all elements size inside td
                $('.slot-tbody-' + tableid).find('td').css({
                    "white-space": "nowrap",
                    "overflow": "hidden !important",
                    "text-overflow": "clip",
                    "vertical-align": tableStyleVAlign
                })

                $('.slot-tbody-' + tableid).find('tr td *').css({
                    "max-height": bodyRowHeight + "px !important",
                    "white-space": "nowrap",
                    "overflow": "hidden",
                    "text-overflow": "clip",
                    "vertical-align": tableStyleVAlign,
                })

                // Only cycle to next if there are multiple items
                if (colFaderloop[cellKey].length > 1) {
                    // go to the next column fader
                    colFaderTimeout[cellKey] = setTimeout(function () {
                        changeColTextFader(cellKey)
                    }, animationInterval)
                }
            }

            //play next column text transition after current column text transition has finished (new transition: format)
            function changeColTextTransition(cellKey) {
                if (colTextTransitionloop[cellKey].length == 1) {
                    colTextTransitionCurIndex[cellKey] = 0
                }
                if (colTextTransitionCurIndex[cellKey] >= colTextTransitionloop[cellKey].length) {
                    // modified this so it would display the first column when looping
                    colTextTransitionCurIndex[cellKey] = 0
                }
                // Mark that this column has been rendered before (not first render)
                if (colTextTransitionFirstRender[cellKey] === undefined) {
                    colTextTransitionFirstRender[cellKey] = true
                }
                appendColumnTextTransition(colTextTransitionloop[cellKey][colTextTransitionCurIndex[cellKey]], cellKey)
                colTextTransitionCurIndex[cellKey]++
            }

            //render every column text transition slot
            function appendColumnTextTransition(item, cellKey) {
                if (colTextTransitionTimeout[cellKey]) { //clear colTextTransitionTimeout to reset
                    clearTimeout(colTextTransitionTimeout[cellKey])
                }
                
                // Get per-column text transition settings or use defaults
                var transitionSettings = colTextTransitionSettings[cellKey] || {}
                var animationDuration = (transitionSettings.enabled && transitionSettings.speed) 
                    ? transitionSettings.speed 
                    : 4000
                var animationInterval = (transitionSettings.enabled && transitionSettings.switchingTime) 
                    ? transitionSettings.switchingTime 
                    : 25000
                var transitionStyle = (transitionSettings.enabled && transitionSettings.style)
                    ? transitionSettings.style
                    : 'scroll-up'
                
                var targetContainer = $('.' + cellKey.split('-')[2] + ' .text-transition-col-' + colRowIndex)
                
                // Map transition styles to CSS animation classes (similar to image transitions)
                var transitionClassMap = {
                    'fade': { out: 'text-fade-out', in: 'text-fade-in' },
                    'slide-right': { out: 'text-slide-right-out', in: 'text-slide-right-in' },
                    'slide-left': { out: 'text-slide-left-out', in: 'text-slide-left-in' },
                    'scroll-up': { out: 'text-scroll-up-out', in: 'text-scroll-up-in' },
                    'scroll-down': { out: 'text-scroll-down-out', in: 'text-scroll-down-in' }
                }
                
                var transitionClasses = transitionClassMap[transitionStyle] || transitionClassMap['scroll-up']
                
                // Check if this is NOT the first render - use firstRender flag instead of index
                // This ensures transitions work when looping from last to first
                var isFirstRender = colTextTransitionFirstRender[cellKey] !== true
                if (!isFirstRender && targetContainer.find('.column-text-transition').length > 0) {
                    // Animate out the old content with configured duration and style
                    var $oldElement = targetContainer.find('.column-text-transition')
                    $oldElement.addClass(transitionClasses.out)
                    $oldElement.css('animation-duration', (animationDuration * 0.75) + 'ms') // 0.75 for transition-out
                    
                    // Wait for animation to complete, then update content
                    setTimeout(function() {
                        var renderEl = '<div id="col-' + colRowIndex + '" class="column-text-transition ' + transitionClasses.in + '">' + item.text + '</div>'
                        targetContainer.html(renderEl)
                        var $newElement = targetContainer.find('.column-text-transition')
                        $newElement.css('animation-duration', (animationDuration * 0.75) + 'ms') // 0.75 for transition-in
                        
                        // Remove animation class after it completes
                        setTimeout(function() {
                            targetContainer.find('.column-text-transition').removeClass(transitionClasses.in)
                        }, animationDuration * 0.75)
                    }, animationDuration * 0.75)
                } else {
                    // First render - no animation
                    var renderEl = '<div id="col-' + colRowIndex + '" class="column-text-transition">' + item.text + '</div>'
                    targetContainer.html(renderEl)
                    // Mark this as rendered
                    if (isFirstRender) {
                        colTextTransitionFirstRender[cellKey] = true
                    }
                }

                //row table height
                $('.slot-tbody-' + tableid).find('tr').css({
                    "white-space": "nowrap",
                    "overflow": "hidden !important",
                    "text-overflow": "clip",
                    "height": bodyRowHeight + "px !important",
                    "max-height": bodyRowHeight + "px !important",
                    'line-height': bodyRowHeight + 'px'
                })
                //fit all elements size inside td
                $('.slot-tbody-' + tableid).find('td').css({
                    "white-space": "nowrap",
                    "overflow": "hidden !important",
                    "text-overflow": "clip",
                    "vertical-align": tableStyleVAlign
                })

                $('.slot-tbody-' + tableid).find('tr td *').css({
                    "max-height": bodyRowHeight + "px !important",
                    "white-space": "nowrap",
                    "overflow": "hidden",
                    "text-overflow": "clip",
                    "vertical-align": tableStyleVAlign,
                })

                // Only cycle to next if there are multiple items
                if (colTextTransitionloop[cellKey].length > 1) {
                    // go to the next column text transition using per-column or global interval
                    colTextTransitionTimeout[cellKey] = setTimeout(function () {
                        changeColTextTransition(cellKey)
                    }, animationInterval)
                }
            }

            // Append <col> with width, and apply other styles to <td> in tbody only
            columnStyle.forEach(function (checkres1, vindex) {
                // Apply the styles to the corresponding <td> in tbody (not header <th>)
                var columnCellStyles = {
                    'text-align': checkres1['textalign'],
                    "border-radius": checkres1['trradius'] + "px " + checkres1['tlradius'] + "px " + checkres1['blradius'] + "px " + checkres1['brradius'] + "px",
                    'height': bodyRowHeight + "px",
                    'max-height': bodyRowHeight + "px",
                    'line-height': bodyRowHeight + "px"
                }
                
                // Apply column background color if enabled (only to tbody cells)
                if (checkres1['bgColorEnabled'] === 'Y' && checkres1['bgColor']) {
                    columnCellStyles['background-color'] = checkres1['bgColor']
                }
                
                // Apply styles only to tbody cells, not header cells
                $('.slot-tbody-' + tableid + ' .' + checkres1['colid']).css(columnCellStyles);
            });
        })
    }

    //set style of row odd/even color and row height
    $('.slot-tbody-' + tableid).find('tr:odd').css('background-color', headRowOddColor)
    $('.slot-tbody-' + tableid).find('tr:even').css('background-color', headRowEvenColor)

    // Apply row and element styles
    applyTableRowStyles(tableid)

    //store all data to pagerow object
    $('.slot-tbody-' + tableid).find('tr').each(function (i, row) {
        return pagerow[tableid].push(row)
    })

    if (pagerow[tableid].length != 0) {
        // Use configured table height for maxrows calculation
        var configuredHeight = parseInt(table['height']) || parseInt($('#slot-' + tableid).height());
        var maxrows = configuredHeight - parseInt(headRowHeight);
        maxrows = maxrows / parseInt($('.slot-tbody-' + tableid).find('tr').css('line-height'));
        maxrows = Math.floor(maxrows);
        var pagination = $('#pagination-' + tableid);
        var totalRows = pagerow[tableid].length;  // Total number of rows
        var pageSize = parseInt(maxrows);
        var flipMode = tableFlipMode[tableid] || 1

        // Hide pagination display if hidepagination = 'Y'
        if (tableHidePagination[tableid] === 'Y') {
            $('#slot-' + tableid).find('.pagination-pages').hide()
        }

        // Always use pagination even for single page (to show 1/1)
        // Check flip mode
        if (flipMode === 2) {
            // Line type mode - scroll line by line
            implementLineTypeMode(tableid, pagerow[tableid], pageSize)
        } else {
            // Pagination mode (default)
            implementPaginationMode(tableid, pagination, pagerow[tableid], pageSize)
        }
    }
}

/**
 * Apply row height and element styling to table body
 * This function ensures consistent row heights and element sizing
 * Called after initial render and after pagination content changes
 * @param {string} tableid - The ID of the table to style
 */
function applyTableRowStyles(tableid) {
    var wrapStyle = tableWrap[tableid] === 'Y' ? 'normal' : 'nowrap'
    var textOverflow = tableWrap[tableid] === 'Y' ? 'ellipsis' : 'clip'
    
    //row table height
    $('.slot-tbody-' + tableid).find('tr').css({
        "white-space": wrapStyle,
        "overflow": "hidden",
        "text-overflow": textOverflow,
        "height": bodyRowHeight + "px",
        "max-height": bodyRowHeight + "px",
        'line-height': bodyRowHeight + 'px'
    })
    
    //fit all elements size inside td
    $('.slot-tbody-' + tableid).find('td').css({
        "white-space": wrapStyle,
        "overflow": "hidden",
        "text-overflow": textOverflow,
        "vertical-align": tableStyleVAlign,
        "height": bodyRowHeight + "px",
        "max-height": bodyRowHeight + "px"
    })

    $('.slot-tbody-' + tableid).find('tr td *').css({
        "max-height": bodyRowHeight + "px !important",
        "white-space": wrapStyle,
        "overflow": "hidden",
        "text-overflow": textOverflow,
        "vertical-align": tableStyleVAlign,
    })
}

/**
 * Implement pagination mode (flipmode = 1) - flip page by page
 */
function implementPaginationMode(tableid, pagination, pageData, pageSize) {
    // Get transition settings
    var transitionType = tableTransition[tableid] || 'none'
    var transitionDuration = 500 // milliseconds for transition animation
    
    pagination.pagination({
        dataSource: pageData,
        pageSize: pageSize,
        showPageNumbers: false,
        showNavigator: false,
        showPrevious: false,
        showNext: false,
        callback: function (data, pagi) {
            applyPageTransition(tableid, data, transitionType, transitionDuration)
        }
    });

    // Change page element if got update
    if (checkpage[tableid] == true) {
        checkpage[tableid] = false;
        pagination.pagination('go', 1);
        $('#slot-' + tableid).find('.pagination-pages').html('<div>Page ' + pageincrease[tableid] + '/' + pagination.pagination('getTotalPage') + '</div>');
    } else {
        $('#slot-' + tableid).find('.pagination-pages').html('<div>Page ' + pageincrease[tableid] + '/' + pagination.pagination('getTotalPage') + '</div>');
        pagination.pagination('go', pageincrease[tableid]);
    }

    // Auto page flip
    pageAutoInterval[tableid] = setInterval(function () {
        pageincrease[tableid] += 1;
        var totalpage = pagination.pagination('getTotalPage') || 1;
        if (pageincrease[tableid] > totalpage) {
            pageincrease[tableid] = 1;
            pagination.pagination('go', 1);
        } else {
            pagination.pagination('next');
        }

        // Refresh page
        $('#slot-' + tableid).find('.pagination-pages').html('<div>Page ' + pageincrease[tableid] + '/' + pagination.pagination('getTotalPage') + '</div>');
    }, pageLengthTime[tableid]);
}

/**
 * Implement line type mode (flipmode = 2) - scroll line by line
 */
function implementLineTypeMode(tableid, pageData, pageSize) {
    var currentStartIndex = 0
    var totalRows = pageData.length
    
    // Initial render - show first page
    var initialData = pageData.slice(0, pageSize)
    $('.slot-tbody-' + tableid).html(initialData)
    
    // Update pagination display
    var totalPages = Math.ceil(totalRows / pageSize)
    var currentPage = 1
    $('#slot-' + tableid).find('.pagination-pages').html('<div>Page ' + currentPage + '/' + totalPages + '</div>')
    
    // Auto scroll line by line
    pageAutoInterval[tableid] = setInterval(function () {
        currentStartIndex += 1
        
        // Loop back to beginning when reaching the end
        if (currentStartIndex + pageSize > totalRows) {
            currentStartIndex = 0
        }
        
        // Get current window of rows
        var currentData = pageData.slice(currentStartIndex, currentStartIndex + pageSize)
        
        // Calculate current page for display
        currentPage = Math.floor(currentStartIndex / pageSize) + 1
        
        // Apply transition
        var transitionType = tableTransition[tableid] || 'scroll-up'
        applyPageTransition(tableid, currentData, transitionType, 500)
        
        // Update pagination display
        $('#slot-' + tableid).find('.pagination-pages').html('<div>Line ' + (currentStartIndex + 1) + '-' + Math.min(currentStartIndex + pageSize, totalRows) + '/' + totalRows + '</div>')
    }, pageLengthTime[tableid])
}

/**
 * Apply transition animation when changing table pages
 * @param {string} tableid - The table ID
 * @param {Array} data - The new page data to display
 * @param {string} transitionType - Type of transition (none, fade, slide-right, slide-left, scroll-up, scroll-down)
 * @param {number} duration - Duration of transition in milliseconds
 */
function applyPageTransition(tableid, data, transitionType, duration) {
    var tbody = $('.slot-tbody-' + tableid)
    
    if (transitionType === 'none' || !tbody.children().length) {
        // No transition or first render - instant change
        // Use hidden state to apply styles before showing content
        tbody.css('visibility', 'hidden')
        tbody.html(data)
        applyTableRowStyles(tableid)
        // Force reflow to ensure styles are applied
        tbody[0].offsetHeight
        tbody.css('visibility', 'visible')
        return
    }
    
    // Map transition types to CSS classes
    var transitionMap = {
        'fade': { out: 'table-fade-out', in: 'table-fade-in' },
        'slide-right': { out: 'table-slide-right-out', in: 'table-slide-right-in' },
        'slide-left': { out: 'table-slide-left-out', in: 'table-slide-left-in' },
        'scroll-up': { out: 'table-scroll-up-out', in: 'table-scroll-up-in' },
        'scroll-down': { out: 'table-scroll-down-out', in: 'table-scroll-down-in' }
    }
    
    var classes = transitionMap[transitionType]
    if (!classes) {
        // Invalid transition type - fallback to instant with proper styling
        tbody.css('visibility', 'hidden')
        tbody.html(data)
        applyTableRowStyles(tableid)
        tbody[0].offsetHeight
        tbody.css('visibility', 'visible')
        return
    }
    
    // Apply out transition
    tbody.addClass(classes.out)
    
    // After out animation completes, update content and apply in transition
    setTimeout(function() {
        tbody.removeClass(classes.out)
        
        // Hide tbody to prevent flickering while applying styles
        tbody.css('visibility', 'hidden')
        tbody.html(data)
        
        // Apply styles before making content visible
        applyTableRowStyles(tableid)
        
        // Force reflow to ensure all styles are applied before transition
        tbody[0].offsetHeight
        
        // Make visible and start in transition
        tbody.css('visibility', 'visible')
        tbody.addClass(classes.in)
        
        // Remove in transition class after animation completes
        setTimeout(function() {
            tbody.removeClass(classes.in)
        }, duration)
    }, duration)
}