import type {
  EdgeRoutingStrategy,
  EdgeRoutingParams,
  EdgeBatchRoutingParams,
} from '../types/config'
import type { ComputedPortPosition, PortSide } from '../types/layout'
import {
  buildEdgeObstacles,
  computeOrthogonalWaypoints,
  pathHitsObstacle,
  waypointsToPath,
  type Point,
} from './obstacle-routing'

export interface StepOptions {
  /** Exit/entry offset distance in px. Default: 20 */
  readonly offset?: number
  /** Re-route edges around node obstacles. Default: true */
  readonly avoidObstacles?: boolean
  /** Clearance around obstacles in px. Default: 20 */
  readonly nodePadding?: number
}

const DEFAULT_OFFSET = 20
const DEFAULT_NODE_PADDING = 20
const DEFAULT_MAX_ITERATIONS = 1000

function sideDirection(side: PortSide): { dx: number; dy: number } {
  const map: Record<PortSide, { dx: number; dy: number }> = {
    left: { dx: -1, dy: 0 },
    right: { dx: 1, dy: 0 },
    top: { dx: 0, dy: -1 },
    bottom: { dx: 0, dy: 1 },
  }
  return map[side]
}

function isHorizontal(side: PortSide): boolean {
  return side === 'left' || side === 'right'
}

/**
 * Compute the waypoints for a step (orthogonal) path between two ports.
 * The path always exits in the source port's direction and enters from
 * the correct direction for the target port.
 *
 * Returns an array of points where each adjacent pair shares either x or y
 * (i.e., every segment is horizontal or vertical).
 */
export function computeStepWaypoints(
  source: ComputedPortPosition,
  target: ComputedPortPosition,
  offset: number,
): Point[] {
  const sd = sideDirection(source.side)
  const td = sideDirection(target.side)

  // Exit point: step away from the port in its direction
  const sx = source.x + sd.dx * offset
  const sy = source.y + sd.dy * offset
  // Entry approach point: step away from target in its direction (we approach from opposite)
  const tx = target.x + td.dx * offset
  const ty = target.y + td.dy * offset

  const start: Point = { x: source.x, y: source.y }
  const end: Point = { x: target.x, y: target.y }

  if (isHorizontal(source.side) && isHorizontal(target.side)) {
    // Both horizontal — try Z-route (3 segments), fall back to S-route (5 segments)
    const midX = (sx + tx) / 2
    // Z-route is valid when the first H goes in source direction
    // and the last H approaches target from the correct side
    const zOk = sd.dx * (midX - source.x) >= 0 && td.dx * (midX - target.x) >= 0

    if (zOk) {
      return [start, { x: midX, y: source.y }, { x: midX, y: target.y }, end]
    }
    // S-route: exit → vertical crossover → horizontal crossing → approach → enter
    const midY = (source.y + target.y) / 2
    return [
      start,
      { x: sx, y: source.y },
      { x: sx, y: midY },
      { x: tx, y: midY },
      { x: tx, y: target.y },
      end,
    ]
  }

  if (!isHorizontal(source.side) && !isHorizontal(target.side)) {
    // Both vertical — same logic rotated
    const midY = (sy + ty) / 2
    const zOk = sd.dy * (midY - source.y) >= 0 && td.dy * (midY - target.y) >= 0

    if (zOk) {
      return [start, { x: source.x, y: midY }, { x: target.x, y: midY }, end]
    }
    const midX = (source.x + target.x) / 2
    return [
      start,
      { x: source.x, y: sy },
      { x: midX, y: sy },
      { x: midX, y: ty },
      { x: target.x, y: ty },
      end,
    ]
  }

  if (isHorizontal(source.side)) {
    // Source horizontal, target vertical — 4-segment route
    // Exit in source direction, route to target approach, enter
    return [start, { x: sx, y: source.y }, { x: sx, y: ty }, { x: target.x, y: ty }, end]
  }

  // Source vertical, target horizontal — 4-segment route
  return [start, { x: source.x, y: sy }, { x: tx, y: sy }, { x: tx, y: target.y }, end]
}

export function computeStepPath(
  source: ComputedPortPosition,
  target: ComputedPortPosition,
  offset: number,
): string[] {
  const waypoints = computeStepWaypoints(source, target, offset)
  const first = waypoints[0]
  if (!first) return []
  const segments: string[] = [`M ${first.x} ${first.y}`]
  for (let i = 1; i < waypoints.length; i++) {
    const curr = waypoints[i]!
    const prev = waypoints[i - 1]!
    if (curr.y === prev.y) {
      segments.push(`H ${curr.x}`)
    } else {
      segments.push(`V ${curr.y}`)
    }
  }
  return segments
}

export function createStepStrategy(options?: StepOptions): EdgeRoutingStrategy {
  const offset = options?.offset ?? DEFAULT_OFFSET
  const avoidObstacles = options?.avoidObstacles ?? true
  const nodePadding = options?.nodePadding ?? DEFAULT_NODE_PADDING

  const strategy: EdgeRoutingStrategy = {
    computePath(params: EdgeRoutingParams): string {
      return computeStepPath(params.source, params.target, offset).join(' ')
    },
  }

  if (avoidObstacles) {
    strategy.computeAllPaths = (params: EdgeBatchRoutingParams): ReadonlyMap<string, string> => {
      const result = new Map<string, string>()

      for (const edge of params.edges) {
        const { source, target } = edge
        const sourceNodeId = edge.sourceNodeId ?? edge.edgeId
        const targetNodeId = edge.targetNodeId ?? edge.edgeId
        const allObs = params.obstacles ?? []
        const collisionObstacles = buildEdgeObstacles(allObs, sourceNodeId, targetNodeId, 0)
        const routingObstacles = buildEdgeObstacles(allObs, sourceNodeId, targetNodeId, nodePadding, 2)

        // Compute step waypoints first
        const stepWaypoints = computeStepWaypoints(source, target, offset)

        if (
          collisionObstacles.length === 0 ||
          !pathHitsObstacle(stepWaypoints, collisionObstacles, 0)
        ) {
          // No collision — use standard step path
          const first = stepWaypoints[0]
          if (!first) {
            result.set(edge.edgeId, '')
            continue
          }
          const segments: string[] = [`M ${first.x} ${first.y}`]
          for (let i = 1; i < stepWaypoints.length; i++) {
            const curr = stepWaypoints[i]!
            const prev = stepWaypoints[i - 1]!
            if (curr.y === prev.y) {
              segments.push(`H ${curr.x}`)
            } else {
              segments.push(`V ${curr.y}`)
            }
          }
          result.set(edge.edgeId, segments.join(' '))
          continue
        }

        // Collision detected: reroute via orthogonal waypoints with sharp corners
        const waypoints = computeOrthogonalWaypoints(
          source,
          target,
          routingObstacles,
          nodePadding,
          DEFAULT_MAX_ITERATIONS,
          nodePadding,
        )
        result.set(edge.edgeId, waypointsToPath(waypoints, 0))
      }

      return result
    }
  }

  return strategy
}
