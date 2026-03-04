import { describe, it, expect } from 'vitest'
import {
  navigateByArrow,
  cycleToNode,
  getFirstNode,
  getLastNode,
} from '../../src/interaction/keyboard-navigation'
import type { Graph } from '../../src/types/graph'
import type { Position } from '../../src/types/layout'

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
  ['b', { x: 200, y: 0 }],
  ['c', { x: 400, y: 0 }],
])

describe('navigateByArrow', () => {
  it('navigates right via outgoing edge', () => {
    const result = navigateByArrow('right', graph, new Set(['a']), positions)
    expect(result).toBe('b')
  })

  it('navigates left via incoming edge', () => {
    const result = navigateByArrow('left', graph, new Set(['b']), positions)
    expect(result).toBe('a')
  })

  it('falls back to spatial for down', () => {
    const pos = new Map([
      ['a', { x: 0, y: 0 }],
      ['b', { x: 0, y: 100 }],
      ['c', { x: 0, y: 200 }],
    ])
    const result = navigateByArrow('down', graph, new Set(['a']), pos)
    expect(result).toBe('b')
  })

  it('falls back to spatial for up', () => {
    const pos = new Map([
      ['a', { x: 0, y: 0 }],
      ['b', { x: 0, y: 100 }],
    ])
    const result = navigateByArrow('up', graph, new Set(['b']), pos)
    expect(result).toBe('a')
  })

  it('returns null when multiple nodes selected', () => {
    const result = navigateByArrow('right', graph, new Set(['a', 'b']), positions)
    expect(result).toBeNull()
  })

  it('returns null when no neighbor in direction', () => {
    const result = navigateByArrow('left', graph, new Set(['a']), positions)
    expect(result).toBeNull()
  })
})

describe('cycleToNode', () => {
  it('cycles forward from selected node', () => {
    const result = cycleToNode('forward', new Set(['a']), positions)
    expect(result).toBe('b')
  })

  it('cycles backward from selected node', () => {
    const result = cycleToNode('backward', new Set(['b']), positions)
    expect(result).toBe('a')
  })

  it('wraps around forward', () => {
    const result = cycleToNode('forward', new Set(['c']), positions)
    expect(result).toBe('a')
  })

  it('wraps around backward', () => {
    const result = cycleToNode('backward', new Set(['a']), positions)
    expect(result).toBe('c')
  })

  it('returns first node when none selected', () => {
    const result = cycleToNode('forward', new Set<string>(), positions)
    expect(result).toBe('a')
  })

  it('returns null for empty positions', () => {
    const result = cycleToNode('forward', new Set<string>(), new Map())
    expect(result).toBeNull()
  })
})

describe('getFirstNode / getLastNode', () => {
  it('returns first node in position order', () => {
    expect(getFirstNode(positions)).toBe('a')
  })

  it('returns last node in position order', () => {
    expect(getLastNode(positions)).toBe('c')
  })

  it('returns null for empty positions', () => {
    expect(getFirstNode(new Map())).toBeNull()
    expect(getLastNode(new Map())).toBeNull()
  })

  it('orders by Y first, then X', () => {
    const pos = new Map([
      ['d', { x: 100, y: 50 }],
      ['e', { x: 0, y: 0 }],
      ['f', { x: 200, y: 0 }],
    ])
    expect(getFirstNode(pos)).toBe('e')
    expect(getLastNode(pos)).toBe('d')
  })
})
