import { prop, propHistory } from '@tempots/core'
import type { Signal, Prop } from '@tempots/core'
import type { Graph } from '../types/graph'
import type { Position } from '../types/layout'

export interface FlowSnapshot<N, E> {
  readonly graph: Graph<N, E>
  readonly positions: ReadonlyMap<string, Position>
}

export interface HistoryManager<_N = unknown, _E = unknown> {
  readonly canUndo: Signal<boolean>
  readonly canRedo: Signal<boolean>
  undo(): void
  redo(): void
  record(): void
}

export function createHistoryManager<N, E>(
  graphProp: Prop<Graph<N, E>>,
  getPositions: () => ReadonlyMap<string, Position>,
  restorePositions: (positions: ReadonlyMap<string, Position>) => void,
  options?: { maxSize?: number },
): HistoryManager<N, E> {
  const snapshotProp = prop<FlowSnapshot<N, E>>({
    graph: graphProp.value,
    positions: getPositions(),
  })

  const history = propHistory(snapshotProp, { maxSize: options?.maxSize ?? 100 })

  function restore(snap: FlowSnapshot<N, E>) {
    graphProp.set(snap.graph)
    restorePositions(snap.positions)
  }

  return {
    canUndo: history.canUndo,
    canRedo: history.canRedo,

    record() {
      history.set({ graph: graphProp.value, positions: getPositions() })
    },

    undo() {
      history.undo()
      restore(snapshotProp.value)
    },

    redo() {
      history.redo()
      restore(snapshotProp.value)
    },
  }
}
