import { svg, attr, svgAttr, dataAttr } from '@tempots/dom'
import type { TNode } from '@tempots/dom'
import type { Signal } from '@tempots/core'
import type { ComputedEdgePath } from '../types/layout'
import type { GraphEdge } from '../types/graph'
import type { EdgeRenderContext } from '../types/config'

export interface DefaultEdgeMarkerAttrs {
  readonly markerStart: Signal<string | undefined>
  readonly markerEnd: Signal<string | undefined>
}

/** Legacy renderer used internally when no custom EdgeRenderer is provided. */
export function DefaultEdgeRenderer(
  edgePath: Signal<ComputedEdgePath>,
  isSelected: Signal<boolean>,
  isHovered: Signal<boolean>,
  markerAttrs?: DefaultEdgeMarkerAttrs,
): TNode {
  const d = edgePath.map((ep) => ep.d)

  return svg.g(
    attr.class('flow-edge-group'),
    attr.class(isSelected.map((s): string => (s ? 'flow-edge--selected' : ''))),
    attr.class(isHovered.map((h): string => (h ? 'flow-edge--hovered' : ''))),
    dataAttr(
      'edgeid',
      edgePath.map((ep) => ep.edgeId),
    ),

    // Invisible hitbox for interaction
    svg.path(svgAttr.d(d), attr.class('flow-edge-hitbox')),

    // Visible edge
    svg.path(
      svgAttr.d(d),
      attr.class('flow-edge'),
      markerAttrs ? svgAttr['marker-start'](markerAttrs.markerStart.map((v) => v ?? '')) : null,
      markerAttrs ? svgAttr['marker-end'](markerAttrs.markerEnd.map((v) => v ?? '')) : null,
    ),
  )
}

/** Default edge renderer matching the EdgeRenderer<E> signature. Does not render hitbox (EdgeLayer handles that). */
export function defaultEdgeRenderer<E>(
  _edge: Signal<GraphEdge<E>>,
  context: EdgeRenderContext,
): TNode {
  const d = context.path.map((ep) => ep.d)

  return svg.g(
    attr.class('flow-edge-group'),
    attr.class(context.isSelected.map((s): string => (s ? 'flow-edge--selected' : ''))),
    attr.class(context.isHovered.map((h): string => (h ? 'flow-edge--hovered' : ''))),
    dataAttr(
      'edgeid',
      context.path.map((ep) => ep.edgeId),
    ),

    svg.path(svgAttr.d(d), attr.class('flow-edge')),
  )
}
