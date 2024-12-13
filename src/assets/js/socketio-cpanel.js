var socket = io('https://localhost:9000')

socket.emit('save id', 'eCLESS:')

//refresh ecless
socket.on('refresh-ecless', function (msg) {
    appname = ipcRenderer.send('app-refresh')
})

//restart ecless
socket.on('restart-ecless', function (msg) {
    appname = ipcRenderer.send('app-reload')
})

var allSlotlist
//change ds layout
socket.on('updatelayout', function (msg) {
    var layoutid = msg['id']
    
    var urlServer =config.hostserver + '/layout/' + layoutid + '/ds.xml'
    if (config.corsproxy == 'Y') urlServer = 'https://corsproxy.io/?url='+ encodeURIComponent(config.hostserver + '/layout/' + layoutid + '/ds.xml')
    var layoutURL = urlServer
    if (!isLoopLyt) { // save xml to layout
        clearTimeout(refreshTimeout)
    }
    loopArr = []
    $('#main').html('')
    $.ajax({ //get xml from hostserver
        url: layoutURL,
        type: 'GET',
        success: function (data) {
            //read ds xml
            var xmlText = new XMLSerializer().serializeToString(data)
            var xml = '<?xml version="1.0" encoding="utf-8"?>' + xmlText
            var xmlJSON = convert.xml2json(xml, {
                compact: false,
                spaces: 4
            })
            xmlJSON = JSON.parse(xmlJSON)
            localStorage.setItem('layout-' + layoutid, JSON.stringify(xmlJSON))
            var layoutxml = JSON.parse(localStorage.getItem('layout-' + layoutid))
            getLayoutXML(layoutxml)
        },
        error: function (xhr, textStatus, errorThrown) {
            console.log('cless server is offline')
        }
    })
})

//retrive all text slot
socket.on('gettextslot', function (msg) {
    var elementTextCpanelList = []
    if (isLoopLyt) { // check element id from xml storage
        loopArr.forEach(function (xmlData, xindex) {
            var layoutURL = xmlData['attributes']['url']
            var lytname = xmlData['attributes']['name']
            var getLayoutID = layoutURL.split("layout/")
            getLayoutID = getLayoutID[1].slice(0, getLayoutID[1].lastIndexOf('/'))
            var layoutxml = JSON.parse(localStorage.getItem('layout-offline-' + getLayoutID))
            var lytslotlist = layoutxml['elements']['0']['elements']['0']['elements']['0']['elements']
            lytslotlist.forEach(function (slot, lindex) {
                var slotid = slot['attributes']['id']
                var slotname = slot['attributes']['name']
                var slotitem = slot['elements']
                if (slot['name'] == 'text' || slot['name'] == 'ticker' || slot['name'] == 'fader' || slot['name'] == 'scroller') {
                    if (slotitem[0]['elements'] == undefined) {
                        var textVal = ''
                    } else {
                        var textVal = slotitem[0]['elements'][0]['text']
                    }
                    var textObj = new Object()
                    textObj.myid = getLayoutID
                    textObj.layout = lytname
                    textObj.id = slotid
                    textObj.slotname = slotname
                    textObj.slottype = capitalizeFirstLetter(slot['name'])
                    textObj.text = textVal
                    elementTextCpanelList.push(textObj)
                }
                if (xindex === loopArr.length - 1) {
                    if (lindex === lytslotlist.length - 1) {
                        //send back to cpanel
                        socket.emit('textslot-list', elementTextCpanelList)
                    }
                }
            })
        })
    } else {
        //text-slot
        if ($('.mslot-text').length) {
            $('.mslot-text').each(function (i, obj) {
                //get all element of text slot
                var thisID = $(this).attr('id')
                var filterID = slotnameList.filter((e) => e.slotid == thisID)
                var thisSlotName = filterID[0]['slotname']
                var textObj = new Object()
                textObj.myid = filterID[0]['layoutid']
                textObj.layout = filterID[0]['layoutname']
                textObj.id = thisID
                textObj.slotname = thisSlotName
                textObj.slottype = 'Text'
                textObj.text = $(this).children().first().text()
                elementTextCpanelList.push(textObj)
            })
        }
        //text-ticker
        if ($('.mslot-ticker').length) {
            $('.mslot-ticker').each(function (i, obj) {
                //get all element of text slot
                var thisID = $(this).attr('id')
                var filterID = slotnameList.filter((e) => e.slotid == thisID)
                var thisSlotName = filterID[0]['slotname']
                var textObj = new Object()
                textObj.myid = filterID[0]['layoutid']
                textObj.layout = filterID[0]['layoutname']
                textObj.id = thisID
                textObj.slotname = thisSlotName
                textObj.slottype = 'Ticker'
                textObj.text = $(this).children().first().text()
                elementTextCpanelList.push(textObj)
            })
        }
        //text-fader
        if ($('.mslot-fader').length) {
            $('.mslot-fader').each(function (i, obj) {
                //get all element of text slot
                var thisID = $(this).attr('id')
                var filterID = slotnameList.filter((e) => e.slotid == thisID)
                var thisSlotName = filterID[0]['slotname']
                var textObj = new Object()
                textObj.myid = filterID[0]['layoutid']
                textObj.layout = filterID[0]['layoutname']
                textObj.id = thisID
                textObj.slotname = thisSlotName
                textObj.slottype = 'Fader'
                textObj.text = $(this).children().first().text()
                elementTextCpanelList.push(textObj)
            })
        }
        //text-scroller
        if ($('.mslot-scroller').length) {
            $('.mslot-scroller').each(function (i, obj) {
                //get all element of text slot
                var thisID = $(this).attr('id')
                var filterID = slotnameList.filter((e) => e.slotid == thisID)
                var thisSlotName = filterID[0]['slotname']
                var textObj = new Object()
                textObj.myid = filterID[0]['layoutid']
                textObj.layout = filterID[0]['layoutname']
                textObj.id = thisID
                textObj.slotname = thisSlotName
                textObj.slottype = 'Scroller'
                textObj.text = $(this).children().first().text()
                elementTextCpanelList.push(textObj)
            })
        }
        setTimeout(function () {
            socket.emit('textslot-list', elementTextCpanelList)
        }, 2000)
    }
})

//replace text
socket.on('replacetextslot', function (msg) {
    var filterID = slotnameList.filter((e) => e.slotname == msg['slotname'])
    var layoutid = filterID[0]['layoutid'] || '2'
    var id = filterID[0]['slotid'] || 'slot-1'
    var slottype = filterID[0]['slottype']
    id = id.split('-')[1]
    var text = msg['slottext']
    clearTimeout(textTimeout[id])
    if (slottype == 'text') {
        $('#slot-' + id).html('<div id="text-' + id + '" class="text-slot">' + text + '</div>')
    }
    if (slottype == 'ticker') {
        if (text.length <= 10){
            text = text + ' ' + text + ' ' + text + ' ' + text + ' ' + text + ' ' + text + ' ' + text
        } else if (text.length > 10 && text.length <= 25){
            text = text + ' ' + text + ' ' + text + ' ' + text + ' ' + text + ' ' + text
        } else if (text.length > 25 && text.length <= 40){
            text = text + ' ' + text + ' ' + text + ' ' + text + ' ' + text + ' ' + text
        } else if (text.length > 40 && text.length <= 60) {
            text = text + ' ' + text + ' ' + text + ' ' + text + ' ' + text
        } else if (text.length > 60 && text.length <= 80) {
            text = text + ' ' + text + ' ' + text + ' ' + text
        } else if (text.length > 80 && text.length <= 110) {
            text = text + ' ' + text + ' ' + text
        } else if (text.length > 110 && text.length <= 130) {
            text = text + ' ' + text
        }
        $('#slot-' + id).children().children().text(text)
    }
    if (slottype == 'fader') {
        $('#slot-' + id).children().text(text)
    }
    if (slottype == 'scroller') {
        $('#slot-' + id).children().children().text(text)
    }
    if (isLoopLyt) { // save xml to layout
        var layoutxml = JSON.parse(localStorage.getItem('layout-offline-' + layoutid))
        var lytslotlist = layoutxml['elements']['0']['elements']['0']['elements']['0']['elements']
        lytslotlist.forEach(function (slot, lindex) {
            var slotid = slot['attributes']['id']
            var slotitem = slot['elements']
            if (slot['name'] == 'text') {
                if (slotid == id) {
                    slotitem.forEach(function (media, mindex) {
                        if (mindex == 0) {
                            layoutxml['elements']['0']['elements']['0']['elements']['0']['elements'][lindex]['elements'] = [media]
                            layoutxml['elements']['0']['elements']['0']['elements']['0']['elements'][lindex]['elements'][0]['elements'][0]['text'] = text
                            localStorage.setItem('layout-offline-' + layoutid, JSON.stringify(layoutxml))
                            clearTimeout(loopTimeout)
                            layoutxml = JSON.parse(localStorage.getItem('layout-offline-' + layoutid))
                            getLayoutXML(layoutxml)
                        }
                    })
                }
            }
        })
    } else { // save xml to ds
        clearTimeout(refreshTimeout)
    }
})

