import { html, svg, attr, svgAttr, on } from '@tempots/dom'
import type { TNode } from '@tempots/dom'
import type { Signal } from '@tempots/core'
import type { ControlsConfig } from '../types/config'

function ZoomInIcon(): TNode {
  return svg.svg(
    svgAttr.viewBox('0 0 16 16'),
    svgAttr.width('16'),
    svgAttr.height('16'),
    attr.class('flow-controls-icon'),
    svg.path(
      svgAttr.d('M8 3v10M3 8h10'),
      svgAttr.fill('none'),
      svgAttr.stroke('currentColor'),
      svgAttr['stroke-width']('1.5'),
      svgAttr['stroke-linecap']('round'),
    ),
  )
}

function ZoomOutIcon(): TNode {
  return svg.svg(
    svgAttr.viewBox('0 0 16 16'),
    svgAttr.width('16'),
    svgAttr.height('16'),
    attr.class('flow-controls-icon'),
    svg.path(
      svgAttr.d('M3 8h10'),
      svgAttr.fill('none'),
      svgAttr.stroke('currentColor'),
      svgAttr['stroke-width']('1.5'),
      svgAttr['stroke-linecap']('round'),
    ),
  )
}

function FitViewIcon(): TNode {
  return svg.svg(
    svgAttr.viewBox('0 0 16 16'),
    svgAttr.width('16'),
    svgAttr.height('16'),
    attr.class('flow-controls-icon'),
    svg.path(
      svgAttr.d('M3 3h4M3 3v4M13 3h-4M13 3v4M3 13h4M3 13v-4M13 13h-4M13 13v-4'),
      svgAttr.fill('none'),
      svgAttr.stroke('currentColor'),
      svgAttr['stroke-width']('1.5'),
      svgAttr['stroke-linecap']('round'),
    ),
  )
}

function LockIcon(): TNode {
  return svg.svg(
    svgAttr.viewBox('0 0 16 16'),
    svgAttr.width('16'),
    svgAttr.height('16'),
    attr.class('flow-controls-icon'),
    svg.path(
      svgAttr.d(
        'M5 7V5a3 3 0 0 1 6 0v2M4 7h8a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z',
      ),
      svgAttr.fill('none'),
      svgAttr.stroke('currentColor'),
      svgAttr['stroke-width']('1.5'),
      svgAttr['stroke-linecap']('round'),
      svgAttr['stroke-linejoin']('round'),
    ),
  )
}

export function Controls(
  config: ControlsConfig,
  zoomIn: () => void,
  zoomOut: () => void,
  fitView: () => void,
  interactionLocked?: Signal<boolean>,
  toggleLock?: () => void,
): TNode {
  const position = config.position ?? 'bottom-left'
  const showZoomIn = config.showZoomIn ?? true
  const showZoomOut = config.showZoomOut ?? true
  const showFitView = config.showFitView ?? true
  const showLock = config.showLock ?? false

  const positionClass = `flow-controls--${position}`

  return html.div(
    attr.class(`flow-controls ${positionClass}`),
    showZoomIn
      ? html.button(
          attr.class('flow-controls-button'),
          attr.type('button'),
          attr.title('Zoom in'),
          on.click(() => zoomIn()),
          ZoomInIcon(),
        )
      : null,
    showZoomOut
      ? html.button(
          attr.class('flow-controls-button'),
          attr.type('button'),
          attr.title('Zoom out'),
          on.click(() => zoomOut()),
          ZoomOutIcon(),
        )
      : null,
    showFitView
      ? html.button(
          attr.class('flow-controls-button'),
          attr.type('button'),
          attr.title('Fit view'),
          on.click(() => fitView()),
          FitViewIcon(),
        )
      : null,
    showLock && interactionLocked && toggleLock
      ? html.button(
          attr.class('flow-controls-button'),
          attr.class(
            interactionLocked.map((l): string => (l ? 'flow-controls-button--active' : '')),
          ),
          attr.type('button'),
          attr.title(interactionLocked.map((l): string => (l ? 'Unlock' : 'Lock'))),
          on.click(() => toggleLock()),
          LockIcon(),
        )
      : null,
  )
}
