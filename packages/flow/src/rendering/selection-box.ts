import { html, attr, style, When } from '@tempots/dom'
import type { TNode } from '@tempots/dom'
import type { Signal } from '@tempots/core'
import type { InteractionState } from '../types/interaction'

export function SelectionBox(interactionState: Signal<InteractionState>): TNode {
  const isSelecting = interactionState.map(
    (s) => s.mode === 'box-selecting' && s.selectionBox !== null,
  )

  return When(isSelecting, () => {
    const left = interactionState.map((s) => {
      const box = s.selectionBox
      if (!box) return 0
      return Math.min(box.start.x, box.current.x)
    })

    const top = interactionState.map((s) => {
      const box = s.selectionBox
      if (!box) return 0
      return Math.min(box.start.y, box.current.y)
    })

    const width = interactionState.map((s) => {
      const box = s.selectionBox
      if (!box) return 0
      return Math.abs(box.current.x - box.start.x)
    })

    const height = interactionState.map((s) => {
      const box = s.selectionBox
      if (!box) return 0
      return Math.abs(box.current.y - box.start.y)
    })

    return html.div(
      attr.class('flow-selection-box'),
      style.left(left.map((v) => `${v}px`)),
      style.top(top.map((v) => `${v}px`)),
      style.width(width.map((v) => `${v}px`)),
      style.height(height.map((v) => `${v}px`)),
    )
  })
}
