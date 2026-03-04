import { clamp } from '@tempots/std'
import type { Position, Viewport } from '../types/layout'

export function screenToGraph(
  screenX: number,
  screenY: number,
  viewport: Viewport,
  containerRect: DOMRect,
): Position {
  return {
    x: (screenX - containerRect.left - viewport.x) / viewport.zoom,
    y: (screenY - containerRect.top - viewport.y) / viewport.zoom,
  }
}

export function graphToScreen(
  graphPos: Position,
  viewport: Viewport,
  containerRect: DOMRect,
): Position {
  return {
    x: graphPos.x * viewport.zoom + viewport.x + containerRect.left,
    y: graphPos.y * viewport.zoom + viewport.y + containerRect.top,
  }
}

export const clampZoom = clamp

export function snapToGrid(value: number, gridSize: number): number {
  return Math.round(value / gridSize) * gridSize
}
