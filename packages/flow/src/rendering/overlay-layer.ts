import { html, attr } from '@tempots/dom'
import type { TNode } from '@tempots/dom'

export function OverlayLayer(): TNode {
  return html.div(attr.class('flow-overlay-layer'))
}
