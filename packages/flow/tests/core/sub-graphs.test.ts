import { describe, it, expect } from 'vitest'
import { collapseToSubGraph, expandSubGraph } from '../../src/core/graph-mutations'
import type { Graph, GraphNode, GraphEdge } from '../../src/types/graph'

function makeGraph(): Graph<string, string> {
  const nodes: GraphNode<string>[] = [
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
    {
      id: 'd',
      data: 'D',
      ports: [
        { id: 'in', direction: 'input' },
        { id: 'out', direction: 'output' },
      ],
    },
  ]
  const edges: GraphEdge<string>[] = [
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
    {
      id: 'e3',
      data: '',
      source: { nodeId: 'b', portId: 'out' },
      target: { nodeId: 'd', portId: 'in' },
      direction: 'forward',
    },
  ]
  return { nodes, edges }
}

describe('collapseToSubGraph', () => {
  it('creates a compound node with inner graph', () => {
    const graph = makeGraph()
    const nodeIds = new Set(['b', 'c'])
    const compoundNode: GraphNode<string> = {
      id: 'compound',
      data: 'Compound',
      ports: [
        { id: 'in', direction: 'input' },
        { id: 'out', direction: 'output' },
      ],
    }

    const result = collapseToSubGraph(graph, nodeIds, compoundNode)

    // Collapsed nodes removed from outer graph
    expect(result.nodes.find((n) => n.id === 'b')).toBeUndefined()
    expect(result.nodes.find((n) => n.id === 'c')).toBeUndefined()

    // Compound node added with subGraph
    const compound = result.nodes.find((n) => n.id === 'compound')
    expect(compound).toBeDefined()
    expect(compound!.subGraph).toBeDefined()
    expect(compound!.subGraph!.innerGraph.nodes).toHaveLength(2)
    expect(compound!.subGraph!.innerGraph.edges).toHaveLength(1) // e2 is internal

    // External edges remapped to compound node
    const externalEdge = result.edges.find((e) => e.id === 'e1')
    expect(externalEdge).toBeDefined()
    expect(externalEdge!.target.nodeId).toBe('compound')

    // Original nodes a and d remain
    expect(result.nodes.find((n) => n.id === 'a')).toBeDefined()
    expect(result.nodes.find((n) => n.id === 'd')).toBeDefined()
  })
})

describe('expandSubGraph', () => {
  it('restores inner nodes and edges', () => {
    const graph = makeGraph()
    const nodeIds = new Set(['b', 'c'])
    const compoundNode: GraphNode<string> = {
      id: 'compound',
      data: 'Compound',
      ports: [
        { id: 'in', direction: 'input' },
        { id: 'out', direction: 'output' },
      ],
    }

    const collapsed = collapseToSubGraph(graph, nodeIds, compoundNode)
    const expanded = expandSubGraph(collapsed, 'compound')

    // Compound node removed
    expect(expanded.nodes.find((n) => n.id === 'compound')).toBeUndefined()

    // Inner nodes restored
    expect(expanded.nodes.find((n) => n.id === 'b')).toBeDefined()
    expect(expanded.nodes.find((n) => n.id === 'c')).toBeDefined()

    // All original nodes present
    expect(expanded.nodes).toHaveLength(4)

    // Inner edge restored
    expect(expanded.edges.find((e) => e.id === 'e2')).toBeDefined()
  })

  it('returns graph unchanged for non-compound node', () => {
    const graph = makeGraph()
    const result = expandSubGraph(graph, 'a')
    expect(result).toBe(graph)
  })
})
