import type {
  EdgeRoutingStrategy,
  EdgeRoutingParams,
  EdgeBatchRoutingParams,
} from '../types/config'
import type { ComputedPortPosition, PortSide } from '../types/layout'

export interface OrthogonalOptions {
  /** Corner rounding radius. Default: 8 */
  readonly borderRadius?: number
  /** Padding around obstacles. Default: 20 */
  readonly nodePadding?: number
  /** Maximum iterations for pathfinding. Default: 1000 */
  readonly maxIterations?: number
}

interface Rect {
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
}

interface Point {
  readonly x: number
  readonly y: number
}

function sideOffset(side: PortSide, dist: number): { dx: number; dy: number } {
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

function sign(v: number): number {
  return v > 0 ? 1 : v < 0 ? -1 : 0
}

function pointInRect(p: Point, r: Rect, margin: number): boolean {
  return (
    p.x > r.x - margin && p.x < r.x + r.w + margin && p.y > r.y - margin && p.y < r.y + r.h + margin
  )
}

function segmentIntersectsRect(a: Point, b: Point, r: Rect, margin: number): boolean {
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

/**
 * Build an orthogonal path that avoids obstacles.
 * Uses a simplified routing approach: exit port direction, route around obstacles,
 * enter from target port direction.
 */
function computeOrthogonalWaypoints(
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

  // Start with a basic step routing path
  const waypoints: Point[] = [{ x: source.x, y: source.y }]

  // Simple orthogonal routing: exit → mid routing → entry
  const path = findOrthogonalPath(exit, entry, source.side, target.side, obstacles, maxIterations)

  waypoints.push(...path)
  waypoints.push({ x: target.x, y: target.y })

  return waypoints
}

function findOrthogonalPath(
  start: Point,
  end: Point,
  sourceSide: PortSide,
  targetSide: PortSide,
  obstacles: readonly Rect[],
  maxIterations: number,
): Point[] {
  // Try direct orthogonal routing first
  const directPath = tryDirectRoute(start, end, sourceSide, targetSide)
  if (!pathHitsObstacle(directPath, obstacles)) {
    return directPath
  }

  // If direct path hits obstacles, use detour routing
  return detourRoute(start, end, sourceSide, targetSide, obstacles, maxIterations)
}

/** Threshold below which coordinates are treated as aligned. */
const SNAP_THRESHOLD = 4

function tryDirectRoute(
  start: Point,
  end: Point,
  sourceSide: PortSide,
  targetSide: PortSide,
): Point[] {
  const srcH = sourceSide === 'left' || sourceSide === 'right'
  const tgtH = targetSide === 'left' || targetSide === 'right'

  if (srcH && tgtH) {
    // Nearly same Y → straight horizontal line
    if (Math.abs(start.y - end.y) < SNAP_THRESHOLD) {
      const y = (start.y + end.y) / 2
      return [{ x: start.x, y }, { x: end.x, y }]
    }
    const midX = (start.x + end.x) / 2
    return [start, { x: midX, y: start.y }, { x: midX, y: end.y }, end]
  }
  if (!srcH && !tgtH) {
    // Nearly same X → straight vertical line
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

function pathHitsObstacle(path: Point[], obstacles: readonly Rect[]): boolean {
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i]!
    const b = path[i + 1]!
    for (const obs of obstacles) {
      if (segmentIntersectsRect(a, b, obs, 2)) return true
    }
  }
  return false
}

function detourRoute(
  start: Point,
  end: Point,
  sourceSide: PortSide,
  targetSide: PortSide,
  obstacles: readonly Rect[],
  maxIterations: number,
): Point[] {
  // Collect candidate Y/X values from obstacle boundaries
  const xValues = new Set<number>([start.x, end.x])
  const yValues = new Set<number>([start.y, end.y])
  for (const obs of obstacles) {
    xValues.add(obs.x - 10)
    xValues.add(obs.x + obs.w + 10)
    yValues.add(obs.y - 10)
    yValues.add(obs.y + obs.h + 10)
  }

  const srcH = sourceSide === 'left' || sourceSide === 'right'

  // Try routes via candidate points
  let bestPath: Point[] | null = null
  let bestLen = Infinity
  let iterations = 0

  const sortedY = [...yValues].sort((a, b) => a - b)
  const sortedX = [...xValues].sort((a, b) => a - b)

  if (srcH) {
    // Source exits horizontally: try different Y channels
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
    // Also try L-shaped detours
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
    // Source exits vertically
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

function pathLength(points: Point[]): number {
  let len = 0
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!
    const b = points[i]!
    len += Math.abs(b.x - a.x) + Math.abs(b.y - a.y)
  }
  return len
}

function simplifyPath(points: Point[]): Point[] {
  if (points.length < 3) return points
  const result: Point[] = [points[0]!]
  for (let i = 1; i < points.length - 1; i++) {
    const prev = result[result.length - 1]!
    const curr = points[i]!
    const next = points[i + 1]!
    // Remove collinear points
    const sameX = prev.x === curr.x && curr.x === next.x
    const sameY = prev.y === curr.y && curr.y === next.y
    if (!sameX && !sameY) {
      result.push(curr)
    }
  }
  result.push(points[points.length - 1]!)
  return result
}

function roundedCorner(
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

function waypointsToPath(waypoints: Point[], borderRadius: number): string {
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

export function createOrthogonalStrategy(options?: OrthogonalOptions): EdgeRoutingStrategy {
  const borderRadius = options?.borderRadius ?? 8
  const nodePadding = options?.nodePadding ?? 20
  const maxIterations = options?.maxIterations ?? 1000

  return {
    computePath(params: EdgeRoutingParams): string {
      const waypoints = computeOrthogonalWaypoints(
        params.source,
        params.target,
        [],
        nodePadding,
        maxIterations,
      )
      return waypointsToPath(waypoints, borderRadius)
    },

    computeAllPaths(params: EdgeBatchRoutingParams): ReadonlyMap<string, string> {
      const result = new Map<string, string>()
      const obstacles: Rect[] =
        params.obstacles?.map((obs) => ({
          x: obs.position.x,
          y: obs.position.y,
          w: obs.dimensions.width,
          h: obs.dimensions.height,
        })) ?? []

      for (const edge of params.edges) {
        // Exclude source and target node obstacles for this edge
        const edgeObstacles = obstacles.filter((obs) => {
          const srcInside = pointInRect({ x: edge.source.x, y: edge.source.y }, obs, nodePadding)
          const tgtInside = pointInRect({ x: edge.target.x, y: edge.target.y }, obs, nodePadding)
          return !srcInside && !tgtInside
        })

        const waypoints = computeOrthogonalWaypoints(
          edge.source,
          edge.target,
          edgeObstacles,
          nodePadding,
          maxIterations,
        )
        result.set(edge.edgeId, waypointsToPath(waypoints, borderRadius))
      }

      return result
    },
  }
}
