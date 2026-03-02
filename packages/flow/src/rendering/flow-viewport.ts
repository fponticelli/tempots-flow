import { html, attr, on, WithElement } from '@tempots/dom'
import type { Renderable } from '@tempots/dom'
import type { Signal } from '@tempots/core'
import type { Graph } from '../types/graph'
import type { PortRef } from '../types/graph'
import type {
  Viewport,
  ComputedEdgePath,
  Position,
  Dimensions,
  PortPlacement,
} from '../types/layout'
import type {
  NodeRenderer,
  EdgeRenderer,
  PortRenderer,
  EdgeRoutingStrategy,
  BackgroundConfig,
  BackgroundType,
  ControlsConfig,
  MinimapConfig,
} from '../types/config'
import type { EnterAnimation } from '../animation/animation-config'
import type { InteractionManager, InteractionTarget } from '../interaction/interaction-manager'
import { TransformLayer } from './transform-layer'
import { EdgeLayer } from './edge-layer'
import { GroupLayer } from './group-layer'
import { NodeLayer } from './node-layer'
import { ConnectionPreview } from './connection-preview'
import { SelectionBox } from './selection-box'
import { OverlayLayer } from './overlay-layer'
import { Background } from './background'

export interface FlowViewportOptions<N, E> {
  readonly graph: Signal<Graph<N, E>>
  readonly viewport: Signal<Viewport>
  readonly positions: Signal<ReadonlyMap<string, Position>>
  readonly dimensions: Signal<ReadonlyMap<string, Dimensions>>
  readonly edgePaths: Signal<ComputedEdgePath[]>
  readonly interactionManager: InteractionManager
  readonly onDimensionsChange: (nodeId: string, dims: Dimensions) => void
  readonly setContainerRect: (getter: () => DOMRect) => void
  readonly edgeRouting: Signal<EdgeRoutingStrategy>
  readonly transitioning: Signal<boolean>
  readonly allowManualPositioning: Signal<boolean>
  readonly nodeRenderer?: NodeRenderer<N>
  readonly edgeRenderer?: EdgeRenderer<E>
  readonly portRenderer?: PortRenderer
  readonly background?: BackgroundConfig | false
  readonly controls?: ControlsConfig | false
  readonly minimap?: MinimapConfig | false
  readonly setViewport: (v: Partial<Viewport>) => void
  readonly getContainerRect: () => DOMRect
  readonly zoomIn: () => void
  readonly zoomOut: () => void
  readonly fitView: () => void
  readonly onKeyDown?: (event: KeyboardEvent) => void
  readonly onViewportInteraction?: () => void
  readonly enterAnimation?: EnterAnimation
  readonly animationsEnabled?: boolean
  readonly gridVisible?: Signal<boolean>
  readonly gridType?: Signal<BackgroundType>
  readonly portPlacement?: Signal<PortPlacement>
}

export function FlowViewport<N, E>(options: FlowViewportOptions<N, E>): Renderable {
  const {
    graph,
    viewport,
    positions,
    dimensions,
    edgePaths,
    interactionManager,
    onDimensionsChange,
    setContainerRect,
    edgeRouting,
    transitioning,
    allowManualPositioning,
    nodeRenderer,
  } = options
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

  const enterClass =
    options.animationsEnabled && options.enterAnimation && options.enterAnimation !== 'none'
      ? `flow--enter-${options.enterAnimation}`
      : ''

  return html.div(
    attr.class('flow-viewport'),
    attr.class(allowManualPositioning.map((v): string => (v ? 'flow--manual-positioning' : ''))),
    attr.class(enterClass),
    options.portPlacement
      ? attr.class(
          options.portPlacement.map((p): string =>
            p === 'vertical' ? 'flow--port-placement-vertical' : '',
          ),
        )
      : null,
    attr.tabindex(0),

    on.pointerdown((e: PointerEvent) => {
      ;(e.currentTarget as HTMLElement).focus({ preventScroll: true })
      options.onViewportInteraction?.()
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

    on.keydown((e: KeyboardEvent) => {
      options.onKeyDown?.(e)
    }),

    on.pointermove((e: PointerEvent) => {
      interactionManager.handlePointerMove(e)
    }),

    on.pointerup((e: PointerEvent) => {
      interactionManager.handlePointerUp(e)
    }),

    on.wheel((e: WheelEvent) => {
      options.onViewportInteraction?.()
      interactionManager.handleWheel(e)
    }),

    // Capture container rect after mount
    WithElement((element: HTMLElement) => {
      setContainerRect(() => element.getBoundingClientRect())
    }),

    options.background !== false
      ? Background(viewport, options.background ?? {}, options.gridVisible, options.gridType)
      : null,

    TransformLayer(
      viewport,
      EdgeLayer(
        edgePaths,
        graph,
        interactionState,
        handleInteraction,
        setHoveredEdge,
        transitioning,
        options.edgeRenderer,
      ),
      GroupLayer(graph, positions, dimensions, interactionState, handleInteraction, transitioning),
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
        options.portRenderer,
      ),
      ConnectionPreview(interactionState, edgeRouting),
      SelectionBox(interactionState),
    ),

    OverlayLayer({
      controls: options.controls,
      minimap: options.minimap,
      positions,
      dimensions,
      viewport,
      setViewport: options.setViewport,
      getContainerRect: options.getContainerRect,
      zoomIn: options.zoomIn,
      zoomOut: options.zoomOut,
      fitView: options.fitView,
    }),
  )
}
