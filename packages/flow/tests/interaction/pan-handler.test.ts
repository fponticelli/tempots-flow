import { describe, it, expect } from 'vitest'
import { computeContentBounds } from '../../src/interaction/pan-handler'

describe('computeContentBounds', () => {
  it('returns null for empty positions', () => {
    const result = computeContentBounds(new Map(), new Map())
    expect(result).toBeNull()
  })

  it('computes bounds for a single node', () => {
    const positions = new Map([['a', { x: 10, y: 20 }]])
    const dimensions = new Map([['a', { width: 100, height: 50 }]])
    const result = computeContentBounds(positions, dimensions)
    expect(result).toEqual({
      min: { x: 10, y: 20 },
      max: { x: 110, y: 70 },
    })
  })

  it('computes bounds for multiple nodes', () => {
    const positions = new Map([
      ['a', { x: 0, y: 0 }],
      ['b', { x: 200, y: 100 }],
      ['c', { x: -50, y: 50 }],
    ])
    const dimensions = new Map([
      ['a', { width: 100, height: 50 }],
      ['b', { width: 120, height: 60 }],
      ['c', { width: 80, height: 40 }],
    ])
    const result = computeContentBounds(positions, dimensions)
    expect(result).toEqual({
      min: { x: -50, y: 0 },
      max: { x: 320, y: 160 },
    })
  })

  it('uses default dimensions when missing', () => {
    const positions = new Map([['a', { x: 0, y: 0 }]])
    const result = computeContentBounds(positions, new Map())
    expect(result).toEqual({
      min: { x: 0, y: 0 },
      max: { x: 180, y: 80 },
    })
  })
})
