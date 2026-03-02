import { describe, it, expect } from 'vitest'
import { easing } from './easing'

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
