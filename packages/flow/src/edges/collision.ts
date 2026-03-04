// Shared collision detection and obstacle-avoidance routing utilities

import type { ComputedPortPosition, PortSide } from '../types/layout'

export interface Rect {
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
}

export interface Point {
  readonly x: number
  readonly y: number
}

export function sideOffset(side: PortSide, dist: number): { dx: number; dy: number } {
  switch (side) {
    case 'right':
      return { dx: dist, dy: 0 }
    case 'left':
      return { dx: -dist, dy: 0 }
    case 'bottom':
      return { dx: 0, dy: dist }
    case 'top':
      return { dx: 0, dy: -dist }
  }
}

export function sign(v: number): number {
  return v > 0 ? 1 : v < 0 ? -1 : 0
}

export function pointInRect(p: Point, r: Rect, margin: number): boolean {
  return (
    p.x > r.x - margin && p.x < r.x + r.w + margin && p.y > r.y - margin && p.y < r.y + r.h + margin
  )
}

export function segmentIntersectsRect(a: Point, b: Point, r: Rect, margin: number): boolean {
  const left = r.x - margin
  const right = r.x + r.w + margin
  const top = r.y - margin
  const bottom = r.y + r.h + margin

  // Horizontal segment
  if (a.y === b.y) {
    if (a.y < top || a.y > bottom) return false
    const minX = Math.min(a.x, b.x)
    const maxX = Math.max(a.x, b.x)
    return maxX > left && minX < right
  }
  // Vertical segment
  if (a.x === b.x) {
    if (a.x < left || a.x > right) return false
    const minY = Math.min(a.y, b.y)
    const maxY = Math.max(a.y, b.y)
    return maxY > top && minY < bottom
  }
  return false
}

/** Check if an axis-aligned polyline path hits any obstacle */
export function pathHitsObstacle(path: readonly Point[], obstacles: readonly Rect[]): boolean {
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i]!
    const b = path[i + 1]!
    for (const obs of obstacles) {
      if (segmentIntersectsRect(a, b, obs, 2)) return true
    }
  }
  return false
}

export function pathLength(points: readonly Point[]): number {
  let len = 0
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!
    const b = points[i]!
    len += Math.abs(b.x - a.x) + Math.abs(b.y - a.y)
  }
  return len
}

export function simplifyPath(points: readonly Point[]): Point[] {
  if (points.length < 3) return [...points]
  const result: Point[] = [points[0]!]
  for (let i = 1; i < points.length - 1; i++) {
    const prev = result[result.length - 1]!
    const curr = points[i]!
    const next = points[i + 1]!
    const sameX = prev.x === curr.x && curr.x === next.x
    const sameY = prev.y === curr.y && curr.y === next.y
    if (!sameX && !sameY) {
      result.push(curr)
    }
  }
  result.push(points[points.length - 1]!)
  return result
}

export function roundedCorner(
  fromX: number,
  fromY: number,
  cornerX: number,
  cornerY: number,
  toX: number,
  toY: number,
  r: number,
): string {
  const dxIn = sign(cornerX - fromX)
  const dyIn = sign(cornerY - fromY)
  const dxOut = sign(toX - cornerX)
  const dyOut = sign(toY - cornerY)

  const legIn = Math.max(Math.abs(cornerX - fromX), Math.abs(cornerY - fromY))
  const legOut = Math.max(Math.abs(toX - cornerX), Math.abs(toY - cornerY))
  const maxR = Math.min(legIn, legOut, r)

  if (maxR < 1) return `L ${cornerX} ${cornerY}`

  const arcStartX = cornerX - dxIn * maxR
  const arcStartY = cornerY - dyIn * maxR
  const arcEndX = cornerX + dxOut * maxR
  const arcEndY = cornerY + dyOut * maxR

  return `L ${arcStartX} ${arcStartY} Q ${cornerX} ${cornerY} ${arcEndX} ${arcEndY}`
}

export function waypointsToPath(waypoints: readonly Point[], borderRadius: number): string {
  const simplified = simplifyPath(waypoints)
  const n = simplified.length
  if (n < 2) return ''

  const first = simplified[0]!
  const last = simplified[n - 1]!
  const segments: string[] = [`M ${first.x} ${first.y}`]

  if (n === 2) {
    segments.push(`L ${last.x} ${last.y}`)
    return segments.join(' ')
  }

  for (let i = 1; i < n - 1; i++) {
    const prev = simplified[i - 1]!
    const curr = simplified[i]!
    const next = simplified[i + 1]!
    segments.push(roundedCorner(prev.x, prev.y, curr.x, curr.y, next.x, next.y, borderRadius))
  }

  segments.push(`L ${last.x} ${last.y}`)
  return segments.join(' ')
}

/** Threshold below which coordinates are treated as aligned. */
const SNAP_THRESHOLD = 4

