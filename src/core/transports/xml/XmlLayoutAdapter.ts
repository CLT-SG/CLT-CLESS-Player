import { SCHEMA_VERSION, type ContentItemDefinition, type ContentSlotDefinition, type DatasetDefinition, type LayoutDefinition, type LayoutDocument, type PlaylistDefinition } from '@core/layouts/schema'
import { layoutDocumentSchema } from '@core/layouts/schema/layout'
import { LayoutMath, Logger, NetworkUtils, ValidationUtils } from '@core/utilities'
import { XmlNode } from './XmlNode'

const logger = Logger.forScope('xml-adapter')

export interface XmlAdapterOptions {
  /** Base URL of CLESS-Server; used to absolutise media and widget paths. */
  readonly serverBaseUrl: string
  /** Display id, so the document can carry its own identity. */
  readonly displayId: string
}

/**
 * Slot tag names that map onto a differently named content type. Anything not
 * listed keeps its tag name as the content type, which means a brand new slot
 * element from the server arrives as an unknown content type (rendered as a
 * placeholder) rather than being silently dropped.
 */
const SLOT_TYPE_ALIASES: Readonly<Record<string, string>> = {
  wintv: 'media',
  bookingsystem: 'html',
}

/**
 * Converts the legacy player XML into the canonical Layout Definition Schema.
 *
 * This class is the whole compatibility layer. It exists so that the rest of
 * the player has exactly one input shape: every deployment still running an
 * XML-only CLESS-Server is normalised here, at the edge, and the renderer,
 * stores, cache and sync logic never learn that XML exists.
 *
 * Practical consequence for the migration: XML support can eventually be
 * removed by deleting this directory and the transport branch that calls it,
 * with no changes anywhere else.
 */
export class XmlLayoutAdapter {
  constructor(private readonly options: XmlAdapterOptions) {}

  /**
   * Entry point. Accepts the parsed `ds.xml` of either root form:
   * `<Configuration>` (a single layout) or `<Configure><loop>` (a playlist).
   */
  adaptDocument(parsedXml: unknown, loopLayouts: readonly unknown[] = []): LayoutDocument {
    const root = XmlNode.fromDocument(parsedXml)

    const loop = root.child('loop')
    if (loop.exists) {
      return this.adaptPlaylistDocument(root, loop, loopLayouts)
    }
    return this.adaptLayoutDocument(root)
  }

  /** Converts one `<Configuration>` document into a single-layout document. */
  adaptLayoutDocument(root: XmlNode): LayoutDocument {
    const layout = this.adaptLayout(root)
    return layoutDocumentSchema.parse({
      schemaVersion: SCHEMA_VERSION,
      origin: 'xml-adapter',
      generatedAt: new Date().toISOString(),
      etag: layout.revision,
      mode: 'layout',
      display: {
        id: this.options.displayId,
        name: root.attr('ds'),
        scheduleId: root.hasAttr('schedule_id') ? root.attr('schedule_id') : null,
        syncMasterIp: root.hasAttr('sync_master_ip') ? root.attr('sync_master_ip') : null,
      },
      layout,
    })
  }

  private adaptPlaylistDocument(
    root: XmlNode,
    loop: XmlNode,
    loopLayouts: readonly unknown[],
  ): LayoutDocument {
    const entries = loop.childrenNamed('layout').map((entry, index) => {
      const url = entry.attr('url')
      return {
        layoutId: XmlLayoutAdapter.layoutIdFromUrl(url) ?? String(index),
        name: entry.attr('name'),
        duration: entry.attrNumber('duration', 10),
        order: index,
        enabled: entry.attrBoolean('enabled', true),
        source: url || null,
      }
    })

    const playlist: PlaylistDefinition = {
      id: loop.attr('id', '0'),
      name: loop.attr('name'),
      revision: root.attr('update'),
      transition: {
        style: XmlLayoutAdapter.transitionStyle(loop.attr('transition_style', 'none')),
        speedMs: loop.attrNumber('transition_speed', 1000),
        delayMs: loop.attrNumber('transition_delay', 0),
      },
      entries,
    }

    const layouts = loopLayouts
      .map((parsed) => {
        try {
          return this.adaptLayout(XmlNode.fromDocument(parsed))
        } catch (error) {
          logger.warn('Skipped a loop member that failed to adapt', error)
          return null
        }
      })
      .filter((layout): layout is LayoutDefinition => layout !== null)

    return layoutDocumentSchema.parse({
      schemaVersion: SCHEMA_VERSION,
      origin: 'xml-adapter',
      generatedAt: new Date().toISOString(),
      etag: playlist.revision,
      mode: 'playlist',
      display: {
        id: this.options.displayId,
        name: root.attr('ds'),
        syncMasterIp: root.hasAttr('sync_master_ip') ? root.attr('sync_master_ip') : null,
      },
      playlist,
      layouts,
    })
  }

