// Configuration types for createFlow()

import type { Signal, Prop, Value } from '@tempots/core'
import type { TNode, Renderable } from '@tempots/dom'
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
import type { PartialAnimationConfig } from '../animation/animation-config'

// --- Node rendering ---

export type NodeRenderer<N> = (node: Signal<GraphNode<N>>, context: NodeRenderContext) => TNode

export interface NodeRenderContext {
  readonly isSelected: Signal<boolean>
  readonly isHovered: Signal<boolean>
  readonly isDragging: Signal<boolean>
  readonly diagnostics: Signal<readonly Diagnostic[]>
  readonly port: (portId: Value<string>) => TNode
  readonly ports: Signal<PortWithState[]>
}

export interface PortWithState {
  readonly definition: PortDefinition
  readonly isConnected: boolean
  readonly connectionCount: number
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
  readonly allowManualPositioning?: boolean
  layout(
    graph: Graph<unknown, unknown>,
    dimensions: ReadonlyMap<string, Dimensions>,
    currentPositions: ReadonlyMap<string, Position>,
  ): ReadonlyMap<string, Position>
}

// --- UI components ---

export type CornerPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'

export interface BackgroundConfig {
  readonly type?: 'dots' | 'lines' | 'cross'
  readonly gap?: number
  readonly size?: number
  readonly color?: string
}

export interface ControlsConfig {
  readonly position?: CornerPosition
  readonly showZoomIn?: boolean
  readonly showZoomOut?: boolean
  readonly showFitView?: boolean
}

export interface MinimapConfig {
  readonly position?: CornerPosition
  readonly width?: number
  readonly height?: number
  readonly interactive?: boolean
  readonly nodeColor?: string
}

// --- Grid ---

export interface GridConfig {
  /** Grid cell size in graph units. Defaults to 20. */
  readonly size?: number
  /** Whether to show the grid visually. Defaults to true. */
  readonly visible?: boolean
  /** Visual style when visible. Defaults to 'lines'. */
  readonly type?: 'dots' | 'lines' | 'cross'
  /** Grid line/dot color. Defaults to CSS variable --flow-grid-color. */
  readonly color?: string
}

// --- Port type system ---

export interface PortTypeConfig {
  readonly isCompatible?: (
    sourceType: string | undefined,
    targetType: string | undefined,
  ) => boolean
}

// --- Main config ---

export interface FlowConfig<N, E> {
  readonly graph: Prop<Graph<N, E>>
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

  // Connection
  readonly portTypes?: PortTypeConfig
  readonly connectionSnapRadius?: number

  // Snap (low-level, prefer `grid` for unified snap + visual)
  readonly snapToGrid?: boolean
  readonly snapGridSize?: number

  // Grid (enables snap + optional visual grid)
  readonly grid?: GridConfig | false

  // Fit
  readonly fitViewOnInit?: boolean
  readonly fitViewPadding?: number

  // Layout transitions (legacy, prefer animation.layout.duration)
  readonly layoutTransitionDuration?: number

  // Animation
  readonly animation?: PartialAnimationConfig

  // Keyboard & history
  readonly keyboardEnabled?: boolean
  readonly maxUndoHistory?: number

  // UI components
  readonly background?: BackgroundConfig | false
  readonly controls?: ControlsConfig | false
  readonly minimap?: MinimapConfig | false
}

// --- Flow instance ---

export interface FlowInstance<N, E> {
  readonly graph: Signal<Graph<N, E>>
  readonly viewport: Signal<Viewport>
  readonly selectedNodeIds: Signal<ReadonlySet<string>>
  readonly selectedEdgeIds: Signal<ReadonlySet<string>>
  readonly edgePaths: Signal<ComputedEdgePath[]>

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

  // Layout
  setLayout(algorithm: LayoutAlgorithm): void

  // History
  readonly canUndo: Signal<boolean>
  readonly canRedo: Signal<boolean>
  undo(): void
  redo(): void

  // Clipboard & editing
  copySelection(): void
  pasteSelection(): void
  cutSelection(): void
  deleteSelection(): void
  selectAll(): void

  // Animation state
  readonly isAnimating: Signal<boolean>

  // The renderable to mount
  readonly renderable: Renderable

  // Cleanup
  dispose(): void
}
