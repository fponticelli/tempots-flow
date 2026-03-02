import { describe, it, expect } from 'vitest'
import type { Graph, GraphNode } from '../../src/types/graph'
import type { Position, Dimensions } from '../../src/types/layout'
import {
  getChildIds,
  getDescendantIds,
  getParentIds,
  getGroupBounds,
  expandGroupDragIds,
} from '../../src/layout/compound-utils'
import { groupNodes, ungroupNodes } from '../../src/core/graph-mutations'
import { validHierarchy } from '../../src/validators/index'

function node(id: string, parentId?: string): GraphNode<string> {
  return { id, data: id, ports: [], ...(parentId ? { parentId } : {}) }
}

// --- Compound utils ---

describe('getChildIds', () => {
  it('returns direct children only', () => {
    const nodes = [
      node('root'),
      node('a', 'root'),
      node('b', 'root'),
      node('c', 'a'), // grandchild of root
    ]
    expect(getChildIds('root', nodes)).toEqual(['a', 'b'])
  })

  it('returns empty array when no children', () => {
    const nodes = [node('root'), node('other')]
    expect(getChildIds('root', nodes)).toEqual([])
  })
})

describe('getDescendantIds', () => {
  it('returns all descendants including nested', () => {
    const nodes = [
      node('root'),
      node('a', 'root'),
      node('b', 'root'),
      node('c', 'a'),
      node('d', 'c'),
    ]
    const descendants = getDescendantIds('root', nodes)
    expect(descendants).toHaveLength(4)
    expect(new Set(descendants)).toEqual(new Set(['a', 'b', 'c', 'd']))
  })

  it('returns empty array for leaf nodes', () => {
    const nodes = [node('root'), node('a', 'root')]
    expect(getDescendantIds('a', nodes)).toEqual([])
  })
})

describe('getParentIds', () => {
  it('identifies nodes that have children', () => {
    const nodes = [node('root'), node('a', 'root'), node('b', 'root'), node('c', 'a')]
    const parents = getParentIds(nodes)
    expect(parents).toEqual(new Set(['root', 'a']))
  })

  it('returns empty set when no hierarchy', () => {
    const nodes = [node('a'), node('b')]
    expect(getParentIds(nodes)).toEqual(new Set())
  })
})

describe('getGroupBounds', () => {
  it('computes correct bounding box with padding', () => {
    const positions: ReadonlyMap<string, Position> = new Map([
      ['a', { x: 10, y: 20 }],
      ['b', { x: 50, y: 60 }],
    ])
    const dimensions: ReadonlyMap<string, Dimensions> = new Map([
      ['a', { width: 100, height: 40 }],
      ['b', { width: 80, height: 30 }],
    ])
    const bounds = getGroupBounds(['a', 'b'], positions, dimensions, 10)
    expect(bounds).toEqual({
      x: 0, // 10 - 10
      y: 10, // 20 - 10
      width: 140, // (130 - 10) + 20
      height: 90, // (90 - 20) + 20
    })
  })

  it('returns null when no positions found', () => {
    const positions: ReadonlyMap<string, Position> = new Map()
    const dimensions: ReadonlyMap<string, Dimensions> = new Map()
    const bounds = getGroupBounds(['a', 'b'], positions, dimensions, 10)
    expect(bounds).toBeNull()
  })

  it('handles nodes without dimensions as zero-size', () => {
    const positions: ReadonlyMap<string, Position> = new Map([['a', { x: 10, y: 20 }]])
    const dimensions: ReadonlyMap<string, Dimensions> = new Map()
    const bounds = getGroupBounds(['a'], positions, dimensions, 5)
    expect(bounds).toEqual({
      x: 5, // 10 - 5
      y: 15, // 20 - 5
      width: 10, // 0 + 10
      height: 10, // 0 + 10
    })
  })
})

describe('expandGroupDragIds', () => {
  it('includes descendants of group containers', () => {
    const nodes = [node('root'), node('a', 'root'), node('b', 'root'), node('c', 'a')]
    const expanded = expandGroupDragIds(['root'], nodes)
    expect(new Set(expanded)).toEqual(new Set(['root', 'a', 'b', 'c']))
  })

  it('deduplicates when child is already in drag set', () => {
    const nodes = [node('root'), node('a', 'root'), node('b', 'root')]
    const expanded = expandGroupDragIds(['root', 'a'], nodes)
    expect(expanded).toHaveLength(3)
    expect(new Set(expanded)).toEqual(new Set(['root', 'a', 'b']))
  })

  it('returns same ids for leaf nodes', () => {
    const nodes = [node('a'), node('b')]
    const expanded = expandGroupDragIds(['a'], nodes)
    expect(expanded).toEqual(['a'])
  })
})

