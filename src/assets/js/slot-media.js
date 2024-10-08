var previewContainer
var videoJSPlayer = new Array() //videojs call function
var mediaTimeout = new Array()
var mediaCurIndex = new Array()
var medialoop = new Array()
var mediaEl = new Array()
var mediasrcList = new Array()
var mediafilenameList = new Array()
var videoIdIncrease = new Array()

function generateRandomNumber() {
    const minDigits = 7;
    const randomNumber = Math.floor(Math.random() * Math.pow(10, minDigits - 1)) + Math.pow(10, minDigits - 1);
    return randomNumber;
}

function mediaFunc(slotitem, slotid, mediapath) {
    mediaCurIndex[slotid] = 1
    medialoop[slotid] = []
    var serverAdd = config.hostserver
    serverAdd = serverAdd.split('/')
    serverAdd = serverAdd[0] + '//' + serverAdd[2]
    if (mediapath.length != 0) {
        medialoop[slotid] = []
    }
    slotitem.forEach(function (media, mindex) {
        var src = media['elements']['0']['text'].replace('{', '').replace('}', '')
        var duration = media['attributes']['duration']
        var n = src.lastIndexOf('.')
        var mediamode = src.substring(n + 1)
        var ytbe = src.split("/")
        //media file location
        var mediaLocalPath

        //check media file if exist
        var mediaDownloadURL = serverAdd + mediapath + '/' + src
        if (['png', 'jpg', 'jpeg', 'bmp', 'gif', 'mp4', 'webm'].includes(mediamode)) { //image and video format
            if (src != 'none') {
                var mediaName = src.split('/')
                mediaName = mediaName[1]
                //add source to media list and isnert to cpanel
                mediafilenameList.push(mediaName)
                mediaLocalPath = homedir + '/clessapp/res/' + mediaName
                if (!fs.existsSync(mediaLocalPath)) {
                    //using ipc to download media cause electron not allow to use axios
                    //https://stackoverflow.com/questions/65602941/axios-error-data-pipe-is-not-a-function
                    ipcRenderer.invoke('app-downloadmedia', {
                        mediaURL: mediaDownloadURL,
                        mediaPathSrc: mediaLocalPath
                    }).then((result) => {
                        log.info('Saved to ' + mediaLocalPath)
                    })
                }
            }
        }

        //add source to media list and isnert to column image inside table slot
        mediasrcList.push(mediaLocalPath)

        if (['png', 'jpg', 'jpeg', 'bmp', 'gif'].includes(mediamode)) { //image format
            var contentObj = new Object()
            contentObj.contentUrl = mediaLocalPath
            contentObj.contentDuration = duration
            contentObj.contentType = "image/" + mediamode
            contentObj.mediaType = "IMAGE"
            medialoop[slotid].push(contentObj)
        } else if (ytbe[2] == 'youtu.be') {
            var contentObj = new Object()
            contentObj.contentUrl = ytbe[3]
            contentObj.contentDuration = duration
            contentObj.contentType = "youtube"
            contentObj.mediaType = "YTB"
            medialoop[slotid].push(contentObj)
        } else if (mediamode == 'm3u8' || mediamode == 'm3u') { //video m3u8 format
            var contentObj = new Object()
            contentObj.contentUrl = src
            contentObj.contentDuration = duration
            contentObj.contentType = "application/x-mpegURL"
            contentObj.mediaType = "STREAM"
            medialoop[slotid].push(contentObj)
        } else if (['mp4', 'webm', 'mkv'].includes(mediamode)) { //video mp4/webm format
            var contentObj = new Object()
            contentObj.contentUrl = mediaLocalPath
            contentObj.contentDuration = duration
            contentObj.contentType = "video/mp4"
            contentObj.mediaType = "VIDEO"
            medialoop[slotid].push(contentObj)
        } else if (['flv'].includes(mediamode)) { //video flv format
            var contentObj = new Object()
            contentObj.contentUrl = src
            contentObj.contentDuration = duration
            contentObj.contentType = "video/x-flv"
            contentObj.mediaType = "CCTV"
            medialoop[slotid].push(contentObj)
        } else { //none 
        }
        if (mindex === slotitem.length - 1) {
            if (!medialoop[slotid][0]) {
                medialoop[slotid][0] = 10
            }
            appendMediaElement(medialoop[slotid][0], '#slot-' + slotid, slotid)
        }
    })
}

//play next media after current media has finished
function changeMedia(slotid) {
    if (mediaCurIndex[slotid] >= medialoop[slotid].length) {
        // modified this so it would display the first image/video when looping
        mediaCurIndex[slotid] = 0
    }
    //check if got more media inside slot
    if (medialoop[slotid].length != 1) {
        appendMediaElement(medialoop[slotid][mediaCurIndex[slotid]], '#slot-' + slotid, slotid)
        mediaCurIndex[slotid]++
    }
}

