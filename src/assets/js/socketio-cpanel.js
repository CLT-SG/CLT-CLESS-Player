console.log('=== SOCKETIO-CPANEL.JS: File loading started ===')
console.log('=== SOCKETIO-CPANEL.JS: Checking if io is available ===', typeof io)

// Create test data in localStorage immediately when this script loads
console.log('=== CREATING TEST DATA ===')
var testLayoutData = {
    'elements': [{
        'attributes': { 'layout': 'Test Layout', 'id': 'test-layout' },
        'elements': [{
            'elements': [{
                'elements': [
                    {
                        'name': 'text',
                        'attributes': { 'id': 'slot-1', 'name': 'Test Text Slot 1' },
                        'elements': [{ 'elements': [{ 'text': 'This is test text content' }] }]
                    },
                    {
                        'name': 'ticker',
                        'attributes': { 'id': 'slot-2', 'name': 'Test Ticker Slot' },
                        'elements': [{ 'elements': [{ 'text': 'Breaking: This is a test ticker!' }] }]
                    },
                    {
                        'name': 'media',
                        'attributes': { 'id': 'slot-3', 'name': 'Test Media Slot' },
                        'elements': [{ 'elements': [{ 'text': '/media/test-image.jpg' }] }]
                    },
                    {
                        'name': 'text',
                        'attributes': { 'id': 'slot-4', 'name': 'Test Text Slot 2' },
                        'elements': [{ 'elements': [{ 'text': 'Another test text content' }] }]
                    }
                ]
            }]
        }]
    }]
}

// Store test data
localStorage.setItem('layout-test-001', JSON.stringify(testLayoutData))
localStorage.setItem('layout-offline-demo', JSON.stringify(testLayoutData))
console.log('=== TEST DATA STORED ===')
console.log('localStorage length:', localStorage.length)

var socket = io('https://localhost:9000')

console.log('=== RENDERER PROCESS: Socket created, registering ===')
socket.emit('save id', 'eCLESS:renderer-process')

socket.on('connect', function() {
    console.log('=== RENDERER PROCESS: Connected to socket server ===')
})

socket.on('disconnect', function() {
    console.log('=== RENDERER PROCESS: Disconnected from socket server ===')
})

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

console.log('=== SOCKETIO-CPANEL.JS FILE START ===')
console.log('Current URL:', window.location.href)
console.log('Socket.io available:', typeof io)

// Test basic alert to see if this code runs
if (typeof window !== 'undefined') {
    console.log('=== WINDOW AVAILABLE ===')
} else {
    console.log('=== NO WINDOW OBJECT ===')
}

// Helper function to capitalize first letter

socket.on('error', function(error) {
    console.log('=== SOCKET ERROR ===', error)
})

//retrive all text slot
socket.on('gettextslot', function (msg) {
    console.log('=== RENDERER PROCESS: gettextslot REQUEST RECEIVED ===');
    console.log('=== RENDERER PROCESS: Message:', msg);
    
    try {
        var textSlots = extractTextSlotsFromLocalStorage();
        console.log('=== RENDERER PROCESS: Found', textSlots.length, 'text slots ===');
        
        // Send the text slots back to the control panel
        socket.emit('textslot-list', textSlots);
        console.log('=== RENDERER PROCESS: Sent text slots to control panel ===');
    } catch (error) {
        console.error('=== RENDERER PROCESS: Error getting text slots ===', error);
        // Send empty array on error
        socket.emit('textslot-list', []);
    }
});

// Helper function to capitalize first letter
function capitalizeFirstLetter(string) {
    if (!string) return '';
    return string.charAt(0).toUpperCase() + string.slice(1);
}

// Function to extract text slots from localStorage
function extractTextSlotsFromLocalStorage() {
    var textSlots = [];
    
    // Scan through all localStorage keys to find layout data
    for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        
        // Check for layout keys (pattern: 'layout-*' or main DS data)
        if (key && (key.startsWith('layout-') || key.match(/^[a-zA-Z0-9_-]+$/))) {
            try {
                var layoutData = JSON.parse(localStorage.getItem(key));
                var slotsFromLayout = extractTextSlotsFromLayoutData(layoutData, key);
                textSlots = textSlots.concat(slotsFromLayout);
            } catch (error) {
                console.warn('Error parsing layout data for key:', key, error);
            }
        }
    }
    
    console.log('=== EXTRACTED TEXT SLOTS ===', textSlots);
    return textSlots;
}

