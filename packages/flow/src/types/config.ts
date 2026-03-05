// Configuration types for createFlow()

import type { Signal, Prop, Value } from '@tempots/core'
import type { TNode, Renderable } from '@tempots/dom'
import type { Graph, GraphNode, GraphEdge, PortDefinition, PortRef } from './graph'
import type {
  Position,
  Dimensions,
  Viewport,
  ComputedPortPosition,
  ComputedEdgePath,
  PortPlacement,
  PortOffset,
} from './layout'
import type { Diagnostic } from './validation'
import type { Validator } from '../validators/index'
import type { FlowEvents } from './events'
import type { PartialAnimationConfig } from '../animation/animation-config'
import type { FlowTheme } from './theme'

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

export type EdgeRenderer<E> = (edge: Signal<GraphEdge<E>>, context: EdgeRenderContext) => TNode

export interface EdgeRenderContext {
  readonly isSelected: Signal<boolean>
  readonly isHovered: Signal<boolean>
  readonly path: Signal<ComputedEdgePath>
  readonly angle: Signal<number>
}

export interface EdgeOverlayConfig {
  readonly content: TNode
  /** Position along edge: 0 = source, 0.5 = center, 1 = target. Default: 0.5 */
  readonly position?: number
  /** Perpendicular offset in px. Default: 0 */
  readonly offset?: number
  /** Rotation: 'horizontal' (no rotation) or 'path' (follows edge direction). Default: 'horizontal' */
  readonly orientation?: 'horizontal' | 'path'
}

export type EdgeMarkerType = 'arrow' | 'arrow-closed' | 'dot' | 'diamond' | 'custom'

export interface EdgeMarkerConfig {
  readonly type?: EdgeMarkerType
  readonly size?: number
  readonly color?: string
  /** Raw SVG path data for custom markers (used when type is 'custom') */
  readonly customSvg?: string
}

export interface EdgeLabelConfig {
  readonly content: string
  /** Position along edge: 0 = source, 0.5 = center, 1 = target. Default: 0.5 */
  readonly position?: number
  /** Perpendicular offset in px. Default: 0 */
  readonly offset?: number
  /** Whether the label background is shown. Default: true */
  readonly background?: boolean
  /** Whether the label rotates to follow the edge path. Default: false */
  readonly followPath?: boolean
}

export interface EdgeRoutingStrategy {
  computePath(params: EdgeRoutingParams): string
  computeAllPaths?(params: EdgeBatchRoutingParams): ReadonlyMap<string, string>
}

export interface EdgeRoutingParams {
  readonly source: ComputedPortPosition
  readonly target: ComputedPortPosition
}

export interface EdgeBatchRoutingParams {
  readonly edges: readonly {
    readonly edgeId: string
    readonly sourceNodeId: string
    readonly targetNodeId: string
    readonly source: ComputedPortPosition
    readonly target: ComputedPortPosition
  }[]
  readonly obstacles?: readonly {
    readonly nodeId: string
    readonly position: Position
    readonly dimensions: Dimensions
  }[]
}

// --- Port rendering ---

export type PortRenderer = (port: Signal<PortDefinition>, context: PortRenderContext) => TNode

export interface PortRenderContext {
  readonly isConnected: Signal<boolean>
  readonly isHovered: Signal<boolean>
  readonly nodeId: Signal<string>
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

export type BackgroundType = 'dots' | 'lines' | 'cross'

export interface BackgroundConfig {
  readonly type?: BackgroundType
  readonly gap?: number
  readonly size?: number
  readonly color?: string
  /** Whether the background pattern scales with zoom. Default: true */
  readonly scaleWithZoom?: boolean
}

export interface ControlsConfig {
  readonly position?: CornerPosition
  readonly showZoomIn?: boolean
  readonly showZoomOut?: boolean
  readonly showFitView?: boolean
  readonly showLock?: boolean
}

export interface MinimapConfig {
  readonly position?: CornerPosition
  readonly width?: number
  readonly height?: number
  readonly interactive?: boolean
  readonly nodeColor?: string
  /** Custom node color renderer for per-node colors on the minimap */
  readonly nodeRenderer?: (nodeId: string) => string
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

// --- Keyboard config ---

export type KeyboardAction =
  | 'delete'
  | 'selectAll'
  | 'escape'
  | 'undo'
  | 'redo'
  | 'copy'
  | 'paste'
  | 'cut'
  | 'group'
  | 'ungroup'
  | 'zoomIn'
  | 'zoomOut'
  | 'fitView'
  | 'home'
  | 'end'
  | 'cycleForward'
  | 'cycleBackward'
  | 'navigateUp'
  | 'navigateDown'
  | 'navigateLeft'
  | 'navigateRight'

export interface KeyboardConfig {
  /** Custom key bindings. Keys are keyboard event descriptors (e.g. 'Delete', 'Ctrl+A'). */
  readonly bindings?: Readonly<Record<string, KeyboardAction>>
  /** Arrow navigation mode: 'graph' follows edges, 'spatial' uses proximity. Default: 'graph' */
  readonly arrowMode?: 'spatial' | 'graph'
}

// --- Box selection config ---

export interface BoxSelectionConfig {
  /** Selection mode: 'intersect' selects on overlap, 'contain' requires full containment. Default: 'intersect' */
  readonly mode?: 'intersect' | 'contain'
  /** Whether to also select edges whose both endpoints are selected. Default: false */
  readonly selectEdges?: boolean
  /** Modifier key to initiate box selection. Default: 'shift' */
  readonly modifier?: 'shift' | 'ctrl' | 'meta'
}

/** Behavior after node drag ends. */
export type DragEndBehavior = 'pin' | 'relayout' | 'settle'

// --- Connection config ---

export interface ConnectionConfig {
  /** Validation mode: 'strict' enforces port type checks, 'loose' bypasses them. Default: 'strict' */
  readonly mode?: 'strict' | 'loose'
  /** Whether to allow connections from a node back to itself. Default: false */
  readonly selfConnection?: boolean
  /** Custom validation callback invoked after built-in checks pass. */
  readonly onValidate?: (source: PortRef, target: PortRef) => boolean
}

// --- Main config ---

export interface FlowConfig<N, E> {
  readonly graph: Prop<Graph<N, E>>
  readonly nodeRenderer?: NodeRenderer<N>
  readonly edgeRenderer?: EdgeRenderer<E>
  readonly portRenderer?: PortRenderer
  readonly edgeRouting?: EdgeRoutingStrategy
  readonly edgeMarkers?: boolean | EdgeMarkerConfig
  readonly edgeLabels?: (edge: GraphEdge<E>) => EdgeLabelConfig | null
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

