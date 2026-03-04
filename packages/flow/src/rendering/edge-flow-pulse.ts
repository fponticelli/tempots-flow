import { svg, attr, svgAttr } from '@tempots/dom'
import type { TNode } from '@tempots/dom'
import type { Signal } from '@tempots/core'

export interface EdgeFlowPulseConfig {
  /** Color of the pulse. Default: inherits from --flow-edge-color */
  readonly color?: string
  /** Width of the pulse path. Default: 3 */
  readonly width?: number
  /** Animation speed CSS value. Default: '1.5s' */
  readonly speed?: string
  /** Dash pattern. Default: '12 8' */
  readonly dashArray?: string
}

/**
 * Renders a pulsing dash animation along an edge path.
 * Uses CSS animation for the dash offset.
 */
export function EdgeFlowPulse(
  pathD: Signal<string>,
  _edgeId: string,
  config?: EdgeFlowPulseConfig,
): TNode {
  const color = config?.color ?? 'var(--flow-edge-color, #53a8ff)'
  const width = config?.width ?? 3
  const pulseSpeed = config?.speed ?? '1.5s'
  const dashArray = config?.dashArray ?? '12 8'

  return svg.path(
    attr.class('flow-edge-flow-pulse'),
    svgAttr.d(pathD),
    svgAttr.fill('none'),
    svgAttr.stroke(color),
    svgAttr['stroke-width'](String(width)),
    svgAttr['stroke-dasharray'](dashArray),
    svgAttr['stroke-linecap']('round'),
    svgAttr.opacity('0.6'),
    // The CSS animation drives the dashoffset
    attr.style(`animation: flow-edge-pulse ${pulseSpeed} linear infinite`),
  )
}

/**
 * Creates a pulse flow TNode factory.
 */
export function createEdgeFlowPulse(config?: EdgeFlowPulseConfig) {
  return (pathD: Signal<string>, edgeId: string): TNode => EdgeFlowPulse(pathD, edgeId, config)
}
