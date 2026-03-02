import { describe, it, expect } from 'vitest'
import { forceDirectedLayout } from '../../src/layout/force'
import type { Graph, GraphNode, GraphEdge } from '../../src/types/graph'
import type { Dimensions, Position } from '../../src/types/layout'

// --- Test helpers ---

function node(id: string): GraphNode<string> {
  return { id, data: id, ports: [] }
}

function edge(id: string, sourceNodeId: string, targetNodeId: string): GraphEdge<string> {
  return {
    id,
    data: id,
    source: { nodeId: sourceNodeId, portId: 'out' },
    target: { nodeId: targetNodeId, portId: 'in' },
    direction: 'forward',
  }
}

function graph(
  nodes: readonly GraphNode<string>[],
  edges: readonly GraphEdge<string>[] = [],
): Graph<string, string> {
  return { nodes, edges }
}

function uniformDimensions(
  nodeIds: readonly string[],
  width = 180,
  height = 80,
): ReadonlyMap<string, Dimensions> {
  return new Map(nodeIds.map((id) => [id, { width, height }]))
}

const emptyPositions: ReadonlyMap<string, Position> = new Map()

function dist(a: Position, b: Position): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2)
}

describe('forceDirectedLayout', () => {
  it('returns an empty map for an empty graph', () => {
    const layout = forceDirectedLayout()
    const positions = layout.layout(graph([]), new Map(), emptyPositions)
    expect(positions.size).toBe(0)
  })

  it('positions a single node near the origin', () => {
    const layout = forceDirectedLayout({ maxIterations: 100 })
    const g = graph([node('A')])
    const dims = uniformDimensions(['A'])
    const positions = layout.layout(g, dims, emptyPositions)

    const pos = positions.get('A')!
    // Gravity pulls single node toward origin
    expect(Math.abs(pos.x)).toBeLessThan(50)
    expect(Math.abs(pos.y)).toBeLessThan(50)
  })

  it('places connected nodes closer than disconnected nodes', () => {
    const layout = forceDirectedLayout({ maxIterations: 200 })
    const g = graph(
      [node('A'), node('B'), node('C')],
      [edge('e1', 'A', 'B')], // A-B connected, C disconnected
    )
    const dims = uniformDimensions(['A', 'B', 'C'])
    const positions = layout.layout(g, dims, emptyPositions)

    const posA = positions.get('A')!
    const posB = positions.get('B')!
    const posC = positions.get('C')!

    const distAB = dist(posA, posB)
    const distAC = dist(posA, posC)
    const distBC = dist(posB, posC)

    // Connected A-B should be closer than at least one disconnected pair
    expect(distAB).toBeLessThan(Math.max(distAC, distBC))
  })

  it('spreads nodes apart without overlapping in a linear chain', () => {
    const layout = forceDirectedLayout({ maxIterations: 500 })
    const g = graph([node('A'), node('B'), node('C')], [edge('e1', 'A', 'B'), edge('e2', 'B', 'C')])
    const dims = uniformDimensions(['A', 'B', 'C'])
    const positions = layout.layout(g, dims, emptyPositions)

    const posA = positions.get('A')!
    const posB = positions.get('B')!
    const posC = positions.get('C')!

    // All pairs should have meaningful separation (no overlapping)
    const minSep = 100 // nodes are 180x80, should be well separated
    expect(dist(posA, posB)).toBeGreaterThan(minSep)
    expect(dist(posB, posC)).toBeGreaterThan(minSep)
    expect(dist(posA, posC)).toBeGreaterThan(minSep)
  })

  it('keeps pinned nodes at their starting positions', () => {
    const startPositions = new Map<string, Position>([
      ['A', { x: 100, y: 200 }],
      ['B', { x: 300, y: 400 }],
    ])

    const layout = forceDirectedLayout({
      maxIterations: 200,
      pinned: new Set(['A']),
    })

    const g = graph([node('A'), node('B')], [edge('e1', 'A', 'B')])
    const dims = uniformDimensions(['A', 'B'])
    const positions = layout.layout(g, dims, startPositions)

    const posA = positions.get('A')!
    // Pinned node should remain exactly at its start position
    expect(posA.x).toBe(100)
    expect(posA.y).toBe(200)

    // B should have moved (not pinned)
    const posB = positions.get('B')!
    expect(posB.x !== 300 || posB.y !== 400).toBe(true)
  })

  it('uses currentPositions as warm start', () => {
    const warmPositions = new Map<string, Position>([
      ['A', { x: 500, y: 500 }],
      ['B', { x: 510, y: 510 }],
    ])

    const layout = forceDirectedLayout({ maxIterations: 5 })
    const g = graph([node('A'), node('B')], [edge('e1', 'A', 'B')])
    const dims = uniformDimensions(['A', 'B'])
    const positions = layout.layout(g, dims, warmPositions)

    const posA = positions.get('A')!
    const posB = positions.get('B')!

    // With only 5 iterations, nodes should still be in the vicinity of their warm start
    // (not reset to origin or random circle)
    expect(Math.abs(posA.x)).toBeGreaterThan(100)
    expect(Math.abs(posB.x)).toBeGreaterThan(100)
  })

  it('converges to stable positions with enough iterations', () => {
    const layout = forceDirectedLayout({
      maxIterations: 500,
      convergenceThreshold: 0.1,
    })
    const g = graph([node('A'), node('B'), node('C')], [edge('e1', 'A', 'B'), edge('e2', 'B', 'C')])
    const dims = uniformDimensions(['A', 'B', 'C'])
    const positions = layout.layout(g, dims, emptyPositions)

    // Run again with the result as warm start — should barely change
    const layout2 = forceDirectedLayout({
      maxIterations: 50,
      convergenceThreshold: 0.1,
    })
    const positions2 = layout2.layout(g, dims, positions)

    for (const id of ['A', 'B', 'C']) {
      const p1 = positions.get(id)!
      const p2 = positions2.get(id)!
      expect(dist(p1, p2)).toBeLessThan(20)
    }
  })

  it('returns positions for all nodes', () => {
    const layout = forceDirectedLayout({ maxIterations: 50 })
    const g = graph(
      [node('A'), node('B'), node('C'), node('D')],
      [edge('e1', 'A', 'B'), edge('e2', 'C', 'D')],
    )
    const dims = uniformDimensions(['A', 'B', 'C', 'D'])
    const positions = layout.layout(g, dims, emptyPositions)

    expect(positions.size).toBe(4)
    expect(positions.has('A')).toBe(true)
    expect(positions.has('B')).toBe(true)
    expect(positions.has('C')).toBe(true)
    expect(positions.has('D')).toBe(true)
  })

  it('has allowManualPositioning set to true', () => {
    const layout = forceDirectedLayout()
    expect(layout.allowManualPositioning).toBe(true)
  })
})
