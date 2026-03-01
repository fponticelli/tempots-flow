import { svg, attr, on, MapSignal, Fragment } from '@tempots/dom'
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

    MapSignal(edgePaths, (paths) =>
      Fragment(
        ...paths.map((ep) => {
          const edgeId = ep.edgeId
          const pathSignal = edgePaths.map((ps) => ps.find((p) => p.edgeId === edgeId) ?? ep)
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
            DefaultEdgeRenderer(pathSignal, isSelected, isHovered),
          )
        }),
      ),
    ),
  )
}
