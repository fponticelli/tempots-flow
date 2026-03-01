// Configuration types for createFlow()

import type { Signal, Prop } from '@tempots/core'
import type { TNode } from '@tempots/dom'
import type { Graph, GraphNode, PortDefinition } from './graph'
import type {
  Position,
  Dimensions,
  Viewport,
  ComputedPortPosition,
  ComputedEdgePath,
} from './layout'
import type { Diagnostic } from './validation'
import type { FlowEvents } from './events'

// --- Node rendering ---

export type NodeRenderer<N> = (node: GraphNode<N>, context: NodeRenderContext) => TNode

export interface NodeRenderContext {
  readonly isSelected: Signal<boolean>
  readonly isHovered: Signal<boolean>
  readonly isDragging: Signal<boolean>
  readonly diagnostics: Signal<readonly Diagnostic[]>
  readonly port: (portId: string) => TNode
  readonly ports: Signal<readonly PortWithState[]>
}

export interface PortWithState {
  readonly definition: PortDefinition
  readonly isConnected: Signal<boolean>
  readonly connectionCount: Signal<number>
}

// --- Edge rendering ---

export interface EdgeRoutingStrategy {
  computePath(params: EdgeRoutingParams): string
}

export interface EdgeRoutingParams {
  readonly source: ComputedPortPosition
  readonly target: ComputedPortPosition
}

// --- Layout ---

export interface LayoutAlgorithm {
  layout(
    nodes: readonly GraphNode<unknown>[],
    dimensions: ReadonlyMap<string, Dimensions>,
    currentPositions: ReadonlyMap<string, Position>,
  ): ReadonlyMap<string, Position>
}

// --- Main config ---

export interface FlowConfig<N, E> {
  readonly graph: Graph<N, E> | Prop<Graph<N, E>>
  readonly nodeRenderer?: NodeRenderer<N>
  readonly edgeRouting?: EdgeRoutingStrategy
  readonly layout?: LayoutAlgorithm
  readonly initialPositions?: ReadonlyMap<string, Position>
  readonly viewport?: Partial<Viewport>
  readonly events?: Partial<FlowEvents<N, E>>

  // Zoom
  readonly minZoom?: number
  readonly maxZoom?: number
  readonly zoomStep?: number

  // Interaction toggles
  readonly panEnabled?: boolean
  readonly zoomEnabled?: boolean
  readonly nodesDraggable?: boolean
  readonly nodesSelectable?: boolean
  readonly edgesSelectable?: boolean
  readonly multiSelectionKey?: 'shift' | 'meta' | 'ctrl'

  // Snap
  readonly snapToGrid?: boolean
  readonly snapGridSize?: number

  // Fit
  readonly fitViewOnInit?: boolean
  readonly fitViewPadding?: number
}

// --- Flow instance ---

export interface FlowInstance<N, E> {
  readonly graph: Signal<Graph<N, E>>
  readonly viewport: Signal<Viewport>
  readonly selectedNodeIds: Signal<ReadonlySet<string>>
  readonly selectedEdgeIds: Signal<ReadonlySet<string>>
  readonly edgePaths: Signal<readonly ComputedEdgePath[]>

  // Graph mutations
  updateGraph(updater: (graph: Graph<N, E>) => Graph<N, E>): void

  // Viewport controls
  setViewport(viewport: Partial<Viewport>): void
  fitView(padding?: number): void
  zoomTo(zoom: number, center?: Position): void

  // Selection
  selectNodes(nodeIds: readonly string[]): void
  selectEdges(edgeIds: readonly string[]): void
  clearSelection(): void

  // Position overrides
  setNodePosition(nodeId: string, position: Position): void

  // The renderable to mount
  readonly renderable: TNode

  // Cleanup
  dispose(): void
}
