import type { BaseContent } from '../content'
import type { ContentPluginRegistry, ContentBuildContext, PluginValidationReport } from '../plugins'
import type { DatasetDefinition, LayoutDefinition, LayoutDocument } from '../schema'
import { Logger, NetworkUtils } from '../utils'

const logger = Logger.forScope('layout')

export interface PreparedLayout {
  readonly definition: LayoutDefinition
  /** Content models in paint order (lowest layer first). */
  readonly contents: readonly BaseContent[]
  readonly validationReports: readonly PluginValidationReport[]
  /** Content types present in the layout that this build cannot render. */
  readonly unsupportedTypes: readonly string[]
}

/**
 * Turns a validated layout definition into renderable content models.
 *
 * This is the boundary that keeps Vue components free of business logic: by
 * the time a component sees anything, media URLs are resolved, geometry is
 * normalised, datasets are bound to their tables and unknown content types
 * have been replaced by placeholders. A component's only job is to paint what
 * its content object exposes.
 */
export class LayoutService {
  constructor(
    private readonly registry: ContentPluginRegistry,
    private readonly serverBaseUrl: string,
  ) {}

  prepare(definition: LayoutDefinition): PreparedLayout {
    const datasets = new Map<string, DatasetDefinition>()
    for (const dataset of definition.datasets) datasets.set(dataset.slotId, dataset)

    const context: ContentBuildContext = {
      layout: definition,
      mediaBaseUrl: definition.mediaBaseUrl,
      serverOrigin: NetworkUtils.origin(this.serverBaseUrl),
      datasetFor: (slotId) => datasets.get(slotId) ?? null,
    }

    const enabledSlots = definition.slots.filter((slot) => slot.enabled)
    const contents = enabledSlots
      .slice()
      .sort((a, b) => a.geometry.layer - b.geometry.layer)
      .map((slot) => this.registry.create(slot, context))

    const validationReports = this.registry.validateAll(enabledSlots)
    const unsupportedTypes = this.registry.unsupportedTypes(enabledSlots)

    if (validationReports.length) {
      logger.warn(`Layout ${definition.id} has ${validationReports.length} slot(s) with configuration issues`, validationReports)
    }
    if (unsupportedTypes.length) {
      logger.warn(`Layout ${definition.id} uses unsupported content types: ${unsupportedTypes.join(', ')}`)
    }

    return { definition, contents, validationReports, unsupportedTypes }
  }

  /** Layouts carried by a document, in playlist order for a playlist. */
  static layoutsOf(document: LayoutDocument): readonly LayoutDefinition[] {
    if (document.mode === 'layout') return document.layout ? [document.layout] : []

    const byId = new Map(document.layouts.map((layout) => [layout.id, layout]))
    const ordered: LayoutDefinition[] = []
    for (const entry of document.playlist?.entries ?? []) {
      if (!entry.enabled) continue
      const layout = byId.get(entry.layoutId)
      if (layout) ordered.push(layout)
    }
    return ordered
  }

  /** Every asset path referenced by a document; the input to cache pruning. */
  static assetPathsOf(document: LayoutDocument): readonly string[] {
    const paths = new Set<string>()
    const layouts = document.mode === 'playlist' ? document.layouts : document.layout ? [document.layout] : []
    for (const layout of layouts) {
      for (const asset of layout.assets) paths.add(asset.path)
    }
    return [...paths]
  }
}