export function tryDirectRoute(
  start: Point,
  end: Point,
  sourceSide: PortSide,
  targetSide: PortSide,
): Point[] {
  const srcH = sourceSide === 'left' || sourceSide === 'right'
  const tgtH = targetSide === 'left' || targetSide === 'right'

  if (srcH && tgtH) {
    // Nearly same Y -> straight horizontal line
    if (Math.abs(start.y - end.y) < SNAP_THRESHOLD) {
      const y = (start.y + end.y) / 2
      return [{ x: start.x, y }, { x: end.x, y }]
    }
    const midX = (start.x + end.x) / 2
    return [start, { x: midX, y: start.y }, { x: midX, y: end.y }, end]
  }
  if (!srcH && !tgtH) {
    // Nearly same X -> straight vertical line
    if (Math.abs(start.x - end.x) < SNAP_THRESHOLD) {
      const x = (start.x + end.x) / 2
      return [{ x, y: start.y }, { x, y: end.y }]
    }
    const midY = (start.y + end.y) / 2
    return [start, { x: start.x, y: midY }, { x: end.x, y: midY }, end]
  }
  if (srcH) {
    return [start, { x: end.x, y: start.y }, end]
  }
  return [start, { x: start.x, y: end.y }, end]
}

export function detourRoute(
  start: Point,
  end: Point,
  sourceSide: PortSide,
  targetSide: PortSide,
  obstacles: readonly Rect[],
  maxIterations: number,
): Point[] {
  const xValues = new Set<number>([start.x, end.x])
  const yValues = new Set<number>([start.y, end.y])
  for (const obs of obstacles) {
    xValues.add(obs.x - 10)
    xValues.add(obs.x + obs.w + 10)
    yValues.add(obs.y - 10)
    yValues.add(obs.y + obs.h + 10)
  }

  const srcH = sourceSide === 'left' || sourceSide === 'right'

  let bestPath: Point[] | null = null
  let bestLen = Infinity
  let iterations = 0

  const sortedY = [...yValues].sort((a, b) => a - b)
  const sortedX = [...xValues].sort((a, b) => a - b)

  if (srcH) {
    for (const midY of sortedY) {
      if (++iterations > maxIterations) break
      const path = [start, { x: start.x, y: midY }, { x: end.x, y: midY }, end]
      if (!pathHitsObstacle(path, obstacles)) {
        const len = pathLength(path)
        if (len < bestLen) {
          bestLen = len
          bestPath = path
        }
      }
    }
    for (const midX of sortedX) {
      for (const midY of sortedY) {
        if (++iterations > maxIterations) break
        const path = [
          start,
          { x: midX, y: start.y },
          { x: midX, y: midY },
          { x: end.x, y: midY },
          end,
        ]
        if (!pathHitsObstacle(path, obstacles)) {
          const len = pathLength(path)
          if (len < bestLen) {
            bestLen = len
            bestPath = path
          }
        }
      }
    }
  } else {
    for (const midX of sortedX) {
      if (++iterations > maxIterations) break
      const path = [start, { x: midX, y: start.y }, { x: midX, y: end.y }, end]
      if (!pathHitsObstacle(path, obstacles)) {
        const len = pathLength(path)
        if (len < bestLen) {
          bestLen = len
          bestPath = path
        }
      }
    }
    for (const midY of sortedY) {
      for (const midX of sortedX) {
        if (++iterations > maxIterations) break
        const path = [
          start,
          { x: start.x, y: midY },
          { x: midX, y: midY },
          { x: midX, y: end.y },
          end,
        ]
        if (!pathHitsObstacle(path, obstacles)) {
          const len = pathLength(path)
          if (len < bestLen) {
            bestLen = len
            bestPath = path
          }
        }
      }
    }
  }

  return bestPath ?? tryDirectRoute(start, end, sourceSide, targetSide)
}

export function findOrthogonalPath(
  start: Point,
  end: Point,
  sourceSide: PortSide,
  targetSide: PortSide,
  obstacles: readonly Rect[],
  maxIterations: number,
): Point[] {
  const directPath = tryDirectRoute(start, end, sourceSide, targetSide)
  if (!pathHitsObstacle(directPath, obstacles)) {
    return directPath
  }
  return detourRoute(start, end, sourceSide, targetSide, obstacles, maxIterations)
}

export function computeOrthogonalWaypoints(
  source: ComputedPortPosition,
  target: ComputedPortPosition,
  obstacles: readonly Rect[],
  exitDist: number,
  maxIterations: number,
): Point[] {
  const srcOff = sideOffset(source.side, exitDist)
  const tgtOff = sideOffset(target.side, exitDist)

  const exit: Point = { x: source.x + srcOff.dx, y: source.y + srcOff.dy }
  const entry: Point = { x: target.x + tgtOff.dx, y: target.y + tgtOff.dy }

  const waypoints: Point[] = [{ x: source.x, y: source.y }]
  const path = findOrthogonalPath(exit, entry, source.side, target.side, obstacles, maxIterations)
  waypoints.push(...path)
  waypoints.push({ x: target.x, y: target.y })

  return waypoints
}

