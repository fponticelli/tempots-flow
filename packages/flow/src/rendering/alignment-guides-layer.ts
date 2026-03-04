import { html, attr, WithElement, OnDispose } from '@tempots/dom'
import type { TNode } from '@tempots/dom'
import type { Signal } from '@tempots/core'
import { effectOf } from '@tempots/core'
import type { AlignmentGuide } from '../interaction/alignment-guides'

/**
 * Renders alignment guide lines during node drag.
 * Uses direct DOM manipulation for performance since guides change every frame.
 */
export function AlignmentGuidesLayer(
  guides: Signal<readonly AlignmentGuide[]>,
  visible: Signal<boolean>,
): TNode {
  return html.div(
    attr.class('flow-alignment-guides-layer'),
    WithElement((el: HTMLElement) => {
      const dispose = effectOf(
        guides,
        visible,
      )((gs, v) => {
        // Remove existing guides
        el.innerHTML = ''

        if (!v || gs.length === 0) return

        for (const g of gs) {
          const line = document.createElement('div')
          line.className =
            g.axis === 'horizontal'
              ? 'flow-alignment-guide flow-alignment-guide--horizontal'
              : 'flow-alignment-guide flow-alignment-guide--vertical'

          if (g.axis === 'horizontal') {
            line.style.cssText = `top: ${g.position}px; left: 0; width: 100000px; margin-left: -50000px;`
          } else {
            line.style.cssText = `left: ${g.position}px; top: 0; height: 100000px; margin-top: -50000px;`
          }

          el.appendChild(line)
        }
      })

      return OnDispose(dispose)
    }),
  )
}
