import { html, attr, on, dataAttr, Ensure } from '@tempots/dom'
import type { TNode } from '@tempots/dom'
import type { Signal } from '@tempots/core'
import type { PortDefinition, PortRef } from '../types/graph'
import type { PortRenderer } from '../types/config'
import type { InteractionTarget } from '../interaction/interaction-manager'

function defaultPortContent(definition: Signal<PortDefinition>): TNode {
  return [
    html.div(attr.class('flow-port-dot')),
    Ensure(definition.$.label, (label) => html.span(attr.class('flow-port-label'), label)),
  ]
}

export const defaultPortRenderer: PortRenderer = (definition, _context) =>
  defaultPortContent(definition)

export function Port(
  definition: Signal<PortDefinition>,
  nodeId: Signal<string>,
  isConnected: Signal<boolean>,
  isHovered: Signal<boolean>,
  onInteraction: (event: PointerEvent, target: InteractionTarget) => void,
  setHoveredPort: (portRef: PortRef | null) => void,
  portRenderer?: PortRenderer,
): TNode {
  return html.div(
    attr.class('flow-port'),
    attr.class(definition.map((d) => `flow-port--${d.direction}`)),
    attr.class(isConnected.map((c): string => (c ? 'flow-port--connected' : ''))),
    attr.class(isHovered.map((h): string => (h ? 'flow-port--hovered' : ''))),
    dataAttr('portid', definition.$.id),
    dataAttr(
      'portdirection',
      definition.map((d): string => d.direction),
    ),
    dataAttr(
      'porttype',
      definition.map((d): string => d.type ?? ''),
    ),

    on.pointerdown((e: PointerEvent) => {
      e.stopPropagation()
      onInteraction(e, { type: 'port', nodeId: nodeId.value, portId: definition.value.id })
    }),
    on.pointerenter(() => {
      setHoveredPort({ nodeId: nodeId.value, portId: definition.value.id })
    }),
    on.pointerleave(() => {
      setHoveredPort(null)
    }),

    portRenderer
      ? portRenderer(definition, { isConnected, isHovered, nodeId })
      : defaultPortContent(definition),
  )
}
