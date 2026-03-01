import { svg, attr, on, KeyedForEach } from '@tempots/dom'
import type { TNode } from '@tempots/dom'
import type { Signal, Prop } from '@tempots/core'
import type { ComputedEdgePath } from '../types/layout'
import type { InteractionState } from '../types/interaction'
import type { InteractionTarget } from '../interaction/interaction-manager'
import { DefaultEdgeRenderer } from './default-edge-renderer'

export function EdgeLayer(
  edgePaths: Signal<readonly ComputedEdgePath[]>,
  interactionState: Prop<InteractionState>,
  onInteraction: (event: PointerEvent, target: InteractionTarget) => void,
): TNode {
  return svg.svg(
    attr.class('flow-edge-layer'),

    KeyedForEach(
      edgePaths.map((p): ComputedEdgePath[] => p as ComputedEdgePath[]),
      (ep) => ep.edgeId,
      (edgePathSignal) => {
        const edgeId = edgePathSignal.get().edgeId
        const isSelected = interactionState.map((s) => s.selectedEdgeIds.has(edgeId))
        const isHovered = interactionState.map((s) => s.hoveredEdgeId === edgeId)

        return svg.g(
          on.pointerdown((e: PointerEvent) => {
            e.stopPropagation()
            onInteraction(e, { type: 'edge', edgeId })
          }),
          on.pointerenter(() => {
            interactionState.update((s) => ({ ...s, hoveredEdgeId: edgeId }))
          }),
          on.pointerleave(() => {
            interactionState.update((s) =>
              s.hoveredEdgeId === edgeId ? { ...s, hoveredEdgeId: null } : s,
            )
          }),
          DefaultEdgeRenderer(edgePathSignal, isSelected, isHovered),
        )
      },
    ),
  )
}
