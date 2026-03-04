import { interpolateNumber, prop } from '@tempots/core'
import type { Prop, Signal } from '@tempots/core'
import type { Viewport } from '../types/layout'
import type { ViewportTransitionConfig } from './animation-config'

export interface ViewportTween {
  /** Animate to the target viewport. */
  tweenTo(target: Viewport): void
  /** Cancel any in-progress animation and keep current value. */
  cancel(): void
  /**
   * Signal holding the tween's target viewport while an animation is in
   * flight, or `null` when idle. Used by culling to pre-populate visible
   * nodes so they are in the DOM before the viewport reaches them.
   */
  readonly target: Signal<Viewport | null>
}

/**
 * Creates a cancellable viewport tween using requestAnimationFrame.
 * Used for fitView, zoomIn, zoomOut — not for user pan/zoom.
 */
export function createViewportTween(
  viewportProp: Prop<Viewport>,
  config: ViewportTransitionConfig,
  isReducedMotion: Signal<boolean>,
): ViewportTween {
  let frameId: number | null = null
  const targetProp = prop<Viewport | null>(null)

  function cancel() {
    if (frameId !== null) {
      cancelAnimationFrame(frameId)
      frameId = null
    }
    targetProp.set(null)
  }

  function tweenTo(target: Viewport) {
    cancel()

    if (!config.enabled || isReducedMotion.value || config.duration <= 0) {
      viewportProp.set(target)
      return
    }

    const from = viewportProp.value
    const start = performance.now()
    const duration = config.duration
    const ease = config.easing

    // Expose the target so culling can include nodes at the destination
    targetProp.set(target)

    function frame() {
      const elapsed = performance.now() - start
      const t = Math.min(1, elapsed / duration)
      const p = ease(t)

      viewportProp.set({
        x: interpolateNumber(from.x, target.x, p),
        y: interpolateNumber(from.y, target.y, p),
        zoom: interpolateNumber(from.zoom, target.zoom, p),
      })

      if (t < 1) {
        frameId = requestAnimationFrame(frame)
      } else {
        frameId = null
        targetProp.set(null)
      }
    }

    frameId = requestAnimationFrame(frame)
  }

  return { tweenTo, cancel, target: targetProp }
}
