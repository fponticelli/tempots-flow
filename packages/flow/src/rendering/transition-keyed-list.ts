import { KeyedForEach, Fragment, WithScope } from '@tempots/dom'
import type { TNode } from '@tempots/dom'
import type { Signal } from '@tempots/core'
import { prop } from '@tempots/core'

export interface TransitionKeyedForEachOptions<T> {
  readonly items: Signal<T[]>
  readonly key: (item: T) => string
  readonly render: (item: Signal<T>, isExiting: Signal<boolean>) => TNode
  readonly exitDuration: number
}

interface TrackedItem<T> {
  readonly item: T
  readonly exiting: boolean
}

export function TransitionKeyedForEach<T>(options: TransitionKeyedForEachOptions<T>): TNode {
  const { items, key, render, exitDuration } = options
  const exitTimers = new Map<string, ReturnType<typeof setTimeout>>()

  const tracked = prop<TrackedItem<T>[]>(items.value.map((item) => ({ item, exiting: false })))

  return Fragment(
    WithScope((scope) => {
      scope.effectOf(items)((currentItems) => {
        const currentKeys = new Set(currentItems.map(key))
        const prevTracked = tracked.value

        // Find items that were just removed (not yet flagged as exiting)
        const newlyRemovedItems = prevTracked.filter(
          (t) => !currentKeys.has(key(t.item)) && !t.exiting,
        )

        // Start exit timers for newly removed items
        for (const t of newlyRemovedItems) {
          const k = key(t.item)
          if (!exitTimers.has(k)) {
            exitTimers.set(
              k,
              setTimeout(() => {
                exitTimers.delete(k)
                tracked.update((prev) => prev.filter((p) => key(p.item) !== k))
              }, exitDuration),
            )
          }
        }

        // Active items currently in the list (not exiting)
        const active = currentItems.map((item) => ({ item, exiting: false }))

        // Items that are still mid-exit (timer running)
        const stillExiting = prevTracked.filter((t) => t.exiting && exitTimers.has(key(t.item)))

        // Newly removed items entering exit state
        const newlyExiting = newlyRemovedItems.map((t) => ({
          item: t.item,
          exiting: true,
        }))

        tracked.set([...active, ...stillExiting, ...newlyExiting] as TrackedItem<T>[])
      })

      scope.onDispose(() => {
        for (const timer of exitTimers.values()) {
          clearTimeout(timer)
        }
        exitTimers.clear()
      })

      return KeyedForEach(
        tracked,
        (t) => key(t.item),
        (trackedSignal) => {
          const itemSignal = trackedSignal.map((t) => t.item)
          const isExiting = trackedSignal.map((t) => t.exiting)
          return render(itemSignal, isExiting)
        },
      )
    }),
  )
}
