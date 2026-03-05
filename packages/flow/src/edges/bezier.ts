import type {
  EdgeRoutingStrategy,
  EdgeRoutingParams,
  EdgeBatchRoutingParams,
} from '../types/config'
import type { ComputedPortPosition, PortSide } from '../types/layout'
import {
  approximateBezierAsPolyline,
  buildEdgeObstacles,
  computeReroutedBezier,
  polylineHitsObstacle,
} from './obstacle-routing'

export interface BezierOptions {
  /** Curvature factor for control point offset. Default: 0.5 */
  readonly curvature?: number
  /** Minimum control point offset in px. Default: 30 */
  readonly controlOffset?: number
  /** Re-route edges around node obstacles. Default: true */
  readonly avoidObstacles?: boolean
  /** Clearance around obstacles in px. Default: 20 */
  readonly nodePadding?: number
}

const DEFAULT_CURVATURE = 0.5
const MIN_CONTROL_OFFSET = 30
const DEFAULT_NODE_PADDING = 20

function controlPointOffset(pos: ComputedPortPosition, offset: number): { dx: number; dy: number } {
  const map: Record<PortSide, { dx: number; dy: number }> = {
    left: { dx: -offset, dy: 0 },
    right: { dx: offset, dy: 0 },
    top: { dx: 0, dy: -offset },
    bottom: { dx: 0, dy: offset },
  }
  return map[pos.side]
}

function computeBezierPath(
  source: ComputedPortPosition,
  target: ComputedPortPosition,
  curvature: number,
  controlOffset: number,
): string {
  const dx = Math.abs(target.x - source.x)
  const dy = Math.abs(target.y - source.y)
  const dist = Math.max(dx, dy)
  const offset = Math.max(dist * curvature, controlOffset)

  const sc = controlPointOffset(source, offset)
  const tc = controlPointOffset(target, offset)

  return [
    `M ${source.x} ${source.y}`,
    `C ${source.x + sc.dx} ${source.y + sc.dy},`,
    `${target.x + tc.dx} ${target.y + tc.dy},`,
    `${target.x} ${target.y}`,
  ].join(' ')
}

/** @deprecated Use `createBezierStrategy(options)` with BezierOptions instead */
export function createBezierStrategy(
  curvature?: number,
  controlOffset?: number,
): EdgeRoutingStrategy
export function createBezierStrategy(options?: BezierOptions): EdgeRoutingStrategy
export function createBezierStrategy(
  optionsOrCurvature?: BezierOptions | number,
  controlOffsetArg?: number,
): EdgeRoutingStrategy {
  let curvature = DEFAULT_CURVATURE
  let controlOffset = MIN_CONTROL_OFFSET
  let avoidObstacles = true
  let nodePadding = DEFAULT_NODE_PADDING

  if (typeof optionsOrCurvature === 'number') {
    curvature = optionsOrCurvature
    controlOffset = controlOffsetArg ?? MIN_CONTROL_OFFSET
  } else if (optionsOrCurvature) {
    curvature = optionsOrCurvature.curvature ?? DEFAULT_CURVATURE
    controlOffset = optionsOrCurvature.controlOffset ?? MIN_CONTROL_OFFSET
    avoidObstacles = optionsOrCurvature.avoidObstacles ?? true
    nodePadding = optionsOrCurvature.nodePadding ?? DEFAULT_NODE_PADDING
  }

  const strategy: EdgeRoutingStrategy = {
    computePath(params: EdgeRoutingParams): string {
      return computeBezierPath(params.source, params.target, curvature, controlOffset)
    },
  }

  if (avoidObstacles) {
    strategy.computeAllPaths = (params: EdgeBatchRoutingParams): ReadonlyMap<string, string> => {
      const result = new Map<string, string>()

      for (const edge of params.edges) {
        const { source, target } = edge
        const path = computeBezierPath(source, target, curvature, controlOffset)

        // Check if the bezier curve collides with any obstacle
        const obstacles = buildEdgeObstacles(
          params.obstacles ?? [],
          edge.sourceNodeId,
          edge.targetNodeId,
          nodePadding,
        )

        const allObs = params.obstacles ?? []
        const sourceObs = allObs.find((o) => o.nodeId === edge.sourceNodeId)
        const targetObs = allObs.find((o) => o.nodeId === edge.targetNodeId)

        const collisionObstacles = [...obstacles]
        if (sourceObs) {
          collisionObstacles.push({
            x: sourceObs.position.x + 1,
            y: sourceObs.position.y + 1,
            w: sourceObs.dimensions.width - 2,
            h: sourceObs.dimensions.height - 2,
          })
        }
        if (targetObs) {
          collisionObstacles.push({
            x: targetObs.position.x + 1,
            y: targetObs.position.y + 1,
            w: targetObs.dimensions.width - 2,
            h: targetObs.dimensions.height - 2,
          })
        }

        const routingObstacles = [...obstacles]
        if (sourceObs) {
          routingObstacles.push({
            x: sourceObs.position.x - nodePadding,
            y: sourceObs.position.y - nodePadding,
            w: sourceObs.dimensions.width + nodePadding * 2,
            h: sourceObs.dimensions.height + nodePadding * 2,
          })
        }
        if (targetObs) {
          routingObstacles.push({
            x: targetObs.position.x - nodePadding,
            y: targetObs.position.y - nodePadding,
            w: targetObs.dimensions.width + nodePadding * 2,
            h: targetObs.dimensions.height + nodePadding * 2,
          })
        }

        if (collisionObstacles.length === 0) {
          result.set(edge.edgeId, path)
          continue
        }

        // Compute bezier control points for intersection testing
        const dx = Math.abs(target.x - source.x)
        const dy = Math.abs(target.y - source.y)
        const dist = Math.max(dx, dy)
        const offset = Math.max(dist * curvature, controlOffset)
        const sc = controlPointOffset(source, offset)
        const tc = controlPointOffset(target, offset)

        const p0 = { x: source.x, y: source.y }
        const p1 = { x: source.x + sc.dx, y: source.y + sc.dy }
        const p2 = { x: target.x + tc.dx, y: target.y + tc.dy }
        const p3 = { x: target.x, y: target.y }

        const polyline = approximateBezierAsPolyline(p0, p1, p2, p3)

        if (!polylineHitsObstacle(polyline, collisionObstacles, 0)) {
          result.set(edge.edgeId, path)
          continue
        }

        // Collision detected: reroute via smooth bezier that avoids obstacles
        result.set(
          edge.edgeId,
          computeReroutedBezier(source, target, routingObstacles, controlOffset, 0),
        )
      }

      return result
    }
  }

  return strategy
}
