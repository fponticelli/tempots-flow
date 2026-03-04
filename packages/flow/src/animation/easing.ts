/** A function that maps progress [0, 1] to eased progress [0, 1]. */
export type EasingFunction = (t: number) => number

/** Standard easing functions for animations. */
export const easing = {
  linear: (t: number): number => t,
  easeIn: (t: number): number => t * t,
  easeOut: (t: number): number => t * (2 - t),
  easeInOut: (t: number): number => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
  easeInCubic: (t: number): number => t * t * t,
  easeOutCubic: (t: number): number => {
    const t1 = t - 1
    return t1 * t1 * t1 + 1
  },
  easeInOutCubic: (t: number): number =>
    t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1,
  easeInBack: (t: number): number => {
    const s = 1.70158
    return t * t * ((s + 1) * t - s)
  },
  easeOutBack: (t: number): number => {
    const s = 1.70158
    const t1 = t - 1
    return t1 * t1 * ((s + 1) * t1 + s) + 1
  },
  easeInOutBack: (t: number): number => {
    const s = 1.70158 * 1.525
    const t2 = t * 2
    if (t2 < 1) return 0.5 * (t2 * t2 * ((s + 1) * t2 - s))
    const t3 = t2 - 2
    return 0.5 * (t3 * t3 * ((s + 1) * t3 + s) + 2)
  },
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
