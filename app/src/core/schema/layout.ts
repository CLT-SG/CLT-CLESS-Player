import { z } from 'zod'
import { SCHEMA_VERSION, isSchemaVersionSupported } from './version'

/**
 * Canonical Layout Definition Schema (v1).
 *
 * This is the single wire contract between CLESS-Server and CLESS-Player. It
 * is produced directly by the server's `/{ds}/ds.json` endpoint and by the
 * client-side XML compatibility adapter, so both transports converge on one
 * shape before anything is rendered.
 *
 * Design constraints that shaped it:
 *  - Every content type shares the same envelope (`type`, `id`, `geometry`,
 *    `items`, `config`) so the renderer can dispatch generically.
 *  - Unknown `type` values validate successfully and keep their raw `config`,
 *    which is what lets the server ship a new content type before players are
 *    updated (they render a placeholder instead of crashing).
 *  - Nothing is optional-by-accident: defaults are declared here so downstream
 *    code never has to re-implement fallbacks.
 */

export const geometrySchema = z.object({
  top: z.number(),
  left: z.number(),
  width: z.number(),
  height: z.number(),
  layer: z.number().default(0),
})

export const backgroundSchema = z.object({
  color: z.string().default('#000000'),
  image: z.string().nullable().default(null),
  stretch: z.boolean().default(false),
})

export const resolutionSchema = z.object({
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  orientation: z.enum(['landscape', 'portrait']).default('landscape'),
})

export const scheduleWindowSchema = z.object({
  startDate: z.string().nullable().default(null),
  endDate: z.string().nullable().default(null),
  startTime: z.string().nullable().default(null),
  endTime: z.string().nullable().default(null),
  /** ISO weekdays, 1 = Monday. Empty means "every day". */
  days: z.array(z.number().int().min(1).max(7)).default([]),
})
export type ScheduleWindow = z.infer<typeof scheduleWindowSchema>

/**
 * A single playable unit inside a content slot: one image, one text page, one
 * widget in a rotation. `data` carries type-specific fields that the owning
 * content plugin validates.
 */
export const contentItemSchema = z.object({
  id: z.string(),
  /** Seconds. 0 means "play to natural end" (video) or "never rotate". */
  duration: z.number().nonnegative().default(0),
  enabled: z.boolean().default(true),
  order: z.number().int().default(0),
  text: z.string().default(''),
  data: z.record(z.unknown()).default({}),
})
export type ContentItemDefinition = z.infer<typeof contentItemSchema>

export const contentSlotSchema = z.object({
  /** Content type key, matched against the content plugin registry. */
  type: z.string().min(1),
  id: z.string(),
  name: z.string().default(''),
  enabled: z.boolean().default(true),
  transparent: z.boolean().default(false),
  backgroundColor: z.string().nullable().default(null),
  geometry: geometrySchema,
  schedule: scheduleWindowSchema.nullable().default(null),
  items: z.array(contentItemSchema).default([]),
  /** Type-specific configuration, validated by the content plugin. */
  config: z.record(z.unknown()).default({}),
})
export type ContentSlotDefinition = z.infer<typeof contentSlotSchema>

/** Tabular payload is kept beside the slots so rows can refresh independently. */
export const datasetRowSchema = z.record(z.string())
export const datasetSchema = z.object({
  slotId: z.string(),
  revision: z.string().default(''),
  columns: z.array(z.string()).default([]),
  rows: z.array(datasetRowSchema).default([]),
})
export type DatasetDefinition = z.infer<typeof datasetSchema>

export const assetSchema = z.object({
  /** Path relative to `mediaBaseUrl`, or an absolute URL for streams. */
  path: z.string(),
  /** Opaque version token; changes whenever the bytes change. */
  version: z.string().default(''),
  sizeBytes: z.number().nonnegative().nullable().default(null),
  mimeType: z.string().nullable().default(null),
})
export type AssetDefinition = z.infer<typeof assetSchema>

