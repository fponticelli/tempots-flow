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
  connectedPorts,
  duplicate,
  outgoingNodes,
  incomingNodes,
  topologicalSort,
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

describe('connectedPorts', () => {
  it('returns ports connected to a source port', () => {
    const g = makeGraph()
    const result = connectedPorts(g, { nodeId: 'a', portId: 'out' })
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({ nodeId: 'b', portId: 'in' })
  })

  it('returns ports connected to a target port', () => {
    const g = makeGraph()
    const result = connectedPorts(g, { nodeId: 'b', portId: 'in' })
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({ nodeId: 'a', portId: 'out' })
  })

  it('returns empty array for unconnected port', () => {
    const g = makeGraph()
    const result = connectedPorts(g, { nodeId: 'c', portId: 'out' })
    expect(result).toHaveLength(0)
  })
})

describe('outgoingNodes', () => {
  it('returns nodes connected via outgoing edges', () => {
    const g = makeGraph()
    const result = outgoingNodes(g, 'a')
    expect(result).toHaveLength(1)
    expect(result[0]?.id).toBe('b')
  })

  it('returns empty for sink node', () => {
    const g = makeGraph()
    expect(outgoingNodes(g, 'c')).toHaveLength(0)
  })

  it('returns multiple outgoing nodes', () => {
    const g: Graph<string, string> = {
      nodes: [
        { id: 'a', data: 'A', ports: [{ id: 'out', direction: 'output' }] },
        { id: 'b', data: 'B', ports: [{ id: 'in', direction: 'input' }] },
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
          source: { nodeId: 'a', portId: 'out' },
          target: { nodeId: 'c', portId: 'in' },
          direction: 'forward',
        },
      ],
    }
    const result = outgoingNodes(g, 'a')
    expect(result).toHaveLength(2)
    expect(result.map((n) => n.id).sort()).toEqual(['b', 'c'])
  })
})

describe('incomingNodes', () => {
  it('returns nodes connected via incoming edges', () => {
    const g = makeGraph()
    const result = incomingNodes(g, 'b')
    expect(result).toHaveLength(1)
    expect(result[0]?.id).toBe('a')
  })

  it('returns empty for source node', () => {
    const g = makeGraph()
    expect(incomingNodes(g, 'a')).toHaveLength(0)
  })
})

describe('duplicate', () => {
  it('duplicates nodes with new IDs', () => {
    const g = makeGraph()
    let counter = 0
    const result = duplicate(g, new Set(['a', 'b']), () => `new-${counter++}`)
    expect(result.graph.nodes).toHaveLength(5)
    expect(result.idMap.size).toBe(2)
    expect(result.graph.nodes.find((n) => n.id === result.idMap.get('a'))?.data).toBe('A')
    expect(result.graph.nodes.find((n) => n.id === result.idMap.get('b'))?.data).toBe('B')
  })

  it('duplicates internal edges between selected nodes', () => {
    const g = makeGraph()
    let counter = 0
    const result = duplicate(g, new Set(['a', 'b']), () => `new-${counter++}`)
    // Original edge e1: a->b is internal, so it should be duplicated
    // Edge e2: b->c has target outside selection, so not duplicated
    const newEdges = result.graph.edges.filter((e) => !g.edges.some((orig) => orig.id === e.id))
    expect(newEdges).toHaveLength(1)
    expect(newEdges[0]?.source.nodeId).toBe(result.idMap.get('a'))
    expect(newEdges[0]?.target.nodeId).toBe(result.idMap.get('b'))
  })

  it('remaps parentId when parent is duplicated', () => {
    const g: Graph<string, string> = {
      nodes: [
        { id: 'parent', data: 'P', ports: [] },
        { id: 'child', data: 'C', ports: [], parentId: 'parent' },
      ],
      edges: [],
    }
    let counter = 0
    const result = duplicate(g, new Set(['parent', 'child']), () => `dup-${counter++}`)
    const newChild = result.graph.nodes.find((n) => n.id === result.idMap.get('child'))
    expect(newChild?.parentId).toBe(result.idMap.get('parent'))
  })

  it('preserves original parentId when parent not in selection', () => {
    const g: Graph<string, string> = {
      nodes: [
        { id: 'parent', data: 'P', ports: [] },
        { id: 'child', data: 'C', ports: [], parentId: 'parent' },
      ],
      edges: [],
    }
    let counter = 0
    const result = duplicate(g, new Set(['child']), () => `dup-${counter++}`)
    const newChild = result.graph.nodes.find((n) => n.id === result.idMap.get('child'))
    expect(newChild?.parentId).toBe('parent')
  })
})

describe('topologicalSort', () => {
  it('returns topological order for a DAG', () => {
    const g = makeGraph()
    const result = topologicalSort(g)
    expect(result).not.toBeNull()
    expect(result).toHaveLength(3)
    // a must come before b, b must come before c
    const indices = new Map(result!.map((id, i) => [id, i]))
    expect(indices.get('a')!).toBeLessThan(indices.get('b')!)
    expect(indices.get('b')!).toBeLessThan(indices.get('c')!)
  })

  it('returns null for a cyclic graph', () => {
    const g: Graph<string, string> = {
      nodes: [
        { id: 'a', data: 'A', ports: [] },
        { id: 'b', data: 'B', ports: [] },
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
          target: { nodeId: 'a', portId: 'in' },
          direction: 'forward',
        },
      ],
    }
    expect(topologicalSort(g)).toBeNull()
  })

  it('handles disconnected nodes', () => {
    const g: Graph<string, string> = {
      nodes: [
        { id: 'a', data: 'A', ports: [] },
        { id: 'b', data: 'B', ports: [] },
        { id: 'c', data: 'C', ports: [] },
      ],
      edges: [],
    }
    const result = topologicalSort(g)
    expect(result).not.toBeNull()
    expect(result).toHaveLength(3)
  })

  it('handles empty graph', () => {
    const g: Graph<string, string> = { nodes: [], edges: [] }
    const result = topologicalSort(g)
    expect(result).toEqual([])
  })
})
