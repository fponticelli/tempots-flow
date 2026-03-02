import { describe, it, expect } from 'vitest'
import { prop } from '@tempots/core'
import type { Graph } from '../../src/types/graph'
import type { Position } from '../../src/types/layout'
import { handleKeyDown, type KeyboardActions } from '../../src/interaction/keyboard-handler'
import { createHistoryManager } from '../../src/core/history-manager'
import { createClipboardManager } from '../../src/core/clipboard-manager'

const graph: Graph<string, string> = {
  nodes: [
    { id: 'a', data: 'A', ports: [] },
    { id: 'b', data: 'B', ports: [] },
    { id: 'c', data: 'C', ports: [] },
  ],
  edges: [
    {
      id: 'e1',
      data: '',
      source: { nodeId: 'a', portId: 'out' },
      target: { nodeId: 'b', portId: 'in' },
      direction: 'forward',
    },
  ],
}

function setup() {
  const graphProp = prop(graph)
  let positions = new Map<string, Position>([
    ['a', { x: 0, y: 0 }],
    ['b', { x: 100, y: 0 }],
    ['c', { x: 200, y: 0 }],
  ])
  const history = createHistoryManager(
    graphProp,
    () => positions,
    (restored) => {
      positions = new Map(restored)
    },
  )
  const clipboard = createClipboardManager<string, string>()

  let selectedNodeIds = new Set<string>()
  let selectedEdgeIds = new Set<string>()

  const actions: KeyboardActions<string, string> = {
    getGraph: () => graphProp.value,
    updateGraph: (updater) => {
      graphProp.update(updater)
    },
    getSelectedNodeIds: () => selectedNodeIds,
    getSelectedEdgeIds: () => selectedEdgeIds,
    selectNodes: (ids) => {
      selectedNodeIds = new Set(ids)
    },
    clearSelection: () => {
      selectedNodeIds = new Set()
      selectedEdgeIds = new Set()
    },
    getPositions: () => positions,
    setNodePosition: (id, pos) => {
      positions.set(id, pos)
    },
    history,
    clipboard,
  }

  return {
    graphProp,
    actions,
    getSelectedNodeIds: () => selectedNodeIds,
    setSelectedNodeIds: (ids: Set<string>) => {
      selectedNodeIds = ids
    },
    getSelectedEdgeIds: () => selectedEdgeIds,
    setSelectedEdgeIds: (ids: Set<string>) => {
      selectedEdgeIds = ids
    },
  }
}

function keyEvent(key: string, opts: Partial<KeyboardEventInit> = {}): KeyboardEvent {
  return new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    ...opts,
  })
}

describe('keyboard-handler', () => {
  it('Delete removes selected nodes', () => {
    const { graphProp, actions, setSelectedNodeIds } = setup()
    setSelectedNodeIds(new Set(['a']))
    handleKeyDown(keyEvent('Delete'), actions)
    expect(graphProp.value.nodes.find((n) => n.id === 'a')).toBeUndefined()
    // Edge e1 (a→b) should also be removed since node 'a' was deleted
    expect(graphProp.value.edges.find((e) => e.id === 'e1')).toBeUndefined()
  })

  it('Backspace removes selected edges', () => {
    const { graphProp, actions, setSelectedEdgeIds } = setup()
    setSelectedEdgeIds(new Set(['e1']))
    handleKeyDown(keyEvent('Backspace'), actions)
    expect(graphProp.value.edges).toHaveLength(0)
    // Nodes should remain
    expect(graphProp.value.nodes).toHaveLength(3)
  })

  it('Ctrl+A selects all nodes', () => {
    const { actions, getSelectedNodeIds } = setup()
    handleKeyDown(keyEvent('a', { ctrlKey: true }), actions)
    expect(getSelectedNodeIds().size).toBe(3)
  })

  it('Meta+A selects all nodes (Mac)', () => {
    const { actions, getSelectedNodeIds } = setup()
    handleKeyDown(keyEvent('a', { metaKey: true }), actions)
    expect(getSelectedNodeIds().size).toBe(3)
  })

  it('Escape clears selection', () => {
    const { actions, setSelectedNodeIds, getSelectedNodeIds } = setup()
    setSelectedNodeIds(new Set(['a', 'b']))
    handleKeyDown(keyEvent('Escape'), actions)
    expect(getSelectedNodeIds().size).toBe(0)
  })

  it('Ctrl+Z calls undo', () => {
    const { graphProp, actions, setSelectedNodeIds } = setup()
    const original = graphProp.value
    // Make a change and record
    setSelectedNodeIds(new Set(['a']))
    handleKeyDown(keyEvent('Delete'), actions)
    expect(graphProp.value.nodes).toHaveLength(2)
    // Undo
    handleKeyDown(keyEvent('z', { ctrlKey: true }), actions)
    expect(graphProp.value).toEqual(original)
  })

  it('Ctrl+Shift+Z calls redo', () => {
    const { graphProp, actions, setSelectedNodeIds } = setup()
    setSelectedNodeIds(new Set(['a']))
    handleKeyDown(keyEvent('Delete'), actions)
    const afterDelete = graphProp.value
    handleKeyDown(keyEvent('z', { ctrlKey: true }), actions)
    handleKeyDown(keyEvent('z', { ctrlKey: true, shiftKey: true }), actions)
    expect(graphProp.value).toEqual(afterDelete)
  })

  it('Ctrl+Y calls redo', () => {
    const { graphProp, actions, setSelectedNodeIds } = setup()
    setSelectedNodeIds(new Set(['a']))
    handleKeyDown(keyEvent('Delete'), actions)
    const afterDelete = graphProp.value
    handleKeyDown(keyEvent('z', { ctrlKey: true }), actions)
    handleKeyDown(keyEvent('y', { ctrlKey: true }), actions)
    expect(graphProp.value).toEqual(afterDelete)
  })

  it('Ctrl+C copies selected nodes', () => {
    const { actions, setSelectedNodeIds } = setup()
    setSelectedNodeIds(new Set(['a']))
    handleKeyDown(keyEvent('c', { ctrlKey: true }), actions)
    expect(actions.clipboard.hasCopied()).toBe(true)
  })

  it('Ctrl+V pastes copied nodes', () => {
    const { graphProp, actions, setSelectedNodeIds, getSelectedNodeIds } = setup()
    setSelectedNodeIds(new Set(['a']))
    handleKeyDown(keyEvent('c', { ctrlKey: true }), actions)
    handleKeyDown(keyEvent('v', { ctrlKey: true }), actions)
    // Should have 4 nodes now (3 original + 1 pasted)
    expect(graphProp.value.nodes).toHaveLength(4)
    // Pasted node should be selected
    expect(getSelectedNodeIds().size).toBe(1)
    const pastedId = [...getSelectedNodeIds()][0]!
    expect(pastedId).not.toBe('a')
  })

  it('Ctrl+X cuts selected nodes', () => {
    const { graphProp, actions, setSelectedNodeIds } = setup()
    setSelectedNodeIds(new Set(['c']))
    handleKeyDown(keyEvent('x', { ctrlKey: true }), actions)
    // Node c should be removed
    expect(graphProp.value.nodes.find((n) => n.id === 'c')).toBeUndefined()
    // But clipboard should have it
    expect(actions.clipboard.hasCopied()).toBe(true)
  })

  it('does nothing when no selection and Delete pressed', () => {
    const { graphProp, actions } = setup()
    const before = graphProp.value
    handleKeyDown(keyEvent('Delete'), actions)
    expect(graphProp.value).toEqual(before)
  })
})
