import { html, attr, style } from '@tempots/dom'
import type { TNode } from '@tempots/dom'
import type { Signal } from '@tempots/core'
import type { Viewport } from '../types/layout'

export function TransformLayer(viewport: Signal<Viewport>, ...children: TNode[]): TNode {
  return html.div(
    attr.class('flow-transform-layer'),
    style.transform(viewport.map((v) => `translate(${v.x}px, ${v.y}px) scale(${v.zoom})`)),
    style.transformOrigin('0 0'),
    ...children,
  )
}
