import type { EdgeRoutingStrategy, EdgeRoutingParams } from '../types/config'
import { computeStepWaypoints } from './step'

export interface SmoothStepOptions {
  readonly offset?: number
  readonly borderRadius?: number
}

const DEFAULT_OFFSET = 20
const DEFAULT_BORDER_RADIUS = 8

function sign(v: number): number {
  return v > 0 ? 1 : v < 0 ? -1 : 0
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

  if (maxR < 1) {
    return `L ${cornerX} ${cornerY}`
  }

  const arcStartX = cornerX - dxIn * maxR
  const arcStartY = cornerY - dyIn * maxR
  const arcEndX = cornerX + dxOut * maxR
  const arcEndY = cornerY + dyOut * maxR

  return `L ${arcStartX} ${arcStartY} Q ${cornerX} ${cornerY} ${arcEndX} ${arcEndY}`
}

export function createSmoothStepStrategy(options?: SmoothStepOptions): EdgeRoutingStrategy {
  const offset = options?.offset ?? DEFAULT_OFFSET
  const radius = options?.borderRadius ?? DEFAULT_BORDER_RADIUS

  return {
    computePath(params: EdgeRoutingParams): string {
      const waypoints = computeStepWaypoints(params.source, params.target, offset)
      const n = waypoints.length
      const first = waypoints[0]
      const last = waypoints[n - 1]

      if (n < 2 || !first || !last) return ''

      const segments: string[] = [`M ${first.x} ${first.y}`]

      if (n === 2) {
        segments.push(`L ${last.x} ${last.y}`)
        return segments.join(' ')
      }

      // Compute segment lengths between adjacent waypoints
      const segLen: number[] = []
      for (let i = 0; i < n - 1; i++) {
        const a = waypoints[i]!
        const b = waypoints[i + 1]!
        segLen.push(Math.abs(b.x - a.x) + Math.abs(b.y - a.y))
      }

      // Each interior segment is shared by two corners, so each corner
      // can use at most half its length. First and last segments have
      // only one corner, so the full length is available.
      const segAvail = segLen.map((len, i) => (i === 0 || i === n - 2 ? len : len / 2))

      // Apply rounded corners at each interior waypoint
      for (let i = 1; i < n - 1; i++) {
        const prev = waypoints[i - 1]!
        const curr = waypoints[i]!
        const next = waypoints[i + 1]!
        const r = Math.min(radius, segAvail[i - 1] ?? 0, segAvail[i] ?? 0)
        segments.push(roundedCorner(prev.x, prev.y, curr.x, curr.y, next.x, next.y, r))
      }

      segments.push(`L ${last.x} ${last.y}`)
      return segments.join(' ')
    },
  }
}
