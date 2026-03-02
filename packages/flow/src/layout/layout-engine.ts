import { prop, computedOf } from '@tempots/core'
import type { Signal, Prop } from '@tempots/core'
import type { Graph } from '../types/graph'
import type { LayoutAlgorithm } from '../types/config'
import type { Position, Dimensions, LayoutState } from '../types/layout'
import { manualLayout } from './manual'

export interface LayoutEngine {
  readonly layoutState: Signal<LayoutState>
  readonly positions: Signal<ReadonlyMap<string, Position>>
  readonly dimensions: Signal<ReadonlyMap<string, Dimensions>>
  readonly transitioning: Signal<boolean>
  setNodePosition(nodeId: string, position: Position): void
  updateDimensions(nodeId: string, dims: Dimensions): void
  setAlgorithm(algorithm: LayoutAlgorithm): void
}

export function createLayoutEngine<N, E>(
  graph: Signal<Graph<N, E>>,
  algorithm: LayoutAlgorithm = manualLayout,
  initialPositions: ReadonlyMap<string, Position> = new Map(),
  transitionDuration = 300,
): LayoutEngine {
  const algorithmProp: Prop<LayoutAlgorithm> = prop(algorithm)
  const positionOverrides: Prop<ReadonlyMap<string, Position>> = prop(initialPositions, mapsEqual)
  const dimensionMap: Prop<ReadonlyMap<string, Dimensions>> = prop(
    new Map() as ReadonlyMap<string, Dimensions>,
    mapsEqual,
  )
  const transitioningProp = prop(false)

  let transitionTimer: ReturnType<typeof setTimeout> | null = null

  const positions = computedOf(
    graph,
    dimensionMap,
    positionOverrides,
    algorithmProp,
  )((g, dims, overrides, algo) => algo.layout(g, dims, overrides))

  const layoutState = computedOf(positions, dimensionMap)((pos, dims) => ({
    positions: pos,
    dimensions: dims,
  }))

  function triggerTransition() {
    if (transitionDuration <= 0) return
    if (transitionTimer) clearTimeout(transitionTimer)
    transitioningProp.set(true)
    transitionTimer = setTimeout(() => {
      transitioningProp.set(false)
      transitionTimer = null
    }, transitionDuration)
  }

  return {
    layoutState,
    positions,
    dimensions: dimensionMap,
    transitioning: transitioningProp,

    setNodePosition(nodeId: string, position: Position) {
      positionOverrides.update((overrides) => {
        const next = new Map(overrides)
        next.set(nodeId, position)
        return next
      })
    },

    updateDimensions(nodeId: string, dims: Dimensions) {
      dimensionMap.update((current) => {
        const existing = current.get(nodeId)
        if (existing && existing.width === dims.width && existing.height === dims.height) {
          return current
        }
        const next = new Map(current)
        next.set(nodeId, dims)
        return next
      })
    },

    setAlgorithm(algo: LayoutAlgorithm) {
      algorithmProp.set(algo)
      triggerTransition()
    },
  }
}

function mapsEqual<K, V>(a: ReadonlyMap<K, V>, b: ReadonlyMap<K, V>): boolean {
  return a === b
}
