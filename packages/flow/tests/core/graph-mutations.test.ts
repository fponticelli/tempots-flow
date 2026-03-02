import { describe, it, expect } from 'vitest'
import {
  addNode,
  removeNode,
  removeNodes,
  updateNodeData,
  addEdge,
  removeEdge,
  removeEdges,
  connectedEdges,
} from '../../src/core/graph-mutations'
import type { Graph, GraphNode, GraphEdge } from '../../src/types/graph'

function makeGraph(): Graph<string, string> {
  return {
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
}

describe('addNode', () => {
  it('appends a node to the graph', () => {
    const g = makeGraph()
    const node: GraphNode<string> = { id: 'd', data: 'D', ports: [] }
    const result = addNode(g, node)
    expect(result.nodes).toHaveLength(4)
    expect(result.nodes[3]?.id).toBe('d')
    expect(result.edges).toBe(g.edges)
  })
})

describe('removeNode', () => {
  it('removes the node and its connected edges', () => {
    const g = makeGraph()
    const result = removeNode(g, 'b')
    expect(result.nodes).toHaveLength(2)
    expect(result.nodes.find((n) => n.id === 'b')).toBeUndefined()
    expect(result.edges).toHaveLength(0)
  })

  it('only removes edges connected to the removed node', () => {
    const g = makeGraph()
    const result = removeNode(g, 'c')
    expect(result.nodes).toHaveLength(2)
    expect(result.edges).toHaveLength(1)
    expect(result.edges[0]?.id).toBe('e1')
  })
})

describe('removeNodes', () => {
  it('removes multiple nodes at once', () => {
    const g = makeGraph()
    const result = removeNodes(g, new Set(['a', 'c']))
    expect(result.nodes).toHaveLength(1)
    expect(result.nodes[0]?.id).toBe('b')
    expect(result.edges).toHaveLength(0)
  })
})

describe('updateNodeData', () => {
  it('updates the data of a specific node', () => {
    const g = makeGraph()
    const result = updateNodeData(g, 'a', (d) => d.toUpperCase())
    expect(result.nodes[0]?.data).toBe('A')
    expect(result.nodes[1]?.data).toBe('B')
  })

  it('does not modify other nodes', () => {
    const g = makeGraph()
    const result = updateNodeData(g, 'a', () => 'changed')
    expect(result.nodes[0]?.data).toBe('changed')
    expect(result.nodes[1]?.data).toBe('B')
    expect(result.nodes[2]?.data).toBe('C')
  })
})

describe('addEdge', () => {
  it('appends an edge to the graph', () => {
    const g = makeGraph()
    const edge: GraphEdge<string> = {
      id: 'e3',
      data: '',
      source: { nodeId: 'a', portId: 'out' },
      target: { nodeId: 'c', portId: 'in' },
      direction: 'forward',
    }
    const result = addEdge(g, edge)
    expect(result.edges).toHaveLength(3)
    expect(result.nodes).toBe(g.nodes)
  })
})

describe('removeEdge', () => {
  it('removes a single edge by id', () => {
    const g = makeGraph()
    const result = removeEdge(g, 'e1')
    expect(result.edges).toHaveLength(1)
    expect(result.edges[0]?.id).toBe('e2')
  })
})

describe('removeEdges', () => {
  it('removes multiple edges at once', () => {
    const g = makeGraph()
    const result = removeEdges(g, new Set(['e1', 'e2']))
    expect(result.edges).toHaveLength(0)
  })
})

describe('connectedEdges', () => {
  it('returns edges connected to a node', () => {
    const g = makeGraph()
    expect(connectedEdges(g, 'b')).toHaveLength(2)
    expect(connectedEdges(g, 'a')).toHaveLength(1)
    expect(connectedEdges(g, 'c')).toHaveLength(1)
  })

  it('returns empty array for disconnected node', () => {
    const g: Graph<string, string> = {
      nodes: [{ id: 'x', data: 'X', ports: [] }],
      edges: [],
    }
    expect(connectedEdges(g, 'x')).toHaveLength(0)
  })
})
