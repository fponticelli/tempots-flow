import { describe, it, expect } from 'vitest'
import { easing, springEasing } from '../../src/animation/easing'

describe('easing', () => {
  const names = Object.keys(easing) as (keyof typeof easing)[]

  for (const name of names) {
    describe(name, () => {
      it('returns 0 at t=0', () => {
        expect(easing[name](0)).toBeCloseTo(0, 10)
      })

      it('returns 1 at t=1', () => {
        expect(easing[name](1)).toBeCloseTo(1, 10)
      })

      it('returns values in a reasonable range for t=0.5', () => {
        const mid = easing[name](0.5)
        // Back easings can overshoot, but mid should still be reasonable
        expect(mid).toBeGreaterThan(-0.5)
        expect(mid).toBeLessThan(1.5)
      })
    })
  }

  it('linear returns the input unchanged', () => {
    expect(easing.linear(0.25)).toBe(0.25)
    expect(easing.linear(0.5)).toBe(0.5)
    expect(easing.linear(0.75)).toBe(0.75)
  })

  it('easeIn starts slow (value < t at midpoint)', () => {
    expect(easing.easeIn(0.5)).toBeLessThan(0.5)
  })

  it('easeOut starts fast (value > t at midpoint)', () => {
    expect(easing.easeOut(0.5)).toBeGreaterThan(0.5)
  })

  it('easeInOut passes through 0.5 at midpoint', () => {
    expect(easing.easeInOut(0.5)).toBeCloseTo(0.5, 10)
  })
})

describe('springEasing', () => {
  it('returns 0 at t=0', () => {
    const spring = springEasing()
    expect(spring(0)).toBeCloseTo(0, 5)
  })

  it('returns 1 at t=1', () => {
    const spring = springEasing()
    expect(spring(1)).toBeCloseTo(1, 5)
  })

  it('returns intermediate values for t in (0, 1)', () => {
    const spring = springEasing()
    const mid = spring(0.5)
    expect(mid).toBeGreaterThan(0)
    expect(mid).toBeLessThan(2) // springs can overshoot
  })

  it('interpolates smoothly between steps', () => {
    const spring = springEasing()
    const v1 = spring(0.3)
    const v2 = spring(0.31)
    // Adjacent values should be close (smooth interpolation)
    expect(Math.abs(v2 - v1)).toBeLessThan(0.1)
  })

  it('accepts custom stiffness and damping', () => {
    const stiff = springEasing(200, 15)
    const soft = springEasing(50, 5)
    // Both should start at 0 and end at 1
    expect(stiff(0)).toBeCloseTo(0, 5)
    expect(stiff(1)).toBeCloseTo(1, 5)
    expect(soft(0)).toBeCloseTo(0, 5)
    expect(soft(1)).toBeCloseTo(1, 5)
    // Different parameters should produce different curves
    expect(stiff(0.5)).not.toBeCloseTo(soft(0.5), 2)
  })

  it('handles edge case where last value equals 1', () => {
    // High damping to make the spring converge to exactly 1
    const spring = springEasing(100, 100)
    expect(spring(0)).toBeCloseTo(0, 5)
    expect(spring(1)).toBeCloseTo(1, 5)
  })
})
