var refreshTimeout
var mediapath
var lywidth
var lyheight
var layoutfirstRun = true
var layoutolddate
var tableolddate
var tablefirstrun = true
var slotnameList = []

function updatelayout(result2) {
    var layoutnewupdate = result2['elements']['0']['attributes']['update']
    var lytsvrrefresh = parseInt(result2['elements']['0']['attributes']['serverRefresh']) * 1000
    var lytslotlist = result2['elements']['0']['elements']['0']['elements']['0']['elements']

    //refresh layout
    refreshTimeout = setTimeout(function () {
        layoutolddate = result2['elements']['0']['attributes']['update']
        log.warn('Player info : Refresh')
        getxml()
    }, lytsvrrefresh)

    //first run
    if (layoutfirstRun) {
        log.warn('Player info : eCLESS booting up')
        layoutfirstRun = false
        getLayoutXML(result2)
    }

    //check if layout slot got update
    if (layoutnewupdate > layoutolddate) {
        $('.main-slot').not(".mslot-table").remove()
        log.warn('Player info : Layout content updated')
        getLayoutXML(result2)
    }

    //check if table got update
    lytslotlist.forEach(function (slot, index) {
        var tableCheckLoop = setInterval(() => {
            if (slot['name'] == 'table') {
                var tablenewupdate = slot['attributes']['update']
                var slotitem = slot['elements']
                var slotid = slot['attributes']['id']
                //compare update server time with pc time
                if (tablenewupdate >= tableolddate) {
                    if (result2['elements']['0']['elements']['1']) {
                        var tableRecordList = result2['elements']['0']['elements']['1']['elements']
                        if (!tableRecordList[0]['elements']) {
                            return
                        }
                        log.warn('Player info : Table content updated')
                        pagerow = []
                        $('#slot-' + slotid).find('table').remove()
                        $('#slot-' + slotid).find('.clearfix').first().remove()
                        $('#pagination-' + slotid).remove()
                        $('#pagination').empty()
                        log.info('table have records')
                        tableFunc(slotitem, slotid, slot['attributes'])
                        tableRecordList.forEach(function (records, tindex) {
                            tableRecord(records['elements'], slotid, records['attributes'])
                        })
                        clearInterval(tableCheckLoop)

                    }
                }
            }
        }, 1000)
    })
}

