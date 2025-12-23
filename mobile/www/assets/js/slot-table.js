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
            "border-radius": cellTopLeftRadius + "px " + cellTopRightRadius + "px " + cellBottomRightRadius + "px " + cellBottomLeftRadius + "px",
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
        pagerow[tableid] = [] // set page row array with table id
        pageincrease[tableid] = 1
        checkpage[tableid] = true

        console.log('[tableRecord] ✓ Initialized pagerow[' + tableid + '] as empty array');
        console.log('[tableRecord] DEBUG: pagerow object type:', typeof pagerow);
        console.log('[tableRecord] DEBUG: pagerow is Array?', Array.isArray(pagerow));
        console.log('[tableRecord] DEBUG: pagerow[' + tableid + '] type:', typeof pagerow[tableid]);
        console.log('[tableRecord] DEBUG: pagerow[' + tableid + '] is Array?', Array.isArray(pagerow[tableid]));

        // Mobile app - ensure media manager is initialized
        if (window.mediaManager && !window.mediaManager.initialized) {
            console.log('[tableRecord] Waiting for media manager initialization...');
            await window.mediaManager.initialize().catch(err => {
                console.error('[tableRecord] Media manager init failed:', err);
            });
        }
        console.log('[tableRecord] Using mobile media manager for table:', tableid);

        // VALIDATION: Check for empty or invalid data
        if (!slotitem || !Array.isArray(slotitem) || slotitem.length === 0) {
            console.warn('[tableRecord] Invalid or empty slotitem data for table:', tableid);
            return;
        }

        // VALIDATION: Detect potential duplicate data in source
        const seenRowSignatures = new Set();
        let duplicateDetected = false;
        slotitem.forEach((row, idx) => {
            if (row && row.attributes) {
                const signature = JSON.stringify(row.attributes);
                if (seenRowSignatures.has(signature)) {
                    console.warn('[tableRecord] Duplicate row detected at index', idx, ':', signature.substring(0, 100));
                    duplicateDetected = true;
                }
                seenRowSignatures.add(signature);
            }
        });
        if (duplicateDetected) {
            console.warn('[tableRecord] ⚠️ SOURCE DATA contains duplicates - this may indicate upstream issue');
        }

        console.log('[tableRecord] Rendering table records for table:', tableid, 'with', slotitem.length, 'unique rows');
        // Clear any existing tbody and colgroup before appending new ones
        $('.slot-tbody-' + tableid).remove();
        $('.slot-colgroup-' + tableid).remove();

        // Verify removal was successful
        if ($('.slot-tbody-' + tableid).length > 0) {
            console.error('[tableRecord] ⚠️ Failed to remove existing tbody, forcing empty');
            $('.slot-tbody-' + tableid).empty().remove();
        }

        $('.slot-table-' + tableid).append('<tbody class="slot-tbody-' + tableid + '"></tbody>')
        $('.slot-table-' + tableid).append('<colgroup class="slot-colgroup-' + tableid + '"></colgroup>')

        // Verify tbody is truly empty before rendering
        const tbodyRowCount = $('.slot-tbody-' + tableid).find('tr').length;
        if (tbodyRowCount > 0) {
            console.error('[tableRecord] ⚠️ tbody not empty after creation! Found', tbodyRowCount, 'rows - clearing');
            $('.slot-tbody-' + tableid).empty();
        }
        console.log('[tableRecord] tbody initialized - confirmed empty, ready for', slotitem.length, 'rows');

        // Append <col> with width, and apply other styles to <td>/<th>
        columnStyle.forEach(function (checkres1, vindex) {
            // Append the <col> with width only
            $('.slot-table-' + tableid + ' .slot-colgroup-' + tableid).append('<col class="colgroup-' + checkres1['colid'] + '" style="width:' + checkres1['width'] + 'px;"></col>');
        })

        //start to render table items
        if (slotitem) {
            // Use synchronous forEach like Electron version (NOT async for...of)
            slotitem.forEach(function (row, xindex) {
                var colRowIndex = xindex
                var colList = row['attributes']
                var objColList = Object.entries(colList)
                var rowId = 'row-' + tableid + '-' + colRowIndex; // Unique row identifier
                $('.slot-tbody-' + tableid).append('<tr data-row-id="' + rowId + '"> </tr>')
                objColList.forEach(function (col, zindex) {
                    zindex++
                    $('.slot-table-' + tableid + ' tbody tr[data-row-id="' + rowId + '"]').append('<td nowrap class="col' + zeroPad(zindex, 2) + '"></td>')
                })

                // Process columns synchronously
                objColList.forEach(function (col, zindex) {

                    var colNumber = col[0]
                    const compositeKey = colRowIndex + '-' + colNumber; // CRITICAL: Unique key per row+column

                    colImageCurIndex[compositeKey] = 0
                    colImageloop[compositeKey] = []
                    colFaderCurIndex[compositeKey] = 0
                    colFaderloop[compositeKey] = []
                    if (colFaderTimeout[compositeKey]) { //clear colFaderTimeout to reset
                        clearTimeout(colFaderTimeout[compositeKey])
                    }
                    if (colImageTimeout[compositeKey]) { //clear colImageTimeout to reset
                        clearTimeout(colImageTimeout[compositeKey])
                    }
                    var colFormat = col[1].substring(0, 6)
                    if (colFormat == 'image:') {
                        var n = col[1].lastIndexOf(':')
                        var colImageList = col[1].substring(n + 1)
                        colImageList = colImageList.split(',') // split and create array
                        $('.slot-tbody-' + tableid + ' tr[data-row-id="' + rowId + '"] .' + colNumber).html('<div class="imagecol-' + colRowIndex + '"></div>') //create image td

                        // Phase 1: Parse and categorize images
                        const imagesToPreload = [];
                        colImageList.forEach(function (ele, resId) {
                            var coltext = ele.trim(); // trim whitespace
                            if (coltext != '') { // cancel if string empty
                                var contentObj = new Object()
                                contentObj.text = coltext
                                contentObj.isExternal = isExternalMediaUrl(coltext)
                                colImageloop[compositeKey].push(contentObj)

                                // Add to preload queue if local file
                                if (!contentObj.isExternal && window.mediaManager) {
                                    if (window.config && window.config.hostserver) {
                                        const serverAdd = window.config.hostserver.split('/');
                                        const baseUrl = serverAdd[0] + '//' + serverAdd[2];
                                        imagesToPreload.push({
                                            url: baseUrl + '/res/' + coltext,
                                            filename: coltext
                                        });
                                    }
                                }
                            }
                        });

                        // Phase 2: Batch preload local images (non-blocking)
                        if (imagesToPreload.length > 0 && window.mediaManager) {
                            // Fire and forget - don't await, preload in background
                            window.mediaManager.preloadMediaBatch(imagesToPreload).catch(err => {
                                console.warn('[tableRecord] Preload failed for column', colNumber, ':', err);
                            });
                        }

                        // Phase 3: Display first image (synchronously)
                        if (colImageloop[compositeKey].length > 0) {
                            appendColumnImage(colImageloop[compositeKey][0], colNumber, colRowIndex);
                        }
                    } else if (colFormat == 'fader:') { //create fader animation for this column
                        var n = col[1].indexOf(":") // remove first string before : symbol
                        var colTextFaderList = col[1].slice(n + 1) // combine all text when have ,
                        colTextFaderList = colTextFaderList.split(',') // split and create array
                        $('.slot-tbody-' + tableid + ' tr[data-row-id="' + rowId + '"] .' + col[0]).html('<div class="fadercol-' + colRowIndex + '"></div>') //create td
                        colTextFaderList.forEach(function (ele, resId) { //create foreach to create fading animation
                            var coltext = ele.replace(/ /g, '') // delete any space
                            if (coltext != '') { // cancel if string empty
                                var contentObj = new Object()
                                contentObj.text = coltext
                                colFaderloop[compositeKey].push(contentObj)
                            }
                            if (resId === colTextFaderList.length - 1) {
                                appendColumnFader(colFaderloop[compositeKey][0], colNumber, colRowIndex)
                            }
                        })
                    } else {
                        $('.slot-tbody-' + tableid + ' tr[data-row-id="' + rowId + '"] .' + col[0]).html(col[1])
                    }
                })
                //play next column image after current column image has finished
                function changeColImageMedia(colNumber, rowIndex) {
                    const compositeKey = rowIndex + '-' + colNumber;

                    // DEFENSIVE: Check if colImageloop exists
                    if (!colImageloop[compositeKey] || !Array.isArray(colImageloop[compositeKey])) {
                        console.error('[changeColImageMedia] colImageloop not initialized for key:', compositeKey);
                        return;
                    }

                    if (colImageloop[compositeKey].length == 1) {
                        colImageCurIndex[compositeKey] = 0
                    }
                    if (colImageCurIndex[compositeKey] >= colImageloop[compositeKey].length) {
                        // modified this so it would display the first column when looping
                        colImageCurIndex[compositeKey] = 0
                    }
                    appendColumnImage(colImageloop[compositeKey][colImageCurIndex[compositeKey]], colNumber, rowIndex)
                    colImageCurIndex[compositeKey]++
                }

                //render every column image slot
                async function appendColumnImage(item, colNumber, rowIndex) {
                    const compositeKey = rowIndex + '-' + colNumber;
                    if (colImageTimeout[compositeKey]) { //clear colImageTimeout to reset
                        clearTimeout(colImageTimeout[compositeKey])
                    }

                    var renderEl = '';
                    var mediaFileName = item.text;

                    console.log('[appendColumnImage] Processing media file:', mediaFileName, 'for column:', colNumber, 'rowIndex:', rowIndex, 'key:', compositeKey);

                    // Check if this is an external URL
                    const isExternalUrl = isExternalMediaUrl(mediaFileName);

                    if (isExternalUrl) {
                        // External URL - use directly without caching
                        console.log('[appendColumnImage] ✓ External URL detected:', mediaFileName);
                        renderEl = '<img src="' + mediaFileName + '" style="max-height: ' + bodyRowHeight + 'px; width: auto; height: auto;" crossorigin="anonymous" onload="console.log(\'External image loaded\')" onerror="console.error(\'External image load error\')">';
                    } else {
                        // Local file - use media manager with base64 support
                        try {
                            if (window.mediaManager) {
                                // Use smart URI getter (handles cache, base64, etc.)
                                const mediaUri = await window.mediaManager.getMediaUriSmart(mediaFileName, false);

                                if (mediaUri) {
                                    console.log('[appendColumnImage] ✓ Got media URI from mediaManager (cached/base64)');
                                    renderEl = '<img src="' + mediaUri + '" style="max-height: ' + bodyRowHeight + 'px; width: auto; height: auto;" onload="console.log(\'Image loaded from cache\')" onerror="console.error(\'Image load error\')">';
                                } else {
                                    console.warn('[appendColumnImage] Failed to get media URI, trying direct download');
                                    // Try downloading if not in cache
                                    if (window.config && window.config.hostserver) {
                                        const serverAdd = window.config.hostserver.split('/');
                                        const baseUrl = serverAdd[0] + '//' + serverAdd[2];
                                        const downloadUrl = baseUrl + '/res/' + mediaFileName;

                                        await window.mediaManager.downloadMedia(downloadUrl, mediaFileName);
                                        const retryUri = await window.mediaManager.getMediaUriSmart(mediaFileName, false);

                                        if (retryUri) {
                                            console.log('[appendColumnImage] ✓ Downloaded and got URI after retry');
                                            renderEl = '<img src="' + retryUri + '" style="max-height: ' + bodyRowHeight + 'px; width: auto; height: auto;">';
                                        } else {
                                            // Final fallback: direct URL
                                            console.warn('[appendColumnImage] Using direct URL fallback');
                                            renderEl = '<img src="' + downloadUrl + '" style="max-height: ' + bodyRowHeight + 'px; width: auto; height: auto;" crossorigin="anonymous">';
                                        }
                                    }
                                }
                            } else {
                                console.warn('[appendColumnImage] Media manager not available, using server URL fallback');
                                // Fallback: direct URL from server
                                if (window.config && window.config.hostserver) {
                                    const serverAdd = window.config.hostserver.split('/');
                                    const baseUrl = serverAdd[0] + '//' + serverAdd[2];
                                    renderEl = '<img src="' + baseUrl + '/res/' + mediaFileName + '" style="max-height: ' + bodyRowHeight + 'px; width: auto; height: auto;" crossorigin="anonymous">';
                                    console.log('[appendColumnImage] Using server URL:', baseUrl + '/res/' + mediaFileName);
                                } else {
                                    console.error('[appendColumnImage] No config available for server URL');
                                }
                            }
                        } catch (error) {
                            console.error('[appendColumnImage] Media error:', error);
                            // Fallback to direct URL
                            if (window.config && window.config.hostserver) {
                                const serverAdd = window.config.hostserver.split('/');
                                const baseUrl = serverAdd[0] + '//' + serverAdd[2];
                                renderEl = '<img src="' + baseUrl + '/res/' + mediaFileName + '" style="max-height: ' + bodyRowHeight + 'px; width: auto; height: auto;" crossorigin="anonymous">';
                                console.log('[appendColumnImage] Using direct URL after error');
                            }
                        }
                    }

                    $('.' + colNumber + ' .imagecol-' + rowIndex).html(renderEl)

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
                    $('.imagecol-' + rowIndex).css({
                        "white-space": "nowrap",
                        "width": "auto",
                        "height": "auto",
                    })

                    // go to the next column fader after 20 seconds
                    colImageTimeout[compositeKey] = setTimeout(function () {
                        changeColImageMedia(colNumber, rowIndex)
                    }, 20000)
                }

                //play next column fader after current column fader has finished
                function changeColTextFader(colNumber, rowIndex) {
                    const compositeKey = rowIndex + '-' + colNumber;

                    // DEFENSIVE: Check if colFaderloop exists
                    if (!colFaderloop[compositeKey] || !Array.isArray(colFaderloop[compositeKey])) {
                        console.error('[changeColTextFader] colFaderloop not initialized for key:', compositeKey);
                        return;
                    }

                    if (colFaderloop[compositeKey].length == 1) {
                        colFaderCurIndex[compositeKey] = 0
                    }
                    if (colFaderCurIndex[compositeKey] >= colFaderloop[compositeKey].length) {
                        // modified this so it would display the first column when looping
                        colFaderCurIndex[compositeKey] = 0
                    }
                    appendColumnFader(colFaderloop[compositeKey][colFaderCurIndex[compositeKey]], colNumber, rowIndex)
                    colFaderCurIndex[compositeKey]++
                }

                //render every column fader slot
                function appendColumnFader(item, colNumber, rowIndex) {
                    const compositeKey = rowIndex + '-' + colNumber;
                    if (colFaderTimeout[compositeKey]) { //clear colFaderTimeout to reset
                        clearTimeout(colFaderTimeout[compositeKey])
                    }
                    var renderEl = '<div id="col-' + rowIndex + '" class="column-fader">' + item.text + '</div>'
                    $('.' + colNumber + ' .fadercol-' + rowIndex).html(renderEl)

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

                    if (colFaderCurIndex[compositeKey] >= 1) $('.' + colNumber + ' .fadercol-' + rowIndex + ' #col-' + rowIndex).fadeIn(500).fadeOut(500).fadeIn(1500)

                    // go to the next column fader after 20 seconds
                    colFaderTimeout[compositeKey] = setTimeout(function () {
                        changeColTextFader(colNumber, rowIndex)
                    }, 20000)
                }

                // Append <col> with width, and apply other styles to <td>/<th>
                columnStyle.forEach(function (checkres1, vindex) {
                    // Apply the styles to the corresponding <td> or <th>
                    $(' .' + checkres1['colid']).css({
                        'text-align': checkres1['textalign'],
                        "border-radius": checkres1['tlradius'] + "px " + checkres1['trradius'] + "px " + checkres1['brradius'] + "px " + checkres1['blradius'] + "px",
                        'height': bodyRowHeight + "px",
                    });
                });
            }) // Close slotitem.forEach
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
        console.log('[tableRecord] DEBUG: tbody element exists?', $('.slot-tbody-' + tableid).length);
        console.log('[tableRecord] DEBUG: tbody HTML length:', $('.slot-tbody-' + tableid).html()?.length || 0);
        var foundRows = $('.slot-tbody-' + tableid).find('tr');
        console.log('[tableRecord] DEBUG: Found', foundRows.length, 'tr elements in tbody');
        foundRows.each(function (i, row) {
            console.log('[tableRecord] DEBUG: Pushing row', i, 'with data-row-id:', $(row).attr('data-row-id'));
            return pagerow[tableid].push(row)
        })
        console.log('[tableRecord] ✓ Collected', pagerow[tableid].length, 'rows into pagerow array');

    if (pagerow[tableid].length != 0) {
            console.log('[tableRecord] Setting up pagination for table:', tableid, '- Total rows:', pagerow[tableid].length);
            
            // DEFENSIVE: Validate slot element exists
            var slotElement = $('#slot-' + tableid);
            if (slotElement.length === 0) {
                console.error('[tableRecord] ⚠️ Slot element not found for table:', tableid);
                return;
            }

            var slotHeight = slotElement.height();
            if (!slotHeight || slotHeight <= 0) {
                console.error('[tableRecord] ⚠️ Invalid slot height:', slotHeight);
                return;
            }
            
            var maxrows = parseInt(slotHeight) - parseInt(headRowHeight);
            
            // DEFENSIVE: Check if tbody exists and has computed line-height
            var tbodyRows = $('.slot-tbody-' + tableid).find('tr');
            if (tbodyRows.length === 0) {
                console.error('[tableRecord] ⚠️ No tbody rows found after rendering');
                return;
            }
            
            var lineHeight = tbodyRows.css('line-height');
            if (!lineHeight) {
                console.error('[tableRecord] ⚠️ Could not get line-height from tbody rows');
                return;
            }
            
            maxrows = maxrows / parseInt(lineHeight);
            maxrows = maxrows - 1;
            console.log('[tableRecord] Calculated max rows per page:', maxrows, '- Slot height:', slotHeight, 'px');
            
            var pagination = $('#pagination-' + tableid);
            
            // Ensure pagination element is clean before initializing
            if (pagination.data('pagination')) {
                console.log('[tableRecord] Destroying existing pagination instance');
                try {
                    pagination.pagination('destroy');
                } catch (e) {
                    console.warn('[tableRecord] Error destroying pagination:', e);
                }
            }
            pagination.empty();
            
            var totalRows = pagerow[tableid].length;  // Total number of rows
            var pageSize = parseInt(maxrows);

            // Check if there's only one page of data
            if (totalRows <= pageSize) {
                console.log('[tableRecord] Single page only - hiding pagination');
                pagination.hide();  // Hide pagination if only 1 page
                $('#slot-' + tableid).find('.pagination-pages').hide()
                $('#pagination-' + tableid).hide()
                $('.slot-tbody-' + tableid).html(pagerow[tableid]);  // Render the data without pagination
            } else {
                console.log('[tableRecord] Multiple pages detected - initializing pagination with pageSize:', pageSize);
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
                    console.log('[tableRecord] Pagination initialized - Page 1/' + pagination.pagination('getTotalPage'));
                } else {
                    $('#slot-' + tableid).find('.pagination-pages').html('<div>Page ' + pageincrease[tableid] + '/' + pagination.pagination('getTotalPage') + '</div>');
                    pagination.pagination('go', pageincrease[tableid]);
                }

                // Auto page flip - clear any existing interval first
                if (pageAutoInterval[tableid]) {
                    console.log('[tableRecord] Clearing existing pageAutoInterval before creating new one');
                    clearInterval(pageAutoInterval[tableid]);
                }
                
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
                    console.log('[tableRecord] Auto page flip - Now showing page:', pageincrease[tableid] + '/' + totalpage);
                }, pageLengthTime[tableid]);
                console.log('[tableRecord] Auto page flip interval set to:', pageLengthTime[tableid], 'ms');
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