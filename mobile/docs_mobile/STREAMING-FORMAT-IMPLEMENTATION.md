# Streaming Format Support - Implementation Guide

## Overview
This document describes the new streaming format support implemented for both Electron desktop and mobile (Capacitor) versions of the eCLESS Player application.

## Server-Side Media Format

The server now supports a new format for specifying streaming media sources:

```
{protocol:url}
```

### Supported Protocols

| Protocol | Format | Description | Example |
|----------|--------|-------------|---------|
| **m3u8** | `{m3u8:http://...}` | M3U8/HLS streaming playlist | `{m3u8:http://server/playlist.m3u8}` |
| **rtsp** | `{rtsp://server/stream}` | RTSP streaming protocol | `{rtsp://camera.local/stream1}` |
| **rtmp** | `{rtmp://server/stream}` | RTMP streaming protocol | `{rtmp://live.server.com/app/stream}` |
| **http** | `{http://server/video.mp4}` | HTTP external video URL | `{http://cdn.example.com/video.mp4}` |
| **https** | `{https://server/video.mp4}` | HTTPS external video URL | `{https://cdn.example.com/video.mp4}` |

### Backward Compatibility

The implementation maintains full backward compatibility:
- Old format: `{media/video.mp4}` - works as before
- Extension-based detection: `video.m3u8` - still works
- YouTube URLs: `https://youtu.be/...` - still works

## Implementation Details

### Mobile App (`mobile/www/assets/js/slot-media.js`)

#### 1. Streaming URL Parser
```javascript
parseStreamingUrl(rawSrc)
```
- Detects `{protocol:url}` format
- Extracts protocol type and URL
- Returns structured data: `{ protocol, url, isStreaming, originalSrc }`
- Handles edge cases and malformed inputs

#### 2. Media Processing Priority
```
Priority 1: Streaming Protocols (from {protocol:url} format)
  ├─ M3U8/HLS streaming
  ├─ RTSP streaming (with transcoding check)
  ├─ RTMP streaming (via flv.js)
  └─ HTTP/HTTPS external URLs
  
Priority 2: YouTube (legacy detection)

Priority 3: M3U8 streams (extension-based)

Priority 4: FLV streams (legacy)

Priority 5: Images (local/external)

Priority 6: Videos (local/external)
```

#### 3. Video Player Configuration

**M3U8/HLS Streams:**
```javascript
videojs('video-id', {
    html5: {
        vhs: {
            withCredentials: false,
            overrideNative: true
        }
    },
    liveui: true
})
```

**RTMP Streams:**
```javascript
videojs('video-id', {
    techOrder: ['html5', 'flvjs'],
    flvjs: {
        mediaDataSource: {
            type: 'flv',
            isLive: true,
            cors: true,
            withCredentials: false,
            url: streamUrl
        }
    }
})
```

**RTSP Streams:**
- Direct RTSP not supported in browsers
- Shows error notification
- Auto-detects if URL is pre-transcoded (contains `.m3u8`)
- If transcoded, plays as HLS stream

### Desktop App (`src/assets/js/slot-media.js`)

The desktop Electron app has identical implementation with the same:
- `parseStreamingUrl()` function
- Protocol detection and handling
- Video player configuration
- Error handling

## Browser/Platform Compatibility

| Protocol | Desktop (Electron) | Mobile (Android) | Mobile (iOS) | Notes |
|----------|-------------------|------------------|--------------|-------|
| **M3U8/HLS** | ✅ Yes | ✅ Yes | ✅ Yes | Native support via VideoJS-VHS |
| **RTSP** | ⚠️ Transcoding Required | ⚠️ Transcoding Required | ⚠️ Transcoding Required | Must be converted to HLS/WebRTC server-side |
| **RTMP** | ⚠️ Limited | ⚠️ Limited | ⚠️ Limited | Via flv.js, may require transcoding |
| **HTTP/HTTPS** | ✅ Yes | ✅ Yes | ✅ Yes | Direct video file access |
| **FLV** | ✅ Yes | ✅ Yes | ✅ Yes | Via flv.js integration |

### RTSP Limitations
RTSP cannot be played directly in web browsers or Electron. Options:
1. **Server-side transcoding to HLS** (Recommended)
   - Use FFmpeg, GStreamer, or similar
   - Output as `.m3u8` playlist
2. **WebRTC conversion**
   - Use WebRTC gateway (Kurento, Janus, etc.)
3. **Native player integration** (mobile only)
   - Use native Android/iOS video players via Capacitor plugin

### RTMP Limitations
RTMP requires Flash or transcoding:
1. **Server-side transcoding to HLS** (Recommended)
2. **FLV.js playback** (Limited browser support)
3. **Native player integration** (mobile only)

## Error Handling

### User Notifications
All streaming errors show user-friendly notifications:
- Stream connection failures
- Codec/format incompatibilities
- Transcoding requirements
- Network errors

### Auto-Skip Behavior
- **Stream start timeout**: 5 seconds (M3U8, RTSP, RTMP)
- **Video start timeout**: 3 seconds (MP4, WebM)
- Failed streams automatically skip to next media
- Error details logged to console

### Error Recovery
```javascript
// Stream fails to start
setTimeout(() => {
    if (!streamStarted) {
        console.warn('Stream failed to start - skipping');
        player.dispose();
        changeMedia(slotid);
    }
}, 5000);
```

## Testing Guide

### Test Cases

1. **M3U8/HLS Stream**
   ```
   {m3u8:http://d2e1asnsl7br7b.cloudfront.net/7782e205e72f43aeb4a48ec97f66ebbe/index_5.m3u8}
   ```
   Expected: Stream plays successfully

2. **RTSP Stream (Pre-transcoded)**
   ```
   {rtsp://server/stream.m3u8}
   ```
   Expected: Plays as HLS stream

3. **RTSP Stream (Raw)**
   ```
   {rtsp://camera.local/stream1}
   ```
   Expected: Error notification, skips after 5 seconds

4. **RTMP Stream**
   ```
   {rtmp://live.server.com/app/stream}
   ```
   Expected: Attempts flv.js playback, may show compatibility warning

5. **External HTTP Video**
   ```
   {http://cdn.example.com/video.mp4}
   ```
   Expected: Plays as regular video

6. **External HTTPS HLS**
   ```
   {https://cdn.example.com/playlist.m3u8}
   ```
   Expected: Plays as HLS stream

### Mobile Testing Checklist
- [ ] Test on actual Android device (not emulator)
- [ ] Test on iOS device (if available)
- [ ] Verify kiosk mode still works
- [ ] Check network change handling
- [ ] Verify media preloading still works
- [ ] Test slot transitions
- [ ] Verify error notifications appear
- [ ] Check console logs for errors

### Desktop Testing Checklist
- [ ] Test on Windows
- [ ] Test on macOS
- [ ] Test on Linux
- [ ] Verify video synchronization still works
- [ ] Test multi-display setup
- [ ] Check control panel integration

## Performance Considerations

### Mobile Optimizations
- **Media preloading**: Local files still batch-preload
- **URI caching**: In-memory caching for converted URIs
- **Parallel processing**: Independent operations run in parallel
- **Memory management**: Proper VideoJS disposal prevents leaks

### Bandwidth
- **External streams**: No download/cache - played directly
- **Local files**: Downloaded once, cached in filesystem
- **HLS adaptive**: Automatically adjusts quality based on bandwidth

## Logging

### Console Logs
All streaming operations are extensively logged:
```
[parseStreamingUrl] ✓ Detected streaming format: m3u8 → http://...
[mediaFunc] Starting optimized processing for slot: 0 with 3 items
[mediaFunc] → Adding M3U8/HLS stream: http://...
[VideoJS] Player ready for stream
[VideoJS] Stream playing successfully
```

### Error Logs
```
[VideoJS] Stream error: 4 - Media source error
[VideoJS] RTSP requires server-side transcoding
[mediaFunc] ⚠ No valid media loaded for slot 0
```

## Server-Side Recommendations

### For RTSP Support
Use FFmpeg to transcode RTSP to HLS:
```bash
ffmpeg -rtsp_transport tcp -i rtsp://camera.local/stream1 \
  -c:v libx264 -preset ultrafast -tune zerolatency \
  -c:a aac -f hls -hls_time 1 -hls_list_size 3 \
  -hls_flags delete_segments output.m3u8
```

### For RTMP Support
Configure NGINX RTMP module to output HLS:
```nginx
rtmp {
    server {
        listen 1935;
        application live {
            live on;
            hls on;
            hls_path /tmp/hls;
            hls_fragment 1s;
        }
    }
}
```

## Migration Guide

### Updating Server Configuration
1. Update media source format in database/CMS
2. Test with old format first (verify backward compatibility)
3. Gradually introduce new `{protocol:url}` format
4. Monitor error logs for compatibility issues

### No Client Changes Required
- Desktop app auto-updates through normal update process
- Mobile app auto-updates through app store or APK distribution
- Both apps support old and new formats simultaneously

## Troubleshooting

### "Stream Failed to Start"
- Check URL is accessible from device
- Verify CORS headers on streaming server
- Check network connectivity
- Verify format is browser-compatible

### RTSP Shows Error
- RTSP requires transcoding to HLS
- Set up FFmpeg transcoding server
- Or use WebRTC gateway

### RTMP Not Playing
- Check if stream is actually FLV format
- Verify flv.js is loaded correctly
- Consider HLS transcoding instead

### External URL Not Loading
- Check CORS headers on source server
- Verify HTTPS if app is HTTPS
- Check network/firewall restrictions

## Future Enhancements

### Potential Improvements
1. **WebRTC support** for low-latency RTSP
2. **Native player plugins** for better mobile RTSP/RTMP support
3. **Adaptive bitrate selection** for HLS
4. **Stream health monitoring** with automatic failover
5. **Offline stream caching** for replay

### API Additions
- Stream quality selection
- Buffer size configuration  
- Network bandwidth detection
- Stream statistics/analytics

---

## Summary

✅ **Completed:**
- Full streaming format support for M3U8, RTSP, RTMP, HTTP, HTTPS
- Backward compatibility maintained
- Both mobile and desktop apps updated
- Comprehensive error handling
- User-friendly notifications
- Extensive logging

⚠️ **Known Limitations:**
- RTSP requires server-side transcoding
- RTMP has limited browser support
- Some streams may need specific codec configuration

📱 **Next Steps:**
1. Test on real devices
2. Configure server-side transcoding for RTSP/RTMP
3. Monitor error logs during rollout
4. Gather user feedback on streaming quality
