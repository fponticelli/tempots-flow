import { html, attr, KeyedForEach } from '@tempots/dom'
import type { TNode } from '@tempots/dom'
import type { Signal, Prop } from '@tempots/core'
import type { Graph, GraphNode } from '../types/graph'
import type { Position, Dimensions } from '../types/layout'
import type { InteractionState } from '../types/interaction'
import type { NodeRenderer } from '../types/config'
import type { InteractionTarget } from '../interaction/interaction-manager'
import { NodeWrapper } from './node-wrapper'

const ZERO_POS: Position = { x: 0, y: 0 }

export function NodeLayer<N, E>(
  graph: Signal<Graph<N, E>>,
  positions: Signal<ReadonlyMap<string, Position>>,
  interactionState: Prop<InteractionState>,
  onInteraction: (event: PointerEvent, target: InteractionTarget) => void,
  onDimensionsChange: (nodeId: string, dims: Dimensions) => void,
  nodeRenderer?: NodeRenderer<N>,
): TNode {
  return html.div(
    attr.class('flow-node-layer'),

    KeyedForEach(
      graph.map((g) => g.nodes as GraphNode<N>[]),
      (node) => node.id,
      (nodeSignal) => {
        const node = nodeSignal.get()
        const nodePosition = positions.map((p) => p.get(node.id) ?? ZERO_POS)

        return NodeWrapper(
          node,
          nodePosition,
          graph,
          interactionState,
          onInteraction,
          onDimensionsChange,
          nodeRenderer,
        )
      },
    ),
  )
}
