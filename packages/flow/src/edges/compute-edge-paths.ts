import type { Signal } from '@tempots/core'
import { computed } from '@tempots/core'
import type { Graph } from '../types/graph'
import type { ComputedEdgePath, ComputedPortPosition, Position, Dimensions } from '../types/layout'
import type { EdgeRoutingStrategy } from '../types/config'
import { computePortPositionsForNode } from './port-positions'

const DEFAULT_DIMS: Dimensions = { width: 180, height: 80 }
const ZERO_POS: Position = { x: 0, y: 0 }
const DEFAULT_SOURCE: ComputedPortPosition = { x: 0, y: 0, side: 'right' }
const DEFAULT_TARGET: ComputedPortPosition = { x: 0, y: 0, side: 'left' }

export function createEdgePathsSignal<N, E>(
  graph: Signal<Graph<N, E>>,
  positions: Signal<ReadonlyMap<string, Position>>,
  dimensions: Signal<ReadonlyMap<string, Dimensions>>,
  routing: EdgeRoutingStrategy,
): Signal<readonly ComputedEdgePath[]> {
  return computed((): readonly ComputedEdgePath[] => {
    const g = graph.value
    const posMap = positions.value
    const dimMap = dimensions.value

    const portPositionCache = new Map<string, ReadonlyMap<string, ComputedPortPosition>>()

    function getPortPositions(nodeId: string) {
      let cached = portPositionCache.get(nodeId)
      if (!cached) {
        const node = g.nodes.find((n) => n.id === nodeId)
        if (!node) return new Map<string, ComputedPortPosition>()
        const pos = posMap.get(nodeId) ?? ZERO_POS
        const dims = dimMap.get(nodeId) ?? DEFAULT_DIMS
        cached = computePortPositionsForNode(pos, dims, node.ports)
        portPositionCache.set(nodeId, cached)
      }
      return cached
    }

    return g.edges.map((edge): ComputedEdgePath => {
      const sourcePortPositions = getPortPositions(edge.source.nodeId)
      const targetPortPositions = getPortPositions(edge.target.nodeId)

      const sourcePoint = sourcePortPositions.get(edge.source.portId) ?? DEFAULT_SOURCE
      const targetPoint = targetPortPositions.get(edge.target.portId) ?? DEFAULT_TARGET

      const d = routing.computePath({ source: sourcePoint, target: targetPoint })

      return {
        edgeId: edge.id,
        d,
        sourcePoint,
        targetPoint,
        labelPosition: {
          x: (sourcePoint.x + targetPoint.x) / 2,
          y: (sourcePoint.y + targetPoint.y) / 2,
        },
      }
    })
  }, [graph, positions, dimensions])
}