  /** Converts a `<Configuration>` node into a layout definition. */
  adaptLayout(root: XmlNode): LayoutDefinition {
    const display = root.child('display')
    const resolution = LayoutMath.parseResolution(display.attr('resolution'))
    const mediaBaseUrl = this.resolveMediaBaseUrl(root.attr('mediapath'))
    const slotNodes = display.path('slots').children

    const datasets = this.adaptDatasets(root.child('records'))
    const slots = slotNodes
      .map((node, index) => this.adaptSlot(node, index))
      .filter((slot): slot is ContentSlotDefinition => slot !== null)

    return {
      id: root.attr('id', '0'),
      name: root.attr('layout'),
      revision: root.attr('update'),
      refreshInterval: root.attrNumber('serverRefresh', 60),
      resolution,
      autoscale: display.attrBoolean('autoscale', true),
      background: {
        color: display.attr('bgcolor', '#000000'),
        image: XmlLayoutAdapter.backgroundImage(display.attr('bgimage'), mediaBaseUrl),
        stretch: display.attrBoolean('bgscretch', false),
      },
      mediaBaseUrl,
      slots,
      datasets,
      assets: XmlLayoutAdapter.deriveAssets(slots, root.attr('update')),
    }
  }

  /**
   * Converts one slot element.
   *
   * Geometry, identity and scheduling are shared by every slot type; anything
   * type-specific is left in `config` verbatim (camelCased) so the content
   * plugin owns its own interpretation. That split is why a new slot type
   * needs no adapter change.
   */
  private adaptSlot(node: XmlNode, index: number): ContentSlotDefinition | null {
    const tag = node.name
    if (!tag) return null

    const type = SLOT_TYPE_ALIASES[tag] ?? tag
    const id = node.attr('id', `${tag}-${index}`)

    return {
      type,
      id,
      name: node.attr('name'),
      enabled: node.attrBoolean('enabled', true),
      transparent: node.attrBoolean('transparent', false),
      backgroundColor: node.hasAttr('bgcolor') ? node.attr('bgcolor') : null,
      geometry: {
        top: node.attrNumber('top', 0),
        left: node.attrNumber('left', 0),
        width: node.attrNumber('width', 0),
        height: node.attrNumber('height', 0),
        /*
         * Document order, not the `layer` attribute.
         *
         * The server already sorts slots by layer before emitting them, and
         * the legacy renderer used the element index as the z-index. Honouring
         * `layer` here would change existing stacking, because several slot
         * types emit `layer="0"` while others omit the attribute entirely.
         */
        layer: index,
      },
      schedule: XmlLayoutAdapter.adaptSchedule(node),
      items: XmlLayoutAdapter.adaptItems(node),
      config: XmlLayoutAdapter.adaptConfig(node, type),
    }
  }

  private static adaptItems(node: XmlNode): ContentItemDefinition[] {
    return node.childrenNamed('item').map((item, index) => {
      const { id: _ignoredId, duration: _ignoredDuration, ...rest } = item.attributes
      return {
        id: item.attr('id', `${node.attr('id', node.name)}-${index}`),
        duration: item.attrNumber('duration', 0),
        enabled: item.attrBoolean('enabled', true),
        order: index,
        text: item.text.trim(),
        data: XmlLayoutAdapter.camelCaseKeys(rest),
      }
    })
  }

