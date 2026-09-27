var ClessCore = function() {
  "use strict";
  class ColorUtils {
    static {
      this.HEX_PATTERN = /^#?([a-f\d]{3}|[a-f\d]{6})$/i;
    }
    static normalizeHex(value, fallback = "#000000") {
      if (!value) return fallback;
      const trimmed = value.trim();
      const match = ColorUtils.HEX_PATTERN.exec(trimmed);
      if (!match) return ColorUtils.isCssColor(trimmed) ? trimmed : fallback;
      const digits = match[1];
      const expanded = digits.length === 3 ? digits.split("").map((char) => char + char).join("") : digits;
      return `#${expanded.toLowerCase()}`;
    }
    /** Accepts named colours and functional notations that CSS understands. */
    static isCssColor(value) {
      return /^(transparent|none|rgb|rgba|hsl|hsla|[a-z]+)$/i.test(value) || value.startsWith("rgb");
    }
    static toRgba(value, alpha) {
      const hex = ColorUtils.normalizeHex(value);
      if (!hex.startsWith("#")) return hex;
      const numeric = Number.parseInt(hex.slice(1), 16);
      const r = numeric >> 16 & 255;
      const g = numeric >> 8 & 255;
      const b = numeric & 255;
      const clamped = Math.min(1, Math.max(0, alpha));
      return `rgba(${r},${g},${b},${clamped})`;
    }
    /**
     * The XML transparency attribute is a three-level enum rather than a number.
     * `high` means fully see-through, matching the legacy behaviour.
     */
    static transparencyToAlpha(level) {
      switch ((level ?? "").toLowerCase()) {
        case "high":
          return 0;
        case "medium":
          return 0.5;
        default:
          return 1;
      }
    }
  }
  class DateUtils {
    static {
      this.MONTHS_SHORT = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec"
      ];
    }
    static {
      this.MONTHS_LONG = [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December"
      ];
    }
    static {
      this.DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    }
    static {
      this.DAYS_LONG = [
        "Sunday",
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday"
      ];
    }
    static {
      this.TOKENS = [
        ["dddd", (d) => DateUtils.DAYS_LONG[d.getDay()]],
        ["ddd", (d) => DateUtils.DAYS_SHORT[d.getDay()]],
        ["mmmmm", (d) => DateUtils.MONTHS_LONG[d.getMonth()]],
        ["mmmm", (d) => DateUtils.MONTHS_LONG[d.getMonth()]],
        ["mmm", (d) => DateUtils.MONTHS_SHORT[d.getMonth()]],
        ["YYYY", (d) => String(d.getFullYear())],
        ["yyyy", (d) => String(d.getFullYear())],
        ["yy", (d) => String(d.getFullYear()).slice(-2)],
        ["MM", (d) => DateUtils.pad(d.getMonth() + 1)],
        ["DD", (d) => DateUtils.pad(d.getDate())],
        ["dd", (d) => DateUtils.pad(d.getDate())],
        ["mm", (d) => DateUtils.pad(d.getMonth() + 1)],
        ["HH", (d) => DateUtils.pad(DateUtils.to12Hour(d.getHours()))],
        ["hh", (d) => DateUtils.pad(d.getHours())],
        ["nn", (d) => DateUtils.pad(d.getMinutes())],
        ["ss", (d) => DateUtils.pad(d.getSeconds())],
        ["AM/PM", (d) => d.getHours() < 12 ? "AM" : "PM"],
        ["A", (d) => d.getHours() < 12 ? "AM" : "PM"]
      ];
    }
    static pad(value, length = 2) {
      return String(Math.abs(Math.trunc(value))).padStart(length, "0");
    }
    static to12Hour(hours24) {
      const hour = hours24 % 12;
      return hour === 0 ? 12 : hour;
    }
    /**
     * Renders `date` using the legacy token vocabulary.
     *
     * Tokens are substituted longest-first into a placeholder array rather than
     * into the output string, so a replacement's own characters (e.g. the "d" in
     * "Wednesday") can never be re-matched by a later, shorter token.
     */
    static format(date, pattern) {
      if (!pattern) return date.toISOString();
      const replacements = [];
      let working = pattern;
      for (const [token, resolve] of DateUtils.TOKENS) {
        if (!working.includes(token)) continue;
        const placeholder = `\0${replacements.length}\0`;
        replacements.push(resolve(date));
        working = working.split(token).join(placeholder);
      }
      return working.replace(/\u0000(\d+)\u0000/g, (_match, index) => replacements[Number(index)] ?? "");
    }
    /** Minutes since midnight for an `HH:mm` string, or `null` when unparseable. */
    static parseClockMinutes(value) {
      if (!value) return null;
      const match = /^(\d{1,2}):(\d{2})/.exec(value.trim());
      if (!match) return null;
      const hours = Number(match[1]);
      const minutes = Number(match[2]);
      if (hours > 23 || minutes > 59) return null;
      return hours * 60 + minutes;
    }
    static minutesSinceMidnight(date) {
      return date.getHours() * 60 + date.getMinutes();
    }
    /** ISO weekday, 1 = Monday .. 7 = Sunday (the convention the server uses). */
    static isoWeekday(date) {
      const day = date.getDay();
      return day === 0 ? 7 : day;
    }
    static parseIsoDate(value) {
      if (!value) return null;
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    /**
     * Compares the server's `YYYYMMDDHHMMSS` revision stamps. They are
     * lexicographically ordered by construction, so string comparison is enough
     * and avoids timezone parsing entirely.
     */
    static isRevisionNewer(candidate, current) {
      if (!candidate) return false;
      if (!current) return true;
      return candidate > current;
    }
  }
  class FormatUtils {
    static {
      this.HTML_ESCAPES = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      };
    }
    static escapeHtml(value) {
      return value.replace(/[&<>"']/g, (char) => FormatUtils.HTML_ESCAPES[char] ?? char);
    }
    static bytes(value) {
      if (value == null || !Number.isFinite(value)) return "—";
      const units = ["B", "KB", "MB", "GB", "TB"];
      let size = Math.max(0, value);
      let unit = 0;
      while (size >= 1024 && unit < units.length - 1) {
        size /= 1024;
        unit += 1;
      }
      return `${size.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
    }
    static duration(seconds) {
      if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return "0s";
      const total = Math.round(seconds);
      const hours = Math.floor(total / 3600);
      const minutes = Math.floor(total % 3600 / 60);
      const secs = total % 60;
      if (hours > 0) return `${hours}h ${minutes}m`;
      if (minutes > 0) return `${minutes}m ${secs}s`;
      return `${secs}s`;
    }
    static truncate(value, maxLength) {
      if (value.length <= maxLength) return value;
      return `${value.slice(0, Math.max(0, maxLength - 1))}…`;
    }
    /**
     * Maps the server's alignment codes (`c`, `l`, `r` plus full words) to CSS
     * values. Unknown codes fall back to `left` so text is never invisible.
     */
    static textAlign(code) {
      switch ((code ?? "").trim().toLowerCase()) {
        case "c":
        case "center":
        case "centre":
          return "center";
        case "r":
        case "right":
          return "right";
        case "j":
        case "justify":
          return "justify";
        default:
          return "left";
      }
    }
    static verticalAlign(code) {
      switch ((code ?? "").trim().toLowerCase()) {
        case "middle":
        case "center":
        case "m":
          return "center";
        case "bottom":
        case "b":
          return "flex-end";
        default:
          return "flex-start";
      }
    }
    /** Font styles arrive as a comma separated list (`bold,italic,underline`). */
    static fontStyles(value) {
      const styles = (value ?? "").split(",").map((entry) => entry.trim().toLowerCase()).filter(Boolean);
      return {
        fontWeight: styles.includes("bold") ? "bold" : "normal",
        fontStyle: styles.includes("italic") ? "italic" : "normal",
        textDecoration: styles.includes("underline") ? "underline" : "none"
      };
    }
  }
  class LayoutMath {
    static parseResolution(value) {
      const fallback = { width: 1920, height: 1080, orientation: "landscape" };
      if (!value) return fallback;
      const parts = value.trim().toLowerCase().split(/[x_]/).filter(Boolean);
      const width = Number.parseInt(parts[0] ?? "", 10);
      const height = Number.parseInt(parts[1] ?? "", 10);
      if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
        return fallback;
      }
      const orientation = parts.includes("portrait") ? "portrait" : "landscape";
      return { width, height, orientation };
    }
    /**
     * Uniform scale factor that fits `design` inside `viewport` without
     * distortion. Used when the layout opts into autoscale.
     */
    static fitScale(design, viewport) {
      if (design.width <= 0 || design.height <= 0) return 1;
      return Math.min(viewport.width / design.width, viewport.height / design.height);
    }
    /** Independent x/y factors, for layouts that want to fill the screen exactly. */
    static stretchScale(design, viewport) {
      if (design.width <= 0 || design.height <= 0) return { x: 1, y: 1 };
      return { x: viewport.width / design.width, y: viewport.height / design.height };
    }
    /** Offsets that centre a scaled design surface inside the viewport. */
    static centerOffset(design, viewport, scale) {
      return {
        x: Math.max(0, (viewport.width - design.width * scale) / 2),
        y: Math.max(0, (viewport.height - design.height * scale) / 2)
      };
    }
    static scaleGeometry(geometry, scaleX, scaleY) {
      return {
        top: geometry.top * scaleY,
        left: geometry.left * scaleX,
        width: geometry.width * scaleX,
        height: geometry.height * scaleY,
        layer: geometry.layer
      };
    }
    static clamp(value, min, max) {
      return Math.min(max, Math.max(min, value));
    }
    static toPx(value) {
      return `${Math.round(value * 100) / 100}px`;
    }
  }
  class MediaUtils {
    static {
      this.IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg", "avif"];
    }
    static {
      this.VIDEO_EXTENSIONS = ["mp4", "webm", "mkv", "mov", "avi", "m4v", "ogv"];
    }
    static {
      this.AUDIO_EXTENSIONS = ["mp3", "wav", "ogg", "aac", "m4a", "flac"];
    }
    static {
      this.STREAM_PROTOCOLS = ["rtsp", "rtmp", "m3u8", "flv", "http", "https", "file"];
    }
    static extension(value) {
      const withoutQuery = value.split(/[?#]/)[0] ?? "";
      const lastDot = withoutQuery.lastIndexOf(".");
      if (lastDot < 0) return "";
      return withoutQuery.slice(lastDot + 1).toLowerCase();
    }
    static kindFromPath(value) {
      const extension = MediaUtils.extension(value);
      if (MediaUtils.IMAGE_EXTENSIONS.includes(extension)) return "image";
      if (MediaUtils.VIDEO_EXTENSIONS.includes(extension)) return "video";
      if (MediaUtils.AUDIO_EXTENSIONS.includes(extension)) return "audio";
      if (extension === "m3u8") return "stream";
      return "unknown";
    }
    static isYouTube(value) {
      return /(?:youtube\.com|youtu\.be)/i.test(value);
    }
    /** Extracts the 11-character video id from any common YouTube URL shape. */
    static youTubeId(value) {
      const match = /(?:youtu\.be\/|v=|embed\/|shorts\/)([A-Za-z0-9_-]{11})/.exec(value);
      return match ? match[1] : null;
    }
    static youTubeEmbedUrl(value) {
      const id = MediaUtils.youTubeId(value);
      if (!id) return null;
      return `https://www.youtube.com/embed/${id}?autoplay=1&mute=1&controls=0&loop=1&playlist=${id}`;
    }
    /**
     * Decodes an item's media reference.
     *
     * `mediaBaseUrl` is only applied to relative library paths; braces-wrapped
     * streams and absolute URLs are passed through untouched.
     */
    static parse(raw, mediaBaseUrl = "") {
      const value = (raw ?? "").trim();
      if (!value || value === "none") {
        return { kind: "unknown", url: "", protocol: null, isStreaming: false, raw: value };
      }
      const braced = /^\{([a-z0-9]+):(.+)\}$/i.exec(value);
      if (braced) {
        const protocol = braced[1].toLowerCase();
        const target = braced[2].trim();
        const url2 = /^[a-z0-9]+:\/\//i.test(target) ? target : `${protocol}://${target}`;
        const isStreaming = MediaUtils.STREAM_PROTOCOLS.includes(protocol) && protocol !== "file";
        if (protocol === "file") {
          return { kind: MediaUtils.kindFromPath(target), url: target, protocol, isStreaming: false, raw: value };
        }
        if (MediaUtils.isYouTube(url2)) {
          return {
            kind: "youtube",
            url: MediaUtils.youTubeEmbedUrl(url2) ?? url2,
            protocol,
            isStreaming: false,
            raw: value
          };
        }
        const kind = MediaUtils.kindFromPath(target);
        return {
          kind: kind === "unknown" ? "stream" : kind,
          url: url2,
          protocol,
          isStreaming,
          raw: value
        };
      }
      if (MediaUtils.isYouTube(value)) {
        return {
          kind: "youtube",
          url: MediaUtils.youTubeEmbedUrl(value) ?? value,
          protocol: null,
          isStreaming: false,
          raw: value
        };
      }
      const absolute = /^[a-z0-9]+:\/\//i.test(value);
      const url = absolute ? value : MediaUtils.joinUrl(mediaBaseUrl, value);
      return { kind: MediaUtils.kindFromPath(value), url, protocol: null, isStreaming: false, raw: value };
    }
    static joinUrl(base, path) {
      if (!base) return path;
      if (!path) return base;
      return `${base.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
    }
  }
  class NetworkUtils {
    static {
      this.DEFAULT_BASE_DELAY_MS = 2e3;
    }
    static {
      this.DEFAULT_MAX_DELAY_MS = 12e4;
    }
    static joinUrl(base, ...segments) {
      const cleanedBase = base.replace(/\/+$/, "");
      const cleanedSegments = segments.filter((segment) => segment !== "" && segment != null).map((segment) => String(segment).replace(/^\/+|\/+$/g, "")).filter(Boolean);
      return [cleanedBase, ...cleanedSegments].join("/");
    }
    static withQuery(url, params) {
      const entries = Object.entries(params).filter(([, value]) => value != null && value !== "");
      if (!entries.length) return url;
      const query = entries.map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`).join("&");
      return url.includes("?") ? `${url}&${query}` : `${url}?${query}`;
    }
    /** Origin of an absolute URL, used to prefix server-relative media paths. */
    static origin(url) {
      const match = /^([a-z][a-z0-9+.-]*:\/\/[^/]+)/i.exec(url.trim());
      return match ? match[1] : "";
    }
    /**
     * Exponential backoff with full jitter.
     *
     * Jitter matters in this deployment: a site can have dozens of players that
     * all lost the server at the same moment, and without it they would retry in
     * lockstep and produce a thundering herd when the server comes back.
     */
    static backoffDelay(attempt, baseDelayMs = NetworkUtils.DEFAULT_BASE_DELAY_MS, maxDelayMs = NetworkUtils.DEFAULT_MAX_DELAY_MS, random = Math.random) {
      const safeAttempt = Math.max(0, Math.trunc(attempt));
      const exponential = Math.min(maxDelayMs, baseDelayMs * 2 ** safeAttempt);
      const jitter = exponential * 0.5 * random();
      return Math.round(Math.min(maxDelayMs, exponential * 0.5 + jitter));
    }
    static isAbortError(error) {
      return error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError");
    }
    static isTransient(status) {
      return status === 0 || status === 408 || status === 429 || status >= 500;
    }
  }
  class TableCellCodec {
    static decode(raw) {
      const value = raw ?? "";
      if (value.startsWith("image:")) {
        const entries = TableCellCodec.splitList(value.slice(value.lastIndexOf(":") + 1));
        return { kind: "image", entries, text: "", rotate: entries.length > 1 };
      }
      if (value.startsWith("fader:")) {
        const entries = TableCellCodec.splitList(value.slice(value.indexOf(":") + 1));
        return { kind: "fader", entries, text: entries[0] ?? "", rotate: entries.length > 1 };
      }
      if (value.startsWith("transition:")) {
        const entries = TableCellCodec.splitList(value.slice(value.indexOf(":") + 1));
        return { kind: "transition", entries, text: entries[0] ?? "", rotate: entries.length > 1 };
      }
      return { kind: "text", entries: [value], text: value, rotate: false };
    }
    /** Convenience for the legacy renderer, which only wants the list. */
    static entries(raw) {
      return TableCellCodec.decode(raw).entries;
    }
    static splitList(payload) {
      return payload.split(",").map((entry) => entry.trim()).filter(Boolean);
    }
  }
  class ValidationUtils {
    static isRecord(value) {
      return typeof value === "object" && value !== null && !Array.isArray(value);
    }
    static toStringValue(value, fallback = "") {
      if (typeof value === "string") return value;
      if (typeof value === "number" && Number.isFinite(value)) return String(value);
      if (typeof value === "boolean") return value ? "Y" : "N";
      return fallback;
    }
    static toNumber(value, fallback = 0) {
      if (typeof value === "number") return Number.isFinite(value) ? value : fallback;
      if (typeof value === "string") {
        const parsed = Number.parseFloat(value.trim());
        return Number.isFinite(parsed) ? parsed : fallback;
      }
      return fallback;
    }
    static toInteger(value, fallback = 0) {
      const parsed = ValidationUtils.toNumber(value, fallback);
      return Math.trunc(parsed);
    }
    /** Understands the XML `Y`/`N` convention alongside normal truthy strings. */
    static toBoolean(value, fallback = false) {
      if (typeof value === "boolean") return value;
      if (typeof value === "number") return value !== 0;
      if (typeof value === "string") {
        const normalized = value.trim().toLowerCase();
        if (["y", "yes", "true", "1", "on"].includes(normalized)) return true;
        if (["n", "no", "false", "0", "off", ""].includes(normalized)) return false;
      }
      return fallback;
    }
    static toArray(value) {
      if (value == null) return [];
      return Array.isArray(value) ? [...value] : [value];
    }
    static nonEmpty(value) {
      if (typeof value !== "string") return null;
      const trimmed = value.trim();
      return trimmed.length ? trimmed : null;
    }
    /** Parses `"1,3,5"` weekday lists, dropping anything outside 1..7. */
    static toWeekdays(value) {
      if (Array.isArray(value)) {
        return value.map((entry) => ValidationUtils.toInteger(entry, 0)).filter((day) => day >= 1 && day <= 7);
      }
      if (typeof value !== "string") return [];
      return value.split(/[,\s]+/).map((entry) => Number.parseInt(entry, 10)).filter((day) => Number.isFinite(day) && day >= 1 && day <= 7);
    }
    static clampInt(value, min, max, fallback) {
      const parsed = ValidationUtils.toInteger(value, fallback);
      return Math.min(max, Math.max(min, parsed));
    }
  }
  const SCHEMA_MAJOR = 1;
  const SCHEMA_MINOR = 0;
  const SCHEMA_VERSION = `${SCHEMA_MAJOR}.${SCHEMA_MINOR}`;
  const ClessCore2 = {
    version: SCHEMA_VERSION,
    /**
     * Exact replacement for the `hexToRgbA` copies in `layoutxml.js` and
     * `slot-table.js`, including the `high`/`medium`/`low` transparency
     * vocabulary. Unlike the original it returns black instead of throwing on a
     * malformed colour, because a bad colour must not stop a layout playing.
     */
    hexToRgbA(hex, transparency) {
      return ColorUtils.toRgba(hex, ColorUtils.transparencyToAlpha(transparency));
    },
    ColorUtils,
    DateUtils,
    FormatUtils,
    MediaUtils,
    NetworkUtils,
    ValidationUtils,
    TableCellCodec,
    LayoutMath,
    /**
     * Decodes a table cell to the flat list the legacy row builder wants.
     *
     * The legacy sites called `substring`/`indexOf` inline, with the `image:`
     * and `fader:`/`transition:` forms using different colon rules. Both rules
     * now live in one place that the Vue renderer uses too, so a table cannot
     * decode differently under the two renderers.
     */
    decodeCellEntries(raw) {
      return TableCellCodec.entries(raw);
    }
  };
  globalThis.ClessCore = ClessCore2;
  return ClessCore2;
}();
