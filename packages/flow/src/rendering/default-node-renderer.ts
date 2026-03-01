import { html, attr } from '@tempots/dom'
import type { TNode } from '@tempots/dom'
import type { GraphNode } from '../types/graph'
import type { NodeRenderContext } from '../types/config'

export function defaultNodeRenderer<N>(node: GraphNode<N>, context: NodeRenderContext): TNode {
  const inputPorts = node.ports.filter((p) => p.direction === 'input')
  const outputPorts = node.ports.filter((p) => p.direction === 'output')

  return html.div(
    attr.class('flow-node'),
    html.div(attr.class('flow-node-header'), node.id),
    html.div(
      attr.class('flow-node-body'),
      inputPorts.length > 0
        ? html.div(
            attr.class('flow-node-ports flow-node-ports--input'),
            ...inputPorts.map((p) => context.port(p.id)),
          )
        : null,
      outputPorts.length > 0
        ? html.div(
            attr.class('flow-node-ports flow-node-ports--output'),
            ...outputPorts.map((p) => context.port(p.id)),
          )
        : null,
    ),
  )
}
