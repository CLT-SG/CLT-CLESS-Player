import type { Component } from 'vue'
import type { ZodType } from 'zod'
import type { BaseContent } from '../content'
import type { ContentSlotDefinition, DatasetDefinition, LayoutDefinition } from '../schema'

/**
 * Everything a plugin needs to build its content object, without giving it a
 * reference to the store or the renderer.
 */
export interface ContentBuildContext {
  readonly layout: LayoutDefinition
  /** Absolute media base, e.g. `https://host/media/uploads`. */
  readonly mediaBaseUrl: string
  /** Scheme + host of CLESS-Server, for resolving server-relative URLs. */
  readonly serverOrigin: string
  /** Dataset addressed to a slot, when the content type consumes one. */
  datasetFor(slotId: string): DatasetDefinition | null
}

/**
 * A content type implementation.
 *
 * Adding a content type means writing one of these and registering it; nothing
 * in the renderer, the stores or the sync layer changes. The four
 * responsibilities the brief asks for map onto the members directly:
 *
 *  - **configuration**: `configSchema`
 *  - **validation**:    `validate`
 *  - **model/lifecycle**: `create` (the returned `BaseContent` owns lifecycle)
 *  - **renderer**:      `component`
 */
export interface ContentPlugin<TContent extends BaseContent = BaseContent> {
  /** Must match `ContentSlotDefinition.type` on the wire. */
  readonly type: string
  readonly displayName: string
  /** Vue component that renders this type. Receives `content` as a prop. */
  readonly component: Component
  /**
   * Optional schema for the slot's `config` object. When present, a slot whose
   * config fails validation is reported and skipped rather than rendered with
   * missing fields.
   */
  readonly configSchema?: ZodType<unknown>
  /** Content types that need the whole screen (e.g. full-bleed takeovers). */
  readonly exclusive?: boolean
  /** Builds the content model for a slot definition. */
  create(definition: ContentSlotDefinition, context: ContentBuildContext): TContent
  /**
   * Extra semantic checks beyond the schema, returning human-readable
   * problems. Runs at layout load, so it must not do any I/O.
   */
  validate?(definition: ContentSlotDefinition): readonly string[]
}

export interface PluginValidationReport {
  readonly slotId: string
  readonly type: string
  readonly issues: readonly string[]
}
