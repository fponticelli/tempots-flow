import { html, attr, When, ForEach } from '@tempots/dom'
import type { TNode } from '@tempots/dom'
import type { Signal } from '@tempots/core'
import type { GraphNode } from '../types/graph'
import type { NodeRenderContext } from '../types/config'

export function defaultNodeRenderer<N>(
  node: Signal<GraphNode<N>>,
  context: NodeRenderContext,
): TNode {
  const inputPorts = node.map((n) => n.ports.filter((p) => p.direction === 'input'))
  const outputPorts = node.map((n) => n.ports.filter((p) => p.direction === 'output'))

  return html.div(
    attr.class('flow-node'),
    html.div(attr.class('flow-node-header'), node.$.id),
    html.div(
      attr.class('flow-node-body'),
      When(
        inputPorts.map((p) => p.length > 0),
        () =>
          html.div(
            attr.class('flow-node-ports flow-node-ports--input'),
            ForEach(inputPorts, (port) => context.port(port.$.id)),
          ),
      ),
      When(
        outputPorts.map((p) => p.length > 0),
        () =>
          html.div(
            attr.class('flow-node-ports flow-node-ports--output'),
            ForEach(outputPorts, (port) => context.port(port.$.id)),
          ),
      ),
    ),
  )
}