//retrive all text slot
socket.on('getmediaslot', function (msg) {
    var elementMediaCpanelList = []
    if (isLoopLyt) { // check element id from xml storage
        loopArr.forEach(function (xmlData, xindex) {
            var layoutURL = xmlData['attributes']['url']
            var lytname = xmlData['attributes']['name']
            var getLayoutID = layoutURL.split("layout/")
            getLayoutID = getLayoutID[1].slice(0, getLayoutID[1].lastIndexOf('/'))
            var layoutxml = JSON.parse(localStorage.getItem('layout-offline-' + getLayoutID))
            var lytslotlist = layoutxml['elements']['0']['elements']['0']['elements']['0']['elements']
            lytslotlist.forEach(function (slot, lindex) {
                var slotid = slot['attributes']['id']
                var slotname = slot['attributes']['name']
                var slotitem = slot['elements']
                if (slot['name'] == 'media') {
                    var srcName = slotitem[0]['elements']['0']['text']
                    if (srcName) {
                        var n = srcName.lastIndexOf('/')
                        srcName = srcName.substring(n + 1)
                    }
                    var textObj = new Object()
                    textObj.myid = getLayoutID
                    textObj.layout = lytname
                    textObj.id = slotid
                    textObj.slotname = slotname
                    textObj.text = srcName != 'undefined' ? srcName : 'not-found'
                    elementMediaCpanelList.push(textObj)
                }
                if (xindex === loopArr.length - 1) {
                    if (lindex === lytslotlist.length - 1) {
                        //send back to cpanel
                        socket.emit('mediaslot-list', elementMediaCpanelList)
                    }
                }
            })
        })
    } else { //check element id from single layout
        $('.mslot-media').each(function (i, obj) {
            //get all element of text slot
            var thisID = $(this).attr('id')
            var filterID = slotnameList.filter((e) => e.slotid == thisID)
            var thisSlotName = filterID[0]['slotname']
            var srcName = $(this).children().first().attr('src')
            if (srcName) {
                var n = srcName.lastIndexOf('/')
                srcName = srcName.substring(n + 1)
            }
            var textObj = new Object()
            textObj.myid = filterID[0]['layoutid']
            textObj.layout = filterID[0]['layoutname']
            textObj.id = thisID
            textObj.slotname = thisSlotName
            textObj.text = srcName != 'undefined' ? srcName : 'not-found'
            elementMediaCpanelList.push(textObj)

            if (i == $('.mslot-media').length - 1) {
                //send back to cpanel
                socket.emit('mediaslot-list', elementMediaCpanelList)
            }

        })
    }
})

