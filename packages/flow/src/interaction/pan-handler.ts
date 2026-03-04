import type { Prop } from '@tempots/core'
import type { InteractionState } from '../types/interaction'
import type { Viewport, Position, Dimensions } from '../types/layout'

export interface PanConfig {
  readonly inertia?: boolean
  readonly bounds?: 'none' | 'soft' | 'hard'
}

let panStartX = 0
let panStartY = 0

// Velocity tracking for inertia
let velocityX = 0
let velocityY = 0
let lastMoveTime = 0
let inertiaRafId = 0

const INERTIA_FRICTION = 0.95
const INERTIA_MIN_VELOCITY = 0.5
const ELASTIC_FACTOR = 0.3

export function handlePanStart(state: Prop<InteractionState>, event: PointerEvent): void {
  cancelInertia()
  panStartX = event.clientX
  panStartY = event.clientY
  velocityX = 0
  velocityY = 0
  lastMoveTime = performance.now()
  state.update((s) => ({ ...s, mode: 'panning' }))
}

export function handlePanMove(
  _state: Prop<InteractionState>,
  viewportProp: Prop<Viewport>,
  event: PointerEvent,
  panConfig?: PanConfig,
  contentBounds?: { min: Position; max: Position } | null,
): void {
  const dx = event.clientX - panStartX
  const dy = event.clientY - panStartY

  const now = performance.now()
  const dt = (now - lastMoveTime) / 1000
  if (dt > 0) {
    velocityX = dx / dt
    velocityY = dy / dt
  }
  lastMoveTime = now

  viewportProp.update((v) => {
    let newX = v.x + dx
    let newY = v.y + dy
    if (panConfig?.bounds && panConfig.bounds !== 'none' && contentBounds) {
      const result = applyPanBounds(newX, newY, v.zoom, contentBounds, panConfig.bounds)
      newX = result.x
      newY = result.y
    }
    return { ...v, x: newX, y: newY }
  })

  panStartX = event.clientX
  panStartY = event.clientY
}

export function handlePanEnd(
  state: Prop<InteractionState>,
  viewportProp?: Prop<Viewport>,
  panConfig?: PanConfig,
  contentBounds?: { min: Position; max: Position } | null,
): void {
  state.update((s) => ({ ...s, mode: 'idle' }))

  if (
    panConfig?.inertia &&
    viewportProp &&
    Math.hypot(velocityX, velocityY) > INERTIA_MIN_VELOCITY
  ) {
    startInertia(viewportProp, panConfig, contentBounds ?? null)
  }
}

function startInertia(
  viewportProp: Prop<Viewport>,
  panConfig: PanConfig,
  contentBounds: { min: Position; max: Position } | null,
): void {
  let vx = velocityX
  let vy = velocityY
  let lastTime = performance.now()

  function tick() {
    const now = performance.now()
    const dt = (now - lastTime) / 1000
    lastTime = now

    vx *= INERTIA_FRICTION
    vy *= INERTIA_FRICTION

    if (Math.hypot(vx, vy) < INERTIA_MIN_VELOCITY) {
      inertiaRafId = 0
      return
    }

    viewportProp.update((v) => {
      let newX = v.x + vx * dt
      let newY = v.y + vy * dt
      if (panConfig.bounds && panConfig.bounds !== 'none' && contentBounds) {
        const result = applyPanBounds(newX, newY, v.zoom, contentBounds, panConfig.bounds)
        newX = result.x
        newY = result.y
        // Dampen velocity if hitting bounds
        if (Math.abs(result.x - (v.x + vx * dt)) > 0.1) vx *= 0.5
        if (Math.abs(result.y - (v.y + vy * dt)) > 0.1) vy *= 0.5
      }
      return { ...v, x: newX, y: newY }
    })

    inertiaRafId = requestAnimationFrame(tick)
  }

  inertiaRafId = requestAnimationFrame(tick)
}

function cancelInertia(): void {
  if (inertiaRafId) {
    cancelAnimationFrame(inertiaRafId)
    inertiaRafId = 0
  }
}

function applyPanBounds(
  x: number,
  y: number,
  zoom: number,
  bounds: { min: Position; max: Position },
  mode: 'soft' | 'hard',
): Position {
  // Content bounds in screen space
  const minScreenX = bounds.min.x * zoom
  const maxScreenX = bounds.max.x * zoom
  const minScreenY = bounds.min.y * zoom
  const maxScreenY = bounds.max.y * zoom

  // The viewport offset should keep content visible
  // x + minScreenX >= 0 (left edge of content visible)
  // x + maxScreenX <= viewportWidth (right edge visible)
  // Simplified: clamp x to [-maxScreenX, -minScreenX + some margin]
  const marginX = 200
  const marginY = 200

  const clampedMinX = -maxScreenX + marginX
  const clampedMaxX = -minScreenX + marginX
  const clampedMinY = -maxScreenY + marginY
  const clampedMaxY = -minScreenY + marginY

  if (mode === 'hard') {
    return {
      x: Math.max(clampedMinX, Math.min(clampedMaxX, x)),
      y: Math.max(clampedMinY, Math.min(clampedMaxY, y)),
    }
  }

  // Soft: elastic resistance beyond bounds
  let resultX = x
  let resultY = y

  if (x < clampedMinX) {
    resultX = clampedMinX + (x - clampedMinX) * ELASTIC_FACTOR
  } else if (x > clampedMaxX) {
    resultX = clampedMaxX + (x - clampedMaxX) * ELASTIC_FACTOR
  }

  if (y < clampedMinY) {
    resultY = clampedMinY + (y - clampedMinY) * ELASTIC_FACTOR
  } else if (y > clampedMaxY) {
    resultY = clampedMaxY + (y - clampedMaxY) * ELASTIC_FACTOR
  }

  return { x: resultX, y: resultY }
}

/**
 * Compute the content bounding box from node positions and dimensions.
 */
export function computeContentBounds(
  positions: ReadonlyMap<string, Position>,
  dimensions: ReadonlyMap<string, Dimensions>,
): { min: Position; max: Position } | null {
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

  return { min: { x: minX, y: minY }, max: { x: maxX, y: maxY } }
}
