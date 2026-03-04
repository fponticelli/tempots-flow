import type { Graph, GraphNode, GraphEdge } from '../types/graph'
import type { Position, Viewport } from '../types/layout'

// --- View Snapshot ---

export interface FlowViewSnapshot {
  readonly version: 1
  readonly positions: Readonly<Record<string, Position>>
  readonly viewport: Viewport
}

export function serializeView(
  positions: ReadonlyMap<string, Position>,
  viewport: Viewport,
): FlowViewSnapshot {
  const posObj: Record<string, Position> = {}
  for (const [id, pos] of positions) {
    posObj[id] = pos
  }
  return { version: 1, positions: posObj, viewport }
}

export function deserializeView(snapshot: FlowViewSnapshot): {
  readonly positions: ReadonlyMap<string, Position>
  readonly viewport: Viewport
} {
  const positions = new Map<string, Position>()
  for (const [id, pos] of Object.entries(snapshot.positions)) {
    positions.set(id, pos)
  }
  return { positions, viewport: snapshot.viewport }
}

// --- Graph Serialization ---

export interface GraphSerializer<N, E> {
  readonly serializeNodeData: (data: N) => unknown
  readonly deserializeNodeData: (raw: unknown) => N
  readonly serializeEdgeData: (data: E) => unknown
  readonly deserializeEdgeData: (raw: unknown) => E
}

export interface SerializedGraph {
  readonly version: 1
  readonly nodes: readonly SerializedNode[]
  readonly edges: readonly SerializedEdge[]
}

interface SerializedNode {
  readonly id: string
  readonly data: unknown
  readonly ports: GraphNode<unknown>['ports']
  readonly parentId?: string
}

interface SerializedEdge {
  readonly id: string
  readonly data: unknown
  readonly source: GraphEdge<unknown>['source']
  readonly target: GraphEdge<unknown>['target']
  readonly direction: GraphEdge<unknown>['direction']
}

const identitySerializer: GraphSerializer<unknown, unknown> = {
  serializeNodeData: (d) => d,
  deserializeNodeData: (d) => d,
  serializeEdgeData: (d) => d,
  deserializeEdgeData: (d) => d,
}

export function serializeGraph<N, E>(
  graph: Graph<N, E>,
  serializer?: GraphSerializer<N, E>,
): SerializedGraph {
  const s = serializer ?? (identitySerializer as GraphSerializer<N, E>)
  return {
    version: 1,
    nodes: graph.nodes.map((n) => ({
      id: n.id,
      data: s.serializeNodeData(n.data),
      ports: n.ports,
      ...(n.parentId !== undefined ? { parentId: n.parentId } : {}),
    })),
    edges: graph.edges.map((e) => ({
      id: e.id,
      data: s.serializeEdgeData(e.data),
      source: e.source,
      target: e.target,
      direction: e.direction,
    })),
  }
}

export function deserializeGraph<N, E>(
  raw: SerializedGraph,
  serializer: GraphSerializer<N, E>,
): Graph<N, E> {
  return {
    nodes: raw.nodes.map((n) => ({
      id: n.id,
      data: serializer.deserializeNodeData(n.data),
      ports: n.ports,
      ...(n.parentId !== undefined ? { parentId: n.parentId } : {}),
    })),
    edges: raw.edges.map((e) => ({
      id: e.id,
      data: serializer.deserializeEdgeData(e.data),
      source: e.source,
      target: e.target,
      direction: e.direction,
    })),
  }
}
