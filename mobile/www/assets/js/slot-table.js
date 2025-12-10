var zeroPad = (num, places) => String(num).padStart(places, '0')
var columnStyle = []

//head row
var headRowEvenColor
var headRowOddColor
var headRowHeight
var bodyRowHeight
var tableStyleVAlign

var pagerow = []
var pageAutoInterval = []
var pageLengthTime = []
var pageincrease = []
var checkpage = []

function tableFunc(slotitem, index, slotattr) {
    columnStyle = []
    //create table
    var tableid = slotattr['id']
    pageLengthTime[tableid] = parseInt(slotattr['pageflip']) * 1000
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
    $('.slot-table-' + tableid).css({
        "background-color": tableStyleBgColor,
        "font-family": tableStylefontName,
        "color": tableStylefontColor,
        "font-size": tableStylefontSize + 'px',
        "padding": "0",
        "overflow": "hidden",
        "table-layout": "fixed",
        "border-collapse": "collapse",
        "border-spacing": tableStyleSpacing + 'px',
        "width": tableStyleWidth + 'px',
    })

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

    //head column
    // Defensive check: Ensure slotitem[1] and its elements exist
    if (!slotitem[1] || !slotitem[1]['elements'] || !Array.isArray(slotitem[1]['elements'])) {
        console.error('[tableFunc] Invalid slotitem[1] structure for table:', tableid);
        console.error('[tableFunc] slotitem[1]:', slotitem[1]);
        return;
    }
    
    slotitem[1]['elements'].forEach(function (column, cindex) {
        // Defensive check: Validate column structure
        if (!column) {
            console.warn('[tableFunc] Column is undefined at index:', cindex, 'for table:', tableid);
            return; // Skip this column
        }
        
        if (!column['attributes']) {
            console.warn('[tableFunc] Missing attributes in column at index:', cindex, 'for table:', tableid);
            column['attributes'] = {}; // Default empty attributes
        }
        
        // Extract column text - handle both direct text property and nested elements[0].text
        var columnText = '';
        if (column['text']) {
            // Text directly on the column item (new mobile XML parser behavior)
            columnText = column['text'];
        } else if (column['elements'] && column['elements'][0] && column['elements'][0]['text']) {
            // Text nested in elements[0] (legacy behavior or different XML structure)
            columnText = column['elements'][0]['text'];
        } else {
            console.warn('[tableFunc] Missing text in column at index:', cindex, 'for table:', tableid);
            columnText = ''; // Use empty string as fallback
        }
        
        var columnIndex = cindex + 1
        var columnAlign = column['attributes']['align'] || 'c' // Default to center
        var columnWidth = column['attributes']['width'] || 100 // Default width
        var cellTopRightRadius = column['attributes']['tlradius'] || 0
        var cellTopLeftRadius = column['attributes']['trradius'] || 0
        var cellBottomRightRadius = column['attributes']['blradius'] || 0
        var cellBottomLeftRadius = column['attributes']['brradius'] || 0
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
        columnStyle.push(colSytleObj)
        if (cindex == slotitem[1]['elements'].length - 1) {

        }
        $('.col' + zeroPad(columnIndex, 2)).css({
            'text-align': columnAlign,
            "border-radius": cellTopRightRadius + "px " + cellTopLeftRadius + "px " + cellBottomLeftRadius + "px " + cellBottomRightRadius + "px",
            'width': columnWidth + "px",
            'height': bodyRowHeight + "px",
        })
    })
}

//Image column global settings
var colImageTimeout = new Array()
var colImageCurIndex = new Array()
var colImageloop = new Array()
//Fader column global settings
var colFaderTimeout = new Array()
var colFaderCurIndex = new Array()
var colFaderloop = new Array()

