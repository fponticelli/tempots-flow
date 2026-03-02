import { describe, it, expect } from 'vitest'
import { treeLayout } from '../../src/layout/tree'
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

describe('treeLayout', () => {
  it('returns an empty map for an empty graph', () => {
    const layout = treeLayout()
    const positions = layout.layout(graph([]), new Map(), emptyPositions)
    expect(positions.size).toBe(0)
  })

  it('positions a single node', () => {
    const layout = treeLayout({ direction: 'TB' })
    const g = graph([node('A')])
    const dims = uniformDimensions(['A'])
    const positions = layout.layout(g, dims, emptyPositions)

    expect(positions.size).toBe(1)
    expect(positions.has('A')).toBe(true)
  })

  it('lays out a linear chain with TB direction — Y increases per level', () => {
    const layout = treeLayout({ direction: 'TB' })
    const g = graph([node('A'), node('B'), node('C')], [edge('e1', 'A', 'B'), edge('e2', 'B', 'C')])
    const dims = uniformDimensions(['A', 'B', 'C'])
    const positions = layout.layout(g, dims, emptyPositions)

    const posA = positions.get('A')!
    const posB = positions.get('B')!
    const posC = positions.get('C')!

    // TB: Y increases per level
    expect(posA.y).toBeLessThan(posB.y)
    expect(posB.y).toBeLessThan(posC.y)

    // All same X (single child chain — centered)
    expect(posA.x).toBeCloseTo(posB.x, 5)
    expect(posB.x).toBeCloseTo(posC.x, 5)
  })

  it('lays out a binary tree — children spread along X in TB mode', () => {
    const layout = treeLayout({ direction: 'TB' })
    const g = graph(
      [node('R'), node('L'), node('RR')],
      [edge('e1', 'R', 'L'), edge('e2', 'R', 'RR')],
    )
    const dims = uniformDimensions(['R', 'L', 'RR'])
    const positions = layout.layout(g, dims, emptyPositions)

    const posR = positions.get('R')!
    const posL = positions.get('L')!
    const posRR = positions.get('RR')!

    // Root above children
    expect(posR.y).toBeLessThan(posL.y)
    expect(posR.y).toBeLessThan(posRR.y)

    // Children at same Y level
    expect(posL.y).toBeCloseTo(posRR.y, 5)

    // Children at different X positions
    expect(posL.x).not.toBeCloseTo(posRR.x, 5)

    // Parent centered over children
    const midChildX = (posL.x + posRR.x) / 2
    expect(posR.x).toBeCloseTo(midChildX, 1)
  })

  it('TB direction: Y increases per level, X varies within level', () => {
    const layout = treeLayout({ direction: 'TB' })
    const g = graph([node('A'), node('B'), node('C')], [edge('e1', 'A', 'B'), edge('e2', 'A', 'C')])
    const dims = uniformDimensions(['A', 'B', 'C'])
    const positions = layout.layout(g, dims, emptyPositions)

    const posA = positions.get('A')!
    const posB = positions.get('B')!
    const posC = positions.get('C')!

    expect(posA.y).toBeLessThan(posB.y)
    expect(posB.y).toBeCloseTo(posC.y, 5)
    expect(posB.x).not.toBeCloseTo(posC.x, 5)
  })

  it('LR direction: X increases per level, Y varies within level', () => {
    const layout = treeLayout({ direction: 'LR' })
    const g = graph([node('A'), node('B'), node('C')], [edge('e1', 'A', 'B'), edge('e2', 'A', 'C')])
    const dims = uniformDimensions(['A', 'B', 'C'])
    const positions = layout.layout(g, dims, emptyPositions)

    const posA = positions.get('A')!
    const posB = positions.get('B')!
    const posC = positions.get('C')!

    expect(posA.x).toBeLessThan(posB.x)
    expect(posB.x).toBeCloseTo(posC.x, 5)
    expect(posB.y).not.toBeCloseTo(posC.y, 5)
  })

  it('RL direction: X decreases per level (mirror of LR)', () => {
    const layout = treeLayout({ direction: 'RL' })
    const g = graph([node('A'), node('B'), node('C')], [edge('e1', 'A', 'B'), edge('e2', 'B', 'C')])
    const dims = uniformDimensions(['A', 'B', 'C'])
    const positions = layout.layout(g, dims, emptyPositions)

    const posA = positions.get('A')!
    const posB = positions.get('B')!
    const posC = positions.get('C')!

    expect(posA.x).toBeGreaterThan(posB.x)
    expect(posB.x).toBeGreaterThan(posC.x)
  })

  it('BT direction: Y decreases per level (mirror of TB)', () => {
    const layout = treeLayout({ direction: 'BT' })
    const g = graph([node('A'), node('B'), node('C')], [edge('e1', 'A', 'B'), edge('e2', 'B', 'C')])
    const dims = uniformDimensions(['A', 'B', 'C'])
    const positions = layout.layout(g, dims, emptyPositions)

    const posA = positions.get('A')!
    const posB = positions.get('B')!
    const posC = positions.get('C')!

    expect(posA.y).toBeGreaterThan(posB.y)
    expect(posB.y).toBeGreaterThan(posC.y)
  })

  it('rootId overrides automatic root detection', () => {
    const layout = treeLayout({ direction: 'TB', rootId: 'B' })
    const g = graph([node('A'), node('B'), node('C')], [edge('e1', 'A', 'B'), edge('e2', 'B', 'C')])
    const dims = uniformDimensions(['A', 'B', 'C'])
    const positions = layout.layout(g, dims, emptyPositions)

    const posB = positions.get('B')!
    const posC = positions.get('C')!

    // B should be at the root level (smallest Y in TB)
    expect(posB.y).toBeLessThan(posC.y)
  })

  it('multiRootStrategy stack: separate trees stacked with gap', () => {
    const layout = treeLayout({
      direction: 'TB',
      multiRootStrategy: 'stack',
      subtreeSpacing: 100,
    })
    const g = graph(
      [node('R1'), node('C1'), node('R2'), node('C2')],
      [edge('e1', 'R1', 'C1'), edge('e2', 'R2', 'C2')],
    )
    const dims = uniformDimensions(['R1', 'C1', 'R2', 'C2'])
    const positions = layout.layout(g, dims, emptyPositions)

    const posR1 = positions.get('R1')!
    const posR2 = positions.get('R2')!

    // Both roots at level 0 (same Y)
    expect(posR1.y).toBeCloseTo(posR2.y, 5)

    // Stacked along X with gap
    expect(posR1.x).not.toBeCloseTo(posR2.x, 5)
  })

  it('multiRootStrategy super-root: all roots treated as siblings', () => {
    const layout = treeLayout({
      direction: 'TB',
      multiRootStrategy: 'super-root',
    })
    const g = graph(
      [node('R1'), node('C1'), node('R2'), node('C2')],
      [edge('e1', 'R1', 'C1'), edge('e2', 'R2', 'C2')],
    )
    const dims = uniformDimensions(['R1', 'C1', 'R2', 'C2'])
    const positions = layout.layout(g, dims, emptyPositions)

    // All 4 nodes should be positioned
    expect(positions.size).toBe(4)

    const posR1 = positions.get('R1')!
    const posR2 = positions.get('R2')!

    // Both roots at the same level
    expect(posR1.y).toBeCloseTo(posR2.y, 5)
  })

  it('siblingSpacing controls gap between siblings', () => {
    const narrow = treeLayout({ direction: 'TB', siblingSpacing: 10 })
    const wide = treeLayout({ direction: 'TB', siblingSpacing: 200 })

    const g = graph([node('A'), node('B'), node('C')], [edge('e1', 'A', 'B'), edge('e2', 'A', 'C')])
    const dims = uniformDimensions(['A', 'B', 'C'])

    const posNarrow = narrow.layout(g, dims, emptyPositions)
    const posWide = wide.layout(g, dims, emptyPositions)

    const gapNarrow = Math.abs(posNarrow.get('C')!.x - posNarrow.get('B')!.x)
    const gapWide = Math.abs(posWide.get('C')!.x - posWide.get('B')!.x)

    expect(gapWide).toBeGreaterThan(gapNarrow)
  })

  it('levelSpacing controls gap between levels', () => {
    const narrow = treeLayout({ direction: 'TB', levelSpacing: 50 })
    const wide = treeLayout({ direction: 'TB', levelSpacing: 300 })

    const g = graph([node('A'), node('B')], [edge('e1', 'A', 'B')])
    const dims = uniformDimensions(['A', 'B'])

    const posNarrow = narrow.layout(g, dims, emptyPositions)
    const posWide = wide.layout(g, dims, emptyPositions)

    const gapNarrow = Math.abs(posNarrow.get('B')!.y - posNarrow.get('A')!.y)
    const gapWide = Math.abs(posWide.get('B')!.y - posWide.get('A')!.y)

    expect(gapWide).toBeGreaterThan(gapNarrow)
  })

  it('handles cycles without crashing', () => {
    const layout = treeLayout({ direction: 'TB' })
    // A -> B -> C -> A (cycle)
    const g = graph(
      [node('A'), node('B'), node('C')],
      [edge('e1', 'A', 'B'), edge('e2', 'B', 'C'), edge('e3', 'C', 'A')],
    )
    const dims = uniformDimensions(['A', 'B', 'C'])
    const positions = layout.layout(g, dims, emptyPositions)

    // All nodes should be positioned (no crash)
    expect(positions.size).toBe(3)
    expect(positions.has('A')).toBe(true)
    expect(positions.has('B')).toBe(true)
    expect(positions.has('C')).toBe(true)
  })

  it('returns positions for all nodes including disconnected ones', () => {
    const layout = treeLayout({ direction: 'TB' })
    const g = graph(
      [node('A'), node('B'), node('C'), node('D')],
      [edge('e1', 'A', 'B')], // C and D are disconnected
    )
    const dims = uniformDimensions(['A', 'B', 'C', 'D'])
    const positions = layout.layout(g, dims, emptyPositions)

    expect(positions.size).toBe(4)
    expect(positions.has('A')).toBe(true)
    expect(positions.has('B')).toBe(true)
    expect(positions.has('C')).toBe(true)
    expect(positions.has('D')).toBe(true)
  })
})
