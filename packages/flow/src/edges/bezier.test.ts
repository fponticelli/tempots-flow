import { describe, it, expect } from 'vitest'
import { createBezierStrategy } from './bezier'

describe('createBezierStrategy', () => {
  const strategy = createBezierStrategy()

  it('returns a valid SVG path', () => {
    const d = strategy.computePath({
      source: { x: 0, y: 0, side: 'right' },
      target: { x: 200, y: 100, side: 'left' },
    })
    expect(d).toMatch(/^M /)
    expect(d).toContain('C ')
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

  it('produces different paths for different curvatures', () => {
    const low = createBezierStrategy(0.2)
    const high = createBezierStrategy(0.8)
    const params = {
      source: { x: 0, y: 0, side: 'right' as const },
      target: { x: 200, y: 100, side: 'left' as const },
    }
    expect(low.computePath(params)).not.toBe(high.computePath(params))
  })
})
