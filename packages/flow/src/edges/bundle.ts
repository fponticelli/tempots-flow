// Hierarchical edge bundling strategy with orthogonal port exits

import type {
  EdgeRoutingStrategy,
  EdgeRoutingParams,
  EdgeBatchRoutingParams,
} from '../types/config'
import type { ComputedPortPosition, PortSide } from '../types/layout'
import {
  approximateBezierAsPolyline,
  approximatePathAsPolyline,
  buildEdgeObstacles,
  catmullRomThroughWaypoints,
  computeOrthogonalWaypoints,
  computeReroutedBezier,
  polylineHitsObstacle,
  type Point,
} from './obstacle-routing'

export interface BundlingOptions {
  /** Bundle tightness 0-1. Higher pulls edges closer to shared control point. Default: 0.85 */
  readonly strength?: number
  /** Minimum edges between same node pair to trigger bundling. Default: 2 */
  readonly minBundleSize?: number
  /** Fan-out distance from control point to individual endpoints. Default: 20 */
  readonly fanDistance?: number
  /** Distance edges travel orthogonal to node before curving. Default: 40 */
  readonly exitDistance?: number
  /** Re-route edges around node obstacles. Default: true */
  readonly avoidObstacles?: boolean
  /** Clearance around obstacles in px. Default: 20 */
  readonly nodePadding?: number
  /** Resolution (px) used to bucket edges into bundles. Default: 10 */
  readonly bundleKeyResolution?: number
}

interface BundleEdge {
  readonly edgeId: string
  readonly sourceNodeId: string
  readonly targetNodeId: string
  readonly source: ComputedPortPosition
  readonly target: ComputedPortPosition
}

const DEFAULT_MAX_ITERATIONS = 1000

interface FanGeometry {
  readonly perpX: number
  readonly perpY: number
  readonly offsets: Map<string, number>
}

function bundleKey(edge: BundleEdge): string {
  return `${edge.sourceNodeId}->${edge.targetNodeId}`
}

function computeFanGeometry(
  group: readonly BundleEdge[],
  fanDistance: number,
  exitDist: number,
): FanGeometry {
  const offsets = new Map<string, number>()
  const firstEdge = group[0]
  if (!firstEdge) {
    return { perpX: 0, perpY: 0, offsets }
  }

  const srcOff0 = sideOffset(firstEdge.source.side, exitDist)
  const tgtOff0 = sideOffset(firstEdge.target.side, exitDist)
  const mainDx = firstEdge.target.x + tgtOff0.dx - (firstEdge.source.x + srcOff0.dx)
  const mainDy = firstEdge.target.y + tgtOff0.dy - (firstEdge.source.y + srcOff0.dy)
  const mainLen = Math.sqrt(mainDx * mainDx + mainDy * mainDy) || 1
  const perpX = -mainDy / mainLen
  const perpY = mainDx / mainLen

  for (let i = 0; i < group.length; i++) {
    const edge = group[i]!
    const fanOffset = (i - (group.length - 1) / 2) * fanDistance
    offsets.set(edge.edgeId, fanOffset)
  }

  return { perpX, perpY, offsets }
}

/** Get orthogonal offset direction for a port side */
function sideOffset(side: PortSide, distance: number): { dx: number; dy: number } {
  switch (side) {
    case 'right':
      return { dx: distance, dy: 0 }
    case 'left':
      return { dx: -distance, dy: 0 }
    case 'bottom':
      return { dx: 0, dy: distance }
    case 'top':
      return { dx: 0, dy: -distance }
  }
}