// Function to extract text slots from layout data structure
function extractTextSlotsFromLayoutData(layoutData, layoutKey) {
    var textSlots = [];
    
    if (!layoutData || !layoutData.elements) {
        return textSlots;
    }
    
    try {
        // Navigate through the layout structure to find slots
        var elements = layoutData.elements;
        
        // Extract layout information
        var layoutId = layoutKey.replace('layout-offline-', '').replace('layout-', '');
        var layoutName = 'Layout ' + layoutId;
        
        // Try to get the actual layout name from XML attributes
        if (elements[0] && elements[0].attributes) {
            if (elements[0].attributes.layout) {
                layoutName = elements[0].attributes.layout;
            } else if (elements[0].attributes.name) {
                layoutName = elements[0].attributes.name;
            } else if (elements[0].attributes.title) {
                layoutName = elements[0].attributes.title;
            }
        }
        
        // Try to find the layout structure (may vary)
        var slotsContainer = null;
        
        // Common pattern: elements[0].elements[0].elements[0].elements (slot list)
        if (elements[0] && 
            elements[0].elements && elements[0].elements[0] && 
            elements[0].elements[0].elements && elements[0].elements[0].elements[0] &&
            elements[0].elements[0].elements[0].elements) {
            slotsContainer = elements[0].elements[0].elements[0].elements;
        }
        
        if (slotsContainer && Array.isArray(slotsContainer)) {
            slotsContainer.forEach(function(slot, index) {
                if (slot.attributes && slot.attributes.id && slot.attributes.name) {
                    // Check if it's a text-type slot
                    if (slot.name === 'text' || slot.name === 'ticker' || 
                        slot.name === 'fader' || slot.name === 'scroller') {
                        
                        var textContent = '';
                        
                        // Try to extract text content
                        if (slot.elements && slot.elements[0] && 
                            slot.elements[0].elements && slot.elements[0].elements[0] &&
                            slot.elements[0].elements[0].text) {
                            textContent = slot.elements[0].elements[0].text;
                        }
                        
                        textSlots.push({
                            myid: layoutId,
                            layout: layoutName,
                            layoutid: layoutId,
                            id: slot.attributes.id,
                            name: slot.attributes.name,
                            slottype: capitalizeFirstLetter(slot.name),
                            text: textContent
                        });
                    }
                }
            });
        }
        
    } catch (error) {
        console.warn('Error extracting text slots from layout:', layoutKey, error);
    }
    
    return textSlots;
}

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

//retrive all media slot
socket.on('getmediaslot', function (msg) {
    console.log('=== RENDERER PROCESS: getmediaslot REQUEST RECEIVED ===');
    console.log('=== RENDERER PROCESS: Message:', msg);
    
    try {
        var mediaSlots = extractMediaSlotsFromLocalStorage();
        console.log('=== RENDERER PROCESS: Found', mediaSlots.length, 'media slots ===');
        
        // Send the media slots back to the control panel
        socket.emit('mediaslot-list', mediaSlots);
        console.log('=== RENDERER PROCESS: Sent media slots to control panel ===');
    } catch (error) {
        console.error('=== RENDERER PROCESS: Error getting media slots ===', error);
        // Send empty array on error
        socket.emit('mediaslot-list', []);
    }
});

// Function to extract media slots from localStorage
function extractMediaSlotsFromLocalStorage() {
    var mediaSlots = [];
    
    // Scan through all localStorage keys to find layout data
    for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        
        // Check for layout keys (pattern: 'layout-*' or main DS data)
        if (key && (key.startsWith('layout-') || key.match(/^[a-zA-Z0-9_-]+$/))) {
            try {
                var layoutData = JSON.parse(localStorage.getItem(key));
                var slotsFromLayout = extractMediaSlotsFromLayoutData(layoutData, key);
                mediaSlots = mediaSlots.concat(slotsFromLayout);
            } catch (error) {
                console.warn('Error parsing layout data for key:', key, error);
            }
        }
    }
    
    console.log('=== EXTRACTED MEDIA SLOTS ===', mediaSlots);
    return mediaSlots;
}

// Function to extract media slots from layout data structure
function extractMediaSlotsFromLayoutData(layoutData, layoutKey) {
    var mediaSlots = [];
    
    if (!layoutData || !layoutData.elements) {
        return mediaSlots;
    }
    
    try {
        // Navigate through the layout structure to find slots
        var elements = layoutData.elements;
        
        // Extract layout information
        var layoutId = layoutKey.replace('layout-offline-', '').replace('layout-', '');
        var layoutName = 'Layout ' + layoutId;
        
        // Try to get the actual layout name from XML attributes
        if (elements[0] && elements[0].attributes) {
            if (elements[0].attributes.layout) {
                layoutName = elements[0].attributes.layout;
            } else if (elements[0].attributes.name) {
                layoutName = elements[0].attributes.name;
            } else if (elements[0].attributes.title) {
                layoutName = elements[0].attributes.title;
            }
        }
        
        // Try to find the layout structure (may vary)
        var slotsContainer = null;
        
        // Common pattern: elements[0].elements[0].elements[0].elements (slot list)
        if (elements[0] && 
            elements[0].elements && elements[0].elements[0] && 
            elements[0].elements[0].elements && elements[0].elements[0].elements[0] &&
            elements[0].elements[0].elements[0].elements) {
            slotsContainer = elements[0].elements[0].elements[0].elements;
        }
        
        if (slotsContainer && Array.isArray(slotsContainer)) {
            slotsContainer.forEach(function(slot, index) {
                if (slot.attributes && slot.attributes.id && slot.attributes.name) {
                    // Check if it's a media slot
                    if (slot.name === 'media') {
                        
                        var mediaContent = '';
                        
                        // Try to extract media content (file path)
                        if (slot.elements && slot.elements[0] && 
                            slot.elements[0].elements && slot.elements[0].elements[0] &&
                            slot.elements[0].elements[0].text) {
                            mediaContent = slot.elements[0].elements[0].text;
                            
                            // Extract just the filename from path
                            if (mediaContent) {
                                var n = mediaContent.lastIndexOf('/');
                                if (n !== -1) {
                                    mediaContent = mediaContent.substring(n + 1);
                                }
                            }
                        }
                        
                        mediaSlots.push({
                            myid: layoutId,
                            layout: layoutName,
                            layoutid: layoutId,
                            id: slot.attributes.id,
                            name: slot.attributes.name,
                            text: mediaContent || 'not-found'
                        });
                    }
                }
            });
        }
        
    } catch (error) {
        console.warn('Error extracting media slots from layout:', layoutKey, error);
    }
    
    return mediaSlots;
}

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