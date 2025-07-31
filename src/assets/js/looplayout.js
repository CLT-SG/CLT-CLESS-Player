// Global variable loopArr is declared in index.html
var loopXMLCurIndex = 1
var loopTimeout = null

function loopNextLayout() {
  if (loopXMLCurIndex >= loopArr.length) {
    // if this is last loop layout then reset counter of current loop timeout
    loopXMLCurIndex = 0
  }
  layoutLoopUpdateXML() // keep updating ds xml to get updated each loop
  playcurrentLayout(loopArr[loopXMLCurIndex])
  loopXMLCurIndex++
}

function playcurrentLayout(xmlData) {
  //clear textTimeout slot-text.js
  for (var i = 0; i < textTimeout.length; i++) {
    clearTimeout(textTimeout[i]);
  }
  //clear mediaTimeout slot-media.js
  for (var i = 0; i < mediaTimeout.length; i++) {
    clearTimeout(mediaTimeout[i]);
  }
  //clear colImageTimeout slot-table.js
  for (var i = 0; i < colImageTimeout.length; i++) {
    clearTimeout(colImageTimeout[i]);
  }
  //clear colFaderTimeout slot-table.js
  for (var i = 0; i < colFaderTimeout.length; i++) {
    clearTimeout(colFaderTimeout[i]);
  }
  //clear interval if running slot-table.js
  for (var i = 0; i < pageAutoInterval.length; i++) {
    clearInterval(pageAutoInterval[i]);
  }
  
  $('#main').html('') //reset whole page html
  if (loopTimeout) { //clear loopTimeout to reset
    clearTimeout(loopTimeout)
    loopTimeout - new Array()
  }
  var layoutURL = xmlData['attributes']['url']
  currentlytID = layoutURL.split("layout/")
  currentlytID = currentlytID[1].slice(0, currentlytID[1].lastIndexOf('/'))
  var layoutDuration = parseInt(xmlData['attributes']['duration']) * 1000
  var layoutxml = JSON.parse(localStorage.getItem('layout-' + currentlytID))
  log.info('play loop xml : ok : layout-' + currentlytID)
  getLayoutXML(layoutxml)
  layoutLoopUpdateXML()
  //time of layout play
  loopTimeout = setTimeout(loopNextLayout, layoutDuration)
}

function layoutLoopUpdateXML() {
  // Return a new Promise
  return new Promise((resolve, reject) => {

    var serverAdd = config.hostserver; // Get the server address from the configuration
    log.info('Layout Loop: Updating xml..'); // Log the online mode

    // Set up proxy if enabled
    var urlServer = serverAdd + '/' + dsid + '/ds.xml'; // Create the URL for fetching XML data
    if (config.corsproxy == 'Y') {
      urlServer = 'https://corsproxy.io/?url=' + encodeURIComponent(serverAdd + '/' + dsid + '/ds.xml'); // Use CORS proxy if enabled
    }

    $.ajax({
      url: urlServer, // Specify the URL for the AJAX request
      type: 'GET', // Use the GET method
      timeout: 5000, // Set a timeout of 5 seconds for the request
      success: function (dsData) {
        log.info('GET XML: OK'); // Log a successful XML retrieval
        if (typeof dsData === 'string') {
          log.warn('get xml : unable to read or data was string format : ' + data, urlServer)
          location.href = 'offline.html'; // Redirect to offline.html if dsData is a string
          remote.getCurrentWindow().focus(); // Focus on the current window
          reject('Data is in string format, redirected to offline.html'); // Reject the promise with an error message
        } else {
          // Read DS XML
          var xmlText = new XMLSerializer().serializeToString(dsData); // Serialize XML dsData to text
          var xml = '<?xml version="1.0" encoding="utf-8"?>' + xmlText; // Create a well-formed XML string
          var result2 = convert.xml2json(xml, {
            compact: false,
            spaces: 4,
            trim: false
          }); // Convert XML to JSON
          result2 = JSON.parse(result2); // Parse the JSON result
          localStorage.setItem(dsid, JSON.stringify(result2)); // Store the dsData in local storage

          if (result2['elements'][0]['elements'][0]['name'] == 'loop') { // Check if it's a loop layout
            result2 = result2['elements'][0]['elements'][0]['elements']; // Access the elements of the loop layout

            // Process each layout in the loop
            $.when.apply($, $.map(result2, function (layoutxml, oindex) {
              var layoutURL = layoutxml['attributes']['url']; // Get the layout URL
              var layoutID = layoutURL.split("layout/"); // Extract the layout ID from the URL
              layoutID = layoutID[1].slice(0, layoutID[1].lastIndexOf('/')); // Extract the layout ID
              layoutURLList[oindex] = layoutURL
              layoutIDList[oindex] = layoutID
              loopArr[oindex] = layoutxml

              // Use proxy if enabled
              if (config.corsproxy == 'Y') {
                layoutURL = 'https://corsproxy.io/?url=' + encodeURIComponent(layoutURL); // Use CORS proxy if enabled
              }

              // Return a new AJAX request for each layout URL
              return $.ajax({
                url: layoutURL, // Specify the URL for the AJAX request
                type: 'GET', // Use the GET method
                success: function (data) {
                  log.info('GET Loop XML: OK'); // Log a successful loop XML retrieval
                  // Read DS XML
                  var xmlText = new XMLSerializer().serializeToString(data); // Serialize XML data to text
                  var xml = '<?xml version="1.0" encoding="utf-8"?>' + xmlText; // Create a well-formed XML string
                  var xmlJSON = convert.xml2json(xml, {
                    compact: false,
                    spaces: 4
                  }); // Convert XML to JSON
                  xmlJSON = JSON.parse(xmlJSON); // Parse the JSON result
                  localStorage.setItem('layout-' + layoutID, JSON.stringify(xmlJSON)); // Store the layout data in local storage
                  localStorage.setItem('layout-offline-' + layoutID, JSON.stringify(xmlJSON)); // Store the offline layout data in local storage
                  log.info(`${layoutURL} XML updated.`); // Log a successful loop XML retrieval
                },
                error: function (xhr, textStatus, errorThrown) {
                  log.warn('GET Loop XML: Failed: URL: ' + layoutURL + ', ' + xhr.responseText); // Log a failed loop XML retrieval
                  reject('Failed to get loop XML: ' + xhr.responseText); // Reject the promise with an error message
                }
              });
            })).then(function () {
              // All layout XML has been stored, and then start to play the first layout
              log.info('Online mode: All layout loop XML has been updated.'); // Log the storage of all loop XML
              resolve('loop'); // Resolve the promise indicating completion
            });
          } else { // If it's a single layout
            getLayoutXML(result2); // Get the layout XML
            resolve('single'); // Resolve the promise indicating completion
          }
        }
      },
      error: function (xhr, textStatus, errorThrown) {
        log.warn('GET XML: Failed: ' + textStatus); // Log a failed XML retrieval
        var resultOffline = JSON.parse(localStorage.getItem(textStatus)); // Parse and retrieve data from local storage
        log.info('GET XML: Recheck network again in 5 seconds: ' + textStatus); // Log a recheck of the network in 5 seconds
        setTimeout(getxml, 5000); // Retry fetching XML data after 5 seconds
        reject('Failed to get XML: ' + textStatus); // Reject the promise with an error message
      }
    });
  });
}

// Usage example:
layoutLoopUpdateXML().then(() => {
  console.log('XML Update completed'); // Log a message when XML update is completed
}).catch((error) => {
  console.error('An error occurred:', error); // Log an error message if the promise is rejected
});