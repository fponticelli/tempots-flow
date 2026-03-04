import { html, attr } from '@tempots/dom'
import type { TNode } from '@tempots/dom'
import type { Signal } from '@tempots/core'
import type { Position, Dimensions, Viewport } from '../types/layout'
import type { ControlsConfig, MinimapConfig } from '../types/config'
import { Controls } from './controls'
import { Minimap } from './minimap'

export interface OverlayLayerOptions {
  readonly controls?: ControlsConfig | false
  readonly minimap?: MinimapConfig | false
  readonly positions: Signal<ReadonlyMap<string, Position>>
  readonly dimensions: Signal<ReadonlyMap<string, Dimensions>>
  readonly viewport: Signal<Viewport>
  readonly setViewport: (v: Partial<Viewport>) => void
  readonly getContainerRect: () => DOMRect
  readonly zoomIn: () => void
  readonly zoomOut: () => void
  readonly fitView: () => void
  readonly interactionLocked?: Signal<boolean>
  readonly toggleLock?: () => void
}

export function OverlayLayer(options: OverlayLayerOptions): TNode {
  return html.div(
    attr.class('flow-ui-layer'),

    options.controls !== false
      ? Controls(
          options.controls ?? {},
          options.zoomIn,
          options.zoomOut,
          options.fitView,
          options.interactionLocked,
          options.toggleLock,
        )
      : null,

    options.minimap !== false
      ? Minimap(
          options.minimap ?? {},
          options.positions,
          options.dimensions,
          options.viewport,
          options.setViewport,
          options.getContainerRect,
        )
      : null,
  )
}
