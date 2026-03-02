import { prop } from '@tempots/core'
import type { Prop, Signal } from '@tempots/core'
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
  const maxSize = options?.maxSize ?? 100
  const canUndoProp = prop(false)
  const canRedoProp = prop(false)

  let entries: FlowSnapshot<N, E>[] = [{ graph: graphProp.value, positions: getPositions() }]
  let pointer = 0

  function updateFlags() {
    canUndoProp.set(pointer > 0)
    canRedoProp.set(pointer < entries.length - 1)
  }

  function currentSnapshot(): FlowSnapshot<N, E> {
    return { graph: graphProp.value, positions: getPositions() }
  }

  function restore(snap: FlowSnapshot<N, E>) {
    graphProp.set(snap.graph)
    restorePositions(snap.positions)
  }

  return {
    canUndo: canUndoProp,
    canRedo: canRedoProp,

    record() {
      entries = entries.slice(0, pointer + 1)
      entries.push(currentSnapshot())
      if (entries.length > maxSize) {
        entries = entries.slice(entries.length - maxSize)
        pointer = entries.length - 1
      } else {
        pointer++
      }
      updateFlags()
    },

    undo() {
      if (pointer <= 0) return
      // Save current state at the current pointer position
      // so redo can restore it
      entries[pointer] = currentSnapshot()
      pointer--
      restore(entries[pointer]!)
      updateFlags()
    },

    redo() {
      if (pointer >= entries.length - 1) return
      entries[pointer] = currentSnapshot()
      pointer++
      restore(entries[pointer]!)
      updateFlags()
    },
  }
}