  /**
   * Extracts widget-style schedule attributes. Returns `null` when the slot
   * does not opt into scheduling, so `BaseContent` can skip the check.
   */
  private static adaptSchedule(node: XmlNode): ContentSlotDefinition['schedule'] {
    if (!node.attrBoolean('scheduled', false)) return null
    return {
      startDate: ValidationUtils.nonEmpty(node.attr('start')),
      endDate: ValidationUtils.nonEmpty(node.attr('end')),
      startTime: ValidationUtils.nonEmpty(node.attr('timestart') || node.attr('starttime')),
      endTime: ValidationUtils.nonEmpty(node.attr('timeend') || node.attr('endtime')),
      days: ValidationUtils.toWeekdays(node.attr('days')),
    }
  }

  /**
   * Builds the type-specific config object.
   *
   * Known attribute names are mapped onto the schema's vocabulary so plugins
   * are not coupled to XML spelling (including the `bgscretch` typo and the
   * `Fontsize` casing). Unmapped attributes are camelCased and passed through,
   * which is what lets a server add an attribute without an adapter release.
   */
  private static adaptConfig(node: XmlNode, type: string): Record<string, unknown> {
    const attributes = node.attributes
    const config: Record<string, unknown> = XmlLayoutAdapter.camelCaseKeys(attributes, [
      'id',
      'name',
      'enabled',
      'transparent',
      'bgcolor',
      'top',
      'left',
      'width',
      'height',
      'layer',
      'scheduled',
      'start',
      'end',
      'days',
      'timestart',
      'timeend',
      'starttime',
      'endtime',
    ])

    // Normalised aliases for the styling attributes every text-like type uses.
    if (attributes['font'] != null) config['font'] = attributes['font']
    if (attributes['fontsize'] != null) config['fontSize'] = ValidationUtils.toNumber(attributes['fontsize'], 32)
    if (attributes['fontcolor'] != null) config['fontColor'] = attributes['fontcolor']
    if (attributes['fontstyle'] != null) config['fontStyle'] = attributes['fontstyle']
    if (attributes['align'] != null) config['align'] = attributes['align']
    if (attributes['valign'] != null) config['valign'] = attributes['valign']
    if (attributes['speed'] != null) config['speed'] = ValidationUtils.toNumber(attributes['speed'], 3)
    if (attributes['direction'] != null) config['direction'] = attributes['direction']
    if (attributes['format'] != null) config['format'] = attributes['format']
    if (attributes['antialias'] != null) config['antialias'] = ValidationUtils.toBoolean(attributes['antialias'], true)
    if (attributes['interactive'] != null) {
      config['interactive'] = ValidationUtils.toBoolean(attributes['interactive'], false)
    }

    if (type === 'table') {
      Object.assign(config, XmlLayoutAdapter.adaptTableConfig(node))
    }

    return config
  }

  private static adaptTableConfig(node: XmlNode): Record<string, unknown> {
    const heading = node.child('heading')
    const row = node.child('row')

    const columns = node
      .child('column')
      .childrenNamed('item')
      .map((item, index) => ({
        // Row data arrives keyed `col01`, `col02`, ... in declaration order.
        key: `col${String(index + 1).padStart(2, '0')}`,
        label: item.text.trim(),
        width: item.attrNumber('width', 0),
        align: item.attr('align', 'left'),
        backgroundEnabled: item.attrBoolean('bgcolor_enabled', false),
        backgroundColor: item.attr('bgcolor'),
        fillToColumn: item.attrBoolean('fill_to_column', false),
        textTransition: {
          enabled: item.attrBoolean('text_transition_enabled', false),
          style: item.attr('text_transition', 'none'),
          switchingMs: item.attrNumber('text_transition_switching_time', 0),
          speedMs: item.attrNumber('text_transition_speed', 0),
          delayMs: item.attrNumber('text_transition_delay', 0),
        },
        image: {
          enabled: item.attrBoolean('image_enabled', false),
          style: item.attr('image_transition', 'none'),
          switchingMs: item.attrNumber('image_switching_time', 0),
          speedMs: item.attrNumber('image_transition_speed', 0),
          delayMs: item.attrNumber('image_transition_delay', 0),
        },
      }))

    return {
      title: node.attr('title'),
      columns,
      header: {
        font: heading.attr('font'),
        fontSize: heading.attrNumber('fontsize', 24),
        fontColor: heading.attr('fontcolor', '#ffffff'),
        backgroundColor: heading.attr('bgcolor', '#222222'),
        hidden: heading.attrBoolean('hideheader', false),
      },
      backgroundColor: node.attr('bgcolor', '#000000'),
      oddRowColor: row.attr('oddcolor', '#111111'),
      evenRowColor: row.attr('evencolor', '#1a1a1a'),
      rowMargin: row.attrNumber('margin', 0),
      rowHeight: node.attrNumber('bodyrowHeight', 0),
      cellSpacing: node.attrNumber('cellspacing', 0),
      wrap: node.attrBoolean('wrap', false),
      fixedHeight: node.attrBoolean('fixedheight', false),
      maxRowsEnabled: node.attrBoolean('maxrows_enabled', false),
      maxRows: node.attrNumber('maxrows_limit', 0),
      hidePagination: node.attrBoolean('hidepagination', false),
      pageFlipSeconds: node.attrNumber('pageflip', 0),
      transition: node.attr('transition', 'none'),
      flipMode: node.attr('flipmode'),
      flipModeSpeedMs: node.attrNumber('flipmode_speed', 0),
      flipModeDelayMs: node.attrNumber('flipmode_delay', 0),
      horizontalBorder: node.attrBoolean('horizontalborder', false),
      verticalBorder: node.attrBoolean('verticalborder', false),
      revision: node.attr('update'),
    }
  }

