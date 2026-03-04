import type { EdgeRoutingStrategy, EdgeRoutingParams } from '../types/config'
import type { ComputedPortPosition, PortSide } from '../types/layout'

const DEFAULT_CURVATURE = 0.5
const MIN_CONTROL_OFFSET = 30

function controlPointOffset(pos: ComputedPortPosition, offset: number): { dx: number; dy: number } {
  const map: Record<PortSide, { dx: number; dy: number }> = {
    left: { dx: -offset, dy: 0 },
    right: { dx: offset, dy: 0 },
    top: { dx: 0, dy: -offset },
    bottom: { dx: 0, dy: offset },
  }
  return map[pos.side]
}

export function createBezierStrategy(
  curvature = DEFAULT_CURVATURE,
  controlOffset = MIN_CONTROL_OFFSET,
): EdgeRoutingStrategy {
  return {
    computePath(params: EdgeRoutingParams): string {
      const { source, target } = params
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
    },
  }
}
