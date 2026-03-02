import { describe, it, expect } from 'vitest'
import { createStepStrategy } from '../../src/edges/step'

describe('createStepStrategy', () => {
  const strategy = createStepStrategy()

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
    // Step paths end with H or V commands (single coordinate)
    // The final segment reaches target.x via H 200
    expect(d).toMatch(/H 200$/)
  })

  it('uses only H and V segments for horizontal sides', () => {
    const d = strategy.computePath({
      source: { x: 0, y: 0, side: 'right' },
      target: { x: 200, y: 100, side: 'left' },
    })
    // Should have H and V commands (no diagonal lines)
    expect(d).toContain('H ')
    expect(d).toContain('V ')
    expect(d).not.toContain('L ')
  })

  it('uses only V and H segments for vertical sides', () => {
    const d = strategy.computePath({
      source: { x: 100, y: 0, side: 'bottom' },
      target: { x: 200, y: 200, side: 'top' },
    })
    expect(d).toContain('V ')
    expect(d).toContain('H ')
  })

  it('respects custom offset option', () => {
    const small = createStepStrategy({ offset: 10 })
    const large = createStepStrategy({ offset: 50 })
    // Use same-direction ports so offsets don't cancel in the midpoint calculation
    const params = {
      source: { x: 0, y: 0, side: 'right' as const },
      target: { x: 200, y: 100, side: 'right' as const },
    }
    expect(small.computePath(params)).not.toBe(large.computePath(params))
  })

  it('handles mixed side combinations (horizontal source, vertical target)', () => {
    const d = strategy.computePath({
      source: { x: 0, y: 0, side: 'right' },
      target: { x: 200, y: 200, side: 'top' },
    })
    expect(d).toMatch(/^M /)
    // Mixed sides produce L-shaped paths ending with V (vertical to target.y)
    expect(d).toMatch(/V 200$/)
  })
})