// --- New utilities for general-purpose obstacle avoidance ---

/** Convert EdgeBatchRoutingParams obstacles to Rect[], filtering out source/target nodes */
export function buildEdgeObstacles(
  allObstacles: readonly { readonly position: { x: number; y: number }; readonly dimensions: { width: number; height: number } }[],
  sourcePoint: Point,
  targetPoint: Point,
  padding: number,
): Rect[] {
  const rects: Rect[] = allObstacles.map((obs) => ({
    x: obs.position.x,
    y: obs.position.y,
    w: obs.dimensions.width,
    h: obs.dimensions.height,
  }))
  return rects.filter((r) => {
    const srcInside = pointInRect(sourcePoint, r, padding)
    const tgtInside = pointInRect(targetPoint, r, padding)
    return !srcInside && !tgtInside
  })
}

/** Approximate a cubic bezier as a polyline using de Casteljau subdivision */
export function approximateBezierAsPolyline(
  p0: Point,
  p1: Point,
  p2: Point,
  p3: Point,
  steps = 20,
): Point[] {
  const points: Point[] = []
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const mt = 1 - t
    const mt2 = mt * mt
    const t2 = t * t
    points.push({
      x: mt2 * mt * p0.x + 3 * mt2 * t * p1.x + 3 * mt * t2 * p2.x + t2 * t * p3.x,
      y: mt2 * mt * p0.y + 3 * mt2 * t * p1.y + 3 * mt * t2 * p2.y + t2 * t * p3.y,
    })
  }
  return points
}

/**
 * Check if a general polyline (including diagonal segments) hits any obstacle.
 * Uses parametric line-segment vs AABB intersection.
 */
export function polylineHitsObstacle(
  points: readonly Point[],
  obstacles: readonly Rect[],
  margin = 2,
): boolean {
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]!
    const b = points[i + 1]!
    for (const obs of obstacles) {
      if (generalSegmentIntersectsRect(a, b, obs, margin)) return true
    }
  }
  return false
}

/** Line segment vs AABB intersection using slab method (handles diagonal segments) */
function generalSegmentIntersectsRect(a: Point, b: Point, r: Rect, margin: number): boolean {
  const left = r.x - margin
  const right = r.x + r.w + margin
  const top = r.y - margin
  const bottom = r.y + r.h + margin

  const dx = b.x - a.x
  const dy = b.y - a.y

  let tMin = 0
  let tMax = 1

  // X slab
  if (dx === 0) {
    if (a.x < left || a.x > right) return false
  } else {
    const invDx = 1 / dx
    let t1 = (left - a.x) * invDx
    let t2 = (right - a.x) * invDx
    if (t1 > t2) {
      const tmp = t1
      t1 = t2
      t2 = tmp
    }
    tMin = Math.max(tMin, t1)
    tMax = Math.min(tMax, t2)
    if (tMin > tMax) return false
  }

  // Y slab
  if (dy === 0) {
    if (a.y < top || a.y > bottom) return false
  } else {
    const invDy = 1 / dy
    let t1 = (top - a.y) * invDy
    let t2 = (bottom - a.y) * invDy
    if (t1 > t2) {
      const tmp = t1
      t1 = t2
      t2 = tmp
    }
    tMin = Math.max(tMin, t1)
    tMax = Math.min(tMax, t2)
    if (tMin > tMax) return false
  }

  return true
}

/**
 * Convert waypoints to a smooth multi-segment cubic bezier SVG path
 * using Catmull-Rom to cubic bezier conversion.
 */
export function catmullRomThroughWaypoints(
  waypoints: readonly Point[],
  tension = 0.5,
): string {
  const n = waypoints.length
  if (n < 2) return ''

  const first = waypoints[0]!
  const last = waypoints[n - 1]!

  if (n === 2) {
    return `M ${first.x} ${first.y} L ${last.x} ${last.y}`
  }

  const segments: string[] = [`M ${first.x} ${first.y}`]
  const alpha = tension

  for (let i = 0; i < n - 1; i++) {
    const p0 = waypoints[Math.max(0, i - 1)]!
    const p1 = waypoints[i]!
    const p2 = waypoints[Math.min(n - 1, i + 1)]!
    const p3 = waypoints[Math.min(n - 1, i + 2)]!

    // Catmull-Rom to cubic bezier control points
    const cp1x = p1.x + (p2.x - p0.x) / (6 / alpha)
    const cp1y = p1.y + (p2.y - p0.y) / (6 / alpha)
    const cp2x = p2.x - (p3.x - p1.x) / (6 / alpha)
    const cp2y = p2.y - (p3.y - p1.y) / (6 / alpha)

    segments.push(`C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`)
  }

  return segments.join(' ')
}
