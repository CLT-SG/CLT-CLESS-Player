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
        remote.getCurrentWindow().focus()
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

    //adjust window size
    if (lytautoscale == 'Y') {
        remote.getCurrentWindow().setBounds({
            y: 0,
            x: 0,
            width: screen.width,
            height: screen.height
        })
    } else {
        remote.getCurrentWindow().setBounds({
            y: 0,
            x: 0,
            width: parseInt(lywidth),
            height: parseInt(lyheight)
        })
    }

    //custom background
    $('body *').not('.no-network').remove()
    $('body').append('<div id="main"></div>')
    $('#main').css({
        "background-color": "black",
    })
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
            var slotid = slot['attributes']['id']
            var slotbgColor = slot['attributes']['bgcolor']
            var slottop = slot['attributes']['top']
            var slotleft = slot['attributes']['left']
            var slotwidth = slot['attributes']['width']
            var slotheight = slot['attributes']['height']
            var slotlayer = index
            var slottransparent = slot['attributes']['transparent']
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
                textCustomFunc(slot, slotid)
                //slot statements
                //media slot
                if (slot['name'] == 'media') {
                    mediaFunc(slotitem, slotid, mediapath)
                } //text slot
                else if (slot['name'] == 'text') {
                    textFunc(slotitem, slotid, index)
                } //ticker slot
                else if (slot['name'] == 'ticker') {
                    tickerFunc(slot, slotid)
                } //scroller slot
                else if (slot['name'] == 'scroller') {
                    scrollerFunc(slot, slotid)
                } //text fader slot
                else if (slot['name'] == 'fader') {
                    faderFunc(slot, slotid)
                } //date slot 
                else if (slot['name'] == 'date') {
                    dateFunc(slot, slotid)
                } //time slot 
                else if (slot['name'] == 'time') {
                    timeFunc(slot, slotid)
                } //html slot
                else if (slot['name'] == 'html') {
                    htmlFunc(slotitem, slotid)
                } //table slot
                else if (slot['name'] == 'table') {
                    if (tablefirstrun) {
                        var tableRecordList = result2['elements']['0']['elements']['1']['elements']
                        if (!tableRecordList[0]['elements']) {
                            tableNorecords(slotitem, slotid, slot['attributes'])
                            return
                        }
                        tableFunc(slotitem, slotid, slot['attributes'])
                    }
                }

                //else if (slot['name'] == 'records') {
                //    tableRecord(slotitem, slotid)
                //}
            }
            //check if table record available
            //table record
            if (index === lytslotlist.length - 1) {
                if (result2['elements']['0']['elements']['1']) {
                    var tableRecordList = result2['elements']['0']['elements']['1']['elements']
                    if (tableRecordList && !tableRecordList[0]['elements']) return
                    if (tableRecordList) {
                        tableRecordList.forEach(function (records, tindex) {
                            tableRecord(records['elements'], slotid, records['attributes'])
                        })
                    }
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