import { svg, attr, svgAttr, on, Ensure, KeyedForEach, computedOf } from '@tempots/dom'
import type { TNode } from '@tempots/dom'
import type { Signal } from '@tempots/core'
import type { Graph } from '../types/graph'
import type { ComputedEdgePath } from '../types/layout'
import type { EdgeRenderer, EdgeRenderContext } from '../types/config'
import type { InteractionState } from '../types/interaction'
import type { InteractionTarget } from '../interaction/interaction-manager'
import { DefaultEdgeRenderer } from './default-edge-renderer'
import { computeEdgeAngle } from './edge-overlay'

export function EdgeLayer<N, E>(
  edgePaths: Signal<ComputedEdgePath[]>,
  graph: Signal<Graph<N, E>>,
  interactionState: Signal<InteractionState>,
  onInteraction: (event: PointerEvent, target: InteractionTarget) => void,
  setHoveredEdge: (edgeId: string | null) => void,
  transitioning: Signal<boolean>,
  edgeRenderer?: EdgeRenderer<E>,
): TNode {
  return svg.svg(
    attr.class('flow-edge-layer'),
    attr.class(transitioning.map((t): string => (t ? 'flow-edge-layer--transitioning' : ''))),

    KeyedForEach(
      edgePaths,
      (ep) => ep.edgeId,
      (edgePathSignal) => {
        const edgeId = edgePathSignal.$.edgeId
        const isSelected = computedOf(
          interactionState,
          edgeId,
        )((s, id) => s.selectedEdgeIds.has(id))
        const isHovered = computedOf(interactionState, edgeId)((s, id) => s.hoveredEdgeId === id)

        const pointerHandlers = [
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
        ]

        if (edgeRenderer) {
          const edgeSignal = computedOf(graph, edgeId)((g, id) => g.edges.find((e) => e.id === id))
          const angleSignal = edgePathSignal.map(computeEdgeAngle)
          const d = edgePathSignal.map((ep) => ep.d)

          const context: EdgeRenderContext = {
            isSelected,
            isHovered,
            path: edgePathSignal,
            angle: angleSignal,
          }

          return svg.g(
            ...pointerHandlers,
            svg.path(svgAttr.d(d), attr.class('flow-edge-hitbox')),
            Ensure(edgeSignal, (edge) => edgeRenderer(edge, context)),
          )
        }

        return svg.g(...pointerHandlers, DefaultEdgeRenderer(edgePathSignal, isSelected, isHovered))
      },
    ),
  )
}
