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
export function pathHitsObstacle(
  path: readonly Point[],
  obstacles: readonly Rect[],
  margin = 2,
): boolean {
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i]!
    const b = path[i + 1]!
    for (const obs of obstacles) {
      if (segmentIntersectsRect(a, b, obs, margin)) return true
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
  const maxR = Math.min(legIn / 2, legOut / 2, r)

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
      return [
        { x: start.x, y },
        { x: end.x, y },
      ]
    }
    const midX = (start.x + end.x) / 2
    return [start, { x: midX, y: start.y }, { x: midX, y: end.y }, end]
  }
  if (!srcH && !tgtH) {
    // Nearly same X -> straight vertical line
    if (Math.abs(start.x - end.x) < SNAP_THRESHOLD) {
      const x = (start.x + end.x) / 2
      return [
        { x, y: start.y },
        { x, y: end.y },
      ]
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
  clearance = 10,
): Point[] {
  const xValues = new Set<number>([start.x, end.x])
  const yValues = new Set<number>([start.y, end.y])

  // Add midpoint between start and end for more natural routing
  xValues.add((start.x + end.x) / 2)
  yValues.add((start.y + end.y) / 2)

  // Use generous spacing (2x clearance) for candidate waypoints so paths
  // don't hug obstacle boundaries. This gives smooth curves room to breathe.
  const spacing = clearance * 2
  for (const obs of obstacles) {
    xValues.add(obs.x - spacing)
    xValues.add(obs.x + obs.w + spacing)
    yValues.add(obs.y - spacing)
    yValues.add(obs.y + obs.h + spacing)
  }

  const srcH = sourceSide === 'left' || sourceSide === 'right'

  let bestPath: Point[] | null = null
  let bestLen = Infinity
  let iterations = 0

  const sortedY = [...yValues].sort((a, b) => a - b)
  const sortedX = [...xValues].sort((a, b) => a - b)

  // Use clearance - 1 for path validation so candidates at obstacle edge ± clearance
  // are not rejected by floating-point boundary effects
  const validationMargin = Math.max(0, clearance - 1)

  if (srcH) {
    for (const midY of sortedY) {
      if (++iterations > maxIterations) break
      const path = [start, { x: start.x, y: midY }, { x: end.x, y: midY }, end]
      if (!pathHitsObstacle(path, obstacles, validationMargin)) {
        const s = pathLength(path)
        if (s < bestLen) {
          bestLen = s
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
        if (!pathHitsObstacle(path, obstacles, validationMargin)) {
          const s = pathLength(path)
          if (s < bestLen) {
            bestLen = s
            bestPath = path
          }
        }
      }
    }
  } else {
    for (const midX of sortedX) {
      if (++iterations > maxIterations) break
      const path = [start, { x: midX, y: start.y }, { x: midX, y: end.y }, end]
      if (!pathHitsObstacle(path, obstacles, validationMargin)) {
        const s = pathLength(path)
        if (s < bestLen) {
          bestLen = s
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
        if (!pathHitsObstacle(path, obstacles, validationMargin)) {
          const s = pathLength(path)
          if (s < bestLen) {
            bestLen = s
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
  clearance = 10,
): Point[] {
  const directPath = tryDirectRoute(start, end, sourceSide, targetSide)
  if (!pathHitsObstacle(directPath, obstacles, clearance)) {
    return directPath
  }
  return detourRoute(start, end, sourceSide, targetSide, obstacles, maxIterations, clearance)
}

export function computeOrthogonalWaypoints(
  source: ComputedPortPosition,
  target: ComputedPortPosition,
  obstacles: readonly Rect[],
  exitDist: number,
  maxIterations: number,
  clearance = 10,
): Point[] {
  const srcOff = sideOffset(source.side, exitDist)
  const tgtOff = sideOffset(target.side, exitDist)

  const exit: Point = { x: source.x + srcOff.dx, y: source.y + srcOff.dy }
  const entry: Point = { x: target.x + tgtOff.dx, y: target.y + tgtOff.dy }

  const waypoints: Point[] = [{ x: source.x, y: source.y }]
  const path = findOrthogonalPath(
    exit,
    entry,
    source.side,
    target.side,
    obstacles,
    maxIterations,
    clearance,
  )
  waypoints.push(...path)
  waypoints.push({ x: target.x, y: target.y })

  return waypoints
}

// --- New utilities for general-purpose obstacle avoidance ---

/**
 * Convert EdgeBatchRoutingParams obstacles to Rect[], filtering out source/target nodes
 * and inflating by the requested padding.
 */
export function buildEdgeObstacles(
  allObstacles: readonly {
    readonly nodeId: string
    readonly position: { x: number; y: number }
    readonly dimensions: { width: number; height: number }
  }[],
  sourceNodeId: string,
  targetNodeId: string,
  padding: number,
): Rect[] {
  const rects: Rect[] = allObstacles
    .filter((obs) => obs.nodeId !== sourceNodeId && obs.nodeId !== targetNodeId)
    .map((obs) => ({
      x: obs.position.x - padding,
      y: obs.position.y - padding,
      w: obs.dimensions.width + padding * 2,
      h: obs.dimensions.height + padding * 2,
    }))
  return rects
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
 * Compute a rerouted bezier path that avoids obstacles while maintaining
 * a smooth curve shape. Only considers obstacles that overlap the
 * control-handle-inflated bounding box of the edge. Routes a single cubic
 * bezier with control points shifted to clear the relevant obstacles,
 * preserving correct port exit/entry angles.
 */
export function computeReroutedBezier(
  source: ComputedPortPosition,
  target: ComputedPortPosition,
  obstacles: readonly Rect[],
  controlOffset: number,
  clearance: number,
): string {
  const sc = sideOffset(source.side, controlOffset)
  const tc = sideOffset(target.side, controlOffset)

  const controlX = [source.x + sc.dx, target.x + tc.dx]
  const controlY = [source.y + sc.dy, target.y + tc.dy]
  const spanMinX = Math.min(source.x, target.x) - clearance
  const spanMaxX = Math.max(source.x, target.x) + clearance
  const spanMinY = Math.min(source.y, target.y) - clearance
  const spanMaxY = Math.max(source.y, target.y) + clearance
  const controlMinX = Math.min(...controlX, spanMinX)
  const controlMaxX = Math.max(...controlX, spanMaxX)
  const controlMinY = Math.min(...controlY, spanMinY)
  const controlMaxY = Math.max(...controlY, spanMaxY)

  // For horizontal-ish edges, consider any obstacle in the X-span (keeps
  // stacks of obstacles in the path's horizontal range). For vertical edges,
  // require Y overlap.
  const isVertical =
    source.side === 'top' ||
    source.side === 'bottom' ||
    target.side === 'top' ||
    target.side === 'bottom'

  const relevant = obstacles.filter((obs) => {
    const overlapsX = obs.x + obs.w > controlMinX && obs.x < controlMaxX
    const overlapsY = obs.y + obs.h > controlMinY && obs.y < controlMaxY
    return isVertical ? overlapsX && overlapsY : overlapsX
  })

  if (relevant.length === 0) {
    return [
      `M ${source.x} ${source.y}`,
      `C ${source.x + sc.dx} ${source.y + sc.dy},`,
      `${target.x + tc.dx} ${target.y + tc.dy},`,
      `${target.x} ${target.y}`,
    ].join(' ')
  }

  // Compute bounding box of relevant obstacles only
  let obsMinY = Infinity
  let obsMaxY = -Infinity
  for (const obs of relevant) {
    obsMinY = Math.min(obsMinY, obs.y)
    obsMaxY = Math.max(obsMaxY, obs.y + obs.h)
  }

  // Determine whether to route above or below.
  const midY = (source.y + target.y) / 2
  const aboveY = obsMinY - clearance
  const belowY = obsMaxY + clearance
  let routeY = Math.abs(midY - aboveY) <= Math.abs(midY - belowY) ? aboveY : belowY

  // Two-segment cubic bezier through a via point at routeY.
  const viaX = (source.x + target.x) / 2
  const dir = source.x < target.x ? 1 : -1

  // Control point distance proportional to segment span — ensures the curve
  // stays flat near routeY long enough to clear obstacles horizontally.
  const halfSpan = Math.abs(viaX - source.x)
  const cpDist = Math.max(controlOffset, halfSpan * 0.4)

  const buildPath = (ry: number): string => {
    const cp1x = source.x + sc.dx
    const cp1y = source.y + sc.dy
    const cp2x = viaX - dir * cpDist
    const cp2y = ry

    const cp3x = viaX + dir * cpDist
    const cp3y = ry
    const cp4x = target.x + tc.dx
    const cp4y = target.y + tc.dy

    return [
      `M ${source.x} ${source.y}`,
      `C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${viaX} ${ry}`,
      `C ${cp3x} ${cp3y}, ${cp4x} ${cp4y}, ${target.x} ${target.y}`,
    ].join(' ')
  }

  let path = buildPath(routeY)

  // If the constructed path still grazes obstacles (e.g., tight clearances),
  // push the route farther away and retry once.
  if (
    relevant.length > 0 &&
    polylineHitsObstacle(approximatePathAsPolyline(path, 20), relevant, Math.max(0, clearance - 1))
  ) {
    const bump = clearance || 10
    routeY = routeY < obsMinY ? obsMinY - bump : obsMaxY + bump
    path = buildPath(routeY)
  }

  return path
}

/**
 * Approximate a general SVG path (M/L/H/V/C/Q) as a polyline for sampling or
 * collision checks. Curves are subdivided into `steps` segments.
 */
export function approximatePathAsPolyline(d: string, steps = 10): Point[] {
  const points: Point[] = []
  const tokens = d.match(/[MLHVCQZ]|[-+]?\d*\.?\d+/g)
  if (!tokens) return points

  let i = 0
  let cx = 0
  let cy = 0

  while (i < tokens.length) {
    const cmd = tokens[i]
    if (cmd === 'M' || cmd === 'L') {
      cx = parseFloat(tokens[++i]!)
      cy = parseFloat(tokens[++i]!)
      points.push({ x: cx, y: cy })
    } else if (cmd === 'H') {
      cx = parseFloat(tokens[++i]!)
      points.push({ x: cx, y: cy })
    } else if (cmd === 'V') {
      cy = parseFloat(tokens[++i]!)
      points.push({ x: cx, y: cy })
    } else if (cmd === 'C') {
      const cp1x = parseFloat(tokens[++i]!)
      const cp1y = parseFloat(tokens[++i]!)
      const cp2x = parseFloat(tokens[++i]!)
      const cp2y = parseFloat(tokens[++i]!)
      const ex = parseFloat(tokens[++i]!)
      const ey = parseFloat(tokens[++i]!)
      for (let s = 1; s <= steps; s++) {
        const t = s / steps
        const mt = 1 - t
        const mt2 = mt * mt
        const t2 = t * t
        points.push({
          x: mt2 * mt * cx + 3 * mt2 * t * cp1x + 3 * mt * t2 * cp2x + t2 * t * ex,
          y: mt2 * mt * cy + 3 * mt2 * t * cp1y + 3 * mt * t2 * cp2y + t2 * t * ey,
        })
      }
      cx = ex
      cy = ey
    } else if (cmd === 'Q') {
      const qx = parseFloat(tokens[++i]!)
      const qy = parseFloat(tokens[++i]!)
      const ex = parseFloat(tokens[++i]!)
      const ey = parseFloat(tokens[++i]!)
      for (let s = 1; s <= steps; s++) {
        const t = s / steps
        const mt = 1 - t
        points.push({
          x: mt * mt * cx + 2 * mt * t * qx + t * t * ex,
          y: mt * mt * cy + 2 * mt * t * qy + t * t * ey,
        })
      }
      cx = ex
      cy = ey
    } else if (cmd === 'Z') {
      // close path — ignore
    }
    i++
  }

  return points
}

/**
 * Convert waypoints to a smooth multi-segment cubic bezier SVG path
 * using Catmull-Rom to cubic bezier conversion.
 *
 * Tangent magnitudes are clamped to a fraction of the shorter adjacent
 * segment so that long-to-short transitions (e.g. long horizontal run
 * followed by a short vertical drop) don't overshoot.
 */
export function catmullRomThroughWaypoints(waypoints: readonly Point[], tension = 0.3): string {
  const n = waypoints.length
  if (n < 2) return ''

  const first = waypoints[0]!
  const last = waypoints[n - 1]!

  if (n === 2) {
    return `M ${first.x} ${first.y} L ${last.x} ${last.y}`
  }

  // Pre-compute segment lengths
  const segLen: number[] = []
  for (let i = 0; i < n - 1; i++) {
    const a = waypoints[i]!
    const b = waypoints[i + 1]!
    segLen.push(Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2))
  }

  const segments: string[] = [`M ${first.x} ${first.y}`]
  const alpha = tension

  for (let i = 0; i < n - 1; i++) {
    const p0 = waypoints[Math.max(0, i - 1)]!
    const p1 = waypoints[i]!
    const p2 = waypoints[Math.min(n - 1, i + 1)]!
    const p3 = waypoints[Math.min(n - 1, i + 2)]!

    // Raw Catmull-Rom tangent vectors
    let t1x = (alpha * (p2.x - p0.x)) / 6
    let t1y = (alpha * (p2.y - p0.y)) / 6
    let t2x = (alpha * (p3.x - p1.x)) / 6
    let t2y = (alpha * (p3.y - p1.y)) / 6

    // Clamp tangent magnitude to 1/3 of the MINIMUM adjacent segment length.
    // t1 sits at p1 (start of segment i) — it's influenced by segments i-1 and i.
    // t2 sits at p2 (end of segment i) — it's influenced by segments i and i+1.
    // Using the minimum prevents overshoot at long-to-short transitions.
    const curLen = segLen[i]!
    const prevLen = i > 0 ? segLen[i - 1]! : curLen
    const nextLen = i < segLen.length - 1 ? segLen[i + 1]! : curLen

    const maxT1 = Math.min(curLen, prevLen) / 3
    const maxT2 = Math.min(curLen, nextLen) / 3

    const t1Mag = Math.sqrt(t1x * t1x + t1y * t1y)
    if (t1Mag > maxT1 && t1Mag > 0) {
      const scale = maxT1 / t1Mag
      t1x *= scale
      t1y *= scale
    }

    const t2Mag = Math.sqrt(t2x * t2x + t2y * t2y)
    if (t2Mag > maxT2 && t2Mag > 0) {
      const scale = maxT2 / t2Mag
      t2x *= scale
      t2y *= scale
    }

    const cp1x = p1.x + t1x
    const cp1y = p1.y + t1y
    const cp2x = p2.x - t2x
    const cp2y = p2.y - t2y

    segments.push(`C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`)
  }

  return segments.join(' ')
}
