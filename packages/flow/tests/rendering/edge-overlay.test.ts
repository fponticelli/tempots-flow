import { describe, it, expect } from 'vitest'
import { computeEdgeAngle } from '../../src/rendering/edge-overlay'
import type { ComputedEdgePath } from '../../src/types/layout'

function makePath(sx: number, sy: number, tx: number, ty: number): ComputedEdgePath {
  return {
    edgeId: 'e1',
    d: '',
    sourcePoint: { x: sx, y: sy, side: 'right' },
    targetPoint: { x: tx, y: ty, side: 'left' },
    labelPosition: { x: (sx + tx) / 2, y: (sy + ty) / 2 },
  }
}

describe('computeEdgeAngle', () => {
  it('returns 0 for horizontal left-to-right', () => {
    expect(computeEdgeAngle(makePath(0, 0, 100, 0))).toBe(0)
  })

  it('returns 0 for horizontal right-to-left', () => {
    expect(computeEdgeAngle(makePath(100, 0, 0, 0))).toBe(0)
  })

  it('returns 90 for vertical top-to-bottom', () => {
    expect(computeEdgeAngle(makePath(0, 0, 0, 100))).toBe(90)
  })

  it('returns -90 for vertical bottom-to-top', () => {
    expect(computeEdgeAngle(makePath(0, 100, 0, 0))).toBe(-90)
  })

  it('returns angle in readable range (-90..90)', () => {
    // Diagonal going bottom-left (angle would be ~135 degrees unclamped)
    const angle = computeEdgeAngle(makePath(100, 0, 0, 100))
    expect(angle).toBeGreaterThanOrEqual(-90)
    expect(angle).toBeLessThanOrEqual(90)
  })

  it('returns 0 for zero-length edge', () => {
    expect(computeEdgeAngle(makePath(50, 50, 50, 50))).toBe(0)
  })

  it('returns ~45 for diagonal down-right', () => {
    const angle = computeEdgeAngle(makePath(0, 0, 100, 100))
    expect(angle).toBeCloseTo(45, 5)
  })

  it('returns ~-45 for diagonal up-right', () => {
    const angle = computeEdgeAngle(makePath(0, 0, 100, -100))
    expect(angle).toBeCloseTo(-45, 5)
  })
})
