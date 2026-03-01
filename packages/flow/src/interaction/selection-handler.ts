import type { Prop } from '@tempots/core'
import type { InteractionState } from '../types/interaction'

export function handleNodeClick(
  state: Prop<InteractionState>,
  nodeId: string,
  isMultiSelect: boolean,
): void {
  state.update((s) => {
    if (isMultiSelect) {
      const next = new Set(s.selectedNodeIds)
      if (next.has(nodeId)) {
        next.delete(nodeId)
      } else {
        next.add(nodeId)
      }
      return { ...s, selectedNodeIds: next }
    }
    return {
      ...s,
      selectedNodeIds: new Set([nodeId]),
      selectedEdgeIds: new Set(),
    }
  })
}

export function handleEdgeClick(
  state: Prop<InteractionState>,
  edgeId: string,
  isMultiSelect: boolean,
): void {
  state.update((s) => {
    if (isMultiSelect) {
      const next = new Set(s.selectedEdgeIds)
      if (next.has(edgeId)) {
        next.delete(edgeId)
      } else {
        next.add(edgeId)
      }
      return { ...s, selectedEdgeIds: next }
    }
    return {
      ...s,
      selectedEdgeIds: new Set([edgeId]),
      selectedNodeIds: new Set(),
    }
  })
}

export function handleBackgroundClick(state: Prop<InteractionState>): void {
  state.update((s) => ({
    ...s,
    selectedNodeIds: new Set(),
    selectedEdgeIds: new Set(),
  }))
}
