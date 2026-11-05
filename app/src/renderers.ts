import type { Component, InjectionKey } from 'vue'
import type { ContentPluginRegistry } from '@core/plugins'
import type { PlayerRuntime } from '@core/player'
import AirportDisplayRenderer from '@/components/renderers/AirportDisplayRenderer.vue'
import ClockRenderer from '@/components/renderers/ClockRenderer.vue'
import EmbedRenderer from '@/components/renderers/EmbedRenderer.vue'
import FaderRenderer from '@/components/renderers/FaderRenderer.vue'
import MediaRenderer from '@/components/renderers/MediaRenderer.vue'
import TableRenderer from '@/components/renderers/TableRenderer.vue'
import TextRenderer from '@/components/renderers/TextRenderer.vue'
import TickerRenderer from '@/components/renderers/TickerRenderer.vue'
import UnsupportedRenderer from '@/components/renderers/UnsupportedRenderer.vue'

/**
 * Maps a content type to the Vue component that draws it.
 *
 * The map lives in the renderer, not in the plugin definitions, because the
 * core describes *what* a content type is and this file decides *how this
 * renderer draws it*. Keeping the two apart is what lets the same plugin
 * registry serve the Vue renderer, the legacy renderer and any headless
 * consumer such as a validation harness.
 */
export const CONTENT_RENDERERS: Readonly<Record<string, Component>> = {
  media: MediaRenderer,
  text: TextRenderer,
  ticker: TickerRenderer,
  scroller: TickerRenderer,
  fader: FaderRenderer,
  date: ClockRenderer,
  time: ClockRenderer,
  datetime: ClockRenderer,
  html: EmbedRenderer,
  widget: EmbedRenderer,
  table: TableRenderer,
  'airport-display': AirportDisplayRenderer,
}

/**
 * Renderer for a content type the core knows about but this renderer does
 * not yet draw. It reports the gap on screen rather than leaving a blank
 * area, so a mismatch between core and renderer is visible during rollout.
 */
export const FALLBACK_RENDERER: Component = UnsupportedRenderer

export function rendererFor(type: string): Component {
  return CONTENT_RENDERERS[type] ?? FALLBACK_RENDERER
}

/**
 * Injection keys for the two objects components are allowed to reach for:
 * the registry (to ask what a content type is) and the runtime (to request an
 * action such as "advance the playlist"). Everything else flows through
 * stores, which keeps the dependency direction one-way.
 */
export const REGISTRY_KEY = Symbol('cless.registry') as InjectionKey<ContentPluginRegistry>
export const RUNTIME_KEY = Symbol('cless.runtime') as InjectionKey<PlayerRuntime>
