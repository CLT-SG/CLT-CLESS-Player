var zeroPad = (num, places) => String(num).padStart(places, '0')
var columnStyle = []

/**
 * Check if a URL is external (http/https)
 * @param {string} url - The URL to check
 * @returns {boolean} True if external URL
 */
function isExternalMediaUrl(url) {
    return url && (url.startsWith('http://') || url.startsWith('https://'));
}

//head row
var headRowEvenColor
var headRowOddColor
var headRowHeight
var bodyRowHeight
var tableStyleVAlign

var pagerow = {} // CRITICAL: Must be object, not array, to support associative indexing by table ID
var pageAutoInterval = []
var pageLengthTime = []
var pageincrease = []
var checkpage = []
var tableRendering = [] // Track if table is currently rendering to prevent duplicates

/**
 * Cleanup function to properly destroy table state before recreation
 * @param {string} tableid - The ID of the table to clean up
 */
function cleanupTableState(tableid) {
    console.log('[cleanupTableState] Cleaning up table:', tableid);

    // DO NOT reset rendering guard flag here - it's managed by tableRecord's try-finally
    // tableRendering[tableid] = false;  // REMOVED - was causing duplicate renders!

    // Clear page auto-flip interval
    if (pageAutoInterval[tableid]) {
        console.log('[cleanupTableState] Clearing pageAutoInterval for table:', tableid);
        clearInterval(pageAutoInterval[tableid]);
        pageAutoInterval[tableid] = null;
    }

    // Clear ALL column image timeouts (now using composite keys)
    Object.keys(colImageTimeout).forEach(key => {
        if (key.includes('-') && colImageTimeout[key]) {
            clearTimeout(colImageTimeout[key]);
            delete colImageTimeout[key];
        }
    });

    // Clear ALL column fader timeouts (now using composite keys)
    Object.keys(colFaderTimeout).forEach(key => {
        if (key.includes('-') && colFaderTimeout[key]) {
            clearTimeout(colFaderTimeout[key]);
            delete colFaderTimeout[key];
        }
    });

    // DO NOT reset pagerow here - it will be reset by tableRecord
    // pagerow[tableid] = [];  // REMOVED - let tableRecord handle this

    // Reset pagination state
    pageincrease[tableid] = 1;
    checkpage[tableid] = true;

    // Destroy pagination plugin instance if exists
    var paginationEl = $('#pagination-' + tableid);
    if (paginationEl.length > 0 && paginationEl.data('pagination')) {
        console.log('[cleanupTableState] Destroying pagination instance');
        try {
            paginationEl.pagination('destroy');
            paginationEl.empty();
        } catch (e) {
            console.warn('[cleanupTableState] Error destroying pagination:', e);
        }
    }

    // CRITICAL: Completely remove tbody and colgroup DOM elements
    $('.slot-tbody-' + tableid).remove();
    $('.slot-colgroup-' + tableid).remove();

    console.log('[cleanupTableState] Cleanup completed for table:', tableid);
}

function tableFunc(slotitem, index, slotattr) {
    columnStyle = []
    //create table
    var tableid = slotattr['id']
    console.log('[tableFunc] Initializing table slot:', tableid, 'at index:', index);
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

    console.log('[tableFunc] Table config - pageflip:', pageLengthTime[tableid], 'ms, bodyRowHeight:', bodyRowHeight, 'px');

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
            console.error('[tableFunc] Invalid column at index', cindex);
            return;
        }

        if (!column['attributes']) {
            console.error('[tableFunc] Missing attributes for column at index', cindex);
            return;
        }

        // Extract column text - handle both direct text property and nested elements[0].text
        var columnText = '';
        if (column['text']) {
            columnText = column['text'];
        } else if (column['elements'] && column['elements'][0] && column['elements'][0]['text']) {
            columnText = column['elements'][0]['text'];
        } else {
            console.warn('[tableFunc] No text found for column at index', cindex);
        }

        var columnIndex = cindex + 1
        var columnAlign = column['attributes']['align']
        var columnWidth = column['attributes']['width'] || 100
        var cellTopRightRadius = column['attributes']['tlradius'] || 0
        var cellTopLeftRadius = column['attributes']['trradius'] || 0
        var cellBottomRightRadius = column['attributes']['blradius'] || 0
        var cellBottomLeftRadius = column['attributes']['brradius'] || 0
        
        // New column-level settings
        var bgColorEnabled = column['attributes']['bgcolor_enabled'] || 'N'
        var bgColor = column['attributes']['bgcolor'] || ''
        var faderEnabled = column['attributes']['fader_enabled'] || 'N'
        var faderSwitchingTime = column['attributes']['fader_switching_time'] || null
        var faderSpeed = column['attributes']['fader_speed'] || null
        var imageEnabled = column['attributes']['image_enabled'] || 'N'
        var imageTransition = column['attributes']['image_transition'] || 'scroll-up'
        var imageSwitchingTime = column['attributes']['image_switching_time'] || null
        var transitionSpeed = column['attributes']['transition_speed'] || null
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
        colSytleObj.imageEnabled = imageEnabled
        colSytleObj.imageTransition = imageTransition
        colSytleObj.imageSwitchingTime = imageSwitchingTime
        colSytleObj.transitionSpeed = transitionSpeed
        colSytleObj.fillToColumn = fillToColumn
        columnStyle.push(colSytleObj)
        if (cindex == slotitem[1]['elements'].length - 1) {

        }
        // Apply header column styles (NO bgcolor - header uses headStyleBgColor)
        $('.slot-thead-' + tableid + ' .col' + zeroPad(columnIndex, 2)).css({
            'text-align': columnAlign,
            "border-radius": cellTopLeftRadius + "px " + cellTopRightRadius + "px " + cellBottomRightRadius + "px " + cellBottomLeftRadius + "px",
            'width': columnWidth + "px",
            'height': bodyRowHeight + "px",
        })
        
        // Apply column background color if enabled
        if (bgColorEnabled === 'Y' && bgColor) {
            $('.col' + zeroPad(columnIndex, 2)).css({
                'background-color': bgColor
            })
        }
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
// Per-column fader settings
var colFaderSettings = new Array()
// Per-column image settings
var colImageSettings = new Array()

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

