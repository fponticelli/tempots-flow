import { describe, it, expect } from 'vitest'
import { prop } from '@tempots/core'
import type { Position } from '../types/layout'
import { createAnimatedPositions } from './animate-positions'
import { easing } from './easing'
import type { LayoutTransitionConfig } from './animation-config'

function makeConfig(overrides?: Partial<LayoutTransitionConfig>): LayoutTransitionConfig {
  return {
    enabled: true,
    duration: 300,
    easing: easing.linear,
    stagger: 0,
    staggerOrder: 'distance',
    ...overrides,
  }
}

describe('createAnimatedPositions', () => {
  it('returns source signal directly when disabled', () => {
    const source = prop<ReadonlyMap<string, Position>>(new Map())
    const reducedMotion = prop(false)
    const dragging = prop(false)
    const result = createAnimatedPositions(
      source,
      makeConfig({ enabled: false }),
      reducedMotion,
      dragging,
    )
    expect(result).toBe(source)
  })

  it('returns source signal directly when duration is 0', () => {
    const source = prop<ReadonlyMap<string, Position>>(new Map())
    const reducedMotion = prop(false)
    const dragging = prop(false)
    const result = createAnimatedPositions(
      source,
      makeConfig({ duration: 0 }),
      reducedMotion,
      dragging,
    )
    expect(result).toBe(source)
  })

  it('returns source signal directly when reduced motion is active', () => {
    const source = prop<ReadonlyMap<string, Position>>(new Map())
    const reducedMotion = prop(true)
    const dragging = prop(false)
    const result = createAnimatedPositions(source, makeConfig(), reducedMotion, dragging)
    expect(result).toBe(source)
  })

  it('returns a different signal when animation is active', () => {
    const source = prop<ReadonlyMap<string, Position>>(new Map([['a', { x: 0, y: 0 }]]))
    const reducedMotion = prop(false)
    const dragging = prop(false)
    const result = createAnimatedPositions(source, makeConfig(), reducedMotion, dragging)
    // animateSignal returns a new Prop, not the same reference
    expect(result).not.toBe(source)
  })

  it('initial value matches source', () => {
    const positions = new Map<string, Position>([
      ['a', { x: 10, y: 20 }],
      ['b', { x: 30, y: 40 }],
    ])
    const source = prop<ReadonlyMap<string, Position>>(positions)
    const reducedMotion = prop(false)
    const dragging = prop(false)
    const result = createAnimatedPositions(source, makeConfig(), reducedMotion, dragging)
    // Initial value should be the same positions (animation starts from current)
    expect(result.value).toEqual(positions)
  })
})
