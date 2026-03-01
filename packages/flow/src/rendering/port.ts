import { html, attr, DataAttr } from '@tempots/dom'
import type { TNode } from '@tempots/dom'
import type { Signal } from '@tempots/core'
import type { PortDefinition } from '../types/graph'

export function Port(definition: PortDefinition, isConnected: Signal<boolean>): TNode {
  return html.div(
    attr.class('flow-port'),
    attr.class(`flow-port--${definition.direction}`),
    attr.class(isConnected.map((c): string => (c ? 'flow-port--connected' : ''))),
    DataAttr('portId', definition.id),
    DataAttr('portDirection', definition.direction),
    html.div(attr.class('flow-port-dot')),
    definition.label ? html.span(attr.class('flow-port-label'), definition.label) : null,
  )
}