//replace text
socket.on('replacemediaslot', function (msg) {
    var filterID = slotnameList.filter((e) => e.slotname == msg['slotname'])
    var layoutid = filterID[0]['layoutid'] || '2'
    var id = filterID[0]['slotid'] || 'slot-1'
    id = id.split('-')[1]
    var src = msg['slottext']
    var resfolder = msg['resfolder']
    var n = src.lastIndexOf('.')
    var mediamode = src.substring(n + 1)
    var mediaLocalPath = resfolder + '/' + src
    var duration = 0
    var ytbe = src.split("/")
    mediaCurIndex[id] = 1
    medialoop[id] = []
    var ytbe = src.split("/")
    $('#slot-' + id).html('')
    if (['png', 'jpg', 'jpeg', 'bmp', 'gif'].includes(mediamode)) { //image format
        duration = 9999999
        var contentObj = new Object()
        contentObj.contentUrl = mediaLocalPath
        contentObj.contentDuration = duration
        contentObj.contentType = "image/" + mediamode
        contentObj.mediaType = "IMAGE"
        medialoop[id].push(contentObj)
    } else if (ytbe[2] == 'youtu.be') {
        var contentObj = new Object()
        contentObj.contentUrl = ytbe[3]
        contentObj.contentDuration = duration
        contentObj.contentType = "youtube"
        contentObj.mediaType = "YTB"
        medialoop[id].push(contentObj)
    } else if (mediamode == 'm3u8' || mediamode == 'm3u') { //video m3u8 format
        var contentObj = new Object()
        contentObj.contentUrl = src
        contentObj.contentDuration = duration
        contentObj.contentType = "application/x-mpegURL"
        contentObj.mediaType = "STREAM"
        medialoop[id].push(contentObj)
    } else if (['mp4', 'webm', 'mkv'].includes(mediamode)) { //video mp4/webm format
        var contentObj = new Object()
        contentObj.contentUrl = mediaLocalPath
        contentObj.contentDuration = duration
        contentObj.contentType = "video/mp4"
        contentObj.mediaType = "VIDEO"
        medialoop[id].push(contentObj)
        medialoop[id].push(contentObj)
    } else if (['flv'].includes(mediamode)) { //video flv format
        var contentObj = new Object()
        contentObj.contentUrl = src
        contentObj.contentDuration = duration
        contentObj.contentType = "video/x-flv"
        contentObj.mediaType = "CCTV"
        medialoop[id].push(contentObj)
    } else { //none 
    }
    appendMediaElement(medialoop[id][0], '#slot-' + id, id)
    if (isLoopLyt) { // save xml to layout
        var layoutxml = JSON.parse(localStorage.getItem('layout-offline-' + layoutid))
        var lytslotlist = layoutxml['elements']['0']['elements']['0']['elements']['0']['elements']
        lytslotlist.forEach(function (slot, lindex) {
            var slotid = slot['attributes']['id']
            var slotitem = slot['elements']
            if (slot['name'] == 'media') {
                if (slotid == id) {
                    slotitem.forEach(function (media, mindex) {
                        if (mindex == 0) {
                            layoutxml['elements']['0']['elements']['0']['elements']['0']['elements'][lindex]['elements'] = [media]
                            layoutxml['elements']['0']['elements']['0']['elements']['0']['elements'][lindex]['elements'][0]['elements'][0]['text'] = '1/' + src
                            localStorage.setItem('layout-offline-' + layoutid, JSON.stringify(layoutxml))
                            clearTimeout(loopTimeout)
                            layoutxml = JSON.parse(localStorage.getItem('layout-offline-' + layoutid))
                            getLayoutXML(layoutxml)
                        }
                    })
                }
            }
        })
    } else { // save xml to ds
        clearTimeout(refreshTimeout)
    }
})

function getKeyByValue(object, value) {
    return Object.keys(object).find(key => object[key] === value);
}

function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}