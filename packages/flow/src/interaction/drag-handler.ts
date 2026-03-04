import type { Prop } from '@tempots/core'
import type { InteractionState, DragState } from '../types/interaction'
import type { Position, Dimensions } from '../types/layout'
import type { FlowEvents } from '../types/events'
import { snapToGrid } from '../core/coordinate-utils'
import { computeAlignmentGuides, type AlignmentResult } from './alignment-guides'

export interface DragConfig {
  readonly alignmentGuides?: boolean
  readonly alignmentSnapThreshold?: number
  readonly dragBounds?: { readonly min?: Position; readonly max?: Position }
}

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
  dragConfig?: DragConfig,
  allPositions?: ReadonlyMap<string, Position>,
  allDimensions?: ReadonlyMap<string, Dimensions>,
): AlignmentResult | null {
  const dx = currentGraphPos.x - drag.startMousePosition.x
  const dy = currentGraphPos.y - drag.startMousePosition.y

  // Compute tentative positions
  const tentativePositions = new Map<string, Position>()
  for (const nodeId of drag.nodeIds) {
    const start = drag.startPositions.get(nodeId)
    if (start) {
      let newX = start.x + dx
      let newY = start.y + dy
      if (snap) {
        newX = snapToGrid(newX, gridSize)
        newY = snapToGrid(newY, gridSize)
      }
      tentativePositions.set(nodeId, { x: newX, y: newY })
    }
  }

  // Alignment guides
  let alignmentResult: AlignmentResult | null = null
  if (dragConfig?.alignmentGuides && allPositions && allDimensions) {
    const threshold = dragConfig.alignmentSnapThreshold ?? 5
    alignmentResult = computeAlignmentGuides(
      drag.nodeIds,
      tentativePositions,
      allPositions,
      allDimensions,
      threshold,
    )

    // Apply alignment snap offset
    if (alignmentResult.snappedPosition) {
      const snapDx = alignmentResult.snappedPosition.x
      const snapDy = alignmentResult.snappedPosition.y
      for (const [nodeId, pos] of tentativePositions) {
        tentativePositions.set(nodeId, { x: pos.x + snapDx, y: pos.y + snapDy })
      }
    }
  }

  // Drag bounds
  if (dragConfig?.dragBounds) {
    const { min, max } = dragConfig.dragBounds
    for (const [nodeId, pos] of tentativePositions) {
      let { x, y } = pos
      if (min) {
        x = Math.max(min.x, x)
        y = Math.max(min.y, y)
      }
      if (max) {
        x = Math.min(max.x, x)
        y = Math.min(max.y, y)
      }
      tentativePositions.set(nodeId, { x, y })
    }
  }

  // Apply positions
  for (const [nodeId, pos] of tentativePositions) {
    setNodePosition(nodeId, pos)
  }

  return alignmentResult
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
