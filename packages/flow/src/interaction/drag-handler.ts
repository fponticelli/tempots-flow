import type { Prop } from '@tempots/core'
import type { InteractionState, DragState } from '../types/interaction'
import type { Position } from '../types/layout'
import type { FlowEvents } from '../types/events'
import { snapToGrid } from '../core/coordinate-utils'

export function handleDragStart(
  state: Prop<InteractionState>,
  nodeIds: readonly string[],
  mousePosition: Position,
  currentPositions: ReadonlyMap<string, Position>,
): void {
  const startPositions = new Map<string, Position>()
  for (const id of nodeIds) {
    const pos = currentPositions.get(id)
    if (pos) startPositions.set(id, pos)
  }

  state.update((s) => ({
    ...s,
    mode: 'dragging-nodes',
    selectedNodeIds: new Set(nodeIds),
    drag: {
      nodeIds,
      startPositions,
      startMousePosition: mousePosition,
    },
  }))
}

export function handleDragMove(
  drag: DragState,
  currentGraphPos: Position,
  setNodePosition: (nodeId: string, position: Position) => void,
  snap: boolean,
  gridSize: number,
): void {
  const dx = currentGraphPos.x - drag.startMousePosition.x
  const dy = currentGraphPos.y - drag.startMousePosition.y

  for (const nodeId of drag.nodeIds) {
    const start = drag.startPositions.get(nodeId)
    if (start) {
      let newX = start.x + dx
      let newY = start.y + dy
      if (snap) {
        newX = snapToGrid(newX, gridSize)
        newY = snapToGrid(newY, gridSize)
      }
      setNodePosition(nodeId, { x: newX, y: newY })
    }
  }
}

export function handleDragEnd<N, E>(
  state: Prop<InteractionState>,
  events?: Partial<FlowEvents<N, E>>,
): void {
  const drag = state.value.drag
  if (drag) {
    events?.onNodeDragEnd?.(drag.nodeIds, drag.startPositions)
  }
  state.update((s) => ({
    ...s,
    mode: 'idle',
    drag: null,
  }))
}
