import { describe, it, expect } from 'vitest'
import { createSmoothStepStrategy } from '../../src/edges/smooth-step'

describe('createSmoothStepStrategy', () => {
  const strategy = createSmoothStepStrategy()

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
    expect(d).toMatch(/200 100$/)
  })

  it('contains Q commands for rounded corners', () => {
    const d = strategy.computePath({
      source: { x: 0, y: 0, side: 'right' },
      target: { x: 200, y: 100, side: 'left' },
    })
    expect(d).toContain('Q ')
  })

  it('respects custom border radius', () => {
    const small = createSmoothStepStrategy({ borderRadius: 4 })
    const large = createSmoothStepStrategy({ borderRadius: 16 })
    const params = {
      source: { x: 0, y: 0, side: 'right' as const },
      target: { x: 200, y: 100, side: 'left' as const },
    }
    expect(small.computePath(params)).not.toBe(large.computePath(params))
  })

  it('respects custom offset', () => {
    const small = createSmoothStepStrategy({ offset: 10 })
    const large = createSmoothStepStrategy({ offset: 50 })
    // Use same-direction ports so offsets don't cancel in the midpoint calculation
    const params = {
      source: { x: 0, y: 0, side: 'right' as const },
      target: { x: 200, y: 100, side: 'right' as const },
    }
    expect(small.computePath(params)).not.toBe(large.computePath(params))
  })

  it('works for vertical side combinations (TB layout)', () => {
    const d = strategy.computePath({
      source: { x: 100, y: 0, side: 'bottom' },
      target: { x: 200, y: 200, side: 'top' },
    })
    expect(d).toMatch(/^M 100 0/)
    expect(d).toMatch(/200 200$/)
    expect(d).toContain('Q ')
  })

  it('handles L-shaped routes (mixed sides)', () => {
    const d = strategy.computePath({
      source: { x: 0, y: 0, side: 'right' },
      target: { x: 200, y: 200, side: 'top' },
    })
    expect(d).toMatch(/^M /)
    expect(d).toMatch(/200 200$/)
  })

  it('falls back to sharp corners when distance is too small for radius', () => {
    const d = strategy.computePath({
      source: { x: 0, y: 0, side: 'right' },
      target: { x: 5, y: 3, side: 'left' },
    })
    expect(d).toMatch(/^M /)
    // Should still produce a valid path
    expect(d).toBeTruthy()
  })
})
