import type {
  EdgeRoutingStrategy,
  EdgeRoutingParams,
  EdgeBatchRoutingParams,
} from '../types/config'
import {
  type Rect,
  pointInRect,
  computeOrthogonalWaypoints,
  waypointsToPath,
} from './collision'

export interface OrthogonalOptions {
  /** Corner rounding radius. Default: 8 */
  readonly borderRadius?: number
  /** Padding around obstacles. Default: 20 */
  readonly nodePadding?: number
  /** Maximum iterations for pathfinding. Default: 1000 */
  readonly maxIterations?: number
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
