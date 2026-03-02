import { html, attr, style, on, KeyedForEach, computedOf } from '@tempots/dom'
import type { TNode } from '@tempots/dom'
import type { Signal } from '@tempots/core'
import type { Graph, GraphNode } from '../types/graph'
import type { Position, Dimensions } from '../types/layout'
import type { InteractionState } from '../types/interaction'
import type { InteractionTarget } from '../interaction/interaction-manager'
import { getParentIds, getChildIds, getGroupBounds } from '../layout/compound-utils'

const GROUP_PADDING = 20
const LABEL_HEIGHT = 28

export function GroupLayer<N, E>(
  graph: Signal<Graph<N, E>>,
  positions: Signal<ReadonlyMap<string, Position>>,
  dimensions: Signal<ReadonlyMap<string, Dimensions>>,
  interactionState: Signal<InteractionState>,
  onInteraction: (event: PointerEvent, target: InteractionTarget) => void,
  transitioning: Signal<boolean>,
): TNode {
  const groupNodes = graph.map((g) => {
    const parentIds = getParentIds(g.nodes)
    return g.nodes.filter((n) => parentIds.has(n.id)) as GraphNode<N>[]
  })

  return html.div(
    attr.class('flow-group-layer'),

    KeyedForEach(
      groupNodes,
      (node) => node.id,
      (nodeSignal) => {
        const nodeId = nodeSignal.$.id

        const bounds = computedOf(
          graph,
          positions,
          dimensions,
          nodeId,
        )((g, pos, dims, id) => {
          const childIds = getChildIds(id, g.nodes)
          return getGroupBounds(childIds, pos, dims, GROUP_PADDING)
        })

        const isSelected = computedOf(
          interactionState,
          nodeId,
        )((s, id) => s.selectedNodeIds.has(id))

        const label = nodeSignal.map((n) => String(n.data))

        return html.div(
          attr.class('flow-group-node'),
          attr.class(isSelected.map((s): string => (s ? 'flow-group-node--selected' : ''))),
          attr.class(transitioning.map((t): string => (t ? 'flow-group-node--transitioning' : ''))),

          style.display(bounds.map((b): string => (b === null ? 'none' : 'block'))),
          style.transform(
            bounds.map((b) =>
              b !== null ? `translate(${b.x}px, ${b.y - LABEL_HEIGHT}px)` : 'translate(0,0)',
            ),
          ),
          style.width(bounds.map((b) => (b !== null ? `${b.width}px` : '0'))),
          style.height(bounds.map((b) => (b !== null ? `${b.height + LABEL_HEIGHT}px` : '0'))),

          on.pointerdown((e: PointerEvent) => {
            e.stopPropagation()
            onInteraction(e, { type: 'node', nodeId: nodeId.value })
          }),

          html.div(attr.class('flow-group-node-label'), label),
        )
      },
    ),
  )
}
