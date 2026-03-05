import type { Signal } from '@tempots/core'
import { computedOf } from '@tempots/core'
import type { Graph } from '../types/graph'
import type {
  ComputedEdgePath,
  ComputedPortPosition,
  Position,
  Dimensions,
  PortPlacement,
  PortOffset,
} from '../types/layout'
import type { EdgeRoutingStrategy } from '../types/config'
import { computePortPositionsForNode } from './port-positions'
import { approximatePathAsPolyline } from './obstacle-routing'

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
  portOffsets: Signal<ReadonlyMap<string, ReadonlyMap<string, PortOffset>>>,
): Signal<ComputedEdgePath[]> {
  return computedOf(
    graph,
    positions,
    dimensions,
    routing,
    portPlacement,
    portOffsets,
  )((g, posMap, dimMap, routingStrategy, placement, measuredOffsets): ComputedEdgePath[] => {
    const portPositionCache = new Map<string, ReadonlyMap<string, ComputedPortPosition>>()

    function getPortPositions(nodeId: string) {
      let cached = portPositionCache.get(nodeId)
      if (!cached) {
        const node = g.nodes.find((n) => n.id === nodeId)
        if (!node) return new Map<string, ComputedPortPosition>()
        const pos = posMap.get(nodeId) ?? ZERO_POS
        const dims = dimMap.get(nodeId) ?? DEFAULT_DIMS
        const fallbackPositions = computePortPositionsForNode(pos, dims, node.ports, placement)
        const offsets = measuredOffsets.get(nodeId)
        if (offsets) {
          // Use DOM-measured port positions where available, fall back to computed
          const result = new Map<string, ComputedPortPosition>(fallbackPositions)
          for (const [portId, offset] of offsets) {
            result.set(portId, {
              x: pos.x + offset.offsetX,
              y: pos.y + offset.offsetY,
              side: offset.side,
            })
          }
          cached = result
        } else {
          // Fallback to formula-based positions
          cached = fallbackPositions
        }
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

    // Build obstacle list from node positions/dimensions
    const obstacles: { nodeId: string; position: Position; dimensions: Dimensions }[] = []
    for (const node of g.nodes) {
      const pos = posMap.get(node.id) ?? ZERO_POS
      const dims = dimMap.get(node.id) ?? DEFAULT_DIMS
      obstacles.push({ nodeId: node.id, position: pos, dimensions: dims })
    }

    // Use batch routing if available, otherwise per-edge
    let pathMap: ReadonlyMap<string, string> | null = null
    if (routingStrategy.computeAllPaths) {
      pathMap = routingStrategy.computeAllPaths({
        edges: edgeData.map((e) => ({
          edgeId: e.edge.id,
          sourceNodeId: e.edge.source.nodeId,
          targetNodeId: e.edge.target.nodeId,
          source: e.sourcePoint,
          target: e.targetPoint,
        })),
        obstacles,
      })
    }

    return edgeData.map(({ edge, sourcePoint, targetPoint }): ComputedEdgePath => {
      // Per-edge routing override takes precedence
      const d = edge.routing
        ? edge.routing.computePath({ source: sourcePoint, target: targetPoint })
        : (pathMap?.get(edge.id) ??
          routingStrategy.computePath({ source: sourcePoint, target: targetPoint }))

      let labelPosition = {
        x: (sourcePoint.x + targetPoint.x) / 2,
        y: (sourcePoint.y + targetPoint.y) / 2,
      }

      const polyline = approximatePathAsPolyline(d, 20)
      if (polyline.length >= 2) {
        let total = 0
        for (let i = 1; i < polyline.length; i++) {
          const a = polyline[i - 1]!
          const b = polyline[i]!
          total += Math.hypot(b.x - a.x, b.y - a.y)
        }
        const targetLen = total / 2
        let accum = 0
        for (let i = 1; i < polyline.length; i++) {
          const a = polyline[i - 1]!
          const b = polyline[i]!
          const segLen = Math.hypot(b.x - a.x, b.y - a.y)
          if (accum + segLen >= targetLen) {
            const t = segLen === 0 ? 0 : (targetLen - accum) / segLen
            labelPosition = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
            break
          }
          accum += segLen
        }
      }

      return {
        edgeId: edge.id,
        d,
        sourcePoint,
        targetPoint,
        labelPosition,
      }
    })
  })
}
