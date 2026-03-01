import { html, attr, on, WithElement, OnDispose } from '@tempots/dom'
import type { TNode } from '@tempots/dom'
import type { Signal, Prop } from '@tempots/core'
import type { Graph } from '../types/graph'
import type { Viewport, ComputedEdgePath, Position, Dimensions } from '../types/layout'
import type { NodeRenderer, EdgeRoutingStrategy } from '../types/config'
import type { InteractionManager, InteractionTarget } from '../interaction/interaction-manager'
import { handleBackgroundClick } from '../interaction/selection-handler'
import { TransformLayer } from './transform-layer'
import { EdgeLayer } from './edge-layer'
import { NodeLayer } from './node-layer'
import { ConnectionPreview } from './connection-preview'
import { OverlayLayer } from './overlay-layer'

export function FlowViewport<N, E>(
  graph: Signal<Graph<N, E>>,
  viewport: Prop<Viewport>,
  positions: Signal<ReadonlyMap<string, Position>>,
  edgePaths: Signal<readonly ComputedEdgePath[]>,
  interactionManager: InteractionManager,
  onDimensionsChange: (nodeId: string, dims: Dimensions) => void,
  setContainerRect: (getter: () => DOMRect) => void,
  edgeRouting: EdgeRoutingStrategy,
  nodeRenderer?: NodeRenderer<N>,
): TNode {
  const { state: interactionState } = interactionManager

  function handleInteraction(event: PointerEvent, target: InteractionTarget) {
    interactionManager.handlePointerDown(event, target)
  }

  return html.div(
    attr.class('flow-viewport'),
    attr.tabindex(0),

    on.pointerdown((e: PointerEvent) => {
      // Only handle if clicking the viewport itself (background)
      const target = e.target as HTMLElement
      if (
        target.classList.contains('flow-viewport') ||
        target.classList.contains('flow-transform-layer')
      ) {
        handleBackgroundClick(interactionState)
        interactionManager.handlePointerDown(e, { type: 'viewport' })
      }
    }),

    on.pointermove((e: PointerEvent) => {
      interactionManager.handlePointerMove(e)
    }),

    on.pointerup((e: PointerEvent) => {
      interactionManager.handlePointerUp(e)
    }),

    on.wheel((e: WheelEvent) => {
      interactionManager.handleWheel(e)
    }),

    // Capture container rect after mount
    WithElement((element: HTMLElement) => {
      setContainerRect(() => element.getBoundingClientRect())
      return OnDispose(() => {
        // no-op, just clean up the reference
      })
    }),

    TransformLayer(
      viewport,
      EdgeLayer(edgePaths, interactionState, handleInteraction),
      NodeLayer(
        graph,
        positions,
        interactionState,
        handleInteraction,
        onDimensionsChange,
        nodeRenderer,
      ),
      ConnectionPreview(interactionState, edgeRouting),
    ),

    OverlayLayer(),
  )
}
