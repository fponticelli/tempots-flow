import type { Prop } from '@tempots/core'
import type { InteractionState } from '../types/interaction'
import type { Viewport } from '../types/layout'

let panStartX = 0
let panStartY = 0

export function handlePanStart(state: Prop<InteractionState>, event: PointerEvent): void {
  panStartX = event.clientX
  panStartY = event.clientY
  state.update((s) => ({ ...s, mode: 'panning' }))
}

export function handlePanMove(
  _state: Prop<InteractionState>,
  viewportProp: Prop<Viewport>,
  event: PointerEvent,
): void {
  const dx = event.clientX - panStartX
  const dy = event.clientY - panStartY

  viewportProp.update((v) => ({
    ...v,
    x: v.x + dx,
    y: v.y + dy,
  }))

  panStartX = event.clientX
  panStartY = event.clientY
}

export function handlePanEnd(state: Prop<InteractionState>): void {
  state.update((s) => ({ ...s, mode: 'idle' }))
}
