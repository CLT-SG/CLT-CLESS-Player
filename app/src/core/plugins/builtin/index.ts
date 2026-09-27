import { z } from 'zod'
import AirportDisplayRenderer from '@/components/renderers/AirportDisplayRenderer.vue'
import ClockRenderer from '@/components/renderers/ClockRenderer.vue'
import EmbedRenderer from '@/components/renderers/EmbedRenderer.vue'
import FaderRenderer from '@/components/renderers/FaderRenderer.vue'
import MediaRenderer from '@/components/renderers/MediaRenderer.vue'
import TableRenderer from '@/components/renderers/TableRenderer.vue'
import TextRenderer from '@/components/renderers/TextRenderer.vue'
import TickerRenderer from '@/components/renderers/TickerRenderer.vue'
import {
  AirportDisplayContent,
  ClockContent,
  EmbedContent,
  FaderContent,
  MediaContent,
  TableContent,
  TextContent,
  TickerContent,
} from '@/core/content'
import type { ContentPlugin } from '../ContentPlugin'

/**
 * The content types shipped with the player.
 *
 * Each entry is self-contained: model, renderer, config schema and semantic
 * validation. A new content type is a new file in this directory plus one line
 * in `BUILTIN_CONTENT_PLUGINS` — no renderer, store or sync change.
 */

/** Shared by every text-like type, so their styling stays consistent. */
const typographyConfigSchema = z.object({
  font: z.string().optional(),
  fontSize: z.coerce.number().nonnegative().optional(),
  fontColor: z.string().optional(),
  fontStyle: z.string().optional(),
  align: z.string().optional(),
  valign: z.string().optional(),
})

export const mediaPlugin: ContentPlugin<MediaContent> = {
  type: 'media',
  displayName: 'Media',
  component: MediaRenderer,
  configSchema: z
    .object({
      fit: z.enum(['cover', 'contain', 'fill']).optional(),
      muted: z.boolean().optional(),
      videoSync: z.boolean().optional(),
    })
    .passthrough(),
  create: (definition, context) => new MediaContent(definition, context.mediaBaseUrl),
  validate: (definition) => {
    const issues: string[] = []
    const playable = definition.items.filter((item) => item.enabled && item.text.trim() && item.text !== 'none')
    if (!playable.length) issues.push('slot has no playable media items')
    return issues
  },
}

export const textPlugin: ContentPlugin<TextContent> = {
  type: 'text',
  displayName: 'Text',
  component: TextRenderer,
  configSchema: typographyConfigSchema.passthrough(),
  create: (definition) => new TextContent(definition),
}

export const tickerPlugin: ContentPlugin<TickerContent> = {
  type: 'ticker',
  displayName: 'Ticker',
  component: TickerRenderer,
  configSchema: typographyConfigSchema
    .extend({
      speed: z.coerce.number().min(1).max(5).optional(),
      direction: z.string().optional(),
      antialias: z.boolean().optional(),
    })
    .passthrough(),
  create: (definition) => new TickerContent(definition, 'horizontal'),
}

export const scrollerPlugin: ContentPlugin<TickerContent> = {
  type: 'scroller',
  displayName: 'Scroller',
  component: TickerRenderer,
  configSchema: tickerPlugin.configSchema,
  create: (definition) => new TickerContent(definition, 'vertical'),
}

export const faderPlugin: ContentPlugin<FaderContent> = {
  type: 'fader',
  displayName: 'Text Fader',
  component: FaderRenderer,
  configSchema: typographyConfigSchema
    .extend({ speed: z.coerce.number().min(1).max(5).optional() })
    .passthrough(),
  create: (definition) => new FaderContent(definition),
}

function clockPlugin(type: 'date' | 'time' | 'datetime', displayName: string): ContentPlugin<ClockContent> {
  return {
    type,
    displayName,
    component: ClockRenderer,
    configSchema: typographyConfigSchema.extend({ format: z.string().optional() }).passthrough(),
    create: (definition) => new ClockContent(definition, type),
  }
}

export const datePlugin = clockPlugin('date', 'Date')
export const timePlugin = clockPlugin('time', 'Time')
export const datetimePlugin = clockPlugin('datetime', 'Date & Time')

export const htmlPlugin: ContentPlugin<EmbedContent> = {
  type: 'html',
  displayName: 'HTML',
  component: EmbedRenderer,
  create: (definition, context) => new EmbedContent(definition, 'html', context.serverOrigin),
  validate: (definition) => {
    const hasUrl = definition.items.some((item) => item.text.trim() || item.data['url'])
    return hasUrl ? [] : ['slot has no source URL']
  },
}

export const widgetPlugin: ContentPlugin<EmbedContent> = {
  type: 'widget',
  displayName: 'Widget',
  component: EmbedRenderer,
  configSchema: z.object({ interactive: z.boolean().optional() }).passthrough(),
  create: (definition, context) => new EmbedContent(definition, 'widget', context.serverOrigin),
}

export const tablePlugin: ContentPlugin<TableContent> = {
  type: 'table',
  displayName: 'Table',
  component: TableRenderer,
  configSchema: z
    .object({
      columns: z.array(z.record(z.unknown())).optional(),
      header: z.record(z.unknown()).optional(),
      pageFlipSeconds: z.coerce.number().nonnegative().optional(),
      maxRows: z.coerce.number().nonnegative().optional(),
    })
    .passthrough(),
  create: (definition, context) => new TableContent(definition, context.datasetFor(definition.id)),
  validate: (definition) => {
    const columns = definition.config['columns']
    if (!Array.isArray(columns) || !columns.length) return ['table has no columns defined']
    return []
  },
}

export const airportDisplayPlugin: ContentPlugin<AirportDisplayContent> = {
  type: 'airport-display',
  displayName: 'Airport Display',
  component: AirportDisplayRenderer,
  exclusive: true,
  create: (definition) => new AirportDisplayContent(definition),
}

export const BUILTIN_CONTENT_PLUGINS: readonly ContentPlugin[] = [
  mediaPlugin,
  textPlugin,
  tickerPlugin,
  scrollerPlugin,
  faderPlugin,
  datePlugin,
  timePlugin,
  datetimePlugin,
  htmlPlugin,
  widgetPlugin,
  tablePlugin,
  airportDisplayPlugin,
] as ContentPlugin[]
