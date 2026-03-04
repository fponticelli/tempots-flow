import { html, attr, WithElement, OnDispose } from '@tempots/dom'
import type { TNode } from '@tempots/dom'
import type { Signal } from '@tempots/core'
import type { Position, Dimensions, Viewport } from '../types/layout'
import type { MinimapConfig } from '../types/config'

interface Bounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

function computeBounds(
  positions: ReadonlyMap<string, Position>,
  dimensions: ReadonlyMap<string, Dimensions>,
  padding: number,
): Bounds | null {
  if (positions.size === 0) return null

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (const [nodeId, pos] of positions) {
    const dims = dimensions.get(nodeId) ?? { width: 180, height: 80 }
    minX = Math.min(minX, pos.x)
    minY = Math.min(minY, pos.y)
    maxX = Math.max(maxX, pos.x + dims.width)
    maxY = Math.max(maxY, pos.y + dims.height)
  }

  return {
    minX: minX - padding,
    minY: minY - padding,
    maxX: maxX + padding,
    maxY: maxY + padding,
  }
}

function draw(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  positions: ReadonlyMap<string, Position>,
  dimensions: ReadonlyMap<string, Dimensions>,
  vp: Viewport,
  getContainerRect: () => DOMRect,
  nodeColor: string,
  nodeRenderer?: (nodeId: string) => string,
): void {
  const canvasWidth = canvas.width
  const canvasHeight = canvas.height

  ctx.clearRect(0, 0, canvasWidth, canvasHeight)

  const bounds = computeBounds(positions, dimensions, 50)
  if (bounds === null) return

  const boundsWidth = bounds.maxX - bounds.minX
  const boundsHeight = bounds.maxY - bounds.minY
  if (boundsWidth <= 0 || boundsHeight <= 0) return

  const scaleX = canvasWidth / boundsWidth
  const scaleY = canvasHeight / boundsHeight
  const scale = Math.min(scaleX, scaleY)

  // Center the drawing within the canvas
  const offsetX = (canvasWidth - boundsWidth * scale) / 2
  const offsetY = (canvasHeight - boundsHeight * scale) / 2

  function toMinimapX(graphX: number): number {
    return (graphX - bounds!.minX) * scale + offsetX
  }

  function toMinimapY(graphY: number): number {
    return (graphY - bounds!.minY) * scale + offsetY
  }

  // Draw nodes
  for (const [nodeId, pos] of positions) {
    ctx.fillStyle = nodeRenderer ? nodeRenderer(nodeId) : nodeColor
    const dims = dimensions.get(nodeId) ?? { width: 180, height: 80 }
    const x = toMinimapX(pos.x)
    const y = toMinimapY(pos.y)
    const w = dims.width * scale
    const h = dims.height * scale
    ctx.beginPath()
    ctx.roundRect(x, y, w, h, 3)
    ctx.fill()
  }

  // Draw viewport region
  const containerRect = getContainerRect()
  const vpGraphX = -vp.x / vp.zoom
  const vpGraphY = -vp.y / vp.zoom
  const vpGraphW = containerRect.width / vp.zoom
  const vpGraphH = containerRect.height / vp.zoom

  const vpMinX = toMinimapX(vpGraphX)
  const vpMinY = toMinimapY(vpGraphY)
  const vpW = vpGraphW * scale
  const vpH = vpGraphH * scale

  ctx.strokeStyle = 'rgba(255,255,255,0.5)'
  ctx.lineWidth = 1
  ctx.fillStyle = 'rgba(255,255,255,0.08)'
  ctx.beginPath()
  ctx.rect(vpMinX, vpMinY, vpW, vpH)
  ctx.fill()
  ctx.stroke()
}

