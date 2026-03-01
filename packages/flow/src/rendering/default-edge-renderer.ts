import { svg, attr, svgAttr, dataAttr } from '@tempots/dom'
import type { TNode } from '@tempots/dom'
import type { Signal } from '@tempots/core'
import type { ComputedEdgePath } from '../types/layout'

export function DefaultEdgeRenderer(
  edgePath: Signal<ComputedEdgePath>,
  isSelected: Signal<boolean>,
  isHovered: Signal<boolean>,
): TNode {
  const d = edgePath.map((ep) => ep.d)

  return svg.g(
    attr.class('flow-edge-group'),
    attr.class(isSelected.map((s): string => (s ? 'flow-edge--selected' : ''))),
    attr.class(isHovered.map((h): string => (h ? 'flow-edge--hovered' : ''))),
    dataAttr.edgeid!(edgePath.map((ep) => ep.edgeId)),

    // Invisible hitbox for interaction
    svg.path(svgAttr.d(d), attr.class('flow-edge-hitbox')),

    // Visible edge
    svg.path(svgAttr.d(d), attr.class('flow-edge')),
  )
}
