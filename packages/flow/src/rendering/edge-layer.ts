import { svg, attr, on, KeyedForEach, computedOf } from '@tempots/dom'
import type { TNode } from '@tempots/dom'
import type { Signal } from '@tempots/core'
import type { ComputedEdgePath } from '../types/layout'
import type { InteractionState } from '../types/interaction'
import type { InteractionTarget } from '../interaction/interaction-manager'
import { DefaultEdgeRenderer } from './default-edge-renderer'

export function EdgeLayer(
  edgePaths: Signal<ComputedEdgePath[]>,
  interactionState: Signal<InteractionState>,
  onInteraction: (event: PointerEvent, target: InteractionTarget) => void,
  setHoveredEdge: (edgeId: string | null) => void,
): TNode {
  return svg.svg(
    attr.class('flow-edge-layer'),

    KeyedForEach(
      edgePaths,
      (ep) => ep.edgeId,
      (edgePathSignal) => {
        const edgeId = edgePathSignal.$.edgeId
        const isSelected = computedOf(interactionState, edgeId)((s, id) =>
          s.selectedEdgeIds.has(id),
        )
        const isHovered = computedOf(interactionState, edgeId)(
          (s, id) => s.hoveredEdgeId === id,
        )

        return svg.g(
          on.pointerdown((e: PointerEvent) => {
            e.stopPropagation()
            onInteraction(e, { type: 'edge', edgeId: edgeId.value })
          }),
          on.pointerenter(() => {
            setHoveredEdge(edgeId.value)
          }),
          on.pointerleave(() => {
            setHoveredEdge(null)
          }),
          DefaultEdgeRenderer(edgePathSignal, isSelected, isHovered),
        )
      },
    ),
  )
}
