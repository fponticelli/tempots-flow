import type { EdgeRoutingStrategy, EdgeRoutingParams } from '../types/config'
import type { PortSide } from '../types/layout'

export interface SmoothStepOptions {
  readonly offset?: number
  readonly borderRadius?: number
}

const DEFAULT_OFFSET = 20
const DEFAULT_BORDER_RADIUS = 8

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
  // Determine the directions into and out of the corner
  const dxIn = sign(cornerX - fromX)
  const dyIn = sign(cornerY - fromY)
  const dxOut = sign(toX - cornerX)
  const dyOut = sign(toY - cornerY)

  // Clamp radius to half the available distance on each leg
  const legIn = Math.max(Math.abs(cornerX - fromX), Math.abs(cornerY - fromY))
  const legOut = Math.max(Math.abs(toX - cornerX), Math.abs(toY - cornerY))
  const maxR = Math.min(legIn, legOut, r)

  if (maxR < 1) {
    // Too short for rounding, just use a sharp corner
    return `L ${cornerX} ${cornerY}`
  }

  // Start of the arc (radius back from corner along incoming direction)
  const arcStartX = cornerX - dxIn * maxR
  const arcStartY = cornerY - dyIn * maxR
  // End of the arc (radius forward from corner along outgoing direction)
  const arcEndX = cornerX + dxOut * maxR
  const arcEndY = cornerY + dyOut * maxR

  return `L ${arcStartX} ${arcStartY} Q ${cornerX} ${cornerY} ${arcEndX} ${arcEndY}`
}

export function createSmoothStepStrategy(options?: SmoothStepOptions): EdgeRoutingStrategy {
  const offset = options?.offset ?? DEFAULT_OFFSET
  const radius = options?.borderRadius ?? DEFAULT_BORDER_RADIUS

  return {
    computePath(params: EdgeRoutingParams): string {
      const { source, target } = params
      const sd = sideDirection(source.side)
      const td = sideDirection(target.side)

      const sx = source.x + sd.dx * offset
      const sy = source.y + sd.dy * offset
      const tx = target.x + td.dx * offset
      const ty = target.y + td.dy * offset

      const segments: string[] = [`M ${source.x} ${source.y}`]

      if (isHorizontal(source.side) && isHorizontal(target.side)) {
        const midX = (sx + tx) / 2
        // H to midX, V to target.y, H to target.x
        // Two corners: (midX, source.y) and (midX, target.y)
        segments.push(
          roundedCorner(source.x, source.y, midX, source.y, midX, target.y, radius),
          roundedCorner(midX, source.y, midX, target.y, target.x, target.y, radius),
          `L ${target.x} ${target.y}`,
        )
      } else if (!isHorizontal(source.side) && !isHorizontal(target.side)) {
        const midY = (sy + ty) / 2
        // V to midY, H to target.x, V to target.y
        // Two corners: (source.x, midY) and (target.x, midY)
        segments.push(
          roundedCorner(source.x, source.y, source.x, midY, target.x, midY, radius),
          roundedCorner(source.x, midY, target.x, midY, target.x, target.y, radius),
          `L ${target.x} ${target.y}`,
        )
      } else if (isHorizontal(source.side)) {
        // Source horizontal, target vertical — L-shaped, one corner at (target.x, source.y)
        segments.push(
          roundedCorner(source.x, source.y, target.x, source.y, target.x, target.y, radius),
          `L ${target.x} ${target.y}`,
        )
      } else {
        // Source vertical, target horizontal — L-shaped, one corner at (source.x, target.y)
        segments.push(
          roundedCorner(source.x, source.y, source.x, target.y, target.x, target.y, radius),
          `L ${target.x} ${target.y}`,
        )
      }

      return segments.join(' ')
    },
  }
}
