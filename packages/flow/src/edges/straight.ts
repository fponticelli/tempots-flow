import type { EdgeRoutingStrategy, EdgeRoutingParams } from '../types/config'

export function createStraightStrategy(): EdgeRoutingStrategy {
  return {
    computePath(params: EdgeRoutingParams): string {
      const { source, target } = params
      return `M ${source.x} ${source.y} L ${target.x} ${target.y}`
    },
  }
}
