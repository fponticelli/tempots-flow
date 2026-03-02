import { describe, it, expect } from 'vitest'
import type { Graph } from '../types/graph'
import type { Position } from '../types/layout'
import { createClipboardManager } from './clipboard-manager'

const graph: Graph<string, string> = {
  nodes: [
    { id: 'a', data: 'A', ports: [{ id: 'out', direction: 'output' }] },
    {
      id: 'b',
      data: 'B',
      ports: [
        { id: 'in', direction: 'input' },
        { id: 'out', direction: 'output' },
      ],
    },
    { id: 'c', data: 'C', ports: [{ id: 'in', direction: 'input' }] },
  ],
  edges: [
    {
      id: 'e1',
      data: '',
      source: { nodeId: 'a', portId: 'out' },
      target: { nodeId: 'b', portId: 'in' },
      direction: 'forward',
    },
    {
      id: 'e2',
      data: '',
      source: { nodeId: 'b', portId: 'out' },
      target: { nodeId: 'c', portId: 'in' },
      direction: 'forward',
    },
  ],
}

const positions: ReadonlyMap<string, Position> = new Map([
  ['a', { x: 0, y: 0 }],
  ['b', { x: 100, y: 0 }],
  ['c', { x: 200, y: 0 }],
])

describe('ClipboardManager', () => {
  it('hasCopied returns false initially', () => {
    const cm = createClipboardManager<string, string>()
    expect(cm.hasCopied()).toBe(false)
  })

  it('paste returns null when clipboard is empty', () => {
    const cm = createClipboardManager<string, string>()
    expect(cm.paste(graph, positions)).toBeNull()
  })

  it('copy captures selected nodes', () => {
    const cm = createClipboardManager<string, string>()
    cm.copy(graph, new Set(['a', 'b']), positions)
    expect(cm.hasCopied()).toBe(true)
  })

  it('copy with empty selection clears clipboard', () => {
    const cm = createClipboardManager<string, string>()
    cm.copy(graph, new Set(['a']), positions)
    expect(cm.hasCopied()).toBe(true)
    cm.copy(graph, new Set(), positions)
    expect(cm.hasCopied()).toBe(false)
  })

  it('paste creates nodes with new IDs', () => {
    const cm = createClipboardManager<string, string>()
    cm.copy(graph, new Set(['a', 'b']), positions)
    const result = cm.paste(graph, positions)
    expect(result).not.toBeNull()
    expect(result!.pastedNodeIds).toHaveLength(2)
    // New IDs should not collide with originals
    for (const id of result!.pastedNodeIds) {
      expect(id).not.toBe('a')
      expect(id).not.toBe('b')
    }
  })

  it('paste remaps edge source and target to new node IDs', () => {
    const cm = createClipboardManager<string, string>()
    cm.copy(graph, new Set(['a', 'b']), positions)
    const result = cm.paste(graph, positions)!
    // Should include 1 internal edge (e1: a→b), not e2 (b→c, c is outside selection)
    const newEdges = result.graph.edges.filter((e) => !graph.edges.some((orig) => orig.id === e.id))
    expect(newEdges).toHaveLength(1)
    const edge = newEdges[0]!
    expect(result.pastedNodeIds).toContain(edge.source.nodeId)
    expect(result.pastedNodeIds).toContain(edge.target.nodeId)
  })

  it('paste offsets positions', () => {
    const cm = createClipboardManager<string, string>()
    cm.copy(graph, new Set(['a']), positions)
    const result = cm.paste(graph, positions)!
    const newId = result.pastedNodeIds[0]!
    const newPos = result.positionUpdates.get(newId)!
    expect(newPos.x).toBe(50) // 0 + 50
    expect(newPos.y).toBe(50) // 0 + 50
  })

  it('paste with custom offset', () => {
    const cm = createClipboardManager<string, string>()
    cm.copy(graph, new Set(['b']), positions)
    const result = cm.paste(graph, positions, { x: 20, y: 30 })!
    const newId = result.pastedNodeIds[0]!
    const newPos = result.positionUpdates.get(newId)!
    expect(newPos.x).toBe(120) // 100 + 20
    expect(newPos.y).toBe(30) // 0 + 30
  })

  it('external edges are not copied', () => {
    const cm = createClipboardManager<string, string>()
    // Select only 'b' — edges e1 (a→b) and e2 (b→c) are both external
    cm.copy(graph, new Set(['b']), positions)
    const result = cm.paste(graph, positions)!
    const newEdges = result.graph.edges.filter((e) => !graph.edges.some((orig) => orig.id === e.id))
    expect(newEdges).toHaveLength(0)
  })

  it('paste preserves original graph nodes and edges', () => {
    const cm = createClipboardManager<string, string>()
    cm.copy(graph, new Set(['a']), positions)
    const result = cm.paste(graph, positions)!
    // Original nodes should still be there
    expect(result.graph.nodes.filter((n) => n.id === 'a')).toHaveLength(1)
    expect(result.graph.nodes.filter((n) => n.id === 'b')).toHaveLength(1)
    expect(result.graph.nodes.filter((n) => n.id === 'c')).toHaveLength(1)
    // Plus one new node
    expect(result.graph.nodes).toHaveLength(4)
  })
})
