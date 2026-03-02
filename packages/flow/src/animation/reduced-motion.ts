import { prop } from '@tempots/core'
import type { Prop } from '@tempots/core'

/** Creates a signal that tracks the `prefers-reduced-motion: reduce` media query. */
export function createReducedMotionSignal(): Prop<boolean> {
  const mql =
    typeof window !== 'undefined' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null
  const signal = prop(mql?.matches ?? false)
  if (mql) {
    const handler = (e: MediaQueryListEvent) => signal.set(e.matches)
    mql.addEventListener('change', handler)
  }
  return signal
}
