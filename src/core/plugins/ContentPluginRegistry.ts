import type { BaseContent } from '@core/models'
import { UnsupportedContent } from '@core/models'
import type { ContentSlotDefinition } from '@core/layouts/schema'
import { Logger } from '@core/utilities'
import type { ContentBuildContext, ContentPlugin, PluginValidationReport } from './ContentPlugin'

const logger = Logger.forScope('plugins')

/**
 * Registry of content types.
 *
 * The set of supported content types is data rather than a `switch` statement
 * (the legacy `getLayoutXML` had an 11-branch `if/else` chain that every new
 * type had to be threaded through). The registry answers "what model does this
 * type build?"; the question "what component renders it?" belongs to whichever
 * renderer is asking, so it is not answered here.
 *
 * Instances are explicit rather than a module-level singleton so tests, the
 * live preview and the offline layout editor can each hold an isolated
 * registry.
 */
export class ContentPluginRegistry {
  private readonly plugins = new Map<string, ContentPlugin>()

  register(plugin: ContentPlugin): this {
    if (this.plugins.has(plugin.type)) {
      logger.warn(`Content plugin "${plugin.type}" replaced an existing registration`)
    }
    this.plugins.set(plugin.type, plugin)
    return this
  }

  registerAll(plugins: readonly ContentPlugin[]): this {
    for (const plugin of plugins) this.register(plugin)
    return this
  }

  has(type: string): boolean {
    return this.plugins.has(type)
  }

  get(type: string): ContentPlugin | null {
    return this.plugins.get(type) ?? null
  }

  get types(): readonly string[] {
    return [...this.plugins.keys()].sort()
  }

  /**
   * Builds the content model for a slot, degrading to `UnsupportedContent`
   * when the type is unknown or the plugin throws. A single broken slot must
   * never prevent the rest of the layout from playing.
   */
  create(definition: ContentSlotDefinition, context: ContentBuildContext): BaseContent {
    const plugin = this.plugins.get(definition.type)
    if (!plugin) {
      logger.warn(`Unknown content type "${definition.type}" in slot ${definition.id}`)
      return new UnsupportedContent(definition, definition.type)
    }

    try {
      return plugin.create(definition, context)
    } catch (error) {
      logger.error(`Content plugin "${definition.type}" failed for slot ${definition.id}`, error)
      const fallback = new UnsupportedContent(definition, definition.type)
      fallback.markError(error instanceof Error ? error.message : String(error))
      return fallback
    }
  }

  /**
   * Validates a slot's configuration against its plugin. Returns an empty
   * array for a valid slot and for an unknown type (reported separately, since
   * an unknown type is a compatibility signal rather than a config error).
   */
  validate(definition: ContentSlotDefinition): readonly string[] {
    const plugin = this.plugins.get(definition.type)
    if (!plugin) return []

    const issues: string[] = []
    if (plugin.configSchema) {
      const parsed = plugin.configSchema.safeParse(definition.config)
      if (!parsed.success) {
        for (const issue of parsed.error.issues) {
          issues.push(`config.${issue.path.join('.') || '(root)'}: ${issue.message}`)
        }
      }
    }
    if (plugin.validate) issues.push(...plugin.validate(definition))
    return issues
  }

  /** Validates every slot in a layout, reporting only the ones with problems. */
  validateAll(definitions: readonly ContentSlotDefinition[]): readonly PluginValidationReport[] {
    const reports: PluginValidationReport[] = []
    for (const definition of definitions) {
      const issues = this.validate(definition)
      if (issues.length) {
        reports.push({ slotId: definition.id, type: definition.type, issues })
      }
    }
    return reports
  }

  /** Content types present in a layout that this build cannot render. */
  unsupportedTypes(definitions: readonly ContentSlotDefinition[]): readonly string[] {
    const missing = new Set<string>()
    for (const definition of definitions) {
      if (!this.plugins.has(definition.type)) missing.add(definition.type)
    }
    return [...missing].sort()
  }
}
