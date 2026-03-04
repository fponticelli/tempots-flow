import { createTween } from '@tempots/dom'
import type { Signal } from '@tempots/core'
import type { Viewport } from '../types/layout'
import type { ViewportTransitionConfig } from './animation-config'

export interface ViewportTween {
  /** Animate to the target viewport. */
  tweenTo(target: Viewport): void
  /** Cancel any in-progress animation and keep current value. */
  cancel(): void
}

const interpolateViewport = (from: Viewport, to: Viewport, t: number): Viewport => ({
  x: from.x + (to.x - from.x) * t,
  y: from.y + (to.y - from.y) * t,
  zoom: from.zoom + (to.zoom - from.zoom) * t,
})

/**
 * Creates a cancellable viewport tween using `createTween` from `@tempots/dom`.
 * Used for fitView, zoomIn, zoomOut — not for user pan/zoom.
 */
export function createViewportTween(
  viewportProp: { value: Viewport; set: (v: Viewport) => void },
  config: ViewportTransitionConfig,
  isReducedMotion: Signal<boolean>,
): ViewportTween {
  const tween = createTween<Viewport>(viewportProp.value, {
    duration: config.duration,
    easing: config.easing,
    interpolate: interpolateViewport,
    reducedMotion: isReducedMotion,
  })

  // Sync tween output back to the viewportProp
  tween.value.on((v) => {
    viewportProp.set(v)
  })

  function tweenTo(target: Viewport) {
    if (!config.enabled) {
      viewportProp.set(target)
      return
    }
    tween.tweenTo(target)
  }

  return { tweenTo, cancel: tween.cancel }
}
