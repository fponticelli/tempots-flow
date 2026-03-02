import { html, attr, style, When } from '@tempots/dom'
import type { TNode } from '@tempots/dom'
import type { Signal } from '@tempots/core'
import type { InteractionState } from '../types/interaction'

export function SelectionBox(interactionState: Signal<InteractionState>): TNode {
  const isSelecting = interactionState.map(
    (s) => s.mode === 'box-selecting' && s.selectionBox !== null,
  )

  return When(isSelecting, () => {
    const rect = interactionState.map((s) => {
      const box = s.selectionBox
      if (!box) return { left: 0, top: 0, width: 0, height: 0 }
      return {
        left: Math.min(box.start.x, box.current.x),
        top: Math.min(box.start.y, box.current.y),
        width: Math.abs(box.current.x - box.start.x),
        height: Math.abs(box.current.y - box.start.y),
      }
    })

    return html.div(
      attr.class('flow-selection-box'),
      style.left(rect.$.left.map((v) => `${v}px`)),
      style.top(rect.$.top.map((v) => `${v}px`)),
      style.width(rect.$.width.map((v) => `${v}px`)),
      style.height(rect.$.height.map((v) => `${v}px`)),
    )
  })
}
