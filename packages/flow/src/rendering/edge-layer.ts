import { svg, attr, svgAttr, on, Ensure, KeyedForEach, computedOf } from '@tempots/dom'
import type { TNode } from '@tempots/dom'
import type { Signal } from '@tempots/core'
import type { Graph, GraphEdge } from '../types/graph'
import type { ComputedEdgePath } from '../types/layout'
import type {
  EdgeRenderer,
  EdgeRenderContext,
  EdgeMarkerConfig,
  EdgeLabelConfig,
} from '../types/config'
import type { InteractionState } from '../types/interaction'
import type { InteractionTarget } from '../interaction/interaction-manager'
import { DefaultEdgeRenderer } from './default-edge-renderer'
import { computeEdgeAngle } from './edge-overlay'
import { createMarkerDefs, resolveEdgeMarkers } from './edge-markers'

export interface EdgeLayerOptions<N, E> {
  readonly edgePaths: Signal<ComputedEdgePath[]>
  readonly graph: Signal<Graph<N, E>>
  readonly interactionState: Signal<InteractionState>
  readonly onInteraction: (event: PointerEvent, target: InteractionTarget) => void
  readonly setHoveredEdge: (edgeId: string | null) => void
  readonly transitioning: Signal<boolean>
  readonly edgeRenderer?: EdgeRenderer<E>
  readonly onEdgeDoubleClick?: (edge: GraphEdge<E>, event: PointerEvent) => void
  readonly onEdgeContextMenu?: (edge: GraphEdge<E>, event: PointerEvent) => void
  readonly edgeMarkers?: EdgeMarkerConfig
  readonly edgeLabels?: (edge: GraphEdge<E>) => EdgeLabelConfig | null
}

export function EdgeLayer<N, E>(
  edgePaths: Signal<ComputedEdgePath[]>,
  graph: Signal<Graph<N, E>>,
  interactionState: Signal<InteractionState>,
  onInteraction: (event: PointerEvent, target: InteractionTarget) => void,
  setHoveredEdge: (edgeId: string | null) => void,
  transitioning: Signal<boolean>,
  edgeRenderer?: EdgeRenderer<E>,
  onEdgeDoubleClick?: (edge: GraphEdge<E>, event: PointerEvent) => void,
  onEdgeContextMenu?: (edge: GraphEdge<E>, event: PointerEvent) => void,
  edgeMarkers?: EdgeMarkerConfig,
  edgeLabels?: (edge: GraphEdge<E>) => EdgeLabelConfig | null,
): TNode {
  return svg.svg(
    attr.class('flow-edge-layer'),
    attr.class(transitioning.map((t): string => (t ? 'flow-edge-layer--transitioning' : ''))),

    edgeMarkers ? createMarkerDefs(edgeMarkers) : null,

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

        const findEdge = () => graph.value.edges.find((e) => e.id === edgeId.value)

        const pointerHandlers = [
          on.pointerdown((e: PointerEvent) => {
            e.stopPropagation()
            onInteraction(e, { type: 'edge', edgeId: edgeId.value })
          }),
          on.dblclick((e: MouseEvent) => {
            if (!onEdgeDoubleClick) return
            const edge = findEdge()
            if (edge) onEdgeDoubleClick(edge, e as unknown as PointerEvent)
          }),
          on.contextmenu((e: MouseEvent) => {
            if (!onEdgeContextMenu) return
            e.preventDefault()
            const edge = findEdge()
            if (edge) onEdgeContextMenu(edge, e as unknown as PointerEvent)
          }),
          on.pointerenter(() => {
            setHoveredEdge(edgeId.value)
          }),
          on.pointerleave(() => {
            setHoveredEdge(null)
          }),
        ]

        // Compute marker attributes for this edge
        const markerAttrs = edgeMarkers
          ? computedOf(
              graph,
              edgeId,
            )((g, id) => {
              const edge = g.edges.find((e) => e.id === id)
              if (!edge) return { start: undefined, end: undefined }
              return resolveEdgeMarkers(edge.direction, edgeMarkers)
            })
          : null

        // Compute label for this edge
        const labelSignal = edgeLabels
          ? computedOf(
              graph,
              edgeId,
            )((g, id) => {
              const edge = g.edges.find((e) => e.id === id)
              if (!edge) return null
              return edgeLabels(edge)
            })
          : null

        function renderLabel(): TNode {
          if (!labelSignal) return null

          const labelInfo = computedOf(
            labelSignal,
            edgePathSignal,
          )((cfg, ep) => {
            if (!cfg) return null
            const p = cfg.position ?? 0.5
            const off = cfg.offset ?? 0
            const sx = ep.sourcePoint.x
            const sy = ep.sourcePoint.y
            const tx = ep.targetPoint.x
            const ty = ep.targetPoint.y
            return {
              content: cfg.content,
              x: sx + (tx - sx) * p,
              y: sy + (ty - sy) * p + off,
              showBg: cfg.background !== false,
            }
          })

          return Ensure(labelInfo, (info) =>
            svg.g(
              attr.class('flow-edge-label-group'),
              svg.rect(
                attr.class('flow-edge-label-bg'),
                attr.class(info.map((i): string => (i.showBg ? '' : 'flow-hidden'))),
                svgAttr.x(info.map((i) => i.x - 20)),
                svgAttr.y(info.map((i) => i.y - 10)),
                svgAttr.width('40'),
                svgAttr.height('20'),
                svgAttr.rx('4'),
              ),
              svg.text(
                attr.class('flow-edge-label'),
                svgAttr.x(info.map((i) => i.x)),
                svgAttr.y(info.map((i) => i.y)),
                svgAttr['text-anchor']('middle'),
                svgAttr['dominant-baseline']('central'),
                info.map((i) => i.content),
              ),
            ),
          )
        }

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
            renderLabel(),
          )
        }

        return svg.g(
          ...pointerHandlers,
          DefaultEdgeRenderer(
            edgePathSignal,
            isSelected,
            isHovered,
            markerAttrs
              ? {
                  markerStart: markerAttrs.map((m) => m.start),
                  markerEnd: markerAttrs.map((m) => m.end),
                }
              : undefined,
          ),
          renderLabel(),
        )
      },
    ),
  )
}
