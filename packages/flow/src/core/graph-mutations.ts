import type { Graph, GraphNode, GraphEdge, PortRef, PortMapping, SubGraph } from '../types/graph'

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

/**
 * Group nodes under a new parent node.
 * Adds groupNode to the graph and sets parentId on all nodeIds.
 */
export function groupNodes<N, E>(
  graph: Graph<N, E>,
  nodeIds: readonly string[],
  groupNode: GraphNode<N>,
): Graph<N, E> {
  const idSet = new Set(nodeIds)
  return {
    ...graph,
    nodes: [
      ...graph.nodes.map((n) => (idSet.has(n.id) ? { ...n, parentId: groupNode.id } : n)),
      groupNode,
    ],
    edges: graph.edges,
  }
}

/**
 * Ungroup: remove the group node and clear parentId on its direct children.
 * Also removes edges connected to the group node.
 */
export function ungroupNodes<N, E>(graph: Graph<N, E>, groupNodeId: string): Graph<N, E> {
  return {
    ...graph,
    nodes: graph.nodes
      .filter((n) => n.id !== groupNodeId)
      .map((n) => {
        if (n.parentId !== groupNodeId) return n
        const { parentId: _, ...rest } = n
        return rest as GraphNode<N>
      }),
    edges: graph.edges.filter(
      (e) => e.source.nodeId !== groupNodeId && e.target.nodeId !== groupNodeId,
    ),
  }
}

/**
 * Duplicate nodes and their internal edges, assigning new IDs.
 * Returns the new graph and a map from old IDs to new IDs.
 */
export function duplicate<N, E>(
  graph: Graph<N, E>,
  nodeIds: ReadonlySet<string>,
  idGenerator: () => string,
): { readonly graph: Graph<N, E>; readonly idMap: ReadonlyMap<string, string> } {
  const idMap = new Map<string, string>()
  for (const nodeId of nodeIds) {
    idMap.set(nodeId, idGenerator())
  }

  const newNodes: GraphNode<N>[] = []
  for (const node of graph.nodes) {
    const newId = idMap.get(node.id)
    if (newId === undefined) continue
    const parentId =
      node.parentId !== undefined ? (idMap.get(node.parentId) ?? node.parentId) : undefined
    newNodes.push({ ...node, id: newId, parentId })
  }

  const newEdges: GraphEdge<E>[] = []
  for (const edge of graph.edges) {
    const newSourceNodeId = idMap.get(edge.source.nodeId)
    const newTargetNodeId = idMap.get(edge.target.nodeId)
    if (newSourceNodeId === undefined || newTargetNodeId === undefined) continue
    newEdges.push({
      ...edge,
      id: idGenerator(),
      source: { nodeId: newSourceNodeId, portId: edge.source.portId },
      target: { nodeId: newTargetNodeId, portId: edge.target.portId },
    })
  }

  return {
    graph: {
      ...graph,
      nodes: [...graph.nodes, ...newNodes],
      edges: [...graph.edges, ...newEdges],
    },
    idMap,
  }
}

/**
 * Get all nodes connected via outgoing edges from the given node.
 */
export function outgoingNodes<N, E>(graph: Graph<N, E>, nodeId: string): readonly GraphNode<N>[] {
  const targetNodeIds = new Set<string>()
  for (const edge of graph.edges) {
    if (edge.source.nodeId === nodeId) {
      targetNodeIds.add(edge.target.nodeId)
    }
  }
  return graph.nodes.filter((n) => targetNodeIds.has(n.id))
}

/**
 * Get all nodes connected via incoming edges to the given node.
 */
export function incomingNodes<N, E>(graph: Graph<N, E>, nodeId: string): readonly GraphNode<N>[] {
  const sourceNodeIds = new Set<string>()
  for (const edge of graph.edges) {
    if (edge.target.nodeId === nodeId) {
      sourceNodeIds.add(edge.source.nodeId)
    }
  }
  return graph.nodes.filter((n) => sourceNodeIds.has(n.id))
}

/**
 * Get all ports connected to a given port via edges.
 */
export function connectedPorts<N, E>(graph: Graph<N, E>, port: PortRef): readonly PortRef[] {
  const result: PortRef[] = []
  for (const edge of graph.edges) {
    if (edge.source.nodeId === port.nodeId && edge.source.portId === port.portId) {
      result.push(edge.target)
    }
    if (edge.target.nodeId === port.nodeId && edge.target.portId === port.portId) {
      result.push(edge.source)
    }
  }
  return result
}

/**
 * Topological sort using Kahn's algorithm.
 * Returns node IDs in topological order, or null if the graph has a cycle.
 */
