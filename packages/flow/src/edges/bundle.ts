// Hierarchical edge bundling strategy with orthogonal port exits

import type {
  EdgeRoutingStrategy,
  EdgeRoutingParams,
  EdgeBatchRoutingParams,
} from '../types/config'
import type { ComputedPortPosition, PortSide } from '../types/layout'

export interface BundlingOptions {
  /** Bundle tightness 0-1. Higher pulls edges closer to shared control point. Default: 0.85 */
  readonly strength?: number
  /** Minimum edges between same node pair to trigger bundling. Default: 2 */
  readonly minBundleSize?: number
  /** Fan-out distance from control point to individual endpoints. Default: 20 */
  readonly fanDistance?: number
  /** Distance edges travel orthogonal to node before curving. Default: 40 */
  readonly exitDistance?: number
}

interface BundleEdge {
  readonly edgeId: string
  readonly source: ComputedPortPosition
  readonly target: ComputedPortPosition
}

function bundleKey(source: ComputedPortPosition, target: ComputedPortPosition): string {
  // Canonical key by source-node-region and target-node-region
  // We approximate node identity by rounding positions to nearest 10px grid
  const sx = Math.round(source.x / 10) * 10
  const sy = Math.round(source.y / 10) * 10
  const tx = Math.round(target.x / 10) * 10
  const ty = Math.round(target.y / 10) * 10
  return `${sx},${sy}->${tx},${ty}`
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
): string {
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

  return [
    `M ${source.x} ${source.y}`,
    `L ${ex} ${ey}`,
    `C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${nx} ${ny}`,
    `L ${target.x} ${target.y}`,
  ].join(' ')
}

function computeBundledPaths(
  group: readonly BundleEdge[],
  strength: number,
  fanDistance: number,
  exitDist: number,
): ReadonlyMap<string, string> {
  const result = new Map<string, string>()

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

  // Perpendicular unit vector for fan-out (based on first edge direction)
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
    const cp1x = natCp1x + (centroidX - natCp1x) * strength + perpX * fanOffset
    const cp1y = natCp1y + (centroidY - natCp1y) * strength + perpY * fanOffset
    const cp2x = natCp2x + (centroidX - natCp2x) * strength + perpX * fanOffset
    const cp2y = natCp2y + (centroidY - natCp2y) * strength + perpY * fanOffset

    result.set(
      edge.edgeId,
      [
        `M ${edge.source.x} ${edge.source.y}`,
        `L ${ex} ${ey}`,
        `C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${nx} ${ny}`,
        `L ${edge.target.x} ${edge.target.y}`,
      ].join(' '),
    )
  }

  return result
}

export function createBundledStrategy(options: BundlingOptions = {}): EdgeRoutingStrategy {
  const strength = options.strength ?? 0.85
  const minBundleSize = options.minBundleSize ?? 2
  const fanDistance = options.fanDistance ?? 20
  const exitDist = options.exitDistance ?? 40

  return {
    computePath(params: EdgeRoutingParams): string {
      return orthogonalBezier(params.source, params.target, exitDist)
    },

    computeAllPaths(params: EdgeBatchRoutingParams): ReadonlyMap<string, string> {
      const result = new Map<string, string>()

      // Group edges by source-target node pair
      const groups = new Map<string, BundleEdge[]>()
      for (const edge of params.edges) {
        const key = bundleKey(edge.source, edge.target)
        let group = groups.get(key)
        if (!group) {
          group = []
          groups.set(key, group)
        }
        group.push(edge)
      }

      for (const group of groups.values()) {
        if (group.length < minBundleSize) {
          for (const edge of group) {
            result.set(edge.edgeId, orthogonalBezier(edge.source, edge.target, exitDist))
          }
        } else {
          const bundled = computeBundledPaths(group, strength, fanDistance, exitDist)
          for (const [id, path] of bundled) {
            result.set(id, path)
          }
        }
      }

      return result
    },
  }
}
