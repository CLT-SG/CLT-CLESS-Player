# Video Codec Compatibility Guide

## Issue Detected

Your video file `4k_Jungle_WaterfallVertical.mp4` is encoded with **AV1 codec**, which is not supported by your Android device/emulator.

## Error Details

```
MEDIA_ERR_DECODE (Code 3): The media playback was aborted due to a corruption problem 
or because the media used features your browser did not support.

Failed to create MediaCodec: video/av01, error 0xfffffffe
```

This means the video codec (AV1) is too new for the device's hardware decoder.

## Solution: Re-encode Videos

### Recommended Video Settings

For maximum compatibility across all Android devices:

| Setting | Value | Why |
|---------|-------|-----|
| **Codec** | H.264 (AVC) | Universal support |
| **Profile** | Baseline or Main | Older device compatibility |
| **Container** | MP4 | Standard format |
| **Resolution** | 1080p or lower | Performance |
| **Bitrate** | 5-10 Mbps | Quality vs size balance |
| **Frame Rate** | 30fps or 60fps | Smooth playback |
| **Audio Codec** | AAC | Standard audio |

### Using FFmpeg to Re-encode

```bash
# Convert AV1 to H.264 (most compatible)
ffmpeg -i input_av1.mp4 -c:v libx264 -profile:v main -level 4.0 -preset medium -crf 23 -c:a aac -b:a 128k output_h264.mp4

# For 4K video (vertical portrait)
ffmpeg -i 4k_Jungle_WaterfallVertical.mp4 -c:v libx264 -profile:v high -level 5.1 -preset medium -crf 23 -vf scale=1080:1920 -c:a aac -b:a 192k output_compatible.mp4

# Quick conversion (faster, larger file)
ffmpeg -i input.mp4 -c:v libx264 -preset fast -crf 23 -c:a copy output.mp4
```

### Using HandBrake (GUI Tool)

1. Download HandBrake: https://handbrake.fr/
2. Open your video file
3. Select preset: **"Android 1080p30"**
4. Click **Start Encode**

### Using Online Converters

- CloudConvert: https://cloudconvert.com/
- FreeConvert: https://www.freeconvert.com/video-converter

Settings:
- Format: MP4
- Video Codec: H.264
- Quality: High or Medium

## Supported Codecs by Android Version

| Codec | Android 5+ | Android 7+ | Android 10+ | Android 12+ |
|-------|------------|------------|-------------|-------------|
| H.264 (AVC) | ✅ | ✅ | ✅ | ✅ |
| H.265 (HEVC) | ⚠️ | ✅ | ✅ | ✅ |
| VP8 | ✅ | ✅ | ✅ | ✅ |
| VP9 | ❌ | ✅ | ✅ | ✅ |
| AV1 | ❌ | ❌ | ⚠️ | ✅ |

✅ = Fully supported
⚠️ = Partial support (device-dependent)
❌ = Not supported

## What We Fixed

The app now handles codec errors gracefully:

1. **Auto-Skip on Error** - Failed videos skip to next media automatically
2. **Timeout Protection** - If video doesn't start in 3s, skip it
3. **User Notifications** - Shows friendly error messages
4. **No Freeze** - Player continues instead of getting stuck

### Error Handling Flow

```
Video Load → Codec Check → Error? → Skip to Next
                ↓
              Success → Play → Done → Next Media
```

## Testing Your Videos

### Quick Test Command

```bash
# Check video codec
ffprobe -v error -select_streams v:0 -show_entries stream=codec_name -of default=noprint_wrappers=1:nokey=1 your-video.mp4
```

Output examples:
- `h264` = ✅ Compatible
- `hevc` = ✅ Compatible (Android 7+)
- `av1` = ❌ Not compatible (most devices)
- `vp9` = ✅ Compatible (Android 7+)

### Full Video Info

```bash
ffprobe -v error -show_format -show_streams your-video.mp4
```

## Best Practices

### 1. Use H.264 for Maximum Compatibility
```bash
ffmpeg -i input.mp4 -c:v libx264 -profile:v main -c:a aac output.mp4
```

### 2. Test on Target Device First
Upload a small test video to verify playback before converting entire library.

### 3. Keep Resolution Appropriate
- **1080p (1920x1080)** - Standard HD, good for most content
- **720p (1280x720)** - Lower bandwidth, faster loading
- **4K (3840x2160)** - Only if device supports and bandwidth allows

### 4. Optimize for Mobile
```bash
# Mobile-optimized settings
ffmpeg -i input.mp4 \
  -c:v libx264 \
  -profile:v main \
  -level 4.0 \
  -preset medium \
  -crf 23 \
  -maxrate 8M \
  -bufsize 16M \
  -movflags +faststart \
  -c:a aac \
  -b:a 128k \
  output_mobile.mp4
```

The `-movflags +faststart` is crucial for streaming!

## Troubleshooting

### Video Won't Play
1. Check codec: `ffprobe your-video.mp4`
2. Re-encode to H.264 if needed
3. Check file isn't corrupted
4. Verify file size isn't too large (>100MB may be slow)

### Video Stutters
1. Lower bitrate: `-crf 25` or `-b:v 3M`
2. Reduce resolution: `-vf scale=1280:720`
3. Check network speed (if streaming from server)

### Audio Issues
1. Re-encode audio: `-c:a aac -b:a 128k`
2. Check audio codec: `ffprobe -select_streams a:0 your-video.mp4`

## Updated Error Messages

The app now shows helpful messages:

**Codec Error:**
```
Video Codec Error
Video format not supported - skipping to next
```

**Timeout Error:**
```
Video Playback Timeout
Video failed to start - skipping to next
```

**Stream Error:**
```
Stream Playback Error
Unable to play stream: [error details]
```

## Recommendations for Your Content

Based on your error, you should:

1. **Immediate:** Re-encode `4k_Jungle_WaterfallVertical.mp4` to H.264
2. **Short-term:** Check all videos in `/media/uploads/4811/` folder
3. **Long-term:** Standardize on H.264 codec for all uploads

### Batch Conversion Script

```bash
#!/bin/bash
# Convert all AV1 videos to H.264

for file in *.mp4; do
    # Check if AV1
    codec=$(ffprobe -v error -select_streams v:0 -show_entries stream=codec_name -of default=noprint_wrappers=1:nokey=1 "$file")
    
    if [ "$codec" = "av1" ]; then
        echo "Converting $file from AV1 to H.264..."
        ffmpeg -i "$file" -c:v libx264 -profile:v main -crf 23 -c:a aac "${file%.mp4}_h264.mp4"
    fi
done
```

## Summary

**Problem:** AV1 codec not supported
**Solution:** Re-encode videos to H.264
**Status:** App now handles errors gracefully (won't freeze)

The app will continue playing other media even if one video fails!

---

**Need Help?** Check the video codec with `ffprobe` and re-encode to H.264 for maximum compatibility.
