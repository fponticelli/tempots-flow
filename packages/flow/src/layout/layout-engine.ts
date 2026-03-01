import { prop, computed } from '@tempots/core'
import type { Signal, Prop } from '@tempots/core'
import type { Graph } from '../types/graph'
import type { LayoutAlgorithm } from '../types/config'
import type { Position, Dimensions, LayoutState } from '../types/layout'
import { manualLayout } from './manual'

export interface LayoutEngine {
  readonly layoutState: Signal<LayoutState>
  readonly positions: Signal<ReadonlyMap<string, Position>>
  readonly dimensions: Signal<ReadonlyMap<string, Dimensions>>
  setNodePosition(nodeId: string, position: Position): void
  updateDimensions(nodeId: string, dims: Dimensions): void
}

export function createLayoutEngine<N, E>(
  graph: Signal<Graph<N, E>>,
  algorithm: LayoutAlgorithm = manualLayout,
  initialPositions: ReadonlyMap<string, Position> = new Map(),
): LayoutEngine {
  const positionOverrides: Prop<ReadonlyMap<string, Position>> = prop(initialPositions, mapsEqual)
  const dimensionMap: Prop<ReadonlyMap<string, Dimensions>> = prop(
    new Map() as ReadonlyMap<string, Dimensions>,
    mapsEqual,
  )

  const positions = computed(() => {
    const g = graph.value
    const dims = dimensionMap.value
    const overrides = positionOverrides.value
    return algorithm.layout(g.nodes, dims, overrides)
  }, [graph, dimensionMap, positionOverrides])

  const layoutState = computed(
    () => ({
      positions: positions.value,
      dimensions: dimensionMap.value,
    }),
    [positions, dimensionMap],
  )

  return {
    layoutState,
    positions,
    dimensions: dimensionMap,

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
  }
}

function mapsEqual<K, V>(a: ReadonlyMap<K, V>, b: ReadonlyMap<K, V>): boolean {
  return a === b
}
