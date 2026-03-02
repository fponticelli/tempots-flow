import type { Prop } from '@tempots/core'
import type { InteractionState } from '../types/interaction'
import type { Position, Dimensions } from '../types/layout'

export function handleBoxSelectStart(state: Prop<InteractionState>, graphPosition: Position): void {
  state.update((s) => ({
    ...s,
    mode: 'box-selecting',
    selectionBox: { start: graphPosition, current: graphPosition },
    selectedNodeIds: new Set(),
    selectedEdgeIds: new Set(),
  }))
}

export function handleBoxSelectMove(state: Prop<InteractionState>, graphPosition: Position): void {
  state.update((s) => ({
    ...s,
    selectionBox: s.selectionBox ? { ...s.selectionBox, current: graphPosition } : null,
  }))
}

export function handleBoxSelectEnd(
  state: Prop<InteractionState>,
  positions: ReadonlyMap<string, Position>,
  dimensions: ReadonlyMap<string, Dimensions>,
): void {
  const box = state.value.selectionBox
  if (!box) {
    state.update((s) => ({ ...s, mode: 'idle', selectionBox: null }))
    return
  }

  const minX = Math.min(box.start.x, box.current.x)
  const maxX = Math.max(box.start.x, box.current.x)
  const minY = Math.min(box.start.y, box.current.y)
  const maxY = Math.max(box.start.y, box.current.y)

  const selected = new Set<string>()
  for (const [nodeId, pos] of positions) {
    const dims = dimensions.get(nodeId)
    if (!dims) continue

    const nodeRight = pos.x + dims.width
    const nodeBottom = pos.y + dims.height

    // Select if any overlap
    if (pos.x <= maxX && nodeRight >= minX && pos.y <= maxY && nodeBottom >= minY) {
      selected.add(nodeId)
    }
  }

  state.update((s) => ({
    ...s,
    mode: 'idle',
    selectionBox: null,
    selectedNodeIds: selected,
    selectedEdgeIds: new Set(),
  }))
}
