// @tempots/flow — Node-based flow editor for the Tempo ecosystem

// Main API
export { createFlow } from './core/create-flow'

// Graph mutations
export {
  addNode,
  removeNode,
  removeNodes,
  updateNodeData,
  addEdge,
  removeEdge,
  removeEdges,
  connectedEdges,
  connectedPorts,
  mergeGraphs,
  groupNodes,
  ungroupNodes,
  duplicate,
  outgoingNodes,
  incomingNodes,
  topologicalSort,
  collapseToSubGraph,
  expandSubGraph,
} from './core/graph-mutations'

// Serialization
export {
  serializeView,
  deserializeView,
  serializeGraph,
  deserializeGraph,
} from './core/serialization'
export type { FlowViewSnapshot, GraphSerializer, SerializedGraph } from './core/serialization'

// Compound node utilities
export {
  getChildIds,
  getDescendantIds,
  getParentIds,
  getGroupBounds,
  expandGroupDragIds,
} from './layout/compound-utils'

// Coordinate utilities
export { screenToGraph, graphToScreen, clampZoom, snapToGrid } from './core/coordinate-utils'

// Viewport culling
export { computeVisibleNodeIds, computeVisibleEdgeIds } from './core/viewport-culling'

// Types
export type {
  PortDirection,
  PortDefinition,
  PortRef,
  EdgeDirection,
  EdgeRoutingLike,
  GraphNode,
  GraphEdge,
  Graph,
  PortMapping,
  SubGraph,
} from './types/graph'

export type {
  Position,
  Dimensions,
  Viewport,
  PortSide,
  PortPlacement,
  ComputedPortPosition,
  ComputedEdgePath,
  LayoutState,
} from './types/layout'

export type {
  InteractionMode,
  DragState,
  ConnectionState,
  SelectionBoxState,
  InteractionState,
} from './types/interaction'

export type {
  NodeRenderer,
  NodeRenderContext,
  PortWithState,
  EdgeRenderer,
  EdgeRenderContext,
  EdgeOverlayConfig,
  PortRenderer,
  PortRenderContext,
  EdgeRoutingStrategy,
  EdgeRoutingParams,
  EdgeBatchRoutingParams,
  LayoutAlgorithm,
  CornerPosition,
  BackgroundType,
  BackgroundConfig,
  ControlsConfig,
  MinimapConfig,
  GridConfig,
  PortTypeConfig,
  EdgeMarkerType,
  EdgeMarkerConfig,
  EdgeLabelConfig,
  ConnectionConfig,
  BoxSelectionConfig,
  DragEndBehavior,
  KeyboardAction,
  KeyboardConfig,
  FlowConfig,
  FlowInstance,
} from './types/config'

export type { FlowEvents } from './types/events'
export type { FlowTheme, PortTypeStyle } from './types/theme'

export type { HistoryManager, FlowSnapshot } from './core/history-manager'
export type { ClipboardManager, ClipboardContents } from './core/clipboard-manager'

// Animation
export type { EasingFunction } from './animation/easing'
export { easing, springEasing } from './animation/easing'
export type {
  LayoutTransitionConfig,
  ViewportTransitionConfig,
  EnterExitConfig,
  EnterAnimation,
  ExitAnimation,
  EdgeFlowConfig,
  AnimationConfig,
  PartialAnimationConfig,
} from './animation/animation-config'
export { resolveAnimationConfig } from './animation/animation-config'

// Default renderers & edge overlay
export { defaultEdgeRenderer } from './rendering/default-edge-renderer'
export { defaultPortRenderer } from './rendering/port'
export { createEdgeOverlay, computeEdgeAngle } from './rendering/edge-overlay'

// Edge flow effects
export { EdgeFlowParticle, createEdgeFlowParticle } from './rendering/edge-flow-particle'
export type { EdgeFlowParticleConfig } from './rendering/edge-flow-particle'
export { EdgeFlowPulse, createEdgeFlowPulse } from './rendering/edge-flow-pulse'
export type { EdgeFlowPulseConfig } from './rendering/edge-flow-pulse'

// Transition utilities
export { TransitionKeyedForEach } from './rendering/transition-keyed-list'
export type { TransitionKeyedForEachOptions } from './rendering/transition-keyed-list'

// Alignment guides
export type { AlignmentGuide, AlignmentResult } from './interaction/alignment-guides'
export { computeAlignmentGuides } from './interaction/alignment-guides'

export type { DiagnosticSeverity, DiagnosticTarget, Diagnostic } from './types/validation'

// Validators
export type { Validator } from './validators/index'
export {
  portTypeCheck,
  portCardinality,
  requiredPorts,
  acyclic,
  validHierarchy,
  validSubGraphMappings,
  compose,
} from './validators/index'
