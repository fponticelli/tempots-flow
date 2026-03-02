import type { EdgeRoutingStrategy, EdgeRoutingParams } from '../types/config'
import type { ComputedPortPosition, PortSide } from '../types/layout'

export interface StepOptions {
  readonly offset?: number
}

const DEFAULT_OFFSET = 20

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

export function computeStepPath(
  source: ComputedPortPosition,
  target: ComputedPortPosition,
  offset: number,
): string[] {
  const sd = sideDirection(source.side)
  const td = sideDirection(target.side)

  // Exit point: step away from the port in its direction
  const sx = source.x + sd.dx * offset
  const sy = source.y + sd.dy * offset
  const tx = target.x + td.dx * offset
  const ty = target.y + td.dy * offset

  const segments: string[] = [`M ${source.x} ${source.y}`]

  if (isHorizontal(source.side) && isHorizontal(target.side)) {
    // Both horizontal (LR layout) — use midpoint x for the vertical segment
    const midX = (sx + tx) / 2
    segments.push(`H ${midX}`, `V ${target.y}`, `H ${target.x}`)
  } else if (!isHorizontal(source.side) && !isHorizontal(target.side)) {
    // Both vertical (TB layout) — use midpoint y for the horizontal segment
    const midY = (sy + ty) / 2
    segments.push(`V ${midY}`, `H ${target.x}`, `V ${target.y}`)
  } else if (isHorizontal(source.side)) {
    // Source horizontal, target vertical — L-shaped
    segments.push(`H ${target.x}`, `V ${target.y}`)
  } else {
    // Source vertical, target horizontal — L-shaped
    segments.push(`V ${target.y}`, `H ${target.x}`)
  }

  return segments
}

export function createStepStrategy(options?: StepOptions): EdgeRoutingStrategy {
  const offset = options?.offset ?? DEFAULT_OFFSET

  return {
    computePath(params: EdgeRoutingParams): string {
      return computeStepPath(params.source, params.target, offset).join(' ')
    },
  }
}
