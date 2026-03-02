import type { Graph } from '../types/graph'
import type { Position } from '../types/layout'
import type { HistoryManager } from '../core/history-manager'
import type { ClipboardManager } from '../core/clipboard-manager'
import { removeNodes, removeEdges } from '../core/graph-mutations'

export interface KeyboardActions<N, E> {
  readonly getGraph: () => Graph<N, E>
  readonly updateGraph: (updater: (g: Graph<N, E>) => Graph<N, E>) => void
  readonly getSelectedNodeIds: () => ReadonlySet<string>
  readonly getSelectedEdgeIds: () => ReadonlySet<string>
  readonly selectNodes: (ids: readonly string[]) => void
  readonly clearSelection: () => void
  readonly getPositions: () => ReadonlyMap<string, Position>
  readonly setNodePosition: (nodeId: string, position: Position) => void
  readonly history: HistoryManager<N, E>
  readonly clipboard: ClipboardManager<N, E>
  readonly onDelete?: (nodeIds: ReadonlySet<string>, edgeIds: ReadonlySet<string>) => void
  readonly onCopy?: (nodeIds: ReadonlySet<string>) => void
  readonly onPaste?: (pastedNodeIds: readonly string[]) => void
}

function isInputFocused(event: KeyboardEvent): boolean {
  const target = event.target as HTMLElement | null
  if (!target) return false
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable
}

export function handleKeyDown<N, E>(event: KeyboardEvent, actions: KeyboardActions<N, E>): void {
  const isMod = event.metaKey || event.ctrlKey

  // Delete / Backspace — remove selected nodes and edges
  if (event.key === 'Delete' || event.key === 'Backspace') {
    if (isInputFocused(event)) return
    event.preventDefault()
    const selectedNodes = actions.getSelectedNodeIds()
    const selectedEdges = actions.getSelectedEdgeIds()
    if (selectedNodes.size === 0 && selectedEdges.size === 0) return

    actions.updateGraph((g) => {
      let result = g
      if (selectedNodes.size > 0) result = removeNodes(result, selectedNodes)
      if (selectedEdges.size > 0) result = removeEdges(result, selectedEdges)
      return result
    })
    actions.clearSelection()
    actions.history.record()
    actions.onDelete?.(selectedNodes, selectedEdges)
    return
  }

  // Ctrl+A — select all nodes
  if (isMod && event.key === 'a') {
    if (isInputFocused(event)) return
    event.preventDefault()
    const graph = actions.getGraph()
    actions.selectNodes(graph.nodes.map((n) => n.id))
    return
  }

  // Escape — clear selection
  if (event.key === 'Escape') {
    event.preventDefault()
    actions.clearSelection()
    return
  }

  // Ctrl+Z — undo
  if (isMod && event.key === 'z' && !event.shiftKey) {
    event.preventDefault()
    actions.history.undo()
    return
  }

  // Ctrl+Shift+Z or Ctrl+Y — redo
  if ((isMod && event.key === 'z' && event.shiftKey) || (isMod && event.key === 'y')) {
    event.preventDefault()
    actions.history.redo()
    return
  }

  // Ctrl+C — copy
  if (isMod && event.key === 'c') {
    if (isInputFocused(event)) return
    event.preventDefault()
    const selectedNodes = actions.getSelectedNodeIds()
    actions.clipboard.copy(actions.getGraph(), selectedNodes, actions.getPositions())
    actions.onCopy?.(selectedNodes)
    return
  }

  // Ctrl+V — paste
  if (isMod && event.key === 'v') {
    if (isInputFocused(event)) return
    event.preventDefault()
    const result = actions.clipboard.paste(actions.getGraph(), actions.getPositions())
    if (result) {
      actions.updateGraph(() => result.graph)
      for (const [nodeId, pos] of result.positionUpdates) {
        actions.setNodePosition(nodeId, pos)
      }
      actions.selectNodes(result.pastedNodeIds)
      actions.history.record()
      actions.onPaste?.(result.pastedNodeIds)
    }
    return
  }

  // Ctrl+X — cut
  if (isMod && event.key === 'x') {
    if (isInputFocused(event)) return
    event.preventDefault()
    const selectedNodes = actions.getSelectedNodeIds()
    const selectedEdges = actions.getSelectedEdgeIds()
    if (selectedNodes.size === 0) return

    // Copy first
    actions.clipboard.copy(actions.getGraph(), selectedNodes, actions.getPositions())
    actions.onCopy?.(selectedNodes)

    // Then delete
    actions.updateGraph((g) => {
      let result = g
      if (selectedNodes.size > 0) result = removeNodes(result, selectedNodes)
      if (selectedEdges.size > 0) result = removeEdges(result, selectedEdges)
      return result
    })
    actions.clearSelection()
    actions.history.record()
    actions.onDelete?.(selectedNodes, selectedEdges)
    return
  }
}