function getScaleAndOffset(
  canvas: HTMLCanvasElement,
  positions: ReadonlyMap<string, Position>,
  dimensions: ReadonlyMap<string, Dimensions>,
): { scale: number; offsetX: number; offsetY: number; bounds: Bounds } | null {
  const bounds = computeBounds(positions, dimensions, 50)
  if (bounds === null) return null

  const boundsWidth = bounds.maxX - bounds.minX
  const boundsHeight = bounds.maxY - bounds.minY
  if (boundsWidth <= 0 || boundsHeight <= 0) return null

  const canvasWidth = canvas.width
  const canvasHeight = canvas.height
  const scaleX = canvasWidth / boundsWidth
  const scaleY = canvasHeight / boundsHeight
  const scale = Math.min(scaleX, scaleY)
  const offsetX = (canvasWidth - boundsWidth * scale) / 2
  const offsetY = (canvasHeight - boundsHeight * scale) / 2

  return { scale, offsetX, offsetY, bounds }
}

function canvasToGraph(
  canvasX: number,
  canvasY: number,
  scale: number,
  offsetX: number,
  offsetY: number,
  bounds: Bounds,
): { graphX: number; graphY: number } {
  const graphX = (canvasX - offsetX) / scale + bounds.minX
  const graphY = (canvasY - offsetY) / scale + bounds.minY
  return { graphX, graphY }
}

export function Minimap(
  config: MinimapConfig,
  positions: Signal<ReadonlyMap<string, Position>>,
  dimensions: Signal<ReadonlyMap<string, Dimensions>>,
  viewport: Signal<Viewport>,
  setViewport: (v: Partial<Viewport>) => void,
  getContainerRect: () => DOMRect,
): TNode {
  const width = config.width ?? 200
  const height = config.height ?? 150
  const nodeColor = config.nodeColor ?? '#53a8ff'
  const nodeRenderer = config.nodeRenderer
  const interactive = config.interactive !== false
  const position = config.position ?? 'bottom-right'
  const positionClass = `flow-minimap--${position}`

  return html.div(
    attr.class(`flow-minimap ${positionClass}`),
    html.canvas(
      attr.width(String(width)),
      attr.height(String(height)),
      WithElement((canvas: HTMLCanvasElement) => {
        const ctx = canvas.getContext('2d')
        if (ctx === null) return

        let isDragging = false

        const intervalId = setInterval(() => {
          draw(
            canvas,
            ctx,
            positions.value,
            dimensions.value,
            viewport.value,
            getContainerRect,
            nodeColor,
            nodeRenderer,
          )
        }, 33)

        function getCanvasPoint(e: PointerEvent): { x: number; y: number } {
          const rect = canvas.getBoundingClientRect()
          return {
            x: (e.clientX - rect.left) * (canvas.width / rect.width),
            y: (e.clientY - rect.top) * (canvas.height / rect.height),
          }
        }

        function panToCanvasPoint(canvasX: number, canvasY: number): void {
          const mapping = getScaleAndOffset(canvas, positions.value, dimensions.value)
          if (mapping === null) return
          const { scale, offsetX, offsetY, bounds } = mapping
          const { graphX, graphY } = canvasToGraph(
            canvasX,
            canvasY,
            scale,
            offsetX,
            offsetY,
            bounds,
          )
          const containerRect = getContainerRect()
          const vp = viewport.value
          setViewport({
            x: containerRect.width / 2 - graphX * vp.zoom,
            y: containerRect.height / 2 - graphY * vp.zoom,
          })
        }

        function onPointerDown(e: PointerEvent): void {
          isDragging = true
          canvas.setPointerCapture(e.pointerId)
          const { x, y } = getCanvasPoint(e)
          panToCanvasPoint(x, y)
        }

        function onPointerMove(e: PointerEvent): void {
          if (!isDragging) return
          const { x, y } = getCanvasPoint(e)
          panToCanvasPoint(x, y)
        }

        function onPointerUp(e: PointerEvent): void {
          isDragging = false
          canvas.releasePointerCapture(e.pointerId)
        }

        if (interactive) {
          canvas.addEventListener('pointerdown', onPointerDown)
          canvas.addEventListener('pointermove', onPointerMove)
          canvas.addEventListener('pointerup', onPointerUp)
        }

        return OnDispose(() => {
          clearInterval(intervalId)
          if (interactive) {
            canvas.removeEventListener('pointerdown', onPointerDown)
            canvas.removeEventListener('pointermove', onPointerMove)
            canvas.removeEventListener('pointerup', onPointerUp)
          }
        })
      }),
    ),
  )
}
