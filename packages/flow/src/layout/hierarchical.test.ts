import { describe, it, expect } from 'vitest'
import { hierarchicalLayout } from './hierarchical'
import type { Graph, GraphNode, GraphEdge } from '../types/graph'
import type { Dimensions, Position } from '../types/layout'

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

describe('hierarchicalLayout', () => {
  // Test 1
  it('should assign linear chain A->B->C to 3 layers with one node each', () => {
    const g = graph([node('A'), node('B'), node('C')], [edge('e1', 'A', 'B'), edge('e2', 'B', 'C')])
    const dims = uniformDimensions(['A', 'B', 'C'])
    const layout = hierarchicalLayout({ direction: 'LR' })
    const positions = layout.layout(g, dims, emptyPositions)

    const posA = positions.get('A')!
    const posB = positions.get('B')!
    const posC = positions.get('C')!

    // LR: X increases per layer, all same Y (single node per layer, centered)
    expect(posA.x).toBeLessThan(posB.x)
    expect(posB.x).toBeLessThan(posC.x)
    expect(posA.y).toBe(posB.y)
    expect(posB.y).toBe(posC.y)
  })

  // Test 2
  it('should assign diamond DAG layers correctly: A=0, B/C=1, D=2', () => {
    const g = graph(
      [node('A'), node('B'), node('C'), node('D')],
      [edge('e1', 'A', 'B'), edge('e2', 'A', 'C'), edge('e3', 'B', 'D'), edge('e4', 'C', 'D')],
    )
    const dims = uniformDimensions(['A', 'B', 'C', 'D'])
    const layout = hierarchicalLayout({ direction: 'LR' })
    const positions = layout.layout(g, dims, emptyPositions)

    const posA = positions.get('A')!
    const posB = positions.get('B')!
    const posC = positions.get('C')!
    const posD = positions.get('D')!

    // A at layer 0, B and C at layer 1, D at layer 2
    expect(posA.x).toBeLessThan(posB.x)
    expect(posB.x).toBeCloseTo(posC.x, 5) // Same layer -> same X
    expect(posB.x).toBeLessThan(posD.x)

    // B and C should be at different Y positions (two nodes in same layer)
    expect(posB.y).not.toBeCloseTo(posC.y, 5)
  })

  // Test 3
  it('should place all disconnected nodes at layer 0', () => {
    const g = graph([node('X'), node('Y'), node('Z')])
    const dims = uniformDimensions(['X', 'Y', 'Z'])
    const layout = hierarchicalLayout({ direction: 'LR' })
    const positions = layout.layout(g, dims, emptyPositions)

    const posX = positions.get('X')!
    const posY = positions.get('Y')!
    const posZ = positions.get('Z')!

    // All at same X (same layer)
    expect(posX.x).toBeCloseTo(posY.x, 5)
    expect(posY.x).toBeCloseTo(posZ.x, 5)

    // But different Y (stacked within layer)
    expect(posX.y).toBeLessThan(posY.y)
    expect(posY.y).toBeLessThan(posZ.y)
  })

  // Test 4
  it('should progress X for LR direction and vary Y within layers', () => {
    const g = graph([node('A'), node('B'), node('C')], [edge('e1', 'A', 'B'), edge('e2', 'A', 'C')])
    const dims = uniformDimensions(['A', 'B', 'C'])
    const layout = hierarchicalLayout({ direction: 'LR' })
    const positions = layout.layout(g, dims, emptyPositions)

    const posA = positions.get('A')!
    const posB = positions.get('B')!
    const posC = positions.get('C')!

    // LR: X increases per layer
    expect(posA.x).toBeLessThan(posB.x)
    expect(posA.x).toBeLessThan(posC.x)

    // B and C same layer, different Y
    expect(posB.x).toBeCloseTo(posC.x, 5)
    expect(posB.y).not.toBeCloseTo(posC.y, 5)
  })

  // Test 5
  it('should progress Y for TB direction and vary X within layers', () => {
    const g = graph([node('A'), node('B'), node('C')], [edge('e1', 'A', 'B'), edge('e2', 'A', 'C')])
    const dims = uniformDimensions(['A', 'B', 'C'])
    const layout = hierarchicalLayout({ direction: 'TB' })
    const positions = layout.layout(g, dims, emptyPositions)

    const posA = positions.get('A')!
    const posB = positions.get('B')!
    const posC = positions.get('C')!

    // TB: Y increases per layer
    expect(posA.y).toBeLessThan(posB.y)
    expect(posA.y).toBeLessThan(posC.y)

    // B and C same layer, different X
    expect(posB.y).toBeCloseTo(posC.y, 5)
    expect(posB.x).not.toBeCloseTo(posC.x, 5)
  })

  // Test 6
  it('should reverse X for RL direction (mirror of LR)', () => {
    const g = graph([node('A'), node('B'), node('C')], [edge('e1', 'A', 'B'), edge('e2', 'B', 'C')])
    const dims = uniformDimensions(['A', 'B', 'C'])
    const layoutLR = hierarchicalLayout({ direction: 'LR' })
    const layoutRL = hierarchicalLayout({ direction: 'RL' })

    const posLR = layoutLR.layout(g, dims, emptyPositions)
    const posRL = layoutRL.layout(g, dims, emptyPositions)

    // LR: A.x < B.x < C.x
    expect(posLR.get('A')!.x).toBeLessThan(posLR.get('B')!.x)
    expect(posLR.get('B')!.x).toBeLessThan(posLR.get('C')!.x)

    // RL: A.x > B.x > C.x (reversed)
    expect(posRL.get('A')!.x).toBeGreaterThan(posRL.get('B')!.x)
    expect(posRL.get('B')!.x).toBeGreaterThan(posRL.get('C')!.x)

    // Same Y positions in both directions
    expect(posRL.get('A')!.y).toBeCloseTo(posLR.get('A')!.y, 5)
  })

  // Test 7
  it('should reverse Y for BT direction (mirror of TB)', () => {
    const g = graph([node('A'), node('B'), node('C')], [edge('e1', 'A', 'B'), edge('e2', 'B', 'C')])
    const dims = uniformDimensions(['A', 'B', 'C'])
    const layoutTB = hierarchicalLayout({ direction: 'TB' })
    const layoutBT = hierarchicalLayout({ direction: 'BT' })

    const posTB = layoutTB.layout(g, dims, emptyPositions)
    const posBT = layoutBT.layout(g, dims, emptyPositions)

    // TB: A.y < B.y < C.y
    expect(posTB.get('A')!.y).toBeLessThan(posTB.get('B')!.y)
    expect(posTB.get('B')!.y).toBeLessThan(posTB.get('C')!.y)

    // BT: A.y > B.y > C.y (reversed)
    expect(posBT.get('A')!.y).toBeGreaterThan(posBT.get('B')!.y)
    expect(posBT.get('B')!.y).toBeGreaterThan(posBT.get('C')!.y)

    // Same X positions in both directions
    expect(posBT.get('A')!.x).toBeCloseTo(posTB.get('A')!.x, 5)
  })

  // Test 8
  it('should control within-layer gap via nodeSpacing', () => {
    const g = graph([node('A'), node('B'), node('C')], [edge('e1', 'A', 'B'), edge('e2', 'A', 'C')])
    const dims = uniformDimensions(['A', 'B', 'C'])

    const layoutNarrow = hierarchicalLayout({ direction: 'LR', nodeSpacing: 10 })
    const layoutWide = hierarchicalLayout({ direction: 'LR', nodeSpacing: 100 })

    const posNarrow = layoutNarrow.layout(g, dims, emptyPositions)
    const posWide = layoutWide.layout(g, dims, emptyPositions)

    // B and C are in the same layer; gap between them should differ
    const gapNarrow = Math.abs(posNarrow.get('C')!.y - posNarrow.get('B')!.y)
    const gapWide = Math.abs(posWide.get('C')!.y - posWide.get('B')!.y)

    expect(gapWide).toBeGreaterThan(gapNarrow)

    // Exact gap: height (80) + nodeSpacing
    expect(gapNarrow).toBe(80 + 10)
    expect(gapWide).toBe(80 + 100)
  })

  // Test 9
  it('should control between-layer gap via layerSpacing', () => {
    const g = graph([node('A'), node('B')], [edge('e1', 'A', 'B')])
    const dims = uniformDimensions(['A', 'B'])

    const layoutNarrow = hierarchicalLayout({ direction: 'LR', layerSpacing: 50 })
    const layoutWide = hierarchicalLayout({ direction: 'LR', layerSpacing: 400 })

    const posNarrow = layoutNarrow.layout(g, dims, emptyPositions)
    const posWide = layoutWide.layout(g, dims, emptyPositions)

    const xGapNarrow = posNarrow.get('B')!.x - posNarrow.get('A')!.x
    const xGapWide = posWide.get('B')!.x - posWide.get('A')!.x

    expect(xGapWide).toBeGreaterThan(xGapNarrow)

    // Exact gap: node width (180) + layerSpacing
    expect(xGapNarrow).toBe(180 + 50)
    expect(xGapWide).toBe(180 + 400)
  })

  // Test 10
  it('should return an empty map for an empty graph', () => {
    const g = graph([])
    const layout = hierarchicalLayout()
    const positions = layout.layout(g, new Map(), emptyPositions)

    expect(positions.size).toBe(0)
  })

  // Test 11
  it('should position a single node at (0, 0)', () => {
    const g = graph([node('solo')])
    const dims = uniformDimensions(['solo'])
    const layout = hierarchicalLayout({ direction: 'LR' })
    const positions = layout.layout(g, dims, emptyPositions)

    const pos = positions.get('solo')!
    expect(pos.x).toBe(0)
    expect(pos.y).toBe(0)
  })

  // Test 12
  it('should place multiple root nodes at layer 0', () => {
    const g = graph(
      [node('R1'), node('R2'), node('C1'), node('C2')],
      [edge('e1', 'R1', 'C1'), edge('e2', 'R2', 'C2')],
    )
    const dims = uniformDimensions(['R1', 'R2', 'C1', 'C2'])
    const layout = hierarchicalLayout({ direction: 'LR' })
    const positions = layout.layout(g, dims, emptyPositions)

    const posR1 = positions.get('R1')!
    const posR2 = positions.get('R2')!
    const posC1 = positions.get('C1')!
    const posC2 = positions.get('C2')!

    // Both roots should share the same X (layer 0)
    expect(posR1.x).toBeCloseTo(posR2.x, 5)

    // Children should share the same X (layer 1)
    expect(posC1.x).toBeCloseTo(posC2.x, 5)

    // Roots at layer 0, children at layer 1
    expect(posR1.x).toBeLessThan(posC1.x)
    expect(posR2.x).toBeLessThan(posC2.x)

    // Roots should be at different Y positions
    expect(posR1.y).not.toBeCloseTo(posR2.y, 5)
  })

  // Test 13 (bonus): uses default dimensions when none provided
  it('should use default node dimensions when none are measured', () => {
    const g = graph([node('A'), node('B')], [edge('e1', 'A', 'B')])
    const layout = hierarchicalLayout({ direction: 'LR', layerSpacing: 200 })
    const positions = layout.layout(g, new Map(), emptyPositions)

    const posA = positions.get('A')!
    const posB = positions.get('B')!

    // Default width is 180, layerSpacing is 200 => gap = 180 + 200 = 380
    expect(posB.x - posA.x).toBe(180 + 200)
  })
})
