import type {
  EdgeRoutingStrategy,
  EdgeRoutingParams,
  EdgeBatchRoutingParams,
} from '../types/config'
import { computeStepWaypoints } from './step'
import {
  buildEdgeObstacles,
  computeOrthogonalWaypoints,
  pathHitsObstacle,
  roundedCorner,
  waypointsToPath,
} from './obstacle-routing'

export interface SmoothStepOptions {
  /** Exit/entry offset distance in px. Default: 20 */
  readonly offset?: number
  /** Corner rounding radius. Default: 8 */
  readonly borderRadius?: number
  /** Re-route edges around node obstacles. Default: true */
  readonly avoidObstacles?: boolean
  /** Clearance around obstacles in px. Default: 20 */
  readonly nodePadding?: number
}

const DEFAULT_OFFSET = 20
const DEFAULT_BORDER_RADIUS = 8
const DEFAULT_NODE_PADDING = 20
const DEFAULT_MAX_ITERATIONS = 1000

function smoothStepFromWaypoints(
  waypoints: readonly { readonly x: number; readonly y: number }[],
  radius: number,
): string {
  const n = waypoints.length
  const first = waypoints[0]
  const last = waypoints[n - 1]

  if (n < 2 || !first || !last) return ''

  const segments: string[] = [`M ${first.x} ${first.y}`]

  if (n === 2) {
    segments.push(`L ${last.x} ${last.y}`)
    return segments.join(' ')
  }

  const segLen: number[] = []
  for (let i = 0; i < n - 1; i++) {
    const a = waypoints[i]!
    const b = waypoints[i + 1]!
    segLen.push(Math.abs(b.x - a.x) + Math.abs(b.y - a.y))
  }

  const segAvail = segLen.map((len, i) => (i === 0 || i === n - 2 ? len : len / 2))

  for (let i = 1; i < n - 1; i++) {
    const prev = waypoints[i - 1]!
    const curr = waypoints[i]!
    const next = waypoints[i + 1]!
    const r = Math.min(radius, segAvail[i - 1] ?? 0, segAvail[i] ?? 0)
    segments.push(roundedCorner(prev.x, prev.y, curr.x, curr.y, next.x, next.y, r))
  }

  segments.push(`L ${last.x} ${last.y}`)
  return segments.join(' ')
}

export function createSmoothStepStrategy(options?: SmoothStepOptions): EdgeRoutingStrategy {
  const offset = options?.offset ?? DEFAULT_OFFSET
  const radius = options?.borderRadius ?? DEFAULT_BORDER_RADIUS
  const avoidObstacles = options?.avoidObstacles ?? true
  const nodePadding = options?.nodePadding ?? DEFAULT_NODE_PADDING

  const strategy: EdgeRoutingStrategy = {
    computePath(params: EdgeRoutingParams): string {
      const waypoints = computeStepWaypoints(params.source, params.target, offset)
      return smoothStepFromWaypoints(waypoints, radius)
    },
  }

  if (avoidObstacles) {
    strategy.computeAllPaths = (params: EdgeBatchRoutingParams): ReadonlyMap<string, string> => {
      const result = new Map<string, string>()

      for (const edge of params.edges) {
        const { source, target } = edge
        const sourceNodeId = edge.sourceNodeId ?? edge.edgeId
        const targetNodeId = edge.targetNodeId ?? edge.edgeId
        const obstacles = buildEdgeObstacles(
          params.obstacles ?? [],
          sourceNodeId,
          targetNodeId,
          nodePadding,
        )

        // Compute step waypoints first
        const stepWaypoints = computeStepWaypoints(source, target, offset)

        if (obstacles.length === 0 || !pathHitsObstacle(stepWaypoints, obstacles, 0)) {
          // No collision — use standard smooth step path
          result.set(edge.edgeId, smoothStepFromWaypoints(stepWaypoints, radius))
          continue
        }

        // Collision detected: reroute via orthogonal waypoints with rounded corners
        const waypoints = computeOrthogonalWaypoints(
          source,
          target,
          obstacles,
          nodePadding,
          DEFAULT_MAX_ITERATIONS,
          0,
        )
        result.set(edge.edgeId, waypointsToPath(waypoints, radius))
      }

      return result
    }
  }

  return strategy
}