//render every media slot
async function appendMediaElement(asset, previewele, slotid) {
    videoIdIncrease[slotid] = generateRandomNumber()
    var videojsid = parseInt(slotid) + videoIdIncrease[slotid]
    if (mediaTimeout[slotid]) { //clear mediaTimeout to reset
        clearTimeout(mediaTimeout[slotid])
    }
    var duration = parseInt(asset.contentDuration * 1000)
    if (asset.mediaType == "IMAGE") { //image player
        //object-fit to fit image inside the image elements //fill : image stretched on slot
        mediaEl[slotid] = '<img id="lp-preview-image" class="media-slot" style="object-fit: fill;" src="' + asset.contentUrl + '">'
        $(previewele).html(mediaEl[slotid])
        // image: go to the next media after specific seconds
        if (medialoop[slotid].length > 1) {
            mediaTimeout[slotid] = setTimeout(function () {
                changeMedia(slotid)
            }, duration)
        }

    } else if (asset.mediaType == "YTB") {
        mediaEl[slotid] = '<iframe src="https://www.youtube.com/embed/' + asset.contentUrl + '?autoplay=1&controls=0" frameborder="0" allow="accelerometer;" ></iframe>'
        $(previewele).html(mediaEl[slotid])
        // image: go to the next media after specific seconds
        mediaTimeout[slotid] = setTimeout(function () {
            changeMedia(slotid)
        }, duration)
    } else if (asset.mediaType == "STREAM") { //streaming player
        mediaEl[slotid] = ""
        mediaEl[slotid] =
            '<video id="video-' + videojsid + '" poster="http://dummyimage.com/320x240/ffffff/fff" class="video-js vjs-default-skin vjs-fill" class="media-slot" autoplay controls preload="metadata" data-setup="{}">'
        mediaEl[slotid] += "<source src='" + asset.contentUrl + "' type='" + asset.contentType + "'>"
        mediaEl[slotid] += "</video>"
        $(previewele).html(mediaEl[slotid])
        videoJSPlayer[videojsid] = videojs('video-' + videojsid, {}, function () {})
        videoJSPlayer[videojsid].controls(false)

        //check if duration 0 then play full duration
        if (duration == 0) {
            videoJSPlayer[videojsid].on('ended', function () {
                videoJSPlayer[videojsid].dispose()
                changeMedia(slotid)
            })

            // if not play with duration 
        } else {
            setTimeout(function () {
                const frame = captureVideoFrame('video-' + slotid, 'png')
                videoJSPlayer[videojsid].poster(frame.dataUri)
                videoJSPlayer[videojsid].dispose()
                changeMedia(slotid)
            }, duration)
        }
        videoJSPlayer[videojsid].on('error', function () {
            videoJSPlayer[videojsid].dispose()
            changeMedia(slotid)
            var error = videoJSPlayer[videojsid].error()
            log.warn('VIDEOJS ERROR : ', error.code, error.type, error.message)
            console.log('VIDEOJS ERROR : ', error.code, error.type, error.message)
        })
    } else if (asset.mediaType == "VIDEO") { //basic video player
        mediaEl[slotid] =
            '<video id="video-' + videojsid + '" poster="http://dummyimage.com/320x240/ffffff/fff" class="video-js vjs-default-skin vjs-fill" class="media-slot" autoplay controls preload="metadata" data-setup="{}">'
        mediaEl[slotid] += "<source src='" + asset.contentUrl + "' type='" + asset.contentType + "'>"
        mediaEl[slotid] += "</video>"
        $(previewele).html(mediaEl[slotid])
        videoJSPlayer[videojsid] = videojs('video-' + videojsid, {}, function () {})
        videoJSPlayer[videojsid].controls(false)
        //check if duration 0 then play full duration

        if (duration == 0) {
            videoJSPlayer[videojsid].on("timeupdate", function (event) { //chrome fix
                if (videoJSPlayer[videojsid].currentTime() == videoJSPlayer[videojsid].duration()) {
                    videoJSPlayer[videojsid].dispose()
                    changeMedia(slotid)
                }
            })
            // if not play with duration 
        } else {
            videoJSPlayer[videojsid].on('timeupdate', function () {
                var currTime = videoJSPlayer[videojsid].currentTime()
                currTime = parseInt(currTime) * 1000
                if (currTime == duration) {
                    videoJSPlayer[videojsid].dispose()
                    changeMedia(slotid)
                }
            })
        }
        videoJSPlayer[videojsid].on('error', function () {
            videoJSPlayer[videojsid].dispose()
            changeMedia(slotid)
            var error = videoJSPlayer[videojsid].error()
            log.warn('VIDEOJS ERROR : ', error.code, error.type, error.message)
            console.log('VIDEOJS ERROR : ', error.code, error.type, error.message)
        })
    } else if (asset.mediaType == "CCTV") { //cctv video player
        mediaEl[slotid] =
            '<video id="video-' + videojsid + '" poster="http://dummyimage.com/320x240/ffffff/fff" class="video-js vjs-default-skin vjs-fill" class="media-slot" autoplay controls preload="metadata" data-setup="{}">'
        mediaEl[slotid] += "<source src='" + asset.contentUrl + "' type='" + asset.contentType + "'>"
        mediaEl[slotid] += "</video>"
        $(previewele).html(mediaEl[slotid])
        videoJSPlayer[videojsid] = videojs('video-' + videojsid, {
            techOrder: ['html5', 'flvjs'],
            flvjs: {
                mediaDataSource: {
                    isLive: true,
                    cors: true,
                    withCredentials: false,
                }
            },
        }, function () {})
        videoJSPlayer[videojsid].controls(false)
        //check if duration 0 then play full duration
        if (duration == 0) {
            videoJSPlayer[videojsid].on('ended', function () {
                videoJSPlayer[videojsid].dispose()
                changeMedia(slotid)
            })
            // if not play with duration 
        } else {
            setTimeout(function () {
                videoJSPlayer[videojsid].dispose()
                changeMedia(slotid)
            }, duration)
        }
        videoJSPlayer[videojsid].on('error', function () {
            videoJSPlayer[videojsid].dispose()
            changeMedia(slotid)
            var error = videoJSPlayer[videojsid].error()
            log.warn('VIDEOJS ERROR : ', error.code, error.type, error.message)
            console.log('VIDEOJS ERROR : ', error.code, error.type, error.message)
        })
    }
}