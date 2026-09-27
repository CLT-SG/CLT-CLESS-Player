export type MediaKind = 'image' | 'video' | 'audio' | 'youtube' | 'stream' | 'unknown'

export interface ParsedMediaSource {
  readonly kind: MediaKind
  /** Resolved, directly playable URL. */
  readonly url: string
  /** Transport protocol for streams (`rtsp`, `rtmp`, `m3u8`, `http`, `file`). */
  readonly protocol: string | null
  readonly isStreaming: boolean
  readonly raw: string
}

/**
 * Media source parsing and classification.
 *
 * The server encodes streams as `{protocol:url}` inside the item text and
 * everything else as a `{folder}/{filename}` path relative to the media base.
 * `slot-media.js` re-implemented this parse plus extension sniffing in several
 * places; this class is the single decoder for both transports.
 */
export abstract class MediaUtils {
  private static readonly IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'avif']
  private static readonly VIDEO_EXTENSIONS = ['mp4', 'webm', 'mkv', 'mov', 'avi', 'm4v', 'ogv']
  private static readonly AUDIO_EXTENSIONS = ['mp3', 'wav', 'ogg', 'aac', 'm4a', 'flac']
  private static readonly STREAM_PROTOCOLS = ['rtsp', 'rtmp', 'm3u8', 'flv', 'http', 'https', 'file']

  static extension(value: string): string {
    const withoutQuery = value.split(/[?#]/)[0] ?? ''
    const lastDot = withoutQuery.lastIndexOf('.')
    if (lastDot < 0) return ''
    return withoutQuery.slice(lastDot + 1).toLowerCase()
  }

  static kindFromPath(value: string): MediaKind {
    const extension = MediaUtils.extension(value)
    if (MediaUtils.IMAGE_EXTENSIONS.includes(extension)) return 'image'
    if (MediaUtils.VIDEO_EXTENSIONS.includes(extension)) return 'video'
    if (MediaUtils.AUDIO_EXTENSIONS.includes(extension)) return 'audio'
    if (extension === 'm3u8') return 'stream'
    return 'unknown'
  }

  static isYouTube(value: string): boolean {
    return /(?:youtube\.com|youtu\.be)/i.test(value)
  }

  /** Extracts the 11-character video id from any common YouTube URL shape. */
  static youTubeId(value: string): string | null {
    const match = /(?:youtu\.be\/|v=|embed\/|shorts\/)([A-Za-z0-9_-]{11})/.exec(value)
    return match ? match[1]! : null
  }

  static youTubeEmbedUrl(value: string): string | null {
    const id = MediaUtils.youTubeId(value)
    if (!id) return null
    return `https://www.youtube.com/embed/${id}?autoplay=1&mute=1&controls=0&loop=1&playlist=${id}`
  }

  /**
   * Decodes an item's media reference.
   *
   * `mediaBaseUrl` is only applied to relative library paths; braces-wrapped
   * streams and absolute URLs are passed through untouched.
   */
  static parse(raw: string, mediaBaseUrl = ''): ParsedMediaSource {
    const value = (raw ?? '').trim()
    if (!value || value === 'none') {
      return { kind: 'unknown', url: '', protocol: null, isStreaming: false, raw: value }
    }

    const braced = /^\{([a-z0-9]+):(.+)\}$/i.exec(value)
    if (braced) {
      const protocol = braced[1]!.toLowerCase()
      const target = braced[2]!.trim()
      const url = /^[a-z0-9]+:\/\//i.test(target) ? target : `${protocol}://${target}`
      const isStreaming = MediaUtils.STREAM_PROTOCOLS.includes(protocol) && protocol !== 'file'

      if (protocol === 'file') {
        return { kind: MediaUtils.kindFromPath(target), url: target, protocol, isStreaming: false, raw: value }
      }
      if (MediaUtils.isYouTube(url)) {
        return {
          kind: 'youtube',
          url: MediaUtils.youTubeEmbedUrl(url) ?? url,
          protocol,
          isStreaming: false,
          raw: value,
        }
      }
      const kind = MediaUtils.kindFromPath(target)
      return {
        kind: kind === 'unknown' ? 'stream' : kind,
        url,
        protocol,
        isStreaming,
        raw: value,
      }
    }

    if (MediaUtils.isYouTube(value)) {
      return {
        kind: 'youtube',
        url: MediaUtils.youTubeEmbedUrl(value) ?? value,
        protocol: null,
        isStreaming: false,
        raw: value,
      }
    }

    const absolute = /^[a-z0-9]+:\/\//i.test(value)
    const url = absolute ? value : MediaUtils.joinUrl(mediaBaseUrl, value)
    return { kind: MediaUtils.kindFromPath(value), url, protocol: null, isStreaming: false, raw: value }
  }

  static joinUrl(base: string, path: string): string {
    if (!base) return path
    if (!path) return base
    return `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`
  }
}
