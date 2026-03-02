import type { Graph, GraphNode, GraphEdge } from '../types/graph'

export function addNode<N, E>(graph: Graph<N, E>, node: GraphNode<N>): Graph<N, E> {
  return { ...graph, nodes: [...graph.nodes, node] }
}

export function removeNode<N, E>(graph: Graph<N, E>, nodeId: string): Graph<N, E> {
  return {
    ...graph,
    nodes: graph.nodes.filter((n) => n.id !== nodeId),
    edges: graph.edges.filter((e) => e.source.nodeId !== nodeId && e.target.nodeId !== nodeId),
  }
}

export function removeNodes<N, E>(graph: Graph<N, E>, nodeIds: ReadonlySet<string>): Graph<N, E> {
  return {
    ...graph,
    nodes: graph.nodes.filter((n) => !nodeIds.has(n.id)),
    edges: graph.edges.filter(
      (e) => !nodeIds.has(e.source.nodeId) && !nodeIds.has(e.target.nodeId),
    ),
  }
}

export function updateNodeData<N, E>(
  graph: Graph<N, E>,
  nodeId: string,
  updater: (data: N) => N,
): Graph<N, E> {
  return {
    ...graph,
    nodes: graph.nodes.map((n) => (n.id === nodeId ? { ...n, data: updater(n.data) } : n)),
  }
}

export function addEdge<N, E>(graph: Graph<N, E>, edge: GraphEdge<E>): Graph<N, E> {
  return { ...graph, edges: [...graph.edges, edge] }
}

export function removeEdge<N, E>(graph: Graph<N, E>, edgeId: string): Graph<N, E> {
  return { ...graph, edges: graph.edges.filter((e) => e.id !== edgeId) }
}

export function removeEdges<N, E>(graph: Graph<N, E>, edgeIds: ReadonlySet<string>): Graph<N, E> {
  return { ...graph, edges: graph.edges.filter((e) => !edgeIds.has(e.id)) }
}

export function connectedEdges<N, E>(graph: Graph<N, E>, nodeId: string): readonly GraphEdge<E>[] {
  return graph.edges.filter((e) => e.source.nodeId === nodeId || e.target.nodeId === nodeId)
}

export function mergeGraphs<N, E>(
  base: Graph<N, E>,
  additions: { readonly nodes: readonly GraphNode<N>[]; readonly edges: readonly GraphEdge<E>[] },
): Graph<N, E> {
  return {
    ...base,
    nodes: [...base.nodes, ...additions.nodes],
    edges: [...base.edges, ...additions.edges],
  }
}
