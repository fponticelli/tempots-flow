// Re-export easing functions from @tempots/core instead of custom implementations.
import {
  linear,
  easeInQuad,
  easeOutQuad,
  easeInOutQuad,
  easeInCubic,
  easeOutCubic,
  easeInOutCubic,
  easeInBack,
  easeOutBack,
  easeInOutBack,
} from '@tempots/core'
import type { EasingFn } from '@tempots/core'

/** Backward-compatible alias for `EasingFn` from `@tempots/core`. */
export type EasingFunction = EasingFn

/** Standard easing functions for animations. */
export const easing = {
  linear,
  easeIn: easeInQuad,
  easeOut: easeOutQuad,
  easeInOut: easeInOutQuad,
  easeInCubic,
  easeOutCubic,
  easeInOutCubic,
  easeInBack,
  easeOutBack,
  easeInOutBack,
} as const satisfies Record<string, EasingFunction>

/**
 * Creates a spring easing function using a damped harmonic oscillator simulation.
 * The curve is pre-computed for efficiency.
 */
export function springEasing(stiffness = 100, damping = 10): EasingFunction {
  const steps = 100
  const dt = 1 / steps
  let velocity = 0
  let position = 0
  const values: number[] = [0]

  for (let i = 0; i < steps; i++) {
    const springForce = -stiffness * (position - 1)
    const dampingForce = -damping * velocity
    const acceleration = springForce + dampingForce
    velocity += acceleration * dt
    position += velocity * dt
    values.push(position)
  }

  // Normalize to ensure we end exactly at 1
  const last = values[values.length - 1]!
  if (last !== 1) {
    for (let i = 0; i < values.length; i++) {
      values[i] = values[i]! / last
    }
  }

  return (t: number): number => {
    const idx = t * steps
    const lo = Math.floor(idx)
    const hi = Math.ceil(idx)
    if (lo === hi || hi >= values.length) return values[Math.min(lo, values.length - 1)]!
    const frac = idx - lo
    return values[lo]! * (1 - frac) + values[hi]! * frac
  }
}
