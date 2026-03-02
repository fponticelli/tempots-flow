import { animateSignal, interpolateNumber } from '@tempots/core'
import type { Signal } from '@tempots/core'
import type { Position } from '../types/layout'
import type { LayoutTransitionConfig } from './animation-config'

/**
 * Creates an animated version of a position map signal.
 * When the source positions change, nodes interpolate smoothly to their new locations.
 */
export function createAnimatedPositions(
  sourcePositions: Signal<ReadonlyMap<string, Position>>,
  config: LayoutTransitionConfig,
  isReducedMotion: Signal<boolean>,
): Signal<ReadonlyMap<string, Position>> {
  if (!config.enabled) return sourcePositions

  const effectiveDuration = isReducedMotion.value ? 0 : config.duration
  if (effectiveDuration <= 0) return sourcePositions

  return animateSignal(sourcePositions, {
    duration: effectiveDuration,
    easing: config.easing,
    interpolate: (from, to, delta) =>
      interpolatePositionMap(from, to, delta, config.stagger, config.staggerOrder),
    equals: () => false, // Always treat new map as different
  })
}

function interpolatePositionMap(
  from: ReadonlyMap<string, Position>,
  to: ReadonlyMap<string, Position>,
  delta: number,
  stagger: number,
  staggerOrder: 'distance' | 'index' | 'radial',
): ReadonlyMap<string, Position> {
  if (delta >= 1) return to
  if (delta <= 0) return from

  const result = new Map<string, Position>()
  const toEntries = Array.from(to.entries())

  if (stagger <= 0 || toEntries.length <= 1) {
    // No stagger: all nodes use the same delta
    for (const [id, toPos] of toEntries) {
      const fromPos = from.get(id)
      if (!fromPos) {
        result.set(id, toPos)
      } else {
        result.set(id, {
          x: interpolateNumber(fromPos.x, toPos.x, delta),
          y: interpolateNumber(fromPos.y, toPos.y, delta),
        })
      }
    }
    return result
  }

  // Staggered animation: compute per-node order
  const ordered = computeStaggerOrder(toEntries, from, staggerOrder)
  const maxIndex = ordered.length - 1
  // Stagger is a fraction of the total duration per node step
  // Total effective range: nodes animate within [nodeDelay, nodeDelay + (1 - maxDelay)]
  const maxDelay = Math.min(stagger * maxIndex, 0.5) // Cap at 50% of total duration
  const perNodeDelay = maxIndex > 0 ? maxDelay / maxIndex : 0

  for (let i = 0; i < ordered.length; i++) {
    const entry = ordered[i]!
    const [id, toPos] = entry
    const fromPos = from.get(id)
    if (!fromPos) {
      result.set(id, toPos)
      continue
    }
    const delay = perNodeDelay * i
    const nodeProgress = Math.max(0, Math.min(1, (delta - delay) / (1 - maxDelay)))
    result.set(id, {
      x: interpolateNumber(fromPos.x, toPos.x, nodeProgress),
      y: interpolateNumber(fromPos.y, toPos.y, nodeProgress),
    })
  }

  return result
}

function computeStaggerOrder(
  entries: [string, Position][],
  from: ReadonlyMap<string, Position>,
  order: 'distance' | 'index' | 'radial',
): [string, Position][] {
  if (order === 'index') return entries

  if (order === 'distance') {
    return [...entries].sort((a, b) => {
      const distA = movementDistance(from.get(a[0]), a[1])
      const distB = movementDistance(from.get(b[0]), b[1])
      return distA - distB
    })
  }

  // 'radial': sort by distance from centroid of target positions
  const cx = entries.reduce((sum, [, p]) => sum + p.x, 0) / entries.length
  const cy = entries.reduce((sum, [, p]) => sum + p.y, 0) / entries.length

  return [...entries].sort((a, b) => {
    const dA = Math.hypot(a[1].x - cx, a[1].y - cy)
    const dB = Math.hypot(b[1].x - cx, b[1].y - cy)
    return dA - dB
  })
}

function movementDistance(from: Position | undefined, to: Position): number {
  if (!from) return 0
  return Math.hypot(to.x - from.x, to.y - from.y)
}
