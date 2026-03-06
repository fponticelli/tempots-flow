import type {
  GraphNode,
  GraphEdge,
  Graph,
  PortDefinition,
} from '@tempots/flow'

export interface SimpleNodeData {
  readonly label: string
}

export const makePort = (
  id: string,
  direction: 'input' | 'output',
  type?: string,
): PortDefinition => ({
  id,
  direction,
  label: id,
  type,
})

export const makeNode = (
  id: string,
  label: string,
  inputs: readonly string[],
  outputs: readonly string[],
): GraphNode<SimpleNodeData> => ({
  id,
  data: { label },
  ports: [
    ...inputs.map((p) => makePort(p, 'input')),
    ...outputs.map((p) => makePort(p, 'output')),
  ],
})

export const makeTypedNode = (
  id: string,
  label: string,
  inputs: readonly { readonly id: string; readonly type?: string }[],
  outputs: readonly { readonly id: string; readonly type?: string }[],
): GraphNode<SimpleNodeData> => ({
  id,
  data: { label },
  ports: [
    ...inputs.map((p) => makePort(p.id, 'input', p.type)),
    ...outputs.map((p) => makePort(p.id, 'output', p.type)),
  ],
})

export const makeEdge = (
  id: string,
  sourceNodeId: string,
  sourcePortId: string,
  targetNodeId: string,
  targetPortId: string,
): GraphEdge<Record<string, never>> => ({
  id,
  data: {},
  source: { nodeId: sourceNodeId, portId: sourcePortId },
  target: { nodeId: targetNodeId, portId: targetPortId },
  direction: 'forward',
})

export const makeGraph = (
  nodes: readonly GraphNode<SimpleNodeData>[],
  edges: readonly GraphEdge<Record<string, never>>[],
): Graph<SimpleNodeData, Record<string, never>> => ({
  nodes,
  edges,
})
