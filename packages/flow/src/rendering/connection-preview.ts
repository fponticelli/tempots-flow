import { svg, attr, svgAttr, When, computedOf } from '@tempots/dom'
import type { TNode } from '@tempots/dom'
import type { Signal } from '@tempots/core'
import type { InteractionState } from '../types/interaction'
import type { EdgeRoutingStrategy } from '../types/config'
import type { ComputedPortPosition, PortSide } from '../types/layout'

const OPPOSITE_SIDE: Record<PortSide, PortSide> = {
  left: 'right',
  right: 'left',
  top: 'bottom',
  bottom: 'top',
}

export function ConnectionPreview(
  interactionState: Signal<InteractionState>,
  routing: Signal<EdgeRoutingStrategy>,
): TNode {
  const isConnecting = interactionState.map((s) => s.mode === 'connecting' && s.connection !== null)

  return When(isConnecting, () => {
    const pathD = computedOf(
      interactionState,
      routing,
    )((s, r): string => {
      const conn = s.connection
      if (!conn) return ''

      const source: ComputedPortPosition = {
        x: conn.sourcePosition.x,
        y: conn.sourcePosition.y,
        side: conn.sourceSide,
      }

      const target: ComputedPortPosition = {
        x: conn.currentPosition.x,
        y: conn.currentPosition.y,
        side: OPPOSITE_SIDE[conn.sourceSide],
      }

      return r.computePath({ source, target })
    })

    const isValid = interactionState.map((s) => s.connection?.isValid ?? false)

    return svg.svg(
      attr.class('flow-connection-preview-layer'),
      svg.g(
        attr.class('flow-connection-preview'),
        attr.class(
          isValid.map((v): string =>
            v ? 'flow-connection-preview--valid' : 'flow-connection-preview--invalid',
          ),
        ),
        svg.path(svgAttr.d(pathD), attr.class('flow-connection-preview-path')),
      ),
    )
  })
}
