import { describe, it, expect } from 'vitest'
import { createOrthogonalStrategy } from '../../src/edges/orthogonal'

describe('createOrthogonalStrategy', () => {
  const strategy = createOrthogonalStrategy()

  it('returns a valid SVG path starting with M', () => {
    const d = strategy.computePath({
      source: { x: 0, y: 0, side: 'right' },
      target: { x: 200, y: 100, side: 'left' },
    })
    expect(d).toMatch(/^M /)
  })

  it('starts at the source point', () => {
    const d = strategy.computePath({
      source: { x: 50, y: 80, side: 'right' },
      target: { x: 300, y: 200, side: 'left' },
    })
    expect(d).toMatch(/^M 50 80/)
  })

  it('ends at the target point', () => {
    const d = strategy.computePath({
      source: { x: 0, y: 0, side: 'right' },
      target: { x: 200, y: 100, side: 'left' },
    })
    expect(d).toContain('200 100')
  })

  it('handles horizontal-to-horizontal routing', () => {
    const d = strategy.computePath({
      source: { x: 0, y: 0, side: 'right' },
      target: { x: 200, y: 0, side: 'left' },
    })
    expect(d).toMatch(/^M /)
    expect(d).toContain('200 0')
  })

  it('handles vertical-to-vertical routing', () => {
    const d = strategy.computePath({
      source: { x: 100, y: 0, side: 'bottom' },
      target: { x: 100, y: 200, side: 'top' },
    })
    expect(d).toMatch(/^M /)
    expect(d).toContain('100 200')
  })

  it('handles mixed side combinations', () => {
    const d = strategy.computePath({
      source: { x: 0, y: 0, side: 'right' },
      target: { x: 200, y: 200, side: 'top' },
    })
    expect(d).toMatch(/^M /)
  })

  it('respects custom borderRadius option', () => {
    const small = createOrthogonalStrategy({ borderRadius: 2 })
    const large = createOrthogonalStrategy({ borderRadius: 20 })
    const params = {
      source: { x: 0, y: 0, side: 'right' as const },
      target: { x: 200, y: 100, side: 'left' as const },
    }
    expect(small.computePath(params)).not.toBe(large.computePath(params))
  })

  it('produces different paths with different nodePadding', () => {
    const small = createOrthogonalStrategy({ nodePadding: 10 })
    const large = createOrthogonalStrategy({ nodePadding: 50 })
    // Use computeAllPaths with obstacles where padding affects route
    const batchParams = {
      edges: [
        {
          edgeId: 'e1',
          sourceNodeId: 's',
          targetNodeId: 't',
          source: { x: 0, y: 50, side: 'right' as const },
          target: { x: 300, y: 50, side: 'left' as const },
        },
      ],
      obstacles: [
        { nodeId: 'obs1', position: { x: 100, y: 0 }, dimensions: { width: 100, height: 100 } },
      ],
    }
    const smallPath = small.computeAllPaths!(batchParams).get('e1')!
    const largePath = large.computeAllPaths!(batchParams).get('e1')!
    // Different padding should produce different obstacle exclusion zones
    expect(smallPath).not.toBe(largePath)
  })

  describe('computeAllPaths', () => {
    it('returns a map of paths for all edges', () => {
      const result = strategy.computeAllPaths!({
        edges: [
          {
            edgeId: 'e1',
            sourceNodeId: 's1',
            targetNodeId: 't1',
            source: { x: 0, y: 0, side: 'right' },
            target: { x: 200, y: 0, side: 'left' },
          },
          {
            edgeId: 'e2',
            sourceNodeId: 's2',
            targetNodeId: 't2',
            source: { x: 0, y: 100, side: 'right' },
            target: { x: 200, y: 100, side: 'left' },
          },
        ],
      })
      expect(result.size).toBe(2)
      expect(result.get('e1')).toMatch(/^M /)
      expect(result.get('e2')).toMatch(/^M /)
    })

    it('routes around obstacles', () => {
      const withObstacles = strategy.computeAllPaths!({
        edges: [
          {
            edgeId: 'e1',
            sourceNodeId: 's1',
            targetNodeId: 't1',
            source: { x: 0, y: 50, side: 'right' },
            target: { x: 300, y: 50, side: 'left' },
          },
        ],
        obstacles: [
          { nodeId: 'obs1', position: { x: 100, y: 0 }, dimensions: { width: 100, height: 100 } },
        ],
      })

      const withoutObstacles = strategy.computeAllPaths!({
        edges: [
          {
            edgeId: 'e1',
            sourceNodeId: 's1',
            targetNodeId: 't1',
            source: { x: 0, y: 50, side: 'right' },
            target: { x: 300, y: 50, side: 'left' },
          },
        ],
      })

      // Path with obstacle should differ from path without
      expect(withObstacles.get('e1')).not.toBe(withoutObstacles.get('e1'))
    })

    it('excludes source and target node obstacles', () => {
      // Place obstacle exactly on source/target — should be excluded
      const result = strategy.computeAllPaths!({
        edges: [
          {
            edgeId: 'e1',
            sourceNodeId: 'source',
            targetNodeId: 'target',
            source: { x: 90, y: 40, side: 'right' },
            target: { x: 290, y: 40, side: 'left' },
          },
        ],
        obstacles: [
          { nodeId: 'source', position: { x: 0, y: 0 }, dimensions: { width: 100, height: 80 } },
          { nodeId: 'target', position: { x: 200, y: 0 }, dimensions: { width: 100, height: 80 } },
        ],
      })
      expect(result.get('e1')).toMatch(/^M /)
    })

    it('handles multiple obstacles', () => {
      const result = strategy.computeAllPaths!({
        edges: [
          {
            edgeId: 'e1',
            sourceNodeId: 's',
            targetNodeId: 't',
            source: { x: 0, y: 100, side: 'right' },
            target: { x: 500, y: 100, side: 'left' },
          },
        ],
        obstacles: [
          { nodeId: 'o1', position: { x: 100, y: 50 }, dimensions: { width: 80, height: 100 } },
          { nodeId: 'o2', position: { x: 300, y: 50 }, dimensions: { width: 80, height: 100 } },
        ],
      })
      expect(result.get('e1')).toMatch(/^M /)
    })

    it('handles maxIterations bailout gracefully', () => {
      const limited = createOrthogonalStrategy({ maxIterations: 1 })
      const result = limited.computeAllPaths!({
        edges: [
          {
            edgeId: 'e1',
            sourceNodeId: 's',
            targetNodeId: 't',
            source: { x: 0, y: 50, side: 'right' },
            target: { x: 300, y: 50, side: 'left' },
          },
        ],
        obstacles: [
          { nodeId: 'obs1', position: { x: 50, y: 0 }, dimensions: { width: 200, height: 100 } },
        ],
      })
      // Should still produce a valid path (falls back to direct route)
      expect(result.get('e1')).toMatch(/^M /)
    })
  })
})