export function topologicalSort<N, E>(graph: Graph<N, E>): readonly string[] | null {
  const inDegree = new Map<string, number>()
  const adjacency = new Map<string, string[]>()

  for (const node of graph.nodes) {
    inDegree.set(node.id, 0)
    adjacency.set(node.id, [])
  }

  for (const edge of graph.edges) {
    const prev = inDegree.get(edge.target.nodeId)
    if (prev !== undefined) {
      inDegree.set(edge.target.nodeId, prev + 1)
    }
    adjacency.get(edge.source.nodeId)?.push(edge.target.nodeId)
  }

  const queue: string[] = []
  for (const [id, degree] of inDegree) {
    if (degree === 0) queue.push(id)
  }

  const result: string[] = []
  while (queue.length > 0) {
    const nodeId = queue.shift()!
    result.push(nodeId)

    for (const neighbor of adjacency.get(nodeId) ?? []) {
      const deg = inDegree.get(neighbor)!
      const newDeg = deg - 1
      inDegree.set(neighbor, newDeg)
      if (newDeg === 0) queue.push(neighbor)
    }
  }

  return result.length === graph.nodes.length ? result : null
}

/**
 * Collapse selected nodes into a compound node with a sub-graph.
 * Internal edges become part of the inner graph.
 * External edges are mapped to port mappings on the compound node.
 */
export function collapseToSubGraph<N, E>(
  graph: Graph<N, E>,
  nodeIds: ReadonlySet<string>,
  compoundNode: GraphNode<N>,
): Graph<N, E> {
  const innerNodes = graph.nodes.filter((n) => nodeIds.has(n.id))
  const innerEdges = graph.edges.filter(
    (e) => nodeIds.has(e.source.nodeId) && nodeIds.has(e.target.nodeId),
  )

  // External edges: one endpoint inside, one outside
  const externalEdges = graph.edges.filter(
    (e) =>
      (nodeIds.has(e.source.nodeId) && !nodeIds.has(e.target.nodeId)) ||
      (!nodeIds.has(e.source.nodeId) && nodeIds.has(e.target.nodeId)),
  )

  // Build port mappings from external edges
  const portMappings: PortMapping[] = []
  for (const edge of externalEdges) {
    if (nodeIds.has(edge.source.nodeId)) {
      portMappings.push({
        innerPortRef: edge.source,
        outerPortId: edge.source.portId,
      })
    } else {
      portMappings.push({
        innerPortRef: edge.target,
        outerPortId: edge.target.portId,
      })
    }
  }

  const innerGraph: Graph<N, E> = { nodes: innerNodes, edges: innerEdges }
  const subGraph: SubGraph<N, E> = { innerGraph, portMappings }

  // Replace external edge endpoints to reference the compound node
  const remappedExternalEdges = externalEdges.map((edge) => {
    if (nodeIds.has(edge.source.nodeId)) {
      return { ...edge, source: { nodeId: compoundNode.id, portId: edge.source.portId } }
    }
    return { ...edge, target: { nodeId: compoundNode.id, portId: edge.target.portId } }
  })

  // Remaining edges (neither internal nor external)
  const remainingEdges = graph.edges.filter(
    (e) => !nodeIds.has(e.source.nodeId) && !nodeIds.has(e.target.nodeId),
  )

  const compoundWithSubGraph: GraphNode<N> = { ...compoundNode, subGraph }

  return {
    nodes: [...graph.nodes.filter((n) => !nodeIds.has(n.id)), compoundWithSubGraph],
    edges: [...remainingEdges, ...remappedExternalEdges],
  }
}

/**
 * Expand a compound node's sub-graph back into the parent graph.
 * Removes the compound node and restores its inner nodes and edges.
 */
export function expandSubGraph<N, E>(graph: Graph<N, E>, compoundNodeId: string): Graph<N, E> {
  const compoundNode = graph.nodes.find((n) => n.id === compoundNodeId)
  if (!compoundNode?.subGraph) return graph

  const { innerGraph, portMappings } = compoundNode.subGraph as SubGraph<N, E>

  // Build mapping from outer port to inner port for edge re-wiring
  const outerToInner = new Map<string, PortRef>()
  for (const mapping of portMappings) {
    outerToInner.set(mapping.outerPortId, mapping.innerPortRef)
  }

  // Re-wire external edges: replace compound node references with inner ports
  const rewiredEdges = graph.edges.filter(
    (e) => e.source.nodeId !== compoundNodeId && e.target.nodeId !== compoundNodeId,
  )

  const externalEdges = graph.edges
    .filter((e) => e.source.nodeId === compoundNodeId || e.target.nodeId === compoundNodeId)
    .map((edge) => {
      if (edge.source.nodeId === compoundNodeId) {
        const inner = outerToInner.get(edge.source.portId)
        if (inner) return { ...edge, source: inner }
      }
      if (edge.target.nodeId === compoundNodeId) {
        const inner = outerToInner.get(edge.target.portId)
        if (inner) return { ...edge, target: inner }
      }
      return edge
    })

  return {
    nodes: [...graph.nodes.filter((n) => n.id !== compoundNodeId), ...innerGraph.nodes],
    edges: [...rewiredEdges, ...externalEdges, ...innerGraph.edges],
  }
}
