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
  mergeGraphs,
} from './core/graph-mutations'

// Coordinate utilities
export { screenToGraph, graphToScreen, clampZoom, snapToGrid } from './core/coordinate-utils'

// Types
export type {
  PortDirection,
  PortDefinition,
  PortRef,
  EdgeDirection,
  GraphNode,
  GraphEdge,
  Graph,
} from './types/graph'

export type {
  Position,
  Dimensions,
  Viewport,
  PortSide,
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
  EdgeRoutingStrategy,
  EdgeRoutingParams,
  LayoutAlgorithm,
  CornerPosition,
  BackgroundConfig,
  ControlsConfig,
  MinimapConfig,
  GridConfig,
  PortTypeConfig,
  FlowConfig,
  FlowInstance,
} from './types/config'

export type { FlowEvents } from './types/events'

export type { HistoryManager, FlowSnapshot } from './core/history-manager'
export type { ClipboardManager, ClipboardContents } from './core/clipboard-manager'

// Animation
export type { EasingFunction } from './animation/easing'
export { easing } from './animation/easing'
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

export type { DiagnosticSeverity, DiagnosticTarget, Diagnostic } from './types/validation'

// Validators
export type { Validator } from './validators/index'
export { portTypeCheck, portCardinality, requiredPorts, acyclic, compose } from './validators/index'
