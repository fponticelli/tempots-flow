import { describe, it, expect } from 'vitest'
import { createStraightStrategy } from '../../src/edges/straight'

describe('createStraightStrategy', () => {
  const strategy = createStraightStrategy()

  it('returns a valid SVG path', () => {
    const d = strategy.computePath({
      source: { x: 0, y: 0, side: 'right' },
      target: { x: 200, y: 100, side: 'left' },
    })
    expect(d).toMatch(/^M /)
    expect(d).toContain('L ')
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

  it('works with all side combinations', () => {
    const sides = ['left', 'right', 'top', 'bottom'] as const
    for (const sourceSide of sides) {
      for (const targetSide of sides) {
        const d = strategy.computePath({
          source: { x: 10, y: 20, side: sourceSide },
          target: { x: 200, y: 150, side: targetSide },
        })
        expect(d).toMatch(/^M 10 20 L 200 150$/)
      }
    }
  })
})
