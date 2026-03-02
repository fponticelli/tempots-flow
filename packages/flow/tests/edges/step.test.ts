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
    // Mixed sides end with V to target.y
    expect(d).toMatch(/V 200$/)
  })

  it('exits in source port direction for backward edges', () => {
    // Source right port is to the right of target left port (backward flow)
    const d = strategy.computePath({
      source: { x: 700, y: 200, side: 'right' },
      target: { x: 600, y: 500, side: 'left' },
    })
    // Path should start by going RIGHT (H to >= 700), not left
    const parts = d.split(' ')
    // First segment after M is H <value> — value should be > 700
    const firstH = parts.indexOf('H')
    expect(firstH).toBeGreaterThan(0)
    expect(Number(parts[firstH + 1])).toBeGreaterThan(700)
    // Path should end at target
    expect(d).toMatch(/H 600$/)
  })

  it('uses S-route for backward vertical edges', () => {
    // Source bottom port is below target top port
    const d = strategy.computePath({
      source: { x: 100, y: 300, side: 'bottom' },
      target: { x: 200, y: 50, side: 'top' },
    })
    // Should exit downward (V > 300), not upward
    const parts = d.split(' ')
    const firstV = parts.indexOf('V')
    expect(firstV).toBeGreaterThan(0)
    expect(Number(parts[firstV + 1])).toBeGreaterThan(300)
    // Path should end at target
    expect(d).toMatch(/V 50$/)
  })
})
