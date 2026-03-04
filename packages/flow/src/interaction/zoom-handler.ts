import type { Prop } from '@tempots/core'
import type { Viewport } from '../types/layout'
import { clampZoom } from '../core/coordinate-utils'

export function handleZoom(
  viewportProp: Prop<Viewport>,
  event: WheelEvent,
  containerRect: DOMRect,
  config: { minZoom: number; maxZoom: number; zoomStep: number },
  onZoom?: (zoom: number) => void,
): void {
  event.preventDefault()

  const delta = -event.deltaY * 0.001
  const viewport = viewportProp.value
  const newZoom = clampZoom(viewport.zoom * (1 + delta), config.minZoom, config.maxZoom)

  if (newZoom === viewport.zoom) return

  // Zoom toward the cursor position
  const mouseX = event.clientX - containerRect.left
  const mouseY = event.clientY - containerRect.top

  const zoomRatio = newZoom / viewport.zoom
  const newX = mouseX - (mouseX - viewport.x) * zoomRatio
  const newY = mouseY - (mouseY - viewport.y) * zoomRatio

  viewportProp.set({ x: newX, y: newY, zoom: newZoom })
  onZoom?.(newZoom)
}
