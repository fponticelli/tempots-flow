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
}

export interface GraphEdge<E> {
  readonly id: string
  readonly data: E
  readonly source: PortRef
  readonly target: PortRef
  readonly direction: EdgeDirection
}

export interface Graph<N, E> {
  readonly nodes: readonly GraphNode<N>[]
  readonly edges: readonly GraphEdge<E>[]
}
