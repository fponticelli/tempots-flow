import type { Prop } from '@tempots/core'
import type { InteractionState } from '../types/interaction'
import type { Position, Dimensions } from '../types/layout'
import type { BoxSelectionConfig } from '../types/config'
import type { GraphEdge } from '../types/graph'

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
  boxConfig?: BoxSelectionConfig,
  edges?: readonly GraphEdge<unknown>[],
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

  const containMode = boxConfig?.mode === 'contain'

  const selectedNodes = new Set<string>()
  for (const [nodeId, pos] of positions) {
    const dims = dimensions.get(nodeId)
    if (!dims) continue

    const nodeRight = pos.x + dims.width
    const nodeBottom = pos.y + dims.height

    if (containMode) {
      // All 4 corners must be inside the box
      if (pos.x >= minX && nodeRight <= maxX && pos.y >= minY && nodeBottom <= maxY) {
        selectedNodes.add(nodeId)
      }
    } else {
      // Select if any overlap (intersect mode)
      if (pos.x <= maxX && nodeRight >= minX && pos.y <= maxY && nodeBottom >= minY) {
        selectedNodes.add(nodeId)
      }
    }
  }

  // Optionally select edges where both endpoints are selected
  const selectedEdges = new Set<string>()
  if (boxConfig?.selectEdges && edges) {
    for (const edge of edges) {
      if (selectedNodes.has(edge.source.nodeId) && selectedNodes.has(edge.target.nodeId)) {
        selectedEdges.add(edge.id)
      }
    }
  }

  state.update((s) => ({
    ...s,
    mode: 'idle',
    selectionBox: null,
    selectedNodeIds: selectedNodes,
    selectedEdgeIds: selectedEdges,
  }))
}
