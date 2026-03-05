import type {
  EdgeRoutingStrategy,
  EdgeRoutingParams,
  EdgeBatchRoutingParams,
} from '../types/config'
import {
  buildEdgeObstacles,
  computeOrthogonalWaypoints,
  polylineHitsObstacle,
  waypointsToPath,
} from './obstacle-routing'

export interface StraightOptions {
  /** Re-route edges around node obstacles. Default: true */
  readonly avoidObstacles?: boolean
  /** Clearance around obstacles in px. Default: 20 */
  readonly nodePadding?: number
}

const DEFAULT_NODE_PADDING = 20
const DEFAULT_MAX_ITERATIONS = 1000

export function createStraightStrategy(options?: StraightOptions): EdgeRoutingStrategy {
  const avoidObstacles = options?.avoidObstacles ?? true
  const nodePadding = options?.nodePadding ?? DEFAULT_NODE_PADDING

  const strategy: EdgeRoutingStrategy = {
    computePath(params: EdgeRoutingParams): string {
      const { source, target } = params
      return `M ${source.x} ${source.y} L ${target.x} ${target.y}`
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
        const routingObstacles = buildEdgeObstacles(allObs, sourceNodeId, targetNodeId, nodePadding)

        if (collisionObstacles.length === 0) {
          result.set(edge.edgeId, `M ${source.x} ${source.y} L ${target.x} ${target.y}`)
          continue
        }

        // Check if the straight line collides with any obstacle
        const line = [
          { x: source.x, y: source.y },
          { x: target.x, y: target.y },
        ]
        if (!polylineHitsObstacle(line, collisionObstacles, 0)) {
          result.set(edge.edgeId, `M ${source.x} ${source.y} L ${target.x} ${target.y}`)
          continue
        }

        // Collision detected: reroute via orthogonal waypoints with sharp corners
        const waypoints = computeOrthogonalWaypoints(
          source,
          target,
          routingObstacles,
          nodePadding,
          DEFAULT_MAX_ITERATIONS,
          0,
        )
        result.set(edge.edgeId, waypointsToPath(waypoints, 0))
      }

      return result
    }
  }

  return strategy
}
