import { describe, it, expect } from 'vitest'
import {
  serializeView,
  deserializeView,
  serializeGraph,
  deserializeGraph,
} from '../../src/core/serialization'
import type { GraphSerializer, SerializedGraph } from '../../src/core/serialization'
import type { Graph } from '../../src/types/graph'
import type { Position, Viewport } from '../../src/types/layout'

describe('serializeView / deserializeView', () => {
  it('round-trips positions and viewport', () => {
    const positions = new Map<string, Position>([
      ['a', { x: 10, y: 20 }],
      ['b', { x: 30, y: 40 }],
    ])
    const viewport: Viewport = { x: 5, y: 10, zoom: 1.5 }

    const snapshot = serializeView(positions, viewport)
    expect(snapshot.version).toBe(1)
    expect(snapshot.positions['a']).toEqual({ x: 10, y: 20 })
    expect(snapshot.viewport).toEqual(viewport)

    const restored = deserializeView(snapshot)
    expect(restored.positions.get('a')).toEqual({ x: 10, y: 20 })
    expect(restored.positions.get('b')).toEqual({ x: 30, y: 40 })
    expect(restored.viewport).toEqual(viewport)
  })

  it('handles empty positions', () => {
    const positions = new Map<string, Position>()
    const viewport: Viewport = { x: 0, y: 0, zoom: 1 }
    const snapshot = serializeView(positions, viewport)
    const restored = deserializeView(snapshot)
    expect(restored.positions.size).toBe(0)
    expect(restored.viewport).toEqual(viewport)
  })
})

describe('serializeGraph / deserializeGraph', () => {
  const graph: Graph<string, number> = {
    nodes: [
      { id: 'a', data: 'hello', ports: [{ id: 'out', direction: 'output', label: 'Out' }] },
      {
        id: 'b',
        data: 'world',
        ports: [{ id: 'in', direction: 'input' }],
        parentId: 'group1',
      },
    ],
    edges: [
      {
        id: 'e1',
        data: 42,
        source: { nodeId: 'a', portId: 'out' },
        target: { nodeId: 'b', portId: 'in' },
        direction: 'forward',
      },
    ],
  }

  const serializer: GraphSerializer<string, number> = {
    serializeNodeData: (d) => d.toUpperCase(),
    deserializeNodeData: (d) => (d as string).toLowerCase(),
    serializeEdgeData: (d) => String(d),
    deserializeEdgeData: (d) => Number(d),
  }

  it('serializes graph with custom serializer', () => {
    const result = serializeGraph(graph, serializer)
    expect(result.version).toBe(1)
    expect(result.nodes).toHaveLength(2)
    expect(result.nodes[0]?.data).toBe('HELLO')
    expect(result.nodes[1]?.data).toBe('WORLD')
    expect(result.nodes[1]?.parentId).toBe('group1')
    expect(result.edges[0]?.data).toBe('42')
  })

  it('round-trips with custom serializer', () => {
    const serialized = serializeGraph(graph, serializer)
    const restored = deserializeGraph(serialized, serializer)
    expect(restored.nodes).toHaveLength(2)
    expect(restored.nodes[0]?.data).toBe('hello')
    expect(restored.nodes[1]?.data).toBe('world')
    expect(restored.nodes[1]?.parentId).toBe('group1')
    expect(restored.edges[0]?.data).toBe(42)
    expect(restored.edges[0]?.source).toEqual({ nodeId: 'a', portId: 'out' })
    expect(restored.edges[0]?.target).toEqual({ nodeId: 'b', portId: 'in' })
    expect(restored.edges[0]?.direction).toBe('forward')
  })

  it('serializes without custom serializer (identity)', () => {
    const simpleGraph: Graph<string, string> = {
      nodes: [{ id: 'x', data: 'test', ports: [] }],
      edges: [],
    }
    const result = serializeGraph(simpleGraph)
    expect(result.nodes[0]?.data).toBe('test')
  })

  it('preserves port definitions through serialization', () => {
    const serialized = serializeGraph(graph, serializer)
    const restored = deserializeGraph(serialized, serializer)
    expect(restored.nodes[0]?.ports).toEqual([{ id: 'out', direction: 'output', label: 'Out' }])
  })

  it('omits parentId when not present', () => {
    const serialized = serializeGraph(graph, serializer)
    expect(serialized.nodes[0]?.parentId).toBeUndefined()
    expect(serialized.nodes[1]?.parentId).toBe('group1')
  })

  it('deserializes from JSON-compatible format', () => {
    const json: SerializedGraph = {
      version: 1,
      nodes: [{ id: 'n1', data: 'DATA', ports: [] }],
      edges: [],
    }
    const result = deserializeGraph(json, {
      serializeNodeData: (d) => d,
      deserializeNodeData: (d) => (d as string).toLowerCase(),
      serializeEdgeData: (d) => d,
      deserializeEdgeData: (d) => d as string,
    })
    expect(result.nodes[0]?.data).toBe('data')
  })
})
