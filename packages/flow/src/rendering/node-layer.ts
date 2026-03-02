import { html, attr, KeyedForEach, computedOf } from '@tempots/dom'
import type { TNode } from '@tempots/dom'
import type { Signal } from '@tempots/core'
import type { Graph, GraphNode, PortRef } from '../types/graph'
import type { Position, Dimensions } from '../types/layout'
import type { InteractionState } from '../types/interaction'
import type { NodeRenderer } from '../types/config'
import type { InteractionTarget } from '../interaction/interaction-manager'
import { NodeWrapper } from './node-wrapper'

const ZERO_POS: Position = { x: 0, y: 0 }

export function NodeLayer<N, E>(
  graph: Signal<Graph<N, E>>,
  positions: Signal<ReadonlyMap<string, Position>>,
  interactionState: Signal<InteractionState>,
  onInteraction: (event: PointerEvent, target: InteractionTarget) => void,
  setHoveredNode: (nodeId: string | null) => void,
  setHoveredPort: (portRef: PortRef | null) => void,
  onDimensionsChange: (nodeId: string, dims: Dimensions) => void,
  transitioning: Signal<boolean>,
  nodeRenderer?: NodeRenderer<N>,
): TNode {
  return html.div(
    attr.class('flow-node-layer'),

    KeyedForEach(
      graph.map((g) => g.nodes as GraphNode<N>[]),
      (node) => node.id,
      (nodeSignal) => {
        const nodePosition = computedOf(
          positions,
          nodeSignal,
        )((p, node) => p.get(node.id) ?? ZERO_POS)

        return NodeWrapper(
          nodeSignal,
          nodePosition,
          graph,
          interactionState,
          onInteraction,
          setHoveredNode,
          setHoveredPort,
          onDimensionsChange,
          transitioning,
          nodeRenderer,
        )
      },
    ),
  )
}
