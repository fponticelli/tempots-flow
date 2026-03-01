// Interaction state types — Layer 3 (ephemeral, never persisted)

import type { Position, PortSide } from './layout'
import type { PortRef } from './graph'

export type InteractionMode = 'idle' | 'panning' | 'dragging-nodes' | 'connecting' | 'box-selecting'

export interface DragState {
  readonly nodeIds: readonly string[]
  readonly startPositions: ReadonlyMap<string, Position>
  readonly startMousePosition: Position
}

export interface ConnectionState {
  readonly sourcePort: PortRef
  readonly sourceSide: PortSide
  readonly sourcePosition: Position
  readonly currentPosition: Position
  readonly targetPort: PortRef | null
  readonly isValid: boolean
}

export interface SelectionBoxState {
  readonly start: Position
  readonly current: Position
}

export interface InteractionState {
  readonly mode: InteractionMode
  readonly selectedNodeIds: ReadonlySet<string>
  readonly selectedEdgeIds: ReadonlySet<string>
  readonly hoveredNodeId: string | null
  readonly hoveredEdgeId: string | null
  readonly hoveredPort: PortRef | null
  readonly drag: DragState | null
  readonly connection: ConnectionState | null
  readonly selectionBox: SelectionBoxState | null
}

export function createInitialInteractionState(): InteractionState {
  return {
    mode: 'idle',
    selectedNodeIds: new Set(),
    selectedEdgeIds: new Set(),
    hoveredNodeId: null,
    hoveredEdgeId: null,
    hoveredPort: null,
    drag: null,
    connection: null,
    selectionBox: null,
  }
}