/** Single-edge path: exits orthogonal, then smooth bezier to target */
function orthogonalBezier(
  source: ComputedPortPosition,
  target: ComputedPortPosition,
  exitDist: number,
): { path: string; polyline: Point[] } {
  const srcOff = sideOffset(source.side, exitDist)
  const tgtOff = sideOffset(target.side, exitDist)

  // Exit point (orthogonal from port)
  const ex = source.x + srcOff.dx
  const ey = source.y + srcOff.dy

  // Entry point (orthogonal from target port)
  const nx = target.x + tgtOff.dx
  const ny = target.y + tgtOff.dy

  // Distance between exit and entry points
  const dist = Math.sqrt((nx - ex) ** 2 + (ny - ey) ** 2)
  const extend = Math.max(dist * 0.4, exitDist)

  // Control points extend further in the port's facing direction
  const cp1Off = sideOffset(source.side, extend)
  const cp2Off = sideOffset(target.side, extend)

  const cp1x = ex + cp1Off.dx
  const cp1y = ey + cp1Off.dy
  const cp2x = nx + cp2Off.dx
  const cp2y = ny + cp2Off.dy

  const polyline = [
    { x: source.x, y: source.y },
    { x: ex, y: ey },
    ...approximateBezierAsPolyline(
      { x: ex, y: ey },
      { x: cp1x, y: cp1y },
      { x: cp2x, y: cp2y },
      { x: nx, y: ny },
    ),
    { x: nx, y: ny },
    { x: target.x, y: target.y },
  ]

  return {
    path: [
      `M ${source.x} ${source.y}`,
      `L ${ex} ${ey}`,
      `C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${nx} ${ny}`,
      `L ${target.x} ${target.y}`,
    ].join(' '),
    polyline,
  }
}

function computeBundledPaths(
  group: readonly BundleEdge[],
  strength: number,
  fanDistance: number,
  exitDist: number,
  fan: FanGeometry,
): ReadonlyMap<string, { path: string; polyline: Point[] }> {
  const result = new Map<string, { path: string; polyline: Point[] }>()

  const firstEdge = group[0]
  if (!firstEdge) return result

  // Compute centroid of midpoints between exit/entry points
  let midSumX = 0
  let midSumY = 0
  for (const edge of group) {
    const srcOff = sideOffset(edge.source.side, exitDist)
    const tgtOff = sideOffset(edge.target.side, exitDist)
    midSumX += (edge.source.x + srcOff.dx + edge.target.x + tgtOff.dx) / 2
    midSumY += (edge.source.y + srcOff.dy + edge.target.y + tgtOff.dy) / 2
  }
  const centroidX = midSumX / group.length
  const centroidY = midSumY / group.length

  for (let i = 0; i < group.length; i++) {
    const edge = group[i]!
    const fanOffset = fan.offsets.get(edge.edgeId) ?? (i - (group.length - 1) / 2) * fanDistance

    const srcOff = sideOffset(edge.source.side, exitDist)
    const tgtOff = sideOffset(edge.target.side, exitDist)

    // Exit and entry points (orthogonal from ports)
    const ex = edge.source.x + srcOff.dx
    const ey = edge.source.y + srcOff.dy
    const nx = edge.target.x + tgtOff.dx
    const ny = edge.target.y + tgtOff.dy

    // Distance and extension for control points
    const dist = Math.sqrt((nx - ex) ** 2 + (ny - ey) ** 2)
    const extend = Math.max(dist * 0.4, exitDist)

    // Natural control points (extending in port direction)
    const cp1Off = sideOffset(edge.source.side, extend)
    const cp2Off = sideOffset(edge.target.side, extend)
    const natCp1x = ex + cp1Off.dx
    const natCp1y = ey + cp1Off.dy
    const natCp2x = nx + cp2Off.dx
    const natCp2y = ny + cp2Off.dy

    // Shared control point: interpolate natural toward centroid, then fan
    const cp1x = natCp1x + (centroidX - natCp1x) * strength + fan.perpX * fanOffset
    const cp1y = natCp1y + (centroidY - natCp1y) * strength + fan.perpY * fanOffset
    const cp2x = natCp2x + (centroidX - natCp2x) * strength + fan.perpX * fanOffset
    const cp2y = natCp2y + (centroidY - natCp2y) * strength + fan.perpY * fanOffset

    const polyline = [
      { x: edge.source.x, y: edge.source.y },
      { x: ex, y: ey },
      ...approximateBezierAsPolyline(
        { x: ex, y: ey },
        { x: cp1x, y: cp1y },
        { x: cp2x, y: cp2y },
        { x: nx, y: ny },
      ),
      { x: nx, y: ny },
      { x: edge.target.x, y: edge.target.y },
    ]

    result.set(edge.edgeId, {
      path: [
        `M ${edge.source.x} ${edge.source.y}`,
        `L ${ex} ${ey}`,
        `C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${nx} ${ny}`,
        `L ${edge.target.x} ${edge.target.y}`,
      ].join(' '),
      polyline,
    })
  }

  return result
}

