var socket = io('https://localhost:9000')

console.log('=== RENDERER PROCESS: Socket created, registering ===')
socket.emit('save id', 'eCLESS:renderer-process')

socket.on('connect', function () {
    console.log('=== RENDERER PROCESS: Connected to socket server ===')
})

socket.on('disconnect', function () {
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
    console.log('=== RENDERER PROCESS: updatelayout REQUEST RECEIVED ===');
    console.log('=== RENDERER PROCESS: Message:', msg);
    console.log('=== RENDERER PROCESS: isLoopLyt status:', isLoopLyt);

    var layoutid = msg['id']
    console.log('=== RENDERER PROCESS: Layout ID:', layoutid);

    var urlServer = config.hostserver + '/layout/' + layoutid + '/ds.xml'
    if (config.corsproxy == 'Y') urlServer = 'https://corsproxy.io/?url=' + encodeURIComponent(config.hostserver + '/layout/' + layoutid + '/ds.xml')
    var layoutURL = urlServer
    console.log('=== RENDERER PROCESS: Layout URL:', layoutURL);

    if (!isLoopLyt) { // save xml to layout
        clearTimeout(refreshTimeout)
        console.log('=== RENDERER PROCESS: Cleared refreshTimeout (not in loop layout) ===');
    } else {
        console.log('=== RENDERER PROCESS: In loop layout mode, skipping refreshTimeout clear ===');
    }
    loopArr = []
    $('#main').html('')
    console.log('=== RENDERER PROCESS: Cleared main content and loopArr ===');
    $.ajax({ //get xml from hostserver
        url: layoutURL,
        type: 'GET',
        success: function (data) {
            console.log('=== RENDERER PROCESS: updatelayout AJAX success ===');
            console.log('=== RENDERER PROCESS: Received XML data for layout:', layoutid);

            //read ds xml
            var xmlText = new XMLSerializer().serializeToString(data)
            var xml = '<?xml version="1.0" encoding="utf-8"?>' + xmlText
            var xmlJSON = convert.xml2json(xml, {
                compact: false,
                spaces: 4
            })
            xmlJSON = JSON.parse(xmlJSON)
            localStorage.setItem('layout-' + layoutid, JSON.stringify(xmlJSON))
            console.log('=== RENDERER PROCESS: Stored layout XML in localStorage: layout-' + layoutid + ' ===');

            var layoutxml = JSON.parse(localStorage.getItem('layout-' + layoutid))
            console.log('=== RENDERER PROCESS: Calling getLayoutXML with layout data ===');
            getLayoutXML(layoutxml)
            console.log('=== RENDERER PROCESS: updatelayout completed successfully ===');
        },
        error: function (xhr, textStatus, errorThrown) {
            console.log('=== RENDERER PROCESS: updatelayout AJAX ERROR ===');
            console.log('=== RENDERER PROCESS: Error status:', textStatus);
            console.log('=== RENDERER PROCESS: Error thrown:', errorThrown);
            console.log('cless server is offline')
        }
    })
})

console.log('=== SOCKETIO-CPANEL.JS FILE START ===')
console.log('Current URL:', window.location.href)
console.log('Socket.io available:', typeof io)

// Global variables - ensure dsid is available from index.html
var dsid = dsid || ''
console.log('=== RENDERER PROCESS: dsid variable:', dsid);

