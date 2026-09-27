import type { Geometry, ViewportSize } from '@core/types'

/**
 * Geometry maths for positioning slots.
 *
 * The legacy renderer recomputed autoscale percentages inline for every slot
 * and mixed up the width/height axes while doing it (top was divided by the
 * layout *width*). Centralising it here keeps the projection correct and makes
 * the "letterbox vs stretch" decision explicit and testable.
 */
export abstract class LayoutMath {
  static parseResolution(value: string | null | undefined): {
    width: number
    height: number
    orientation: 'landscape' | 'portrait'
  } {
    const fallback = { width: 1920, height: 1080, orientation: 'landscape' as const }
    if (!value) return fallback

    // Server emits either "1920x1080", "1920_1080_landscape" or "1920x1080_portrait".
    const parts = value.trim().toLowerCase().split(/[x_]/).filter(Boolean)
    const width = Number.parseInt(parts[0] ?? '', 10)
    const height = Number.parseInt(parts[1] ?? '', 10)
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
      return fallback
    }

    const orientation = parts.includes('portrait') ? 'portrait' : 'landscape'
    return { width, height, orientation }
  }

  /**
   * Uniform scale factor that fits `design` inside `viewport` without
   * distortion. Used when the layout opts into autoscale.
   */
  static fitScale(design: ViewportSize, viewport: ViewportSize): number {
    if (design.width <= 0 || design.height <= 0) return 1
    return Math.min(viewport.width / design.width, viewport.height / design.height)
  }

  /** Independent x/y factors, for layouts that want to fill the screen exactly. */
  static stretchScale(design: ViewportSize, viewport: ViewportSize): { x: number; y: number } {
    if (design.width <= 0 || design.height <= 0) return { x: 1, y: 1 }
    return { x: viewport.width / design.width, y: viewport.height / design.height }
  }

  /** Offsets that centre a scaled design surface inside the viewport. */
  static centerOffset(design: ViewportSize, viewport: ViewportSize, scale: number): { x: number; y: number } {
    return {
      x: Math.max(0, (viewport.width - design.width * scale) / 2),
      y: Math.max(0, (viewport.height - design.height * scale) / 2),
    }
  }

  static scaleGeometry(geometry: Geometry, scaleX: number, scaleY: number): Geometry {
    return {
      top: geometry.top * scaleY,
      left: geometry.left * scaleX,
      width: geometry.width * scaleX,
      height: geometry.height * scaleY,
      layer: geometry.layer,
    }
  }

  static clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value))
  }

  static toPx(value: number): string {
    return `${Math.round(value * 100) / 100}px`
  }
}