  // Pan enhancements
  readonly panInertia?: boolean
  readonly panBounds?: 'none' | 'soft' | 'hard'

  // Drag enhancements
  readonly alignmentGuides?: boolean
  readonly dragBounds?: { readonly min?: Position; readonly max?: Position }

  // Port placement
  readonly portPlacement?: PortPlacement

  // Connection
  readonly portTypes?: PortTypeConfig
  readonly connectionSnapRadius?: number
  readonly connection?: ConnectionConfig
  readonly boxSelection?: BoxSelectionConfig
  readonly dragEndBehavior?: DragEndBehavior

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
  readonly keyboard?: KeyboardConfig | false
  readonly maxUndoHistory?: number

  // UI components
  readonly background?: BackgroundConfig | false
  readonly controls?: ControlsConfig | false
  readonly minimap?: MinimapConfig | false

  // Theming
  readonly theme?: FlowTheme

  // Viewport culling
  readonly cullMargin?: number

  // Validators (run reactively to produce diagnostics)
  readonly validators?: readonly Validator<N, E>[]
}

// --- Flow instance ---

export interface FlowInstance<N, E> {
  readonly graph: Signal<Graph<N, E>>
  readonly viewport: Signal<Viewport>
  readonly selectedNodeIds: Signal<ReadonlySet<string>>
  readonly selectedEdgeIds: Signal<ReadonlySet<string>>
  readonly edgePaths: Signal<ComputedEdgePath[]>

  // Viewport culling
  readonly visibleNodeIds: Signal<ReadonlySet<string>>
  readonly visibleEdgeIds: Signal<ReadonlySet<string>>

  // Measured port offsets (DOM-driven)
  readonly portOffsets: Signal<ReadonlyMap<string, ReadonlyMap<string, PortOffset>>>

  // Per-node signals
  getNodePosition(nodeId: string): Signal<Position>
  getNodeDimensions(nodeId: string): Signal<Dimensions>
  isNodeSelected(nodeId: string): Signal<boolean>
  isNodeHovered(nodeId: string): Signal<boolean>

  // Reactive diagnostics
  readonly diagnostics: Signal<readonly Diagnostic[]>
  nodeDiagnostics(nodeId: string): Signal<readonly Diagnostic[]>

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

  // Edge routing
  setEdgeRouting(strategy: EdgeRoutingStrategy): void

  // Port placement
  readonly portPlacement: Signal<PortPlacement>
  setPortPlacement(placement: PortPlacement): void

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

  // Grid
  readonly gridVisible: Signal<boolean>
  setGridVisible(visible: boolean): void
  readonly gridType: Signal<BackgroundType>
  setGridType(type: BackgroundType): void

  // Viewport navigation
  panTo(position: Position, animate?: boolean): void
  centerOnNode(nodeId: string, zoom?: number, animate?: boolean): void
  centerOnSelection(padding?: number, animate?: boolean): void

  // Interaction lock
  readonly interactionLocked: Signal<boolean>
  setInteractionLocked(locked: boolean): void

  // Animation state
  readonly isAnimating: Signal<boolean>

  // Sub-graph navigation
  readonly subGraphDepth: Signal<number>
  enterSubGraph(compoundNodeId: string): void
  exitSubGraph(): void

  // The renderable to mount
  readonly renderable: Renderable

  // Cleanup
  dispose(): void
}
