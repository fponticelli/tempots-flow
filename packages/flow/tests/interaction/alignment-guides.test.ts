import { describe, it, expect } from 'vitest'
import { computeAlignmentGuides } from '../../src/interaction/alignment-guides'

const dims = new Map([
  ['a', { width: 100, height: 50 }],
  ['b', { width: 100, height: 50 }],
  ['c', { width: 100, height: 50 }],
])

describe('computeAlignmentGuides', () => {
  it('returns empty when no non-dragged nodes exist', () => {
    const positions = new Map([['a', { x: 0, y: 0 }]])
    const result = computeAlignmentGuides(['a'], positions, positions, dims, 5)
    expect(result.guides).toEqual([])
    expect(result.snappedPosition).toBeNull()
  })

  it('returns empty when drag positions are missing', () => {
    const positions = new Map([
      ['a', { x: 0, y: 0 }],
      ['b', { x: 200, y: 0 }],
    ])
    const result = computeAlignmentGuides(['missing'], positions, positions, dims, 5)
    expect(result.guides).toEqual([])
    expect(result.snappedPosition).toBeNull()
  })

  it('detects left-edge vertical alignment', () => {
    // Node a at x=100, node b at x=102 (within threshold of 5)
    const allPositions = new Map([
      ['a', { x: 102, y: 100 }],
      ['b', { x: 100, y: 0 }],
    ])
    const dragPositions = new Map([['a', { x: 102, y: 100 }]])

    const result = computeAlignmentGuides(['a'], dragPositions, allPositions, dims, 5)
    expect(result.guides.length).toBeGreaterThan(0)
    expect(result.guides.some((g) => g.axis === 'vertical' && g.position === 100)).toBe(true)
    expect(result.snappedPosition).not.toBeNull()
    expect(result.snappedPosition!.x).toBe(-2) // snap dx to align left edges
  })

  it('detects right-edge vertical alignment', () => {
    // Node a right edge at 302, node b right edge at 300
    const allPositions = new Map([
      ['a', { x: 202, y: 100 }],
      ['b', { x: 200, y: 0 }],
    ])
    const dragPositions = new Map([['a', { x: 202, y: 100 }]])

    const result = computeAlignmentGuides(['a'], dragPositions, allPositions, dims, 5)
    // Right edges: a=302, b=300 → diff=2 → within threshold
    expect(result.guides.some((g) => g.axis === 'vertical' && g.position === 300)).toBe(true)
  })

  it('detects center-x vertical alignment', () => {
    // Node a center at 153, node b center at 150
    const allPositions = new Map([
      ['a', { x: 103, y: 100 }],
      ['b', { x: 100, y: 0 }],
    ])
    const dragPositions = new Map([['a', { x: 103, y: 100 }]])

    const result = computeAlignmentGuides(['a'], dragPositions, allPositions, dims, 5)
    expect(result.guides.some((g) => g.axis === 'vertical' && g.position === 150)).toBe(true)
  })

  it('detects top-edge horizontal alignment', () => {
    // Node a top at y=2, node b top at y=0
    const allPositions = new Map([
      ['a', { x: 200, y: 2 }],
      ['b', { x: 0, y: 0 }],
    ])
    const dragPositions = new Map([['a', { x: 200, y: 2 }]])

    const result = computeAlignmentGuides(['a'], dragPositions, allPositions, dims, 5)
    expect(result.guides.some((g) => g.axis === 'horizontal' && g.position === 0)).toBe(true)
    expect(result.snappedPosition!.y).toBe(-2)
  })

  it('detects bottom-edge horizontal alignment', () => {
    // Node a bottom at 52, node b bottom at 50
    const allPositions = new Map([
      ['a', { x: 200, y: 2 }],
      ['b', { x: 0, y: 0 }],
    ])
    const dragPositions = new Map([['a', { x: 200, y: 2 }]])

    const result = computeAlignmentGuides(['a'], dragPositions, allPositions, dims, 5)
    // Bottom edges: a=52, b=50 → diff=2 → within threshold
    expect(result.guides.some((g) => g.axis === 'horizontal' && g.position === 50)).toBe(true)
  })

  it('returns no guides when no alignment within threshold', () => {
    const allPositions = new Map([
      ['a', { x: 0, y: 0 }],
      ['b', { x: 300, y: 300 }],
    ])
    const dragPositions = new Map([['a', { x: 0, y: 0 }]])

    const result = computeAlignmentGuides(['a'], dragPositions, allPositions, dims, 5)
    expect(result.guides).toEqual([])
    expect(result.snappedPosition).toBeNull()
  })

  it('deduplicates guides', () => {
    // Multiple nodes aligned on the same line
    const allPositions = new Map([
      ['a', { x: 0, y: 100 }],
      ['b', { x: 0, y: 0 }],
      ['c', { x: 0, y: 200 }],
    ])
    const dragPositions = new Map([['a', { x: 0, y: 100 }]])

    const result = computeAlignmentGuides(['a'], dragPositions, allPositions, dims, 5)
    // Both b and c have left edge at x=0, should only appear once
    const verticalAtZero = result.guides.filter((g) => g.axis === 'vertical' && g.position === 0)
    expect(verticalAtZero.length).toBe(1)
  })

  it('handles multi-node drag correctly', () => {
    // Dragging nodes a and b together, checking alignment with c
    const allPositions = new Map([
      ['a', { x: 0, y: 0 }],
      ['b', { x: 0, y: 100 }],
      ['c', { x: 2, y: 300 }],
    ])
    const dragPositions = new Map([
      ['a', { x: 0, y: 0 }],
      ['b', { x: 0, y: 100 }],
    ])

    const result = computeAlignmentGuides(['a', 'b'], dragPositions, allPositions, dims, 5)
    // Node c left edge at x=2, drag group left edge at x=0 → diff=2 → within threshold
    expect(result.guides.some((g) => g.axis === 'vertical' && g.position === 2)).toBe(true)
  })

  it('picks closest snap when multiple alignments exist', () => {
    const allPositions = new Map([
      ['a', { x: 3, y: 0 }],
      ['b', { x: 1, y: 200 }],
      ['c', { x: 4, y: 400 }],
    ])
    const dragPositions = new Map([['a', { x: 3, y: 0 }]])

    const result = computeAlignmentGuides(['a'], dragPositions, allPositions, dims, 5)
    // b left=1, c left=4 → drag left=3
    // b: |1-3|=2, c: |4-3|=1 → closest is c with dx=1
    expect(result.snappedPosition).not.toBeNull()
    expect(result.snappedPosition!.x).toBe(1) // snap to c's left edge (4-3=1)
  })
})
