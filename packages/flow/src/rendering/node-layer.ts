import { html, attr, KeyedForEach, computedOf } from '@tempots/dom'
import type { TNode } from '@tempots/dom'
import type { Signal } from '@tempots/core'
import type { Graph, GraphNode, PortRef } from '../types/graph'
import type { Position, Dimensions } from '../types/layout'
import type { InteractionState } from '../types/interaction'
import type { NodeRenderer, PortRenderer } from '../types/config'
import type { InteractionTarget } from '../interaction/interaction-manager'
import type { ExitAnimation } from '../animation/animation-config'
import { NodeWrapper } from './node-wrapper'
import { getParentIds } from '../layout/compound-utils'
import { TransitionKeyedForEach } from './transition-keyed-list'

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
  portRenderer?: PortRenderer,
  exitAnimation?: ExitAnimation,
  exitDuration?: number,
): TNode {
  const nodeItems = graph.map((g) => {
    const parentIds = getParentIds(g.nodes)
    return g.nodes.filter((n) => !parentIds.has(n.id)) as GraphNode<N>[]
  })

  const useExitAnimation =
    exitAnimation && exitAnimation !== 'none' && exitDuration && exitDuration > 0

  function renderNode(nodeSignal: Signal<GraphNode<N>>, isExiting?: Signal<boolean>): TNode {
    const nodePosition = computedOf(positions, nodeSignal)((p, node) => p.get(node.id) ?? ZERO_POS)

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
      portRenderer,
      isExiting,
    )
  }

  return html.div(
    attr.class('flow-node-layer'),

    useExitAnimation
      ? TransitionKeyedForEach({
          items: nodeItems,
          key: (node) => node.id,
          render: (nodeSignal, isExiting) => renderNode(nodeSignal, isExiting),
          exitDuration: exitDuration!,
        })
      : KeyedForEach(
          nodeItems,
          (node) => node.id,
          (nodeSignal) => renderNode(nodeSignal),
        ),
  )
}
