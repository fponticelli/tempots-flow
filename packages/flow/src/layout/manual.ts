import type { LayoutAlgorithm } from '../types/config'
import type { Position } from '../types/layout'

const DEFAULT_SPACING = 20
const DEFAULT_NODE_HEIGHT = 80

export const manualLayout: LayoutAlgorithm = {
  layout(graph, dimensions, currentPositions) {
    const result = new Map<string, Position>()
    let stackY = 0

    for (const node of graph.nodes) {
      const existing = currentPositions.get(node.id)
      if (existing) {
        result.set(node.id, existing)
      } else {
        result.set(node.id, { x: 0, y: stackY })
        const height = dimensions.get(node.id)?.height ?? DEFAULT_NODE_HEIGHT
        stackY += height + DEFAULT_SPACING
      }
    }

    return result
  },
}