const DEFAULT_NODE_PADDING = 20

export function createBundledStrategy(options: BundlingOptions = {}): EdgeRoutingStrategy {
  const strength = options.strength ?? 0.85
  const minBundleSize = options.minBundleSize ?? 2
  const fanDistance = options.fanDistance ?? 20
  const exitDist = options.exitDistance ?? 40
  const avoidObstacles = options.avoidObstacles ?? true
  const nodePadding = options.nodePadding ?? DEFAULT_NODE_PADDING

  return {
    computePath(params: EdgeRoutingParams): string {
      return orthogonalBezier(params.source, params.target, exitDist).path
    },

    computeAllPaths(params: EdgeBatchRoutingParams): ReadonlyMap<string, string> {
      const result = new Map<string, string>()
      const builtData = new Map<string, { path: string; polyline: Point[] }>()
      const fanMeta = new Map<string, { perpX: number; perpY: number; fanOffset: number }>()

      // Group edges by source-target node pair
      const groups = new Map<string, BundleEdge[]>()
      for (const edge of params.edges) {
        const key = bundleKey(edge)
        let group = groups.get(key)
        if (!group) {
          group = []
          groups.set(key, group)
        }
        group.push(edge)
      }

      for (const group of groups.values()) {
        const fan = computeFanGeometry(group, fanDistance, exitDist)
        if (group.length < minBundleSize) {
          for (const edge of group) {
            const ob = orthogonalBezier(edge.source, edge.target, exitDist)
            builtData.set(edge.edgeId, ob)
            fanMeta.set(edge.edgeId, {
              perpX: fan.perpX,
              perpY: fan.perpY,
              fanOffset: fan.offsets.get(edge.edgeId) ?? 0,
            })
          }
        } else {
          const bundled = computeBundledPaths(group, strength, fanDistance, exitDist, fan)
          for (const [id, data] of bundled) {
            builtData.set(id, data)
            fanMeta.set(id, {
              perpX: fan.perpX,
              perpY: fan.perpY,
              fanOffset: fan.offsets.get(id) ?? 0,
            })
          }
        }
      }

      for (const edge of params.edges) {
        const data = builtData.get(edge.edgeId)
        if (!data) continue
        const sourceNodeId = edge.sourceNodeId ?? edge.edgeId
        const targetNodeId = edge.targetNodeId ?? edge.edgeId

        if (avoidObstacles && params.obstacles && params.obstacles.length > 0) {
          const collisionObs = buildEdgeObstacles(params.obstacles, sourceNodeId, targetNodeId, 0)
          const routingObs = buildEdgeObstacles(params.obstacles, sourceNodeId, targetNodeId, nodePadding)
          if (collisionObs.length > 0 && polylineHitsObstacle(data.polyline, collisionObs, 0)) {
            const fan = fanMeta.get(edge.edgeId)
            let rerouted: string | null = null

            if (fan) {
              const waypoints = computeOrthogonalWaypoints(
                edge.source,
                edge.target,
                routingObs,
                exitDist,
                DEFAULT_MAX_ITERATIONS,
                0,
              )

              const shifted = waypoints.map((p, i) =>
                i === 0 || i === waypoints.length - 1
                  ? p
                  : {
                      x: p.x + fan.perpX * fan.fanOffset,
                      y: p.y + fan.perpY * fan.fanOffset,
                    },
              )

              const smooth = catmullRomThroughWaypoints(shifted, 0.35)
              const approx = approximatePathAsPolyline(smooth, 12)
              if (approx.length >= 2 && !polylineHitsObstacle(approx, routingObs, 0)) {
                rerouted = smooth
              }
            }

            // Fallback: single-edge smooth reroute (drops bundling if needed)
            if (!rerouted) {
              rerouted = computeReroutedBezier(
                edge.source,
                edge.target,
                routingObs,
                exitDist,
                nodePadding,
              )
            }

            result.set(edge.edgeId, rerouted)
            continue
          }
        }

        result.set(edge.edgeId, data.path)
      }

      return result
    },
  }
}