// Helper function to get current layout ID and slot information from DS XML data and slotnameList
function getCurrentLayoutID(slotname, slotnameList) {
    try {
        console.log('=== RENDERER PROCESS: getCurrentLayoutID called with slotname:', slotname);
        console.log('=== RENDERER PROCESS: slotnameList length:', slotnameList ? slotnameList.length : 0);

        // Initialize result object
        var result = {
            layoutid: null,
            slotid: 'slot-1',
            slottype: 'text',
            filterID: null
        };

        // First, try to get slot information from slotnameList if provided
        if (slotnameList && Array.isArray(slotnameList) && slotname) {
            var filterID = slotnameList.filter((e) => e.slotname == slotname);
            console.log('=== RENDERER PROCESS: Filtered slot from slotnameList:', filterID);

            if (filterID && filterID.length > 0) {
                result.filterID = filterID;
                result.layoutid = filterID[0]['layoutid'] || '2';
                result.slotid = filterID[0]['slotid'] || 'slot-1';
                result.slottype = filterID[0]['slottype'] || 'text';
                console.log('=== RENDERER PROCESS: Found slot info from slotnameList:', result);
                return result;
            }
        }

        // If not found in slotnameList, try DS XML approach
        if (typeof dsid !== 'undefined' && dsid) {
            dsxml = JSON.parse(localStorage.getItem(dsid));
            console.log('=== RENDERER PROCESS: DSID XML:', dsxml);
        }

        if (!dsxml || !dsxml.elements || !dsxml.elements[0] || !dsxml.elements[0].elements) {
            console.log('=== RENDERER PROCESS: No valid DS XML found ===');
            return result; // Return with default values
        }

        if (dsxml.elements[0].elements[0].name === 'loop') {
            // Loop layout mode - search through all layouts to find the one containing the slotname
            console.log('=== RENDERER PROCESS: Loop layout detected, searching for slotname across layouts ===');

            if (!slotname) {
                // If no slotname provided, fall back to current layout approach
                if (isLoopLyt && typeof currentlytID !== 'undefined' && currentlytID) {
                    console.log('=== RENDERER PROCESS: No slotname provided, using currentlytID:', currentlytID);
                    result.layoutid = currentlytID;
                    return result;
                }
                // Or use loopArr
                if (typeof loopXMLCurIndex !== 'undefined' && typeof loopArr !== 'undefined' && loopArr.length > 0) {
                    var currentIndex = loopXMLCurIndex > 0 ? loopXMLCurIndex - 1 : 0;
                    if (loopArr[currentIndex] && loopArr[currentIndex].attributes && loopArr[currentIndex].attributes.url) {
                        var layoutURL = loopArr[currentIndex].attributes.url;
                        var layoutID = layoutURL.split("layout/");
                        layoutID = layoutID[1].slice(0, layoutID[1].lastIndexOf('/'));
                        console.log('=== RENDERER PROCESS: Using current layout from loopArr:', layoutID);
                        result.layoutid = layoutID;
                        return result;
                    }
                }
                return result;
            }

            // Get all layout IDs from the loop structure
            var loopElements = dsxml.elements[0].elements[0].elements;
            console.log('=== RENDERER PROCESS: Found', loopElements.length, 'layouts in loop ===');

            // Search through each layout to find the one containing the slotname
            for (var i = 0; i < loopElements.length; i++) {
                var layoutElement = loopElements[i];
                if (layoutElement.attributes && layoutElement.attributes.url) {
                    var layoutURL = layoutElement.attributes.url;
                    var layoutID = layoutURL.split("layout/");
                    layoutID = layoutID[1].slice(0, layoutID[1].lastIndexOf('/'));

                    console.log('=== RENDERER PROCESS: Checking layout:', layoutID, 'for slotname:', slotname);

                    // Try to get layout XML from localStorage
                    var layoutKey = 'layout-offline-' + layoutID;
                    var layoutXML = localStorage.getItem(layoutKey);

                    if (!layoutXML) {
                        layoutKey = 'layout-' + layoutID;
                        layoutXML = localStorage.getItem(layoutKey);
                    }

                    if (layoutXML) {
                        try {
                            var layoutData = JSON.parse(layoutXML);
                            if (layoutData && layoutData.elements && layoutData.elements[0] &&
                                layoutData.elements[0].elements && layoutData.elements[0].elements[0] &&
                                layoutData.elements[0].elements[0].elements && layoutData.elements[0].elements[0].elements[0] &&
                                layoutData.elements[0].elements[0].elements[0].elements) {

                                var slots = layoutData.elements[0].elements[0].elements[0].elements;
                                console.log('=== RENDERER PROCESS: Layout', layoutID, 'has', slots.length, 'slots ===');

                                // Search through slots in this layout
                                for (var j = 0; j < slots.length; j++) {
                                    var slot = slots[j];
                                    if (slot.attributes && slot.attributes.name === slotname) {
                                        console.log('=== RENDERER PROCESS: Found slotname', slotname, 'in layout:', layoutID);
                                        result.layoutid = layoutID;
                                        // Try to extract slot information from XML if available
                                        if (slot.attributes.id) {
                                            result.slotid = 'slot-' + slot.attributes.id;
                                        }
                                        if (slot.name) {
                                            result.slottype = slot.name;
                                        }
                                        return result;
                                    }
                                }
                            }
                        } catch (parseError) {
                            console.warn('=== RENDERER PROCESS: Error parsing layout XML for', layoutID, ':', parseError);
                        }
                    } else {
                        console.warn('=== RENDERER PROCESS: No layout XML found for', layoutID);
                    }
                }
            }

            console.log('=== RENDERER PROCESS: Slotname', slotname, 'not found in any layout ===');
            return result; // Return with default values

        } else {
            // Single layout - get layout ID directly from DS XML
            if (dsxml.elements[0].attributes && dsxml.elements[0].attributes.id) {
                var layoutID = dsxml.elements[0].attributes.id;
                console.log('=== RENDERER PROCESS: Single layout mode, Layout ID:', layoutID);
                result.layoutid = layoutID;
                return result;
            }
        }

        console.log('=== RENDERER PROCESS: Could not extract Layout ID from DS XML ===');
        return result; // Return with default values
    } catch (error) {
        console.error('=== RENDERER PROCESS: Error getting current layout ID:', error);
        return {
            layoutid: null,
            slotid: 'slot-1',
            slottype: 'text',
            filterID: null
        };
    }
}

// Helper function to capitalize first letter

