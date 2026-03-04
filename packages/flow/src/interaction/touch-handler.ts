import type { Prop } from '@tempots/core'
import type { Viewport } from '../types/layout'
import { clampZoom } from '../core/coordinate-utils'

export interface TouchConfig {
  readonly minZoom: number
  readonly maxZoom: number
  readonly onZoom?: (zoom: number) => void
}

interface TouchState {
  /** Starting distance between two fingers */
  startDist: number
  /** Starting midpoint */
  startMidX: number
  startMidY: number
  /** Viewport at touch start */
  startViewport: Viewport
  /** Whether actively pinch-zooming */
  active: boolean
}

function dist(t1: Touch, t2: Touch): number {
  const dx = t1.clientX - t2.clientX
  const dy = t1.clientY - t2.clientY
  return Math.sqrt(dx * dx + dy * dy)
}

function midpoint(t1: Touch, t2: Touch): { x: number; y: number } {
  return {
    x: (t1.clientX + t2.clientX) / 2,
    y: (t1.clientY + t2.clientY) / 2,
  }
}

export function createTouchHandler(
  viewportProp: Prop<Viewport>,
  getContainerRect: () => DOMRect,
  config: TouchConfig,
): {
  onTouchStart: (e: TouchEvent) => void
  onTouchMove: (e: TouchEvent) => void
  onTouchEnd: (e: TouchEvent) => void
} {
  let touchState: TouchState | null = null

  function onTouchStart(e: TouchEvent): void {
    if (e.touches.length === 2) {
      e.preventDefault()
      const t1 = e.touches[0]!
      const t2 = e.touches[1]!
      const mid = midpoint(t1, t2)
      touchState = {
        startDist: dist(t1, t2),
        startMidX: mid.x,
        startMidY: mid.y,
        startViewport: { ...viewportProp.value },
        active: true,
      }
    }
  }

  function onTouchMove(e: TouchEvent): void {
    if (!touchState?.active || e.touches.length !== 2) return
    e.preventDefault()

    const t1 = e.touches[0]!
    const t2 = e.touches[1]!
    const currentDist = dist(t1, t2)
    const mid = midpoint(t1, t2)
    const rect = getContainerRect()

    // Compute zoom from pinch ratio
    const ratio = currentDist / touchState.startDist
    const newZoom = clampZoom(touchState.startViewport.zoom * ratio, config.minZoom, config.maxZoom)

    // Compute pan from midpoint delta
    const panDx = mid.x - touchState.startMidX
    const panDy = mid.y - touchState.startMidY

    // Zoom toward the midpoint of the two fingers
    const midX = mid.x - rect.left
    const midY = mid.y - rect.top
    const zoomRatio = newZoom / touchState.startViewport.zoom

    const newX = midX - (midX - touchState.startViewport.x) * zoomRatio + panDx
    const newY = midY - (midY - touchState.startViewport.y) * zoomRatio + panDy

    viewportProp.set({ x: newX, y: newY, zoom: newZoom })
    config.onZoom?.(newZoom)
  }

  function onTouchEnd(e: TouchEvent): void {
    if (e.touches.length < 2) {
      touchState = null
    }
  }

  return { onTouchStart, onTouchMove, onTouchEnd }
}