export const layoutSchema = z.object({
  id: z.string(),
  name: z.string().default(''),
  /** Server-side content revision; the cache key for the whole layout. */
  revision: z.string().default(''),
  /** Seconds between server polls for this layout. */
  refreshInterval: z.number().nonnegative().default(60),
  resolution: resolutionSchema,
  autoscale: z.boolean().default(true),
  background: backgroundSchema,
  mediaBaseUrl: z.string().default(''),
  slots: z.array(contentSlotSchema).default([]),
  datasets: z.array(datasetSchema).default([]),
  assets: z.array(assetSchema).default([]),
})
export type LayoutDefinition = z.infer<typeof layoutSchema>

export const playlistEntrySchema = z.object({
  layoutId: z.string(),
  name: z.string().default(''),
  /** Seconds this layout stays on screen. */
  duration: z.number().nonnegative().default(10),
  order: z.number().int().default(0),
  enabled: z.boolean().default(true),
  /** Populated when the server inlines layouts; otherwise fetched lazily. */
  source: z.string().nullable().default(null),
})
export type PlaylistEntryDefinition = z.infer<typeof playlistEntrySchema>

export const transitionSchema = z.object({
  style: z
    .enum(['none', 'fade', 'slide-left', 'slide-right', 'scroll-up', 'scroll-down'])
    .default('none'),
  speedMs: z.number().nonnegative().default(1000),
  delayMs: z.number().nonnegative().default(0),
})
export type TransitionDefinition = z.infer<typeof transitionSchema>

export const playlistSchema = z.object({
  id: z.string(),
  name: z.string().default(''),
  revision: z.string().default(''),
  transition: transitionSchema.default({ style: 'none', speedMs: 1000, delayMs: 0 }),
  entries: z.array(playlistEntrySchema).default([]),
})
export type PlaylistDefinition = z.infer<typeof playlistSchema>

export const displayTargetSchema = z.object({
  id: z.string(),
  name: z.string().default(''),
  scheduleId: z.string().nullable().default(null),
  syncMasterIp: z.string().nullable().default(null),
})
export type DisplayTargetDefinition = z.infer<typeof displayTargetSchema>

/**
 * Top-level document returned by the Layout Definition API. Exactly one of
 * `layout` or `playlist` is populated; `layouts` inlines playlist members when
 * the server can afford to, which removes a round trip per layout on boot.
 */
export const layoutDocumentSchema = z
  .object({
    schemaVersion: z.string().refine(isSchemaVersionSupported, {
      message: 'Unsupported layout schema major version',
    }),
    /** Where this document came from; drives compatibility diagnostics. */
    origin: z.enum(['json-api', 'xml-adapter', 'cache', 'local']).default('json-api'),
    generatedAt: z.string().default(''),
    /** Whole-document cache validator, mirrors the transport ETag. */
    etag: z.string().default(''),
    display: displayTargetSchema.nullable().default(null),
    mode: z.enum(['layout', 'playlist']),
    layout: layoutSchema.nullable().default(null),
    playlist: playlistSchema.nullable().default(null),
    layouts: z.array(layoutSchema).default([]),
  })
  .superRefine((doc, ctx) => {
    if (doc.mode === 'layout' && !doc.layout) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['layout'],
        message: 'mode "layout" requires a layout',
      })
    }
    if (doc.mode === 'playlist' && !doc.playlist) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['playlist'],
        message: 'mode "playlist" requires a playlist',
      })
    }
  })
export type LayoutDocument = z.infer<typeof layoutDocumentSchema>

export function emptyLayoutDocument(): LayoutDocument {
  return layoutDocumentSchema.parse({
    schemaVersion: SCHEMA_VERSION,
    origin: 'local',
    mode: 'layout',
    layout: {
      id: '0',
      resolution: { width: 1920, height: 1080 },
      background: { color: '#000000' },
    },
  })
}
