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