//generate xml file from cless server
function getLayoutXML(result2) {
    //reset pagination table when playing loop
    if (isLoopLyt) {
        pagerow = []
        videoJSPlayer = []
    }
    //if layout cannot read go to offline page
    if (!result2) {
        // Defensive check before calling remote API
        if (remote && remote.getCurrentWindow && typeof remote.getCurrentWindow().focus === 'function') {
            remote.getCurrentWindow().focus()
        }
        log.warn('layout xml : unable to read : ' + result2)
        location.href = 'offline.html'
    }
    var layoutproperties = result2['elements']['0']['attributes'] // properties and info of layouts
    var dsname = result2['elements']['0']['attributes']['ds']
    var layoutID = result2['elements']['0']['attributes']['id']
    var lytname = result2['elements']['0']['attributes']['layout']
    var lytresolution = result2['elements']['0']['elements']['0']['attributes']['resolution']
    var lytautoscale = result2['elements']['0']['elements']['0']['attributes']['autoscale']
    var lytbgcolor = result2['elements']['0']['elements']['0']['attributes']['bgcolor']
    var lytbgscretch = result2['elements']['0']['elements']['0']['attributes']['bgscretch']
    var lytbgimage = result2['elements']['0']['elements']['0']['attributes']['bgimage']
    var lytslotlist = result2['elements']['0']['elements']['0']['elements']['0']['elements']
    mediapath = result2['elements']['0']['attributes']['mediapath']
    lywidth = lytresolution.split('x')[0]
    lyheight = lytresolution.split('_')[0].split("x").pop()
    var isTableslot = result2['elements']['0']['elements']['1']['elements']

    console.log('[LayoutXML] Layout result:', JSON.stringify(result2));
    console.log('[LayoutXML] Slot list length:', lytslotlist ? lytslotlist.length : 'undefined');
    console.log('[LayoutXML] Media path:', mediapath);

    //custom background - CREATE #main FIRST before any dimension calculations
    $('body *').not('.no-network').remove()
    $('body').append('<div id="main"></div>')
    $('#main').css({
        "background-color": "black",
    })

    //adjust window size
    // Check if we're on mobile or desktop
    var isMobile = window.mobileLayoutHandler || (window.mobileAPI && window.mobileAPI.isNative);
    
    if (isMobile) {
        // Mobile: Use mobile layout handler
        console.log('[LayoutXML] Mobile detected, using mobile layout handler');
        
        if (window.mobileLayoutHandler) {
            // Use the mobile layout handler for proper dimension management
            var autoscale = (lytautoscale == 'Y');
            window.mobileLayoutHandler.setLayoutBounds({
                x: 0,
                y: 0,
                width: parseInt(lywidth),
                height: parseInt(lyheight)
            }, autoscale);
        } else {
            console.warn('[LayoutXML] mobileLayoutHandler not available, using fallback');
            // Fallback: ensure setBounds exists before calling
            if (remote && remote.getCurrentWindow && typeof remote.getCurrentWindow().setBounds === 'function') {
                // setBounds should now be implemented in mobile-electron-shim.js
                if (lytautoscale == 'Y') {
                    remote.getCurrentWindow().setBounds({
                        y: 0,
                        x: 0,
                        width: screen.width,
                        height: screen.height
                    });
                } else {
                    remote.getCurrentWindow().setBounds({
                        y: 0,
                        x: 0,
                        width: parseInt(lywidth),
                        height: parseInt(lyheight)
                    });
                }
            }
        }
    } else {
        // Desktop Electron: Use standard setBounds
        if (remote && remote.getCurrentWindow && typeof remote.getCurrentWindow().setBounds === 'function') {
            if (lytautoscale == 'Y') {
                remote.getCurrentWindow().setBounds({
                    y: 0,
                    x: 0,
                    width: screen.width,
                    height: screen.height
                });
            } else {
                remote.getCurrentWindow().setBounds({
                    y: 0,
                    x: 0,
                    width: parseInt(lywidth),
                    height: parseInt(lyheight)
                });
            }
        }
    }

    //apply remaining background styles
    $('#main').css({
        "background-color": lytbgcolor,
        "background-repeat": "no-repeat",
        "overflow": "hidden",
        "width": "100%",
        "height": "100%",
        "cursor": "none"
    })

    if (lytbgscretch == 'Y') {
        $('#main').css({
            "background-size": "cover"
        })
    } else {
        $('#main').css({
            "background-size": "auto"
        })
    }

    //check and then use background image if available
    if (lytbgimage != 'none') {
        var serverAdd = config.hostserver
        serverAdd = serverAdd.split('/')
        serverAdd = serverAdd[0] + '//' + serverAdd[2]
        $('#main').css({
            "background-image": 'url("' + serverAdd + mediapath + '/' + lytbgimage + '")'
        })
    }

    if (lytslotlist && lytslotlist.length > 0) {
        //slots
        lytslotlist.forEach(function (slot, index) {
            // Defensive check for slot structure
            if (!slot) {
                console.error('[LayoutXML] Slot is null/undefined at index:', index);
                return; // Skip this slot
            }
            
            if (!slot['attributes']) {
                console.error('[LayoutXML] Slot has no attributes at index:', index);
                return; // Skip this slot
            }
            
            if (!slot['name']) {
                console.error('[LayoutXML] Slot has no name at index:', index);
                return; // Skip this slot
            }
            
            var slotid = slot['attributes']['id']
            var slotbgColor = slot['attributes']['bgcolor'] || '#000000'
            var slottop = slot['attributes']['top'] || 0
            var slotleft = slot['attributes']['left'] || 0
            var slotwidth = slot['attributes']['width'] || 100
            var slotheight = slot['attributes']['height'] || 100
            var slotlayer = index
            var slottransparent = slot['attributes']['transparent'] || 'N'
            var slotitem = slot['elements']

            //if slot name found
            if (isLoopLyt == false) {
                if (slot['attributes']['name']) {
                    var slotname = slot['attributes']['name']
                    var slottype = slot['name']
                    var slotlistobj = new Object()
                    slotlistobj.layoutid = layoutID
                    slotlistobj.layoutname = lytname
                    slotlistobj.slottype = slottype
                    slotlistobj.slotid = 'slot-' + slotid
                    slotlistobj.slotname = slotname
                    slotnameList.push(slotlistobj)
                }
            }

            var slotele = '<div id="slot-' + slotid + '" class="main-slot mslot-' + slot['name'] + '" ></div>'
            if (slot['attributes']['enabled'] == 'Y') {
                //render every slot to body
                $('#main').append(slotele)
                //customize slot
                if (lytautoscale == 'Y') {
                    var demoWidth = (slotwidth / lywidth * 100)
                    var demoHeight = (slotheight / lyheight * 100)
                    var demoTop = (slottop / lywidth * 100)
                    var demoLeft = (slotleft / lyheight * 100)
                    var windowsscreenx = $(document).width()
                    var windowsscreeny = $(document).height()
                    demoWidth = ((windowsscreenx / 100) * demoWidth)
                    demoHeight = ((windowsscreeny / 100) * demoHeight)
                    demoTop = ((windowsscreeny / 100) * demoTop)
                    demoLeft = ((windowsscreenx / 100) * demoLeft)

                    $('#slot-' + slotid).css({
                        "z-index": parseInt(slotlayer),
                        "position": "absolute",
                        "top": demoTop + "px",
                        "left": demoLeft + "px",
                        "width": demoWidth + "px",
                        "height": demoHeight + "px",
                        "cursor": "none"
                    })
                } else {
                    $('#slot-' + slotid).css({
                        "z-index": parseInt(slotlayer),
                        "position": "absolute",
                        "top": slottop + "px",
                        "left": slotleft + "px",
                        "width": slotwidth + "px",
                        "height": slotheight + "px",
                        "cursor": "none"
                    })
                }

                //if this not table then follow the background color
                if (slot['name'] != 'table') {
                    if (slottransparent == 'Y') {
                        $('#slot-' + slotid).css({
                            "background": 'none',
                        })
                    } else {
                        $('#slot-' + slotid).css({
                            "background": slotbgColor,
                        })
                    }
                }

                //customize text slot when available
                try {
                    textCustomFunc(slot, slotid)
                } catch (error) {
                    console.error('[LayoutXML] Error in textCustomFunc for slot:', slotid, 'Error:', error.message, error.stack);
                }
                
                //slot statements
                //media slot
                if (slot['name'] == 'media') {
                    try {
                        console.log('[LayoutXML] ===== MEDIA SLOT DETECTED =====');
                        console.log('[LayoutXML] Slot ID:', slotid);
                        console.log('[LayoutXML] Media path:', mediapath);
                        console.log('[LayoutXML] Slotitem length:', slotitem ? slotitem.length : 'undefined');
                        console.log('[LayoutXML] Full slotitem:', JSON.stringify(slotitem));
                        if (slotitem && slotitem.length > 0) {
                            console.log('[LayoutXML] First media item attributes:', slotitem[0]['attributes'] ? Object.keys(slotitem[0]['attributes']) : 'none');
                            console.log('[LayoutXML] First media item properties:', Object.keys(slotitem[0]));
                        }
                        mediaFunc(slotitem, slotid, mediapath)
                    } catch (error) {
                        console.error('[LayoutXML] Error in mediaFunc for slot:', slotid, 'Error:', error.message, error.stack);
                    }
                } //text slot
                else if (slot['name'] == 'text') {
                    try {
                        textFunc(slotitem, slotid, index)
                    } catch (error) {
                        console.error('[LayoutXML] Error in textFunc for slot:', slotid, 'Error:', error.message, error.stack);
                    }
                } //ticker slot
                else if (slot['name'] == 'ticker') {
                    try {
                        tickerFunc(slot, slotid)
                    } catch (error) {
                        console.error('[LayoutXML] Error in tickerFunc for slot:', slotid, 'Error:', error.message, error.stack);
                    }
                } //scroller slot
                else if (slot['name'] == 'scroller') {
                    try {
                        scrollerFunc(slot, slotid)
                    } catch (error) {
                        console.error('[LayoutXML] Error in scrollerFunc for slot:', slotid, 'Error:', error.message, error.stack);
                    }
                } //text fader slot
                else if (slot['name'] == 'fader') {
                    try {
                        faderFunc(slot, slotid)
                    } catch (error) {
                        console.error('[LayoutXML] Error in faderFunc for slot:', slotid, 'Error:', error.message, error.stack);
                    }
                } //date slot 
                else if (slot['name'] == 'date') {
                    try {
                        dateFunc(slot, slotid)
                    } catch (error) {
                        console.error('[LayoutXML] Error in dateFunc for slot:', slotid, 'Error:', error.message, error.stack);
                    }
                } //time slot 
                else if (slot['name'] == 'time') {
                    try {
                        timeFunc(slot, slotid)
                    } catch (error) {
                        console.error('[LayoutXML] Error in timeFunc for slot:', slotid, 'Error:', error.message, error.stack);
                    }
                } //html slot
                else if (slot['name'] == 'html') {
                    try {
                        console.log('[LayoutXML] HTML slot detected - slotid:', slotid);
                        console.log('[LayoutXML] HTML slotitem structure:', JSON.stringify(slotitem).substring(0, 500));
                        console.log('[LayoutXML] HTML slotitem length:', slotitem ? slotitem.length : 'undefined');
                        if (slotitem && slotitem.length > 0) {
                            console.log('[LayoutXML] First HTML item:', JSON.stringify(slotitem[0]));
                        }
                        htmlFunc(slotitem, slotid)
                    } catch (error) {
                        console.error('[LayoutXML] Error in htmlFunc for slot:', slotid, 'Error:', error.message, error.stack);
                    }
                } //table slot
                else if (slot['name'] == 'table') {
                    try {
                        if (tablefirstrun) {
                            var tableRecordList = result2['elements']['0']['elements']['1']['elements']
                            if (!tableRecordList[0]['elements']) {
                                tableNorecords(slotitem, slotid, slot['attributes'])
                                return
                            }
                            tableFunc(slotitem, slotid, slot['attributes'])
                        }
                    } catch (error) {
                        console.error('[LayoutXML] Error in table slot for slot:', slotid, 'Error:', error.message, error.stack);
                    }
                }

                //else if (slot['name'] == 'records') {
                //    tableRecord(slotitem, slotid)
                //}
            }
            //check if table record available
            //table record
            if (index === lytslotlist.length - 1) {
                try {
                    if (result2['elements']['0']['elements']['1']) {
                        var tableRecordList = result2['elements']['0']['elements']['1']['elements']
                        if (tableRecordList && !tableRecordList[0]['elements']) return
                        if (tableRecordList) {
                            tableRecordList.forEach(function (records, tindex) {
                                tableRecord(records['elements'], slotid, records['attributes'])
                            })
                        }
                    }
                } catch (error) {
                    console.error('[LayoutXML] Error processing table records:', error.message, error.stack);
                }
            }
        })
    }
}


//convert hex to rgb
function hexToRgbA(hex, transparent) {
    if (transparent == "high") {
        transparent = 0
    } else if (transparent == "medium") {
        transparent = 0.5
    } else {
        transparent = 1
    }
    var c;
    if (/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)) {
        c = hex.substring(1).split('');
        if (c.length == 3) {
            c = [c[0], c[0], c[1], c[1], c[2], c[2]];
        }
        c = '0x' + c.join('');
        return 'rgba(' + [(c >> 16) & 255, (c >> 8) & 255, c & 255].join(',') + ',' + transparent + ')';
    }
    throw new Error('Bad Hex');
}