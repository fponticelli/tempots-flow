import { svg, attr, svgAttr, When, computedOf } from '@tempots/dom'
import type { TNode } from '@tempots/dom'
import type { Signal } from '@tempots/core'
import type { InteractionState } from '../types/interaction'
import type { EdgeRoutingStrategy } from '../types/config'
import type {
  ComputedPortPosition,
  Dimensions,
  PortOffset,
  PortPlacement,
  PortSide,
  Position,
} from '../types/layout'
import type { Graph } from '../types/graph'
import { computePortPositionsForNode } from '../edges/port-positions'

const OPPOSITE_SIDE: Record<PortSide, PortSide> = {
  left: 'right',
  right: 'left',
  top: 'bottom',
  bottom: 'top',
}

export function ConnectionPreview<N, E>(
  interactionState: Signal<InteractionState>,
  routing: Signal<EdgeRoutingStrategy>,
  graph: Signal<Graph<N, E>>,
  positions: Signal<ReadonlyMap<string, Position>>,
  dimensions: Signal<ReadonlyMap<string, Dimensions>>,
  portPlacement: Signal<PortPlacement>,
  portOffsets: Signal<ReadonlyMap<string, ReadonlyMap<string, PortOffset>>>,
): TNode {
  const isConnecting = interactionState.map((s) => s.mode === 'connecting' && s.connection !== null)

  const DEFAULT_POS: Position = { x: 0, y: 0 }
  const DEFAULT_DIMS: Dimensions = { width: 180, height: 80 }

  return When(isConnecting, () => {
    const pathD = computedOf(
      interactionState,
      routing,
      graph,
      positions,
      dimensions,
      portPlacement,
      portOffsets,
    )((s, r, g, posMap, dimMap, placement, offsets): string => {
      const conn = s.connection
      if (!conn) return ''

      const portOffsetsMap = offsets
      const placementValue = placement

      function resolvePortPosition(nodeId: string, portId: string): ComputedPortPosition | null {
        const node = g.nodes.find((n) => n.id === nodeId)
        if (!node) return null
        const pos = posMap.get(nodeId) ?? DEFAULT_POS
        const dims = dimMap.get(nodeId) ?? DEFAULT_DIMS
        const measured = portOffsetsMap.get(nodeId)
        if (measured) {
          const entry = measured.get(portId)
          if (entry) {
            return {
              x: pos.x + entry.offsetX,
              y: pos.y + entry.offsetY,
              side: entry.side,
            }
          }
        }
        const computed = computePortPositionsForNode(pos, dims, node.ports, placementValue).get(
          portId,
        )
        return computed ?? null
      }

      const source =
        resolvePortPosition(conn.sourcePort.nodeId, conn.sourcePort.portId) ??
        ({
          x: conn.sourcePosition.x,
          y: conn.sourcePosition.y,
          side: conn.sourceSide,
        } as ComputedPortPosition)

      const target =
        (conn.targetPort && resolvePortPosition(conn.targetPort.nodeId, conn.targetPort.portId)) ??
        ({
          x: conn.currentPosition.x,
          y: conn.currentPosition.y,
          side: OPPOSITE_SIDE[conn.sourceSide],
        } as ComputedPortPosition)

      const obstacles: { nodeId: string; position: Position; dimensions: Dimensions }[] = []
      for (const node of g.nodes) {
        const pos = posMap.get(node.id) ?? DEFAULT_POS
        const dims = dimMap.get(node.id) ?? DEFAULT_DIMS
        obstacles.push({ nodeId: node.id, position: pos, dimensions: dims })
      }

      if (r.computeAllPaths) {
        const map = r.computeAllPaths({
          edges: [
            {
              edgeId: 'preview',
              sourceNodeId: conn.sourcePort.nodeId,
              targetNodeId: conn.targetPort?.nodeId ?? '__cursor__',
              source,
              target,
            },
          ],
          obstacles,
        })
        const computed = map.get('preview')
        if (computed) return computed
      }

      return r.computePath({ source, target })
    })

    const isValid = interactionState.map((s) => s.connection?.isValid ?? false)

    return svg.svg(
      attr.class('flow-connection-preview-layer'),
      svg.g(
        attr.class('flow-connection-preview'),
        attr.class(
          isValid.map((v): string =>
            v ? 'flow-connection-preview--valid' : 'flow-connection-preview--invalid',
          ),
        ),
        svg.path(svgAttr.d(pathD), attr.class('flow-connection-preview-path')),
      ),
    )
  })
}
