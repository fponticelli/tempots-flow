import { describe, it, expect } from 'vitest'
import { createBundledStrategy } from '../../src/edges/bundle'
import type { ComputedPortPosition } from '../../src/types/layout'

function sourcePort(x: number, y: number): ComputedPortPosition {
  return { x, y, side: 'right' }
}

function targetPort(x: number, y: number): ComputedPortPosition {
  return { x, y, side: 'left' }
}

function edge(
  edgeId: string,
  source: ComputedPortPosition,
  target: ComputedPortPosition,
  sourceNodeId = 's',
  targetNodeId = 't',
) {
  return { edgeId, source, target, sourceNodeId, targetNodeId }
}

describe('createBundledStrategy', () => {
  it('computePath returns a valid SVG path for a single edge', () => {
    const strategy = createBundledStrategy()
    const path = strategy.computePath({
      source: sourcePort(0, 0),
      target: targetPort(200, 100),
    })
    expect(path).toMatch(/^M /)
    expect(path).toContain('C')
  })

  it('computeAllPaths returns a map with all edge IDs', () => {
    const strategy = createBundledStrategy()
    const result = strategy.computeAllPaths!({
      edges: [
        edge('e1', sourcePort(0, 0), targetPort(200, 100)),
        edge('e2', sourcePort(0, 50), targetPort(200, 150)),
        edge('e3', sourcePort(300, 0), targetPort(500, 0)),
      ],
    })

    expect(result.size).toBe(3)
    expect(result.has('e1')).toBe(true)
    expect(result.has('e2')).toBe(true)
    expect(result.has('e3')).toBe(true)
  })

  it('all paths start with M (valid SVG)', () => {
    const strategy = createBundledStrategy()
    const result = strategy.computeAllPaths!({
      edges: [
        edge('e1', sourcePort(0, 0), targetPort(200, 0)),
        edge('e2', sourcePort(0, 0), targetPort(200, 0)),
      ],
    })

    for (const path of result.values()) {
      expect(path).toMatch(/^M /)
    }
  })

  it('two edges between same node pair are bundled (same control region)', () => {
    const strategy = createBundledStrategy({ strength: 0.85 })
    const result = strategy.computeAllPaths!({
      edges: [
        edge('e1', sourcePort(100, 50), targetPort(300, 50)),
        edge('e2', sourcePort(100, 50), targetPort(300, 50)),
      ],
    })

    const path1 = result.get('e1')!
    const path2 = result.get('e2')!
    // Both should be bundled and have different fan-out offsets
    expect(path1).not.toBe(path2)
  })

  it('single edge is not bundled (uses orthogonal bezier)', () => {
    const strategy = createBundledStrategy({ minBundleSize: 2 })
    const result = strategy.computeAllPaths!({
      edges: [edge('e1', sourcePort(0, 0), targetPort(200, 0))],
    })

    const path = result.get('e1')!
    // Should have orthogonal exit: M ... L ... C ... L
    expect(path).toMatch(/^M /)
    expect(path).toContain('L')
    expect(path).toContain('C')
    // Single edge should have exactly 1 C command (unbundled)
    const cCount = (path.match(/ C /g) ?? []).length
    expect(cCount).toBe(1)
  })

  it('minBundleSize 3 means pair of edges is not bundled', () => {
    const strategy = createBundledStrategy({ minBundleSize: 3 })
    const result = strategy.computeAllPaths!({
      edges: [
        edge('e1', sourcePort(100, 50), targetPort(300, 50)),
        edge('e2', sourcePort(100, 50), targetPort(300, 50)),
      ],
    })

    const path1 = result.get('e1')!
    const path2 = result.get('e2')!
    // Not bundled, both use simple bezier — same source/target means same path
    expect(path1).toBe(path2)
  })

  it('strength 0 vs strength 1 produces different control points', () => {
    const weak = createBundledStrategy({ strength: 0 })
    const strong = createBundledStrategy({ strength: 1 })

    // Use positions that round to same 10px key but differ slightly
    // so centroid != individual midpoints
    const edges = {
      edges: [
        edge('e1', sourcePort(101, 51), targetPort(301, 52)),
        edge('e2', sourcePort(103, 53), targetPort(303, 54)),
      ],
    }

    const weakResult = weak.computeAllPaths!(edges)
    const strongResult = strong.computeAllPaths!(edges)

    // With different strengths, the bundled paths should differ
    expect(weakResult.get('e1')).not.toBe(strongResult.get('e1'))
  })

  it('returns correct number of paths for mixed bundled/unbundled', () => {
    const strategy = createBundledStrategy()

    const result = strategy.computeAllPaths!({
      edges: [
        // These two share same approximate source/target → bundled
        edge('e1', sourcePort(100, 50), targetPort(300, 50)),
        edge('e2', sourcePort(100, 50), targetPort(300, 50)),
        // This one is separate → not bundled
        edge('e3', sourcePort(500, 200), targetPort(700, 200)),
      ],
    })

    expect(result.size).toBe(3)
  })

  it('empty edges returns empty map', () => {
    const strategy = createBundledStrategy()
    const result = strategy.computeAllPaths!({ edges: [] })
    expect(result.size).toBe(0)
  })
})