socket.on('error', function (error) {
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
    console.log('=== EXTRACT TEXT SLOTS: Function started ===');
    console.log('=== EXTRACT TEXT SLOTS: DSID:', dsid);

    var textSlots = [];

    try {
        // Parse and retrieve data from local storage
        console.log('=== EXTRACT TEXT SLOTS: Retrieving data from localStorage with key:', dsid);
        var resultOffline = JSON.parse(localStorage.getItem(dsid));

        if (!resultOffline) {
            console.warn('=== EXTRACT TEXT SLOTS: No data found in localStorage for DSID:', dsid);
            return textSlots;
        }

        console.log('=== EXTRACT TEXT SLOTS: localStorage data retrieved successfully');
        console.log('=== EXTRACT TEXT SLOTS: Data structure check - elements array length:',
            resultOffline.elements ? resultOffline.elements.length : 'undefined');

        // Check if data structure is valid
        if (!resultOffline.elements || !resultOffline.elements[0] ||
            !resultOffline.elements[0].elements || !resultOffline.elements[0].elements[0]) {
            console.error('=== EXTRACT TEXT SLOTS: Invalid data structure in localStorage');
            return textSlots;
        }

        // Determine layout type (loop vs single)
        var layoutType = resultOffline['elements'][0]['elements'][0]['name'];
        console.log('=== EXTRACT TEXT SLOTS: Layout type detected:', layoutType);

        if (layoutType == 'loop') {
            // Check if it's a loop layout
            console.log('=== EXTRACT TEXT SLOTS: Processing LOOP layout');
            // Cpanel check if playing loop
            isLoopLyt = true // Set the loop layout flag to true
            console.log('=== EXTRACT TEXT SLOTS: Set isLoopLyt to true');

            resultOffline = resultOffline['elements'][0]['elements'][0]['elements'] // Access the elements of the loop layout
            console.log('=== EXTRACT TEXT SLOTS: Loop layout elements count:', resultOffline.length);

            $.when
                .apply(
                    $,
                    $.map(resultOffline, function (layoutxml, oindex) {

                        layoutURL = layoutxml['attributes']['url'] // Get the layout URL
                        layoutID = layoutURL.split('layout/') // Extract the layout ID from the URL
                        layoutID = layoutID[1].slice(0, layoutID[1].lastIndexOf('/')) // Extract the layout ID
                        layoutxml = JSON.parse(localStorage.getItem('layout-' + layoutID)) // Parse and retrieve layout data from local storage
                        console.log('=== EXTRACT TEXT SLOTS: Processing loop layout index:', layoutID);
                        var slotsFromLayout = extractTextSlotsFromLayoutData(layoutxml, layoutID);
                        console.log('=== EXTRACT TEXT SLOTS: Found', slotsFromLayout.length, 'text slots in layout', layoutID);
                        textSlots = textSlots.concat(slotsFromLayout);
                        return slotsFromLayout;
                    })
                )
        } else {
            // Single layout processing
            console.log('=== EXTRACT TEXT SLOTS: Processing SINGLE layout');
            try {
                var slotsFromLayout = extractTextSlotsFromLayoutData(resultOffline, 0);
                console.log('=== EXTRACT TEXT SLOTS: Found', slotsFromLayout.length, 'text slots in single layout');
                textSlots = textSlots.concat(slotsFromLayout);
            } catch (error) {
                console.error('=== EXTRACT TEXT SLOTS: Error parsing single layout data:', error);
            }
        }

    } catch (error) {
        console.error('=== EXTRACT TEXT SLOTS: Critical error in function:', error);
        console.error('=== EXTRACT TEXT SLOTS: Error stack:', error.stack);
    }

    console.log('=== EXTRACT TEXT SLOTS: Function completed ===');
    console.log('=== EXTRACT TEXT SLOTS: Total text slots extracted:', textSlots.length);
    console.log('=== EXTRACTED TEXT SLOTS ===', textSlots);

    return textSlots;
}

// Function to extract text slots from layout data structure
function extractTextSlotsFromLayoutData(layoutData, layoutKey) {
    console.log('=== EXTRACT LAYOUT DATA: Processing layout key:', layoutKey, layoutData);
    var textSlots = [];

    if (!layoutData || !layoutData.elements) {
        console.warn('=== EXTRACT LAYOUT DATA: Invalid layout data or missing elements for key:', layoutKey);
        return textSlots;
    }

    console.log('=== EXTRACT LAYOUT DATA: Layout data validation passed for key:', layoutKey);

    try {
        // Navigate through the layout structure to find slots
        var elements = layoutData.elements;
        console.log('=== EXTRACT LAYOUT DATA: Elements array length:', elements.length);

        // Extract layout information
        var layoutId = layoutKey.replace('layout-offline-', '').replace('layout-', '');
        var layoutName = 'Layout ' + layoutId;
        console.log('=== EXTRACT LAYOUT DATA: Initial layout ID:', layoutId, 'layout name:', layoutName);

        // Try to get the actual layout name from XML attributes
        if (elements[0] && elements[0].attributes) {
            console.log('=== EXTRACT LAYOUT DATA: Checking for layout name in attributes');
            if (elements[0].attributes.layout) {
                layoutName = elements[0].attributes.layout;
                console.log('=== EXTRACT LAYOUT DATA: Found layout name from layout attribute:', layoutName);
            } else if (elements[0].attributes.name) {
                layoutName = elements[0].attributes.name;
                console.log('=== EXTRACT LAYOUT DATA: Found layout name from name attribute:', layoutName);
            } else if (elements[0].attributes.title) {
                layoutName = elements[0].attributes.title;
                console.log('=== EXTRACT LAYOUT DATA: Found layout name from title attribute:', layoutName);
            }
        }

        // Try to find the layout structure (may vary)
        var slotsContainer = null;
        console.log('=== EXTRACT LAYOUT DATA: Searching for slots container');

        // Common pattern: elements[0].elements[0].elements[0].elements (slot list)
        if (elements[0] &&
            elements[0].elements && elements[0].elements[0] &&
            elements[0].elements[0].elements && elements[0].elements[0].elements[0] &&
            elements[0].elements[0].elements[0].elements) {
            slotsContainer = elements[0].elements[0].elements[0].elements;
            console.log('=== EXTRACT LAYOUT DATA: Found slots container with', slotsContainer.length, 'slots');
        } else {
            console.warn('=== EXTRACT LAYOUT DATA: Could not find slots container in expected structure');
        }

        if (slotsContainer && Array.isArray(slotsContainer)) {
            var textSlotCount = 0;
            console.log('=== EXTRACT LAYOUT DATA: Processing', slotsContainer.length, 'slots');

            slotsContainer.forEach(function (slot, index) {
                console.log('=== EXTRACT LAYOUT DATA: Processing slot', index, 'type:', slot.name);

                if (slot.attributes && slot.attributes.id && slot.attributes.name) {
                    // Check if it's a text-type slot
                    if (slot.name === 'text' || slot.name === 'ticker' ||
                        slot.name === 'fader' || slot.name === 'scroller') {

                        textSlotCount++;
                        console.log('=== EXTRACT LAYOUT DATA: Found text slot', textSlotCount, '- ID:', slot.attributes.id, 'Name:', slot.attributes.name, 'Type:', slot.name);

                        var textContent = '';

                        // Try to extract text content
                        if (slot.elements && slot.elements[0] &&
                            slot.elements[0].elements && slot.elements[0].elements[0] &&
                            slot.elements[0].elements[0].text) {
                            textContent = slot.elements[0].elements[0].text;
                            console.log('=== EXTRACT LAYOUT DATA: Extracted text content (length:', textContent.length, 'chars)');
                        } else {
                            console.log('=== EXTRACT LAYOUT DATA: No text content found for slot');
                        }

                        var slotObj = {
                            myid: layoutId,
                            layout: layoutName,
                            layoutid: layoutId,
                            id: slot.attributes.id,
                            name: slot.attributes.name,
                            slottype: capitalizeFirstLetter(slot.name),
                            text: textContent
                        };

                        textSlots.push(slotObj);
                        console.log('=== EXTRACT LAYOUT DATA: Added text slot to collection:', slotObj.name);
                    } else {
                        console.log('=== EXTRACT LAYOUT DATA: Skipping non-text slot type:', slot.name);
                    }
                } else {
                    console.log('=== EXTRACT LAYOUT DATA: Skipping slot due to missing attributes - ID:', slot.attributes?.id, 'Name:', slot.attributes?.name);
                }
            });

            console.log('=== EXTRACT LAYOUT DATA: Total text slots found in layout:', textSlotCount);
        } else {
            console.warn('=== EXTRACT LAYOUT DATA: No valid slots container found');
        }

    } catch (error) {
        console.error('=== EXTRACT LAYOUT DATA: Error extracting text slots from layout:', layoutKey, error);
        console.error('=== EXTRACT LAYOUT DATA: Error stack:', error.stack);
    }

    console.log('=== EXTRACT LAYOUT DATA: Completed processing layout key:', layoutKey, '- returning', textSlots.length, 'text slots');
    return textSlots;
}

//Replace text
socket.on('replacetextslot', function (msg) {
    console.log('=== RENDERER PROCESS: replacetextslot REQUEST RECEIVED ===');
    console.log('=== RENDERER PROCESS: Message:', msg);
    console.log('=== RENDERER PROCESS: isLoopLyt status:', isLoopLyt);
    console.log('=== RENDERER PROCESS: slotnameList length:', slotnameList.length);

    // Get layout ID and slot information using improved method with slotnameList
    var slotInfo = getCurrentLayoutID(msg['slotname'], slotnameList);
    console.log('=== RENDERER PROCESS: Slot info from getCurrentLayoutID:', slotInfo);

    var layoutid = slotInfo.layoutid;
    var id = slotInfo.slotid;
    var slottype = slotInfo.slottype;

    // Apply fallback values if needed
    if (!layoutid) {
        layoutid = '2'; // Default fallback
        console.log('=== RENDERER PROCESS: Using default Layout ID:', layoutid);
    }

    console.log('=== RENDERER PROCESS: Final Layout ID:', layoutid, 'Slot ID:', id, 'Slot Type:', slottype);

    // Extract numeric slot ID for timeout management
    var numericId = id.split('-')[1];
    var text = msg['slottext'];
    console.log('=== RENDERER PROCESS: Parsed numeric slot ID:', numericId, 'Text:', text);

    clearTimeout(textTimeout[numericId]);
    console.log('=== RENDERER PROCESS: Cleared textTimeout for slot:', numericId);

    // Check isLoopLyt - if content is for different layout, do layout update first
    if (isLoopLyt) {
        console.log('=== RENDERER PROCESS: Is current layout and layout id same Current Layout: ', currentPlayLayoutID, ' Layout to Trigger: ', layoutid, ' ===');
        if (typeof currentPlayLayoutID !== 'undefined' && currentPlayLayoutID && layoutid === currentPlayLayoutID) {
            // Content is for current layout - skip layout switch, go straight to content update
            console.log('=== RENDERER PROCESS: Content for current layout - updating DOM directly ===');
            updateTextSlotContent(numericId, slottype, text);
            return;
        }

        if (loopTimeout) { //clear loopTimeout to reset
            console.log('=== RENDERER PROCESS: Stopped Loop layout interval - DS ID: (' + dsid + ')  ===');
            clearTimeout(loopTimeout)
            loopTimeout = null
        }

        console.log('=== RENDERER PROCESS: Content for different layout ID (' + layoutid + ') - switching using updatelayout pattern ===');

        // Build URL for layout XML
        var urlServer = config.hostserver + '/layout/' + layoutid + '/ds.xml'
        if (config.corsproxy == 'Y') {
            urlServer = 'https://corsproxy.io/?url=' + encodeURIComponent(config.hostserver + '/layout/' + layoutid + '/ds.xml')
        }

        $.ajax({
            url: urlServer,
            type: 'GET',
            success: function (data) {
                console.log('=== RENDERER PROCESS: replacetextslot layout switch AJAX success ===');

                // Read layout XML (same as updatelayout pattern)
                var xmlText = new XMLSerializer().serializeToString(data)
                var xml = '<?xml version="1.0" encoding="utf-8"?>' + xmlText
                var xmlJSON = convert.xml2json(xml, {
                    compact: false,
                    spaces: 4
                })
                xmlJSON = JSON.parse(xmlJSON)
                localStorage.setItem('layout-' + layoutid, JSON.stringify(xmlJSON))
                console.log('=== RENDERER PROCESS: Stored layout XML in localStorage: layout-' + layoutid + ' ===');

                // Get the layout data and render it
                var layoutxml = JSON.parse(localStorage.getItem('layout-' + layoutid))
                console.log('=== RENDERER PROCESS: Calling getLayoutXML with new layout data ===');
                getLayoutXML(layoutxml)
                console.log('=== RENDERER PROCESS: replacetextslot layout switch completed ===');

                // After layout switch, update the text content
                setTimeout(() => updateTextSlotContent(numericId, slottype, text), 2000);
            },
            error: function (xhr, textStatus, errorThrown) {
                console.log('=== RENDERER PROCESS: replacetextslot layout switch AJAX ERROR ===');
                console.log('=== RENDERER PROCESS: Error status:', textStatus);
                console.log('=== RENDERER PROCESS: Error thrown:', errorThrown);
                console.log('=== RENDERER PROCESS: Server is offline, content update failed ===');
            }
        })
    } else {
        // Non-loop layout mode - update content directly
        console.log('=== RENDERER PROCESS: Non-loop layout mode - updating DOM directly ===');
        updateTextSlotContent(numericId, slottype, text);
    }
})

// Helper function to update text slot content in DOM
function updateTextSlotContent(id, slottype, text) {
    if (slottype == 'text') {
        console.log('=== RENDERER PROCESS: Updating text slot:', id);
        $('#slot-' + id).html('<div id="text-' + id + '" class="text-slot">' + text + '</div>')
    }
    if (slottype == 'ticker') {
        console.log('=== RENDERER PROCESS: Updating ticker slot:', id, 'Text length:', text.length);
        if (text.length <= 10) {
            text = text + ' ' + text + ' ' + text + ' ' + text + ' ' + text + ' ' + text + ' ' + text
        } else if (text.length > 10 && text.length <= 25) {
            text = text + ' ' + text + ' ' + text + ' ' + text + ' ' + text + ' ' + text
        } else if (text.length > 25 && text.length <= 40) {
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
        console.log('=== RENDERER PROCESS: Ticker text processed, final length:', text.length);
        $('#slot-' + id).children().children().text(text)
    }
    if (slottype == 'fader') {
        console.log('=== RENDERER PROCESS: Updating fader slot:', id);
        $('#slot-' + id).children().text(text)
    }
    if (slottype == 'scroller') {
        console.log('=== RENDERER PROCESS: Updating scroller slot:', id);
        $('#slot-' + id).children().children().text(text)
    }
}

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
    console.log('=== EXTRACT MEDIA SLOTS: Function started ===');
    console.log('=== EXTRACT MEDIA SLOTS: DSID:', dsid);

    var mediaSlots = [];

    try {
        // Parse and retrieve data from local storage
        console.log('=== EXTRACT MEDIA SLOTS: Retrieving data from localStorage with key:', dsid);
        var resultOffline = JSON.parse(localStorage.getItem(dsid));

        if (!resultOffline) {
            console.warn('=== EXTRACT MEDIA SLOTS: No data found in localStorage for DSID:', dsid);
            return mediaSlots;
        }

        console.log('=== EXTRACT MEDIA SLOTS: localStorage data retrieved successfully');
        console.log('=== EXTRACT MEDIA SLOTS: Data structure check - elements array length:',
            resultOffline.elements ? resultOffline.elements.length : 'undefined');

        // Check if data structure is valid
        if (!resultOffline.elements || !resultOffline.elements[0] ||
            !resultOffline.elements[0].elements || !resultOffline.elements[0].elements[0]) {
            console.error('=== EXTRACT MEDIA SLOTS: Invalid data structure in localStorage');
            return mediaSlots;
        }

        // Determine layout type (loop vs single)
        var layoutType = resultOffline['elements'][0]['elements'][0]['name'];
        console.log('=== EXTRACT MEDIA SLOTS: Layout type detected:', layoutType);

        if (layoutType == 'loop') {
            // Check if it's a loop layout
            console.log('=== EXTRACT MEDIA SLOTS: Processing LOOP layout');
            // Cpanel check if playing loop
            isLoopLyt = true // Set the loop layout flag to true
            console.log('=== EXTRACT MEDIA SLOTS: Set isLoopLyt to true');

            resultOffline = resultOffline['elements'][0]['elements'][0]['elements'] // Access the elements of the loop layout
            console.log('=== EXTRACT MEDIA SLOTS: Loop layout elements count:', resultOffline.length);

            $.when
                .apply(
                    $,
                    $.map(resultOffline, function (layoutxml, oindex) {

                        layoutURL = layoutxml['attributes']['url'] // Get the layout URL
                        layoutID = layoutURL.split('layout/') // Extract the layout ID from the URL
                        layoutID = layoutID[1].slice(0, layoutID[1].lastIndexOf('/')) // Extract the layout ID
                        layoutxml = JSON.parse(localStorage.getItem('layout-' + layoutID)) // Parse and retrieve layout data from local storage
                        console.log('=== EXTRACT MEDIA SLOTS: Processing loop layout index:', layoutID);
                        var slotsFromLayout = extractMediaSlotsFromLayoutData(layoutxml, layoutID);
                        console.log('=== EXTRACT MEDIA SLOTS: Found', slotsFromLayout.length, 'media slots in layout', layoutID);
                        mediaSlots = mediaSlots.concat(slotsFromLayout);
                        return slotsFromLayout;
                    })
                )
        } else {
            // Single layout processing
            console.log('=== EXTRACT MEDIA SLOTS: Processing SINGLE layout');
            try {
                var slotsFromLayout = extractMediaSlotsFromLayoutData(resultOffline, 0);
                console.log('=== EXTRACT MEDIA SLOTS: Found', slotsFromLayout.length, 'media slots in single layout');
                mediaSlots = mediaSlots.concat(slotsFromLayout);
            } catch (error) {
                console.error('=== EXTRACT MEDIA SLOTS: Error parsing single layout data:', error);
            }
        }

    } catch (error) {
        console.error('=== EXTRACT MEDIA SLOTS: Critical error in function:', error);
        console.error('=== EXTRACT MEDIA SLOTS: Error stack:', error.stack);
    }

    console.log('=== EXTRACT MEDIA SLOTS: Function completed ===');
    console.log('=== EXTRACT MEDIA SLOTS: Total media slots extracted:', mediaSlots.length);
    console.log('=== EXTRACTED MEDIA SLOTS ===', mediaSlots);

    return mediaSlots;
}

// Function to extract media slots from layout data structure
function extractMediaSlotsFromLayoutData(layoutData, layoutKey) {
    console.log('=== EXTRACT MEDIA LAYOUT DATA: Processing layout key:', layoutKey, layoutData);
    var mediaSlots = [];

    if (!layoutData || !layoutData.elements) {
        console.warn('=== EXTRACT MEDIA LAYOUT DATA: Invalid layout data or missing elements for key:', layoutKey);
        return mediaSlots;
    }

    console.log('=== EXTRACT MEDIA LAYOUT DATA: Layout data validation passed for key:', layoutKey);

    try {
        // Navigate through the layout structure to find slots
        var elements = layoutData.elements;
        console.log('=== EXTRACT MEDIA LAYOUT DATA: Elements array length:', elements.length);

        // Extract layout information
        var layoutId = layoutKey.replace('layout-offline-', '').replace('layout-', '');
        var layoutName = 'Layout ' + layoutId;
        console.log('=== EXTRACT MEDIA LAYOUT DATA: Initial layout ID:', layoutId, 'layout name:', layoutName);

        // Try to get the actual layout name from XML attributes
        if (elements[0] && elements[0].attributes) {
            console.log('=== EXTRACT MEDIA LAYOUT DATA: Checking for layout name in attributes');
            if (elements[0].attributes.layout) {
                layoutName = elements[0].attributes.layout;
                console.log('=== EXTRACT MEDIA LAYOUT DATA: Found layout name from layout attribute:', layoutName);
            } else if (elements[0].attributes.name) {
                layoutName = elements[0].attributes.name;
                console.log('=== EXTRACT MEDIA LAYOUT DATA: Found layout name from name attribute:', layoutName);
            } else if (elements[0].attributes.title) {
                layoutName = elements[0].attributes.title;
                console.log('=== EXTRACT MEDIA LAYOUT DATA: Found layout name from title attribute:', layoutName);
            }
        }

        // Try to find the layout structure (may vary)
        var slotsContainer = null;
        console.log('=== EXTRACT MEDIA LAYOUT DATA: Searching for slots container');

        // Common pattern: elements[0].elements[0].elements[0].elements (slot list)
        if (elements[0] &&
            elements[0].elements && elements[0].elements[0] &&
            elements[0].elements[0].elements && elements[0].elements[0].elements[0] &&
            elements[0].elements[0].elements[0].elements) {
            slotsContainer = elements[0].elements[0].elements[0].elements;
            console.log('=== EXTRACT MEDIA LAYOUT DATA: Found slots container with', slotsContainer.length, 'slots');
        } else {
            console.warn('=== EXTRACT MEDIA LAYOUT DATA: Could not find slots container in expected structure');
        }

        if (slotsContainer && Array.isArray(slotsContainer)) {
            var mediaSlotCount = 0;
            console.log('=== EXTRACT MEDIA LAYOUT DATA: Processing', slotsContainer.length, 'slots');

            slotsContainer.forEach(function (slot, index) {
                console.log('=== EXTRACT MEDIA LAYOUT DATA: Processing slot', index, 'type:', slot.name);

                if (slot.attributes && slot.attributes.id && slot.attributes.name) {
                    // Check if it's a media slot
                    if (slot.name === 'media') {

                        mediaSlotCount++;
                        console.log('=== EXTRACT MEDIA LAYOUT DATA: Found media slot', mediaSlotCount, '- ID:', slot.attributes.id, 'Name:', slot.attributes.name, 'Type:', slot.name);

                        var mediaContent = '';

                        // Try to extract media content (file path)
                        if (slot.elements && slot.elements[0] &&
                            slot.elements[0].elements && slot.elements[0].elements[0] &&
                            slot.elements[0].elements[0].text) {
                            mediaContent = slot.elements[0].elements[0].text;
                            console.log('=== EXTRACT MEDIA LAYOUT DATA: Extracted media content:', mediaContent);

                            // Extract just the filename from path
                            if (mediaContent) {
                                var n = mediaContent.lastIndexOf('/');
                                if (n !== -1) {
                                    var originalContent = mediaContent;
                                    mediaContent = mediaContent.substring(n + 1);
                                    console.log('=== EXTRACT MEDIA LAYOUT DATA: Extracted filename from path:', originalContent, '->', mediaContent);
                                }
                            }
                        } else {
                            console.log('=== EXTRACT MEDIA LAYOUT DATA: No media content found for slot');
                        }

                        var slotObj = {
                            myid: layoutId,
                            layout: layoutName,
                            layoutid: layoutId,
                            id: slot.attributes.id,
                            name: slot.attributes.name,
                            slottype: capitalizeFirstLetter(slot.name),
                            text: mediaContent || 'not-found'
                        };

                        mediaSlots.push(slotObj);
                        console.log('=== EXTRACT MEDIA LAYOUT DATA: Added media slot to collection:', slotObj.name);
                    } else {
                        console.log('=== EXTRACT MEDIA LAYOUT DATA: Skipping non-media slot type:', slot.name);
                    }
                } else {
                    console.log('=== EXTRACT MEDIA LAYOUT DATA: Skipping slot due to missing attributes - ID:', slot.attributes?.id, 'Name:', slot.attributes?.name);
                }
            });

            console.log('=== EXTRACT MEDIA LAYOUT DATA: Total media slots found in layout:', mediaSlotCount);
        } else {
            console.warn('=== EXTRACT MEDIA LAYOUT DATA: No valid slots container found');
        }

    } catch (error) {
        console.error('=== EXTRACT MEDIA LAYOUT DATA: Error extracting media slots from layout:', layoutKey, error);
        console.error('=== EXTRACT MEDIA LAYOUT DATA: Error stack:', error.stack);
    }

    console.log('=== EXTRACT MEDIA LAYOUT DATA: Completed processing layout key:', layoutKey, '- returning', mediaSlots.length, 'media slots');
    return mediaSlots;
}

//replace media
socket.on('replacemediaslot', function (msg) {
    console.log('=== RENDERER PROCESS: replacemediaslot REQUEST RECEIVED ===');
    console.log('=== RENDERER PROCESS: Message:', msg);
    console.log('=== RENDERER PROCESS: isLoopLyt status:', isLoopLyt);
    console.log('=== RENDERER PROCESS: slotnameList length:', slotnameList.length);

    // Get layout ID and slot information using improved method with slotnameList
    var slotInfo = getCurrentLayoutID(msg['slotname'], slotnameList);
    console.log('=== RENDERER PROCESS: Slot info from getCurrentLayoutID:', slotInfo);

    var layoutid = slotInfo.layoutid;
    var id = slotInfo.slotid;

    // Apply fallback values if needed
    if (!layoutid) {
        layoutid = '2'; // Default fallback
        console.log('=== RENDERER PROCESS: Using default Layout ID:', layoutid);
    }

    console.log('=== RENDERER PROCESS: Final Layout ID:', layoutid, 'Slot ID:', id);

    // Extract numeric slot ID for media handling
    var numericId = id.split('-')[1];
    var src = msg['slottext'];
    var resfolder = msg['resfolder'];
    console.log('=== RENDERER PROCESS: Parsed numeric slot ID:', numericId, 'Source:', src, 'Resource folder:', resfolder);

    var n = src.lastIndexOf('.');
    var mediamode = src.substring(n + 1);
    var mediaLocalPath = resfolder + '/' + src;
    console.log('=== RENDERER PROCESS: Media mode:', mediamode, 'Local path:', mediaLocalPath);

    var duration = 0;
    var ytbe = src.split("/");

    // Create media object based on media type
    var contentObj = createMediaObject(src, mediamode, mediaLocalPath, duration, ytbe);

    // Helper function to update media content in DOM
    function updateMediaSlotContent() {
        if (contentObj) {
            mediaCurIndex[numericId] = 1;
            medialoop[numericId] = [];
            medialoop[numericId].push(contentObj);
            $('#slot-' + numericId).html('');
            console.log('=== RENDERER PROCESS: Cleared slot content and initialized media arrays ===');
            appendMediaElement(medialoop[numericId][0], '#slot-' + numericId, numericId);
            console.log('=== RENDERER PROCESS: Called appendMediaElement ===');
        }
    }

    // Check isLoopLyt - if content is for different layout, do layout update first
    if (isLoopLyt) {
        if (typeof currentPlayLayoutID !== 'undefined' && currentPlayLayoutID && layoutid === currentPlayLayoutID) {
            // Content is for current layout - skip layout switch, go straight to content update
            console.log('=== RENDERER PROCESS: Content for current layout - updating DOM directly ===');
            updateMediaSlotContent();
            return;
        }

        console.log('=== RENDERER PROCESS: Content for different layout ID (' + layoutid + ') - switching using updatelayout pattern ===');

        // Build URL for layout XML
        var urlServer = config.hostserver + '/layout/' + layoutid + '/ds.xml'
        if (config.corsproxy == 'Y') {
            urlServer = 'https://corsproxy.io/?url=' + encodeURIComponent(config.hostserver + '/layout/' + layoutid + '/ds.xml')
        }

        $.ajax({
            url: urlServer,
            type: 'GET',
            success: function (data) {
                console.log('=== RENDERER PROCESS: replacemediaslot layout switch AJAX success ===');

                // Read layout XML (same as updatelayout pattern)
                var xmlText = new XMLSerializer().serializeToString(data)
                var xml = '<?xml version="1.0" encoding="utf-8"?>' + xmlText
                var xmlJSON = convert.xml2json(xml, {
                    compact: false,
                    spaces: 4
                })
                xmlJSON = JSON.parse(xmlJSON)
                localStorage.setItem('layout-' + layoutid, JSON.stringify(xmlJSON))
                console.log('=== RENDERER PROCESS: Stored layout XML in localStorage: layout-' + layoutid + ' ===');

                // Get the layout data and render it
                var layoutxml = JSON.parse(localStorage.getItem('layout-' + layoutid))
                console.log('=== RENDERER PROCESS: Calling getLayoutXML with new layout data ===');
                getLayoutXML(layoutxml)
                console.log('=== RENDERER PROCESS: replacemediaslot layout switch completed ===');

                // After layout switch, update the media content
                updateMediaSlotContent();
            },
            error: function (xhr, textStatus, errorThrown) {
                console.log('=== RENDERER PROCESS: replacemediaslot layout switch AJAX ERROR ===');
                console.log('=== RENDERER PROCESS: Error status:', textStatus);
                console.log('=== RENDERER PROCESS: Error thrown:', errorThrown);
                console.log('=== RENDERER PROCESS: Server is offline, content update failed ===');
            }
        })
    } else {
        // Non-loop layout mode - update content directly
        console.log('=== RENDERER PROCESS: Non-loop layout mode - updating DOM directly ===');
        updateMediaSlotContent();
    }
})

// Helper function to create media object based on media type
function createMediaObject(src, mediamode, mediaLocalPath, duration, ytbe) {
    var contentObj = new Object();

    if (['png', 'jpg', 'jpeg', 'bmp', 'gif'].includes(mediamode)) { //image format
        console.log('=== RENDERER PROCESS: Processing image media ===');
        duration = 9999999
        contentObj.contentUrl = mediaLocalPath
        contentObj.contentDuration = duration
        contentObj.contentType = "image/" + mediamode
        contentObj.mediaType = "IMAGE"
    } else if (ytbe[2] == 'youtu.be') {
        console.log('=== RENDERER PROCESS: Processing YouTube media ===');
        contentObj.contentUrl = ytbe[3]
        contentObj.contentDuration = duration
        contentObj.contentType = "youtube"
        contentObj.mediaType = "YTB"
    } else if (mediamode == 'm3u8' || mediamode == 'm3u') { //video m3u8 format
        console.log('=== RENDERER PROCESS: Processing m3u8 stream media ===');
        contentObj.contentUrl = src
        contentObj.contentDuration = duration
        contentObj.contentType = "application/x-mpegURL"
        contentObj.mediaType = "STREAM"
    } else if (['mp4', 'webm', 'mkv'].includes(mediamode)) { //video mp4/webm format
        console.log('=== RENDERER PROCESS: Processing video media (mp4/webm/mkv) ===');
        contentObj.contentUrl = mediaLocalPath
        contentObj.contentDuration = duration
        contentObj.contentType = "video/mp4"
        contentObj.mediaType = "VIDEO"
    } else if (['flv'].includes(mediamode)) { //video flv format
        console.log('=== RENDERER PROCESS: Processing FLV stream media ===');
        contentObj.contentUrl = src
        contentObj.contentDuration = duration
        contentObj.contentType = "video/x-flv"
        contentObj.mediaType = "CCTV"
    } else { //none 
        console.log('=== RENDERER PROCESS: WARNING - Unknown media format:', mediamode, '===');
        return null;
    }

    return contentObj;
}

function getKeyByValue(object, value) {
    return Object.keys(object).find(key => object[key] === value);
}

function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}