import { html, attr, on, dataAttr } from '@tempots/dom'
import type { TNode } from '@tempots/dom'
import type { Signal } from '@tempots/core'
import type { PortDefinition, PortRef } from '../types/graph'
import type { InteractionTarget } from '../interaction/interaction-manager'

export function Port(
  definition: PortDefinition,
  nodeId: string,
  isConnected: Signal<boolean>,
  isHovered: Signal<boolean>,
  onInteraction: (event: PointerEvent, target: InteractionTarget) => void,
  onPortHover: (portRef: PortRef | null) => void,
): TNode {
  return html.div(
    attr.class('flow-port'),
    attr.class(`flow-port--${definition.direction}`),
    attr.class(isConnected.map((c): string => (c ? 'flow-port--connected' : ''))),
    attr.class(isHovered.map((h): string => (h ? 'flow-port--hovered' : ''))),
    dataAttr.portid!(definition.id),
    dataAttr.portdirection!(definition.direction),

    on.pointerdown((e: PointerEvent) => {
      e.stopPropagation()
      onInteraction(e, { type: 'port', nodeId, portId: definition.id })
    }),
    on.pointerenter(() => {
      onPortHover({ nodeId, portId: definition.id })
    }),
    on.pointerleave(() => {
      onPortHover(null)
    }),

    html.div(attr.class('flow-port-dot')),
    definition.label ? html.span(attr.class('flow-port-label'), definition.label) : null,
  )
}