async function tableRecord(slotitem, index, table) {
    var tableid = table['id']

    // GUARD: Prevent concurrent rendering of same table
    if (tableRendering[tableid]) {
        console.warn('[tableRecord] ⚠️ Table', tableid, 'is already rendering, skipping duplicate call to prevent duplicate rows');
        return;
    }

    console.log('[tableRecord] Setting rendering guard for table:', tableid);
    tableRendering[tableid] = true;

    try {
        // CRITICAL: Clean up AFTER passing guard check to avoid interfering with concurrent renders
        cleanupTableState(tableid);

        // Initialize page row array and pagination state
        pagerow[tableid] = []
        pageincrease[tableid] = 1
        checkpage[tableid] = true

        console.log('[tableRecord] ✓ Initialized pagerow[' + tableid + '] as empty array');
        
        // Mobile app - ensure media manager is initialized
        if (window.mediaManager && !window.mediaManager.initialized) {
            console.log('[tableRecord] Initializing media manager...');
            await window.mediaManager.initialize().catch(err => {
                console.error('[tableRecord] Media manager initialization failed:', err);
            });
        }
        console.log('[tableRecord] Using mobile media manager for table:', tableid);

        // VALIDATION: Check for empty or invalid data
        if (!slotitem || !Array.isArray(slotitem) || slotitem.length === 0) {
            console.error('[tableRecord] Invalid or empty slotitem data for table:', tableid);
            return;
        }

        // VALIDATION: Detect potential duplicate data in source
        const seenRowSignatures = new Set();
        let duplicateDetected = false;
        slotitem.forEach((row, idx) => {
            const signature = JSON.stringify(row);
            if (seenRowSignatures.has(signature)) {
                console.warn('[tableRecord] ⚠️ Duplicate row detected at index', idx);
                duplicateDetected = true;
            }
            seenRowSignatures.add(signature);
        });
        if (duplicateDetected) {
            console.warn('[tableRecord] Source data contains duplicates - proceeding with caution');
        }

        console.log('[tableRecord] Rendering table records for table:', tableid, 'with', slotitem.length, 'unique rows');
        // Clear any existing tbody and colgroup before appending new ones
        $('.slot-tbody-' + tableid).remove();
        $('.slot-colgroup-' + tableid).remove();

        // Verify removal was successful
        if ($('.slot-tbody-' + tableid).length > 0) {
            console.error('[tableRecord] ❌ Failed to remove existing tbody - DOM manipulation blocked');
            return;
        }

        $('.slot-table-' + tableid).append('<tbody class="slot-tbody-' + tableid + '"></tbody>')
        $('.slot-table-' + tableid).append('<colgroup class="slot-colgroup-' + tableid + '"></colgroup>')

        // Verify tbody is truly empty before rendering
        const tbodyRowCount = $('.slot-tbody-' + tableid).find('tr').length;
        if (tbodyRowCount > 0) {
            console.error('[tableRecord] ❌ tbody already contains', tbodyRowCount, 'rows - aborting to prevent duplicates');
            return;
        }
        console.log('[tableRecord] tbody initialized - confirmed empty, ready for', slotitem.length, 'rows');

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
                if (colFaderTimeout[cellKey]) { //clear colFaderTimeout to reset
                    clearTimeout(colFaderTimeout[cellKey])
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
                    // Store fader settings for this cell
                    colFaderSettings[cellKey] = {
                        enabled: columnConfig.faderEnabled === 'Y',
                        switchingTime: columnConfig.faderSwitchingTime ? parseInt(columnConfig.faderSwitchingTime) * 1000 : null,
                        speed: columnConfig.faderSpeed ? parseInt(columnConfig.faderSpeed) : null
                    }
                    
                    // Store image settings for this cell
                    colImageSettings[cellKey] = {
                        enabled: columnConfig.imageEnabled === 'Y',
                        transition: columnConfig.imageTransition || 'scroll-up',
                        switchingTime: columnConfig.imageSwitchingTime ? parseInt(columnConfig.imageSwitchingTime) * 1000 : null,
                        transitionSpeed: columnConfig.transitionSpeed ? parseInt(columnConfig.transitionSpeed) : null,
                        fillToColumn: columnConfig.fillToColumn === 'Y'
                    }
                }
                
                var colFormat = col[1].substring(0, 6)
                if (colFormat == 'image:') {
                    var n = col[1].lastIndexOf(':')
                    var colImageList = col[1].substring(n + 1)
                    colImageList = colImageList.split(',') // split and create array
                    $('.slot-tbody-' + tableid + ' tr:last .' + colNumber).html('<div class="imagecol-' + colRowIndex + '"></div>') //create image td
                    
                    // MOBILE: Preload images using media manager if available
                    var imagesToPreload = []
                    
                    colImageList.forEach(function (ele, resId) { //create foreach to create fading animation
                        var coltext = ele.trim() // trim whitespace instead of removing all spaces
                        if (coltext != '') { // cancel if string empty
                            var contentObj = new Object()
                            contentObj.text = coltext
                            contentObj.isExternal = isExternalMediaUrl(coltext)
                            colImageloop[cellKey].push(contentObj)
                            
                            // Queue for preloading if not external
                            if (!contentObj.isExternal && window.mediaManager) {
                                imagesToPreload.push({
                                    filename: coltext,
                                    type: 'image',
                                    slot: 'table-' + tableid
                                })
                            }
                        }
                        if (resId === colImageList.length - 1) {
                            // Preload batch if available
                            if (imagesToPreload.length > 0 && window.mediaManager) {
                                console.log('[tableRecord] Preloading', imagesToPreload.length, 'images for cell:', cellKey);
                                window.mediaManager.preloadMediaBatch(imagesToPreload).catch(err => {
                                    console.error('[tableRecord] Image preload failed for cell:', cellKey, err);
                                });
                            }
                            
                            // Only start animation if there are multiple images
                            if (colImageloop[cellKey].length > 0) {
                                appendColumnImage(colImageloop[cellKey][0], cellKey)
                                // Start cycling if more than one image
                                if (colImageloop[cellKey].length > 1) {
                                    colImageCurIndex[cellKey] = 1
                                }
                            }
                        }
                    })
                } else if (colFormat == 'fader:') { //create fader animation for this column
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
                                appendColumnFader(colFaderloop[cellKey][0], cellKey)
                                // Start cycling if more than one text item
                                if (colFaderloop[cellKey].length > 1) {
                                    colFaderCurIndex[cellKey] = 1
                                }
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
                appendColumnImage(colImageloop[cellKey][colImageCurIndex[cellKey]], cellKey)
                colImageCurIndex[cellKey]++
            }

            //render every column image slot
            function appendColumnImage(item, cellKey) {
                if (colImageTimeout[cellKey]) { //clear colImageTimeout to reset
                    clearTimeout(colImageTimeout[cellKey])
                }
                
                // Get per-column image settings or use defaults
                var imageSettings = colImageSettings[cellKey] || {}
                var transitionType = (imageSettings.enabled && imageSettings.transition) 
                    ? imageSettings.transition 
                    : 'scroll-up'
                var transitionSpeed = (imageSettings.enabled && imageSettings.transitionSpeed) 
                    ? imageSettings.transitionSpeed 
                    : 800
                var switchingTime = (imageSettings.enabled && imageSettings.switchingTime) 
                    ? imageSettings.switchingTime 
                    : 10000
                var fillToColumn = imageSettings.fillToColumn || false
                
                var targetContainer = $('.' + cellKey.split('-')[2] + ' .imagecol-' + colRowIndex)
                var mediaFileName = item.text
                
                // MOBILE: Check if URL is external or use media manager
                const isExternalUrl = isExternalMediaUrl(mediaFileName);
                var renderEl = ''
                
                if (isExternalUrl) {
                    // External URL - use directly
                    console.log('[appendColumnImage] Using external URL:', mediaFileName);
                    renderEl = '<img src="' + mediaFileName + '">'
                } else if (window.mediaManager) {
                    // Mobile app - use media manager to get local path
                    const localPath = window.mediaManager.getMediaPath(mediaFileName);
                    if (localPath) {
                        console.log('[appendColumnImage] Using local media:', localPath);
                        renderEl = '<img src="' + localPath + '">'
                    } else {
                        console.warn('[appendColumnImage] Media not found:', mediaFileName);
                        renderEl = '<img src="" alt="Image not found" style="display:none;">'
                    }
                } else {
                    // Fallback - media manager not available
                    console.warn('[appendColumnImage] Media manager not available, using filename directly');
                    renderEl = '<img src="' + mediaFileName + '">'
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
                
                // Check if this is an update (not first render) and multiple images exist
                if (colImageCurIndex[cellKey] > 0 && colImageloop[cellKey].length > 1) {
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
                }

                // Only cycle to next if there are multiple images
                if (colImageloop[cellKey].length > 1) {
                    // go to the next column image using per-column or global interval
                    colImageTimeout[cellKey] = setTimeout(function () {
                        changeColImageMedia(cellKey)
                    }, switchingTime)
                }
            }

            //play next column fader after current column fader has finished
            function changeColTextFader(cellKey) {
                if (colFaderloop[cellKey].length == 1) {
                    colFaderCurIndex[cellKey] = 0
                }
                if (colFaderCurIndex[cellKey] >= colFaderloop[cellKey].length) {
                    // modified this so it would display the first column when looping
                    colFaderCurIndex[cellKey] = 0
                }
                appendColumnFader(colFaderloop[cellKey][colFaderCurIndex[cellKey]], cellKey)
                colFaderCurIndex[cellKey]++
            }

            //render every column fader slot
            function appendColumnFader(item, cellKey) {
                if (colFaderTimeout[cellKey]) { //clear colFaderTimeout to reset
                    clearTimeout(colFaderTimeout[cellKey])
                }
                
                // Get per-column fader settings or use global defaults
                var faderSettings = colFaderSettings[cellKey] || {}
                var animationDuration = (faderSettings.enabled && faderSettings.speed) 
                    ? faderSettings.speed 
                    : colAnimationDuration[tableid]
                var animationInterval = (faderSettings.enabled && faderSettings.switchingTime) 
                    ? faderSettings.switchingTime 
                    : colAnimationInterval[tableid]
                
                var targetContainer = $('.' + cellKey.split('-')[2] + ' .fadercol-' + colRowIndex)
                
                // Check if this is the first render or an update
                if (colFaderCurIndex[cellKey] > 0 && targetContainer.find('.column-fader').length > 0) {
                    // Animate out the old content with configured duration
                    var $oldElement = targetContainer.find('.column-fader')
                    $oldElement.addClass('fader-scroll-out')
                    $oldElement.css('animation-duration', (animationDuration * 0.75) + 'ms') // 0.75 for scroll-out
                    
                    // Wait for animation to complete, then update content
                    setTimeout(function() {
                        var renderEl = '<div id="col-' + colRowIndex + '" class="column-fader fader-scroll-in">' + item.text + '</div>'
                        targetContainer.html(renderEl)
                        var $newElement = targetContainer.find('.column-fader')
                        $newElement.css('animation-duration', (animationDuration * 0.75) + 'ms') // 0.75 for scroll-in
                        
                        // Remove animation class after it completes
                        setTimeout(function() {
                            targetContainer.find('.column-fader').removeClass('fader-scroll-in')
                        }, animationDuration * 0.75)
                    }, animationDuration * 0.75)
                } else {
                    // First render - no animation
                    var renderEl = '<div id="col-' + colRowIndex + '" class="column-fader">' + item.text + '</div>'
                    targetContainer.html(renderEl)
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
                    // go to the next column fader using per-column or global interval
                    colFaderTimeout[cellKey] = setTimeout(function () {
                        changeColTextFader(cellKey)
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

    // Store all data to pagerow object (synchronous like Electron version)
    console.log('[tableRecord] Collecting rows for table:', tableid);
    var foundRows = $('.slot-tbody-' + tableid).find('tr');
    foundRows.each(function (i, row) {
        return pagerow[tableid].push(row)
    })
    console.log('[tableRecord] ✓ Collected', pagerow[tableid].length, 'rows into pagerow array');

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

    } catch (error) {
        console.error('[tableRecord] Error during table rendering:', error);
        console.error('[tableRecord] Error stack:', error.stack);
        console.error('[tableRecord] Error at table:', tableid);
        console.error('[tableRecord] pagerow state:', pagerow[tableid] ? 'Array with ' + pagerow[tableid].length + ' items' : 'UNDEFINED');
    } finally {
        // Always reset rendering flag
        tableRendering[tableid] = false;
        console.log('[tableRecord] Rendering completed for table:', tableid);
    }
}