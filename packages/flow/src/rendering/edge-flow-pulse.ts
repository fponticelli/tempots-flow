import { svg, attr, svgAttr, WithElement, OnDispose, createRafLoop } from '@tempots/dom'
import type { TNode } from '@tempots/dom'
import type { Signal } from '@tempots/core'

export interface EdgeFlowPulseConfig {
  /** Color of the pulse. Default: inherits from --flow-edge-color */
  readonly color?: string
  /** Width of the pulse path. Default: 3 */
  readonly width?: number
  /** Speed in pixels per second. Default: 40 */
  readonly speed?: number
  /** Dash pattern. Default: '12 8' */
  readonly dashArray?: string
}

/**
 * Renders a pulsing dash animation along an edge path.
 * Uses createRafLoop from @tempots/dom for the animation loop.
 */
export function EdgeFlowPulse(
  pathD: Signal<string>,
  _edgeId: string,
  config?: EdgeFlowPulseConfig,
): TNode {
  const color = config?.color ?? 'var(--flow-edge-color, #53a8ff)'
  const width = config?.width ?? 3
  const speed = config?.speed ?? 40
  const dashArray = config?.dashArray ?? '12 8'

  // Compute pattern length from dashArray so offset wraps seamlessly
  const patternLength = dashArray.split(/[\s,]+/).reduce((sum, v) => sum + (parseFloat(v) || 0), 0)

  return svg.path(
    attr.class('flow-edge-flow-pulse'),
    svgAttr.d(pathD),
    svgAttr.fill('none'),
    svgAttr.stroke(color),
    svgAttr['stroke-width'](String(width)),
    svgAttr['stroke-dasharray'](dashArray),
    svgAttr['stroke-linecap']('round'),
    svgAttr.opacity('0.85'),
    WithElement((el: Element) => {
      let offset = 0

      const loop = createRafLoop((dt) => {
        offset = (offset + speed * (dt / 1000)) % patternLength
        el.setAttribute('stroke-dashoffset', String(-offset))
      })

      return OnDispose(() => {
        loop.dispose()
      })
    }),
  )
}

/**
 * Creates a pulse flow TNode factory.
 */
export function createEdgeFlowPulse(config?: EdgeFlowPulseConfig) {
  return (pathD: Signal<string>, edgeId: string): TNode => EdgeFlowPulse(pathD, edgeId, config)
}