  /** Converts `<records><table id><row col01="..."/></table></records>`. */
  private adaptDatasets(records: XmlNode): DatasetDefinition[] {
    return records.childrenNamed('table').map((table) => {
      const rows = table.childrenNamed('row').map((row) => row.attributes)
      const columns = rows.length ? Object.keys(rows[0]!).filter((key) => key !== 'style') : []
      return {
        slotId: table.attr('id', '0'),
        revision: table.attr('update'),
        columns,
        rows,
      }
    })
  }

  private resolveMediaBaseUrl(mediaPath: string): string {
    if (!mediaPath) return ''
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(mediaPath)) return mediaPath
    const origin = NetworkUtils.origin(this.options.serverBaseUrl)
    return origin ? NetworkUtils.joinUrl(origin, mediaPath) : mediaPath
  }

  private static backgroundImage(value: string, mediaBaseUrl: string): string | null {
    const trimmed = value.trim()
    if (!trimmed || trimmed === 'none') return null
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) return trimmed
    return NetworkUtils.joinUrl(mediaBaseUrl, trimmed)
  }

  /**
   * Derives an asset manifest from media items.
   *
   * XML carries no per-file version, so the layout revision is used as the
   * version token for every asset. That is coarse (any layout edit
   * invalidates all of its assets) but correct, and the JSON API replaces it
   * with real per-file versions.
   */
  private static deriveAssets(
    slots: readonly ContentSlotDefinition[],
    revision: string,
  ): LayoutDefinition['assets'] {
    const paths = new Set<string>()
    for (const slot of slots) {
      if (slot.type !== 'media') continue
      for (const item of slot.items) {
        const text = item.text.trim()
        if (text && !text.startsWith('{') && text !== 'none') paths.add(text)
      }
    }
    return [...paths].map((path) => ({ path, version: revision, sizeBytes: null, mimeType: null }))
  }

  private static transitionStyle(value: string): PlaylistDefinition['transition']['style'] {
    const allowed = ['none', 'fade', 'slide-left', 'slide-right', 'scroll-up', 'scroll-down'] as const
    const normalized = value.trim().toLowerCase()
    return (allowed as readonly string[]).includes(normalized)
      ? (normalized as PlaylistDefinition['transition']['style'])
      : 'none'
  }

  /** `https://host/demo/layout/42/ds.xml` -> `42` */
  static layoutIdFromUrl(url: string): string | null {
    const match = /\/layout\/(\d+)(?:\/|$)/.exec(url);
    return match ? match[1]! : null
  }

  private static camelCaseKeys(
    source: Readonly<Record<string, unknown>>,
    exclude: readonly string[] = [],
  ): Record<string, unknown> {
    const excluded = new Set(exclude)
    const result: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(source)) {
      if (excluded.has(key)) continue
      result[XmlLayoutAdapter.toCamelCase(key)] = value
    }
    return result
  }

  private static toCamelCase(key: string): string {
    return key.replace(/[_-]+([a-z0-9])/gi, (_match, char: string) => char.toUpperCase())
  }
}
