  var textTimeout = new Array()
  var textCurIndex = new Array()
  var textloop = new Array()
  var repeatText = true
  var fontTextalign
  var fontValign

  //custom text slot when available
  function textCustomFunc(slot, index) {

      if (slot['attributes']['font']) {

          var fontName = slot['attributes']['font']
          var fontColor = slot['attributes']['fontcolor']
          var fontSize = slot['attributes']['fontsize']
          fontTextalign = slot['attributes']['align']
          fontValign = slot['attributes']['valign']
          if (fontTextalign == 'c') {
              fontTextalign = 'center'
          } else if (fontTextalign == 'l') {
              fontTextalign = 'left'
          } else {
              fontTextalign = 'right'
          }

          //TICKER VERTICAL ALIGN
          if (fontValign == 'middle') {
              fontValign = slot['attributes']['height'] + 'px'
          } else if (fontValign == 'top') {
              fontValign = fontSize + 'px'
          }
          $('#slot-' + index).css({
              "padding": 0,
              "font-family": fontName,
              "color": fontColor,
              "font-size": fontSize + 'px',
              "text-align": fontTextalign,
              "line-height": fontValign,
              "text-overflow": "clip", //hide text if out from element
              //"white-space": "nowrap" // dont wrap to second line
          })
      }
  }

  function textFunc(slotitem, slotid, index) {
      textCurIndex[slotid] = 1
      textloop[slotid] = []
      
      // Defensive check for slotitem
      if (!slotitem || !Array.isArray(slotitem) || slotitem.length === 0) {
          console.error('[textFunc] Invalid slotitem for slot:', slotid, 'Type:', typeof slotitem);
          return;
      }
      
      slotitem.forEach(function (text, mindex) {
          // Defensive check for text element
          if (!text) {
              console.error('[textFunc] Invalid text element at index', mindex, 'for slot', slotid);
              return;
          }
          
          // Enhanced defensive check for nested elements - handle both array and object
          var src = '';
          if (!text['elements']) {
              console.warn('[textFunc] No elements property in text element at index', mindex, 'for slot', slotid);
              src = '';
          } else {
              // Handle both array and object-based elements
              var firstElement = null;
              if (Array.isArray(text['elements'])) {
                  firstElement = text['elements'][0];
              } else if (typeof text['elements'] === 'object') {
                  firstElement = text['elements']['0'];
              }
              
              if (!firstElement) {
                  console.warn('[textFunc] Empty elements in text element at index', mindex, 'for slot', slotid);
                  src = '';
              } else if (!firstElement['text']) {
                  console.warn('[textFunc] No text property in elements[0] at index', mindex, 'for slot', slotid);
                  src = '';
              } else {
                  src = firstElement['text'];
              }
          }
          
          // Validate duration attribute
          if (!text['attributes'] || !text['attributes']['duration']) {
              console.warn('[textFunc] Missing duration attribute at index', mindex, 'for slot', slotid);
              var duration = 5; // Default 5 seconds
          } else {
              var duration = text['attributes']['duration'];
          }
          
          var contentObj = new Object()
          contentObj.text = src
          contentObj.duration = parseInt(duration) * 1000
          textloop[slotid].push(contentObj)
          if (mindex === slotitem.length - 1) {
              if (textloop[slotid][0]) {
                  appendTextElement(textloop[slotid][0])
              } else {
                  console.error('[textFunc] No valid text content to display for slot', slotid);
              }
          }
      })

      //play next text after current text has finished
      function changeText() {
          if (textCurIndex[slotid] >= textloop[slotid].length) {
              // modified this so it would display the first image/video when looping
              textCurIndex[slotid] = 0
          }
          appendTextElement(textloop[slotid][textCurIndex[slotid]])
          textCurIndex[slotid]++
      }

      //render every text slot
      function appendTextElement(item) {
          checkTextSrc(item).then((src) => {
              if (textTimeout[slotid]) { //clear textTimeout to reset
                  clearTimeout(textTimeout[slotid])
              }
              var renderEl = '<div id="text-' + slotid + '" class="text-slot"><span style="line-height:0;">' + src.text + '</span></div>'
              $('#slot-' + slotid).html(renderEl)
              // image: go to the next media after 5 seconds
              textTimeout[slotid] = setTimeout(changeText, src.duration)
          })
      }
  }

  function checkTextSrc(item) {
      return new Promise(async (resolve, reject) => {
          var text = item.text

          //Counter text check
          if (text && text.substring(1, 8) == 'counter') {
              item.text = await getCounter(item.text)
          }
          resolve(item)
      })
  }

  function getCounter(text) {
      return new Promise(async (resolve, reject) => {
          //proxy setup
          var urlServer = config.hostserver + '/counter.xml'
          if (config.corsproxy == 'Y') urlServer = 'https://corsproxy.io/?url=' + encodeURIComponent(config.hostserver + '/counter.xml')

          $.ajax({ //get list of counter at counter.xml 
              url: urlServer,
              type: 'GET',
              timeout: 5000,
              success: function (data) {
                  log.info('get counter xml : ok')
                  if (typeof data === 'string') {
                      reject(data)
                  } else {
                      //read ds xml 
                      var xmlText = new XMLSerializer().serializeToString(data)
                      var xml = '<?xml version="1.0" encoding="utf-8"?>' + xmlText
                      var counterList = convert.xml2json(xml, {
                          compact: false,
                          spaces: 4,
                          trim: false
                      })
                      counterList = JSON.parse(counterList)
                      counterList['elements'][0]['elements'].forEach((counter, cindex) => {
                          var checktext = text
                          //counter attributes
                          counter = counter['attributes']
                          //get counter text name
                          checktext = checktext.substring(9, checktext.length).split('}')[0]
                          //compare
                          if (counter['name'] != checktext) return
                          var currentDate = new Date()
                          var counterDatetime = datetime.parse(counter['datetime'], 'YYYY-MM-DDTHH:mm:ss')
                          var counterStep = counter['step']
                          var counterMode = counter['mode'] // year, month, day or minute
                          var counterMotion = counter['motion'] //minus or add
                          var totaldays = datetime.subtract(currentDate, counterDatetime).toDays() // subtract 2 dates
                          if (counterMode == 'hour') totaldays = datetime.subtract(currentDate, counterDatetime).toHours()
                          if (counterMode == 'min') totaldays = datetime.subtract(currentDate, counterDatetime).toMinutes()
                          if (counterMode == 'sec') totaldays = datetime.subtract(currentDate, counterDatetime).toSeconds()
                          resolve(totaldays.toFixed(0))
                      })
                  }
              },
              error: function (xhr, textStatus, errorThrown) {
                  log.warn('get xml : failed :' + textStatus)
                  reject()
              }
          })
      })
  }