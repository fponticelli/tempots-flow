// Event callback types

import type { GraphNode, GraphEdge, PortRef } from './graph'
import type { Position, Viewport } from './layout'

export interface FlowEvents<N, E> {
  readonly onNodeClick: (node: GraphNode<N>, event: PointerEvent) => void
  readonly onNodeDoubleClick: (node: GraphNode<N>, event: PointerEvent) => void
  readonly onNodeDragStart: (
    nodeIds: readonly string[],
    positions: ReadonlyMap<string, Position>,
  ) => void
  readonly onNodeDrag: (
    nodeIds: readonly string[],
    positions: ReadonlyMap<string, Position>,
  ) => void
  readonly onNodeDragEnd: (
    nodeIds: readonly string[],
    positions: ReadonlyMap<string, Position>,
  ) => void
  readonly onNodeContextMenu: (node: GraphNode<N>, event: PointerEvent) => void
  readonly onEdgeClick: (edge: GraphEdge<E>, event: PointerEvent) => void
  readonly onEdgeDoubleClick: (edge: GraphEdge<E>, event: PointerEvent) => void
  readonly onEdgeContextMenu: (edge: GraphEdge<E>, event: PointerEvent) => void
  readonly onPortHover: (port: PortRef) => void
  readonly onPortLeave: (port: PortRef) => void
  readonly onConnectionStart: (sourcePort: PortRef) => void
  readonly onConnectionDrag: (sourcePort: PortRef, position: Position) => void
  readonly onConnectionEnd: (sourcePort: PortRef, targetPort: PortRef | null) => void
  readonly onZoom: (zoom: number) => void
  readonly onSelectionChange: (nodeIds: ReadonlySet<string>, edgeIds: ReadonlySet<string>) => void
  readonly onViewportChange: (viewport: Viewport) => void
  readonly onConnect: (source: PortRef, target: PortRef) => void
  readonly onDisconnect: (edgeId: string) => void
  readonly onDelete: (nodeIds: ReadonlySet<string>, edgeIds: ReadonlySet<string>) => void
  readonly onCopy: (nodeIds: ReadonlySet<string>) => void
  readonly onPaste: (pastedNodeIds: readonly string[]) => void
}
