import { html, attr, on, WithElement } from '@tempots/dom'
import type { Renderable } from '@tempots/dom'
import type { Signal } from '@tempots/core'
import type { Graph } from '../types/graph'
import type { PortRef } from '../types/graph'
import type { Viewport, ComputedEdgePath, Position, Dimensions } from '../types/layout'
import type { NodeRenderer, EdgeRoutingStrategy } from '../types/config'
import type { InteractionManager, InteractionTarget } from '../interaction/interaction-manager'
import { TransformLayer } from './transform-layer'
import { EdgeLayer } from './edge-layer'
import { NodeLayer } from './node-layer'
import { ConnectionPreview } from './connection-preview'
import { SelectionBox } from './selection-box'
import { OverlayLayer } from './overlay-layer'

export function FlowViewport<N, E>(
  graph: Signal<Graph<N, E>>,
  viewport: Signal<Viewport>,
  positions: Signal<ReadonlyMap<string, Position>>,
  edgePaths: Signal<ComputedEdgePath[]>,
  interactionManager: InteractionManager,
  onDimensionsChange: (nodeId: string, dims: Dimensions) => void,
  setContainerRect: (getter: () => DOMRect) => void,
  edgeRouting: EdgeRoutingStrategy,
  transitioning: Signal<boolean>,
  nodeRenderer?: NodeRenderer<N>,
): Renderable {
  const interactionState = interactionManager.state

  function handleInteraction(event: PointerEvent, target: InteractionTarget) {
    interactionManager.handlePointerDown(event, target)
  }

  function setHoveredNode(nodeId: string | null) {
    interactionManager.state.update((s) => ({ ...s, hoveredNodeId: nodeId }))
  }

  function setHoveredEdge(edgeId: string | null) {
    interactionManager.state.update((s) => ({ ...s, hoveredEdgeId: edgeId }))
  }

  function setHoveredPort(portRef: PortRef | null) {
    interactionManager.state.update((s) => ({ ...s, hoveredPort: portRef }))
  }

  return html.div(
    attr.class('flow-viewport'),
    attr.tabindex(0),

    on.pointerdown((e: PointerEvent) => {
      const target = e.target as HTMLElement
      if (
        target.classList.contains('flow-viewport') ||
        target.classList.contains('flow-transform-layer')
      ) {
        interactionManager.state.update((s) => ({
          ...s,
          selectedNodeIds: new Set<string>(),
          selectedEdgeIds: new Set<string>(),
        }))
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
    }),

    TransformLayer(
      viewport,
      EdgeLayer(edgePaths, interactionState, handleInteraction, setHoveredEdge),
      NodeLayer(
        graph,
        positions,
        interactionState,
        handleInteraction,
        setHoveredNode,
        setHoveredPort,
        onDimensionsChange,
        transitioning,
        nodeRenderer,
      ),
      ConnectionPreview(interactionState, edgeRouting),
      SelectionBox(interactionState),
    ),

    OverlayLayer(),
  )
}
