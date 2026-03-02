import { describe, it, expect } from 'vitest'
import { gridLayout } from '../../src/layout/grid'
import type { Graph, GraphNode } from '../../src/types/graph'
import type { Dimensions } from '../../src/types/layout'

function makeNodes(count: number): readonly GraphNode<string>[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `n${i}`,
    data: `Node ${i}`,
    ports: [],
  }))
}

function makeGraph(count: number): Graph<string, string> {
  return { nodes: makeNodes(count), edges: [] }
}

describe('gridLayout', () => {
  it('uses ceil(sqrt(n)) columns by default', () => {
    const graph = makeGraph(4)
    const layout = gridLayout()
    const positions = layout.layout(graph, new Map(), new Map())

    // 4 nodes → ceil(sqrt(4)) = 2 columns → 2x2 grid
    expect(positions.size).toBe(4)

    const p0 = positions.get('n0')!
    const p1 = positions.get('n1')!
    const p2 = positions.get('n2')!
    const p3 = positions.get('n3')!

    // Row 0: n0 (col 0), n1 (col 1)
    expect(p0.y).toBe(p1.y)
    expect(p0.x).toBeLessThan(p1.x)

    // Row 1: n2 (col 0), n3 (col 1)
    expect(p2.y).toBe(p3.y)
    expect(p2.x).toBeLessThan(p3.x)

    // n2 is below n0
    expect(p2.y).toBeGreaterThan(p0.y)
    // columns align
    expect(p0.x).toBe(p2.x)
    expect(p1.x).toBe(p3.x)
  })

  it('respects a custom column count', () => {
    const graph = makeGraph(6)
    const layout = gridLayout({ columns: 3 })
    const positions = layout.layout(graph, new Map(), new Map())

    // 6 nodes in 3 columns → 2 rows
    // Row 0: n0, n1, n2 — all same y
    expect(positions.get('n0')!.y).toBe(positions.get('n1')!.y)
    expect(positions.get('n1')!.y).toBe(positions.get('n2')!.y)

    // Row 1: n3, n4, n5 — all same y, different from row 0
    expect(positions.get('n3')!.y).toBe(positions.get('n4')!.y)
    expect(positions.get('n4')!.y).toBe(positions.get('n5')!.y)
    expect(positions.get('n3')!.y).toBeGreaterThan(positions.get('n0')!.y)
  })

  it('uses columnSpacing and rowSpacing for gaps', () => {
    const graph = makeGraph(4)
    const layout = gridLayout({
      columns: 2,
      columnSpacing: 100,
      rowSpacing: 50,
    })
    const positions = layout.layout(graph, new Map(), new Map())

    const p0 = positions.get('n0')!
    const p1 = positions.get('n1')!
    const p2 = positions.get('n2')!

    // Default node width is 180, so col 1 starts at 180 + 100 = 280
    expect(p1.x).toBe(180 + 100)
    expect(p0.x).toBe(0)

    // Default node height is 80, so row 1 starts at 80 + 50 = 130
    expect(p2.y).toBe(80 + 50)
    expect(p0.y).toBe(0)
  })

  it('uses measured dimensions for column widths and row heights', () => {
    const graph = makeGraph(4)
    const dims = new Map<string, Dimensions>([
      ['n0', { width: 300, height: 60 }],
      ['n1', { width: 100, height: 120 }],
      ['n2', { width: 200, height: 40 }],
      ['n3', { width: 150, height: 90 }],
    ])
    const layout = gridLayout({
      columns: 2,
      columnSpacing: 50,
      rowSpacing: 30,
    })
    const positions = layout.layout(graph, dims, new Map())

    // Column 0 has n0 (300w) and n2 (200w) → max width 300
    // Column 1 starts at 300 + 50 = 350
    expect(positions.get('n1')!.x).toBe(350)

    // Row 0 has n0 (60h) and n1 (120h) → max height 120
    // Row 1 starts at 120 + 30 = 150
    expect(positions.get('n2')!.y).toBe(150)
  })

  it('applies sortBy to reorder nodes before placement', () => {
    const nodes: readonly GraphNode<string>[] = [
      { id: 'c', data: 'C', ports: [] },
      { id: 'a', data: 'A', ports: [] },
      { id: 'b', data: 'B', ports: [] },
    ]
    const graph: Graph<string, string> = { nodes, edges: [] }

    const layout = gridLayout({
      columns: 3,
      sortBy: (a, b) => a.id.localeCompare(b.id),
    })
    const positions = layout.layout(graph, new Map(), new Map())

    // After sorting: a, b, c — all on row 0 in ascending x
    const pa = positions.get('a')!
    const pb = positions.get('b')!
    const pc = positions.get('c')!

    expect(pa.x).toBeLessThan(pb.x)
    expect(pb.x).toBeLessThan(pc.x)
    // All on same row
    expect(pa.y).toBe(pb.y)
    expect(pb.y).toBe(pc.y)
  })

  it('places a single node at (0, 0)', () => {
    const graph = makeGraph(1)
    const layout = gridLayout()
    const positions = layout.layout(graph, new Map(), new Map())

    expect(positions.size).toBe(1)
    expect(positions.get('n0')).toEqual({ x: 0, y: 0 })
  })

  it('returns an empty map for an empty graph', () => {
    const graph: Graph<string, string> = { nodes: [], edges: [] }
    const layout = gridLayout()
    const positions = layout.layout(graph, new Map(), new Map())

    expect(positions.size).toBe(0)
  })
})
