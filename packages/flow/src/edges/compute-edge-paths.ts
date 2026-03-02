import type { Signal } from '@tempots/core'
import { computedOf } from '@tempots/core'
import type { Graph } from '../types/graph'
import type {
  ComputedEdgePath,
  ComputedPortPosition,
  Position,
  Dimensions,
  PortPlacement,
} from '../types/layout'
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
  routing: Signal<EdgeRoutingStrategy>,
  portPlacement: Signal<PortPlacement>,
): Signal<ComputedEdgePath[]> {
  return computedOf(
    graph,
    positions,
    dimensions,
    routing,
    portPlacement,
  )((g, posMap, dimMap, routingStrategy, placement): ComputedEdgePath[] => {
    const portPositionCache = new Map<string, ReadonlyMap<string, ComputedPortPosition>>()

    function getPortPositions(nodeId: string) {
      let cached = portPositionCache.get(nodeId)
      if (!cached) {
        const node = g.nodes.find((n) => n.id === nodeId)
        if (!node) return new Map<string, ComputedPortPosition>()
        const pos = posMap.get(nodeId) ?? ZERO_POS
        const dims = dimMap.get(nodeId) ?? DEFAULT_DIMS
        cached = computePortPositionsForNode(pos, dims, node.ports, placement)
        portPositionCache.set(nodeId, cached)
      }
      return cached
    }

    // Resolve port positions for all edges first
    const edgeData = g.edges.map((edge) => {
      const sourcePortPositions = getPortPositions(edge.source.nodeId)
      const targetPortPositions = getPortPositions(edge.target.nodeId)
      const sourcePoint = sourcePortPositions.get(edge.source.portId) ?? DEFAULT_SOURCE
      const targetPoint = targetPortPositions.get(edge.target.portId) ?? DEFAULT_TARGET
      return { edge, sourcePoint, targetPoint }
    })

    // Use batch routing if available, otherwise per-edge
    let pathMap: ReadonlyMap<string, string> | null = null
    if (routingStrategy.computeAllPaths) {
      pathMap = routingStrategy.computeAllPaths({
        edges: edgeData.map((e) => ({
          edgeId: e.edge.id,
          source: e.sourcePoint,
          target: e.targetPoint,
        })),
      })
    }

    return edgeData.map(({ edge, sourcePoint, targetPoint }): ComputedEdgePath => {
      const d =
        pathMap?.get(edge.id) ??
        routingStrategy.computePath({ source: sourcePoint, target: targetPoint })

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
  })
}
