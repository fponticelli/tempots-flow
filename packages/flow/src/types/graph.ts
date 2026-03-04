// Graph model types — Layer 1 (consumer-owned, no positions, no UI state)

export type PortDirection = 'input' | 'output'

export interface PortDefinition {
  readonly id: string
  readonly direction: PortDirection
  readonly label?: string
  readonly type?: string
  readonly maxConnections?: number
  readonly required?: boolean
}

export interface PortRef {
  readonly nodeId: string
  readonly portId: string
}

export type EdgeDirection = 'forward' | 'backward' | 'bidirectional' | 'none'

export interface GraphNode<N> {
  readonly id: string
  readonly data: N
  readonly ports: readonly PortDefinition[]
  readonly parentId?: string
  /** Sub-graph for compound nodes that contain a navigable inner graph. */
  readonly subGraph?: SubGraph<N, unknown>
}

/** Minimal edge routing interface to avoid circular dependency with config.ts */
export interface EdgeRoutingLike {
  computePath(params: {
    readonly source: { x: number; y: number; side: string }
    readonly target: { x: number; y: number; side: string }
  }): string
}

export interface GraphEdge<E> {
  readonly id: string
  readonly data: E
  readonly source: PortRef
  readonly target: PortRef
  readonly direction: EdgeDirection
  /** Optional per-edge routing override. When set, this strategy is used instead of the global one. */
  readonly routing?: EdgeRoutingLike
}

export interface Graph<N, E> {
  readonly nodes: readonly GraphNode<N>[]
  readonly edges: readonly GraphEdge<E>[]
}

/** Maps an inner port to an outer compound node port. */
export interface PortMapping {
  readonly innerPortRef: PortRef
  readonly outerPortId: string
}

/** A sub-graph embedded within a compound node. */
export interface SubGraph<N, E> {
  readonly innerGraph: Graph<N, E>
  readonly portMappings: readonly PortMapping[]
}