// --- Graph mutations ---

describe('groupNodes', () => {
  it('adds group node and sets parentId on children', () => {
    const graph: Graph<string, string> = {
      nodes: [node('a'), node('b'), node('c')],
      edges: [],
    }
    const group = node('g')
    const result = groupNodes(graph, ['a', 'b'], group)

    expect(result.nodes).toHaveLength(4)
    expect(result.nodes.find((n) => n.id === 'g')).toBeDefined()
    expect(result.nodes.find((n) => n.id === 'a')?.parentId).toBe('g')
    expect(result.nodes.find((n) => n.id === 'b')?.parentId).toBe('g')
    expect(result.nodes.find((n) => n.id === 'c')?.parentId).toBeUndefined()
  })

  it('preserves existing edges', () => {
    const graph: Graph<string, string> = {
      nodes: [node('a'), node('b')],
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
    const result = groupNodes(graph, ['a', 'b'], node('g'))
    expect(result.edges).toHaveLength(1)
  })
})

describe('ungroupNodes', () => {
  it('removes group node and clears parentId on direct children', () => {
    const graph: Graph<string, string> = {
      nodes: [node('g'), node('a', 'g'), node('b', 'g'), node('c')],
      edges: [],
    }
    const result = ungroupNodes(graph, 'g')

    expect(result.nodes).toHaveLength(3)
    expect(result.nodes.find((n) => n.id === 'g')).toBeUndefined()
    expect(result.nodes.find((n) => n.id === 'a')?.parentId).toBeUndefined()
    expect(result.nodes.find((n) => n.id === 'b')?.parentId).toBeUndefined()
    expect(result.nodes.find((n) => n.id === 'c')?.parentId).toBeUndefined()
  })

  it('removes edges connected to the group node', () => {
    const graph: Graph<string, string> = {
      nodes: [node('g'), node('a', 'g'), node('b')],
      edges: [
        {
          id: 'e1',
          data: '',
          source: { nodeId: 'g', portId: 'out' },
          target: { nodeId: 'b', portId: 'in' },
          direction: 'forward',
        },
        {
          id: 'e2',
          data: '',
          source: { nodeId: 'a', portId: 'out' },
          target: { nodeId: 'b', portId: 'in' },
          direction: 'forward',
        },
      ],
    }
    const result = ungroupNodes(graph, 'g')
    expect(result.edges).toHaveLength(1)
    expect(result.edges[0]?.id).toBe('e2')
  })

  it('does not affect nodes parented to other groups', () => {
    const graph: Graph<string, string> = {
      nodes: [node('g1'), node('g2'), node('a', 'g1'), node('b', 'g2')],
      edges: [],
    }
    const result = ungroupNodes(graph, 'g1')
    expect(result.nodes.find((n) => n.id === 'b')?.parentId).toBe('g2')
  })
})

// --- Validator ---

describe('validHierarchy', () => {
  it('passes for valid hierarchy', () => {
    const graph: Graph<string, string> = {
      nodes: [node('root'), node('a', 'root'), node('b', 'root')],
      edges: [],
    }
    const diagnostics = validHierarchy()(graph)
    expect(diagnostics).toHaveLength(0)
  })

  it('passes for flat graph with no parents', () => {
    const graph: Graph<string, string> = {
      nodes: [node('a'), node('b'), node('c')],
      edges: [],
    }
    const diagnostics = validHierarchy()(graph)
    expect(diagnostics).toHaveLength(0)
  })

  it('detects missing parent references', () => {
    const graph: Graph<string, string> = {
      nodes: [node('a', 'nonexistent')],
      edges: [],
    }
    const diagnostics = validHierarchy()(graph)
    expect(diagnostics).toHaveLength(1)
    expect(diagnostics[0]?.severity).toBe('error')
    expect(diagnostics[0]?.message).toContain('non-existent parent')
    expect(diagnostics[0]?.target).toEqual({ kind: 'node', nodeId: 'a' })
  })

  it('detects self-references', () => {
    const graph: Graph<string, string> = {
      nodes: [{ id: 'a', data: 'a', ports: [], parentId: 'a' }],
      edges: [],
    }
    const diagnostics = validHierarchy()(graph)
    expect(diagnostics.some((d) => d.message.includes('itself'))).toBe(true)
  })

  it('detects cycles in parent chains', () => {
    const graph: Graph<string, string> = {
      nodes: [node('a', 'b'), node('b', 'a')],
      edges: [],
    }
    const diagnostics = validHierarchy()(graph)
    const cycleErrors = diagnostics.filter((d) => d.message.includes('Cycle'))
    expect(cycleErrors.length).toBeGreaterThan(0)
  })
})
