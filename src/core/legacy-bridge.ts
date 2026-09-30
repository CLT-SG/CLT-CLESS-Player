import { AirportEventCodec } from '@core/airport-display/AirportEventCodec'
import { ColorUtils } from '@core/utilities/ColorUtils'
import { DateUtils } from '@core/utilities/DateUtils'
import { FormatUtils } from '@core/utilities/FormatUtils'
import { LayoutMath } from '@core/utilities/LayoutMath'
import { MediaUtils } from '@core/utilities/MediaUtils'
import { NetworkUtils } from '@core/utilities/NetworkUtils'
import { TableCellCodec } from '@core/utilities/TableCellCodec'
import { ValidationUtils } from '@core/utilities/ValidationUtils'
import { SCHEMA_VERSION } from '@core/layouts/schema/version'

/**
 * The shared core, as the legacy renderer sees it.
 *
 * Built as a standalone IIFE to `src/assets/js/cless-core.js` and loaded by a
 * plain `<script>` tag before the other legacy scripts, so `window.ClessCore`
 * is available to code that predates modules by a decade.
 *
 * Two rules govern what belongs here.
 *
 * First, the surface is curated, not the whole core. Exporting everything
 * would invite the legacy renderer to grow new dependencies on internals that
 * are still moving, and the point of the bridge is to remove duplication, not
 * to create a second public API to maintain.
 *
 * Second, offering a function here is not the same as adopting it. The legacy
 * renderer's inline autoscale divides a slot's `top` by the layout *width*
 * and its `left` by the layout *height* — both axes swapped. `LayoutMath`
 * gets it right, which is exactly why `layoutxml.js` has not been switched
 * over: doing so would move every slot on every production screen. That
 * correction belongs to a planned rollout, not to a utility extraction.
 *
 * Imports are file-specific rather than barrel imports so the emitted bundle
 * carries only what is listed here.
 */
const ClessCore = {
  version: SCHEMA_VERSION,

  /**
   * Exact replacement for the `hexToRgbA` copies in `layoutxml.js` and
   * `slot-table.js`, including the `high`/`medium`/`low` transparency
   * vocabulary. Unlike the original it returns black instead of throwing on a
   * malformed colour, because a bad colour must not stop a layout playing.
   */
  hexToRgbA(hex: string, transparency: string): string {
    return ColorUtils.toRgba(hex, ColorUtils.transparencyToAlpha(transparency))
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
  decodeCellEntries(raw: string): readonly string[] {
    return TableCellCodec.entries(raw)
  },

  /**
   * Flattens an Airport Display announcement to the tracks to play, in play
   * order, using the legacy field names so `airport-display.js` can hand the
   * result straight on.
   *
   * The media-selection half of `AirportEventCodec` is deliberately not
   * offered: the legacy `collectMediaTriggerItems` passes its items on to
   * `resolveMediaSource`, which reads a `type` field the normalised item does
   * not carry, so adopting it would quietly drop a hint the legacy media
   * pipeline uses. The two implementations stay pinned to each other by
   * `app/tests/airport-parity.spec.ts` instead.
   */
  airportAnnouncementLanguages(announcement: unknown): Array<Record<string, unknown>> {
    return AirportEventCodec.announcementLanguages(announcement).map((track) => ({
      language: track.language,
      voice: track.voice,
      order: track.order,
      audio_url: track.audioUrl,
      text: track.text,
    }))
  },
} as const

export type ClessCoreBridge = typeof ClessCore

declare global {
  interface Window {
    ClessCore?: ClessCoreBridge
  }
}

;(globalThis as { ClessCore?: ClessCoreBridge }).ClessCore = ClessCore

export default ClessCore