//table record
function tableNorecords(slotitem, slotid, slotattr) {
    //create table
    var tableid = slotattr['id']
    pageLengthTime[tableid] = 9999 * 1000
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

    //custom table element
    $('.slot-table-' + tableid).css({
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
        "width": tableStyleWidth + 'px',
    })
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

                colImageCurIndex[colNumber] = 0
                colImageloop[colNumber] = []
                colFaderCurIndex[colNumber] = 0
                colFaderloop[colNumber] = []
                if (colFaderTimeout[colNumber]) { //clear colFaderTimeout to reset
                    clearTimeout(colFaderTimeout[colNumber])
                }
                if (colImageTimeout[colNumber]) { //clear colFaderTimeout to reset
                    clearTimeout(colImageTimeout[colNumber])
                }
                var colFormat = col[1].substring(0, 6)
                if (colFormat == 'image:') {
                    var n = col[1].lastIndexOf(':')
                    var colImageList = col[1].substring(n + 1)
                    colImageList = colImageList.split(',') // split and create array
                    $('.slot-tbody-' + tableid + ' tr:last .' + colNumber).html('<div class="imagecol-' + colRowIndex + '"></div>') //create image td
                    colImageList.forEach(function (ele, resId) { //create foreach to create fading animation
                        var coltext = ele.replace(/ /g, '') // delete any space
                        if (coltext != '') { // cancel if string empty
                            var contentObj = new Object()
                            contentObj.text = coltext
                            colImageloop[colNumber].push(contentObj)
                        }
                        if (resId === colImageList.length - 1) {
                            appendColumnImage(colImageloop[colNumber][0], colNumber)
                        }
                    })
                } else if (colFormat == 'fader:') { //create fader animation for this column
                    var n = col[1].indexOf(":") // remove first string before : symbol
                    var colTextFaderList = col[1].slice(n + 1) // combine all text when have ,
                    colTextFaderList = colTextFaderList.split(',') // split and create array
                    $('.slot-tbody-' + tableid + ' tr:last .' + col[0]).html('<div class="fadercol-' + colRowIndex + '"></div>') //create td
                    colTextFaderList.forEach(function (ele, resId) { //create foreach to create fading animation
                        var coltext = ele.replace(/ /g, '') // delete any space
                        if (coltext != '') { // cancel if string empty
                            var contentObj = new Object()
                            contentObj.text = coltext
                            colFaderloop[colNumber].push(contentObj)
                        }
                        if (resId === colTextFaderList.length - 1) {
                            appendColumnFader(colFaderloop[colNumber][0], colNumber)
                        }
                    })
                } else {
                    $('.slot-tbody-' + tableid + ' tr:last .' + col[0]).html(col[1])
                }
            })
            //play next column image after current column image has finished
            function changeColImageMedia(colNumber) {
                if (colImageloop[colNumber].length == 1) {
                    colImageCurIndex[colNumber] = 0
                }
                if (colImageCurIndex[colNumber] >= colImageloop[colNumber].length) {
                    // modified this so it would display the first column when looping
                    colImageCurIndex[colNumber] = 0
                }
                appendColumnImage(colImageloop[colNumber][colImageCurIndex[colNumber]], colNumber)
                colImageCurIndex[colNumber]++
            }

            //render every column fader slot
            function appendColumnImage(item, colNumber) {
                if (colImageTimeout[colNumber]) { //clear colImageTimeout to reset
                    clearTimeout(colImageTimeout[colNumber])
                }
                if (fs.existsSync(mediaLocalPath + item.text)) {
                    var renderEl = '<img src="' + mediaLocalPath + item.text + '">'
                    //file exists
                } else {
                    var renderEl = ''
                }
                $('.' + colNumber + ' .imagecol-' + colRowIndex).html(renderEl)

                //row table height
                $('.slot-tbody-' + tableid).find('tr').css({
                    "white-space": "nowrap",
                    "overflow": "hidden !important",
                    "text-overflow": "clip",
                    "height": "100%",
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

                // Specifically target images inside the cells
                $('.imagecol-' + colRowIndex).css({
                    "white-space": "nowrap",
                    "width": "auto",
                    "height": "auto",
                })

                // go to the next column fader after 20 seconds
                colImageTimeout[colNumber] = setTimeout(function () {
                    changeColImageMedia(colNumber)
                }, 20000)
            }

            //play next column fader after current column fader has finished
            function changeColTextFader(colNumber) {
                if (colFaderloop[colNumber].length == 1) {
                    colFaderCurIndex[colNumber] = 0
                }
                if (colFaderCurIndex[colNumber] >= colFaderloop[colNumber].length) {
                    // modified this so it would display the first column when looping
                    colFaderCurIndex[colNumber] = 0
                }
                appendColumnFader(colFaderloop[colNumber][colFaderCurIndex[colNumber]], colNumber)
                colFaderCurIndex[colNumber]++
            }

            //render every column fader slot
            function appendColumnFader(item, colNumber) {
                if (colFaderTimeout[colNumber]) { //clear colFaderTimeout to reset
                    clearTimeout(colFaderTimeout[colNumber])
                }
                var renderEl = '<div id="col-' + colRowIndex + '" class="column-fader">' + item.text + '</div>'
                $('.' + colNumber + ' .fadercol-' + colRowIndex).html(renderEl)

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

                if (colFaderCurIndex[colNumber] >= 1) $('.' + colNumber + ' .fadercol-' + colRowIndex + ' #col-' + colRowIndex).fadeIn(500).fadeOut(500).fadeIn(1500)

                // go to the next column fader after 20 seconds
                colFaderTimeout[colNumber] = setTimeout(function () {
                    changeColTextFader(colNumber)
                }, 20000)
            }

            // Append <col> with width, and apply other styles to <td>/<th>
            columnStyle.forEach(function (checkres1, vindex) {
                // Apply the styles to the corresponding <td> or <th>
                $(' .' + checkres1['colid']).css({
                    'text-align': checkres1['textalign'],
                    "border-radius": checkres1['trradius'] + "px " + checkres1['tlradius'] + "px " + checkres1['blradius'] + "px " + checkres1['brradius'] + "px",
                    'height': bodyRowHeight + "px",
                });
            });
        })
    }

    //set style of row odd/even color and row height
    $('.slot-tbody-' + tableid).find('tr:odd').css('background-color', headRowOddColor)
    $('.slot-tbody-' + tableid).find('tr:even').css('background-color', headRowEvenColor)

    //row table height
    $('.slot-tbody-' + tableid).find('tr').css({
        "white-space": "nowrap",
        "overflow": "hidden !important",
        "text-overflow": "clip",
        "height": "100%",
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

    //store all data to pagerow object
    $('.slot-tbody-' + tableid).find('tr').each(function (i, row) {
        return pagerow[tableid].push(row)
    })

    if (pagerow[tableid].length != 0) {
        var maxrows = parseInt($('#slot-' + tableid).height()) - parseInt(headRowHeight);
        maxrows = maxrows / parseInt($('.slot-tbody-' + tableid).find('tr').css('line-height'));
        maxrows = maxrows - 1;
        var pagination = $('#pagination-' + tableid);
        var totalRows = pagerow[tableid].length;  // Total number of rows
        var pageSize = parseInt(maxrows);

        // Check if there's only one page of data
        if (totalRows <= pageSize) {
            pagination.hide();  // Hide pagination if only 1 page
            $('#slot-' + tableid).find('.pagination-pages').hide()
            $('#pagination-' + tableid).hide()
            $('.slot-tbody-' + tableid).html(pagerow[tableid]);  // Render the data without pagination
        } else {
            pagination.pagination({
                dataSource: pagerow[tableid],
                pageSize: pageSize,
                showPageNumbers: false,
                showNavigator: false,
                showPrevious: false,
                showNext: false,
                callback: function (data, pagi) {
                    $('.slot-tbody-' + tableid).html(data);
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
    }
}