import { html, attr, on, WithElement, OnDispose } from '@tempots/dom'
import type { Renderable } from '@tempots/dom'
import type { Signal } from '@tempots/core'
import type { Graph, PortRef, GraphEdge } from '../types/graph'
import type {
  Viewport,
  ComputedEdgePath,
  Position,
  Dimensions,
  PortPlacement,
  PortOffset,
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
  EdgeMarkerConfig,
  EdgeLabelConfig,
} from '../types/config'
import type { Diagnostic } from '../types/validation'
import type { EnterAnimation, ExitAnimation } from '../animation/animation-config'
import type { FlowTheme } from '../types/theme'
import type { InteractionManager, InteractionTarget } from '../interaction/interaction-manager'
import type { GraphNode } from '../types/graph'
import { TransformLayer } from './transform-layer'
import { EdgeLayer } from './edge-layer'
import { GroupLayer } from './group-layer'
import { NodeLayer } from './node-layer'
import { ConnectionPreview } from './connection-preview'
import { SelectionBox } from './selection-box'
import { OverlayLayer } from './overlay-layer'
import { Background } from './background'
import { AlignmentGuidesLayer } from './alignment-guides-layer'

export interface FlowViewportOptions<N, E> {
  readonly graph: Signal<Graph<N, E>>
  readonly viewport: Signal<Viewport>
  readonly positions: Signal<ReadonlyMap<string, Position>>
  readonly dimensions: Signal<ReadonlyMap<string, Dimensions>>
  readonly edgePaths: Signal<ComputedEdgePath[]>
  readonly interactionManager: InteractionManager
  readonly onDimensionsChange: (nodeId: string, dims: Dimensions) => void
  readonly onPortOffsetsChange: (nodeId: string, offsets: ReadonlyMap<string, PortOffset>) => void
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
  readonly onPortHover?: (port: PortRef) => void
  readonly onPortLeave?: (port: PortRef) => void
  readonly onEdgeDoubleClick?: (edge: GraphEdge<E>, event: PointerEvent) => void
  readonly onEdgeContextMenu?: (edge: GraphEdge<E>, event: PointerEvent) => void
  readonly edgeMarkers?: EdgeMarkerConfig
  readonly edgeLabels?: (edge: GraphEdge<E>) => EdgeLabelConfig | null
  readonly theme?: FlowTheme
  readonly interactionLocked?: Signal<boolean>
  readonly toggleLock?: () => void
  readonly onTouchStart?: (e: TouchEvent) => void
  readonly onTouchMove?: (e: TouchEvent) => void
  readonly onTouchEnd?: (e: TouchEvent) => void
  readonly exitAnimation?: ExitAnimation
  readonly exitDuration?: number
  readonly alignmentGuidesEnabled?: boolean
  readonly visibleNodeIds?: Signal<ReadonlySet<string>>
  readonly visibleEdgeIds?: Signal<ReadonlySet<string>>
  readonly onNodeDoubleClick?: (node: GraphNode<N>, event: PointerEvent) => void
  readonly diagnostics?: Signal<readonly Diagnostic[]>
  readonly onBackgroundDoubleClick?: () => void
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
    onPortOffsetsChange,
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
    const prev = interactionManager.state.value.hoveredPort
    interactionManager.state.update((s) => ({ ...s, hoveredPort: portRef }))
    if (portRef && (!prev || prev.nodeId !== portRef.nodeId || prev.portId !== portRef.portId)) {
      options.onPortHover?.(portRef)
    }
    if (prev && !portRef) {
      options.onPortLeave?.(prev)
    }
  }

  const enterClass =
    options.animationsEnabled && options.enterAnimation && options.enterAnimation !== 'none'
      ? `flow--enter-${options.enterAnimation}`
      : ''

  const exitClass =
    options.animationsEnabled && options.exitAnimation && options.exitAnimation !== 'none'
      ? `flow--exit-${options.exitAnimation}`
      : ''

  return html.div(
    attr.class('flow-viewport'),
    attr.class(allowManualPositioning.map((v): string => (v ? 'flow--manual-positioning' : ''))),
    attr.class(enterClass),
    exitClass ? attr.class(exitClass) : null,
    options.theme?.containerClass ? attr.class(options.theme.containerClass) : null,
    options.interactionLocked
      ? attr.class(options.interactionLocked.map((l): string => (l ? 'flow-viewport--locked' : '')))
      : null,
    options.portPlacement
      ? attr.class(
          options.portPlacement.map((p): string =>
            p === 'vertical' ? 'flow--port-placement-vertical' : '',
          ),
        )
      : null,
    // Theme: apply custom CSS properties
    options.theme?.customProperties
      ? WithElement((el: HTMLElement) => {
          for (const [k, v] of Object.entries(options.theme!.customProperties!)) {
            el.style.setProperty(k, v)
          }
        })
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

    options.onBackgroundDoubleClick
      ? on.dblclick((e: MouseEvent) => {
          const target = e.target as HTMLElement
          if (
            target.classList.contains('flow-viewport') ||
            target.classList.contains('flow-transform-layer') ||
            target.classList.contains('flow-background')
          ) {
            options.onBackgroundDoubleClick!()
          }
        })
      : null,

    on.keydown((e: KeyboardEvent) => {
      interactionManager.handleKeyDown(e)
      options.onKeyDown?.(e)
    }),

    on.keyup((e: KeyboardEvent) => {
      interactionManager.handleKeyUp(e)
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

    // Capture container rect + attach touch handlers after mount
    WithElement((element: HTMLElement) => {
      setContainerRect(() => element.getBoundingClientRect())
      if (options.onTouchStart) {
        const ts = options.onTouchStart
        const tm = options.onTouchMove!
        const te = options.onTouchEnd!
        element.addEventListener('touchstart', ts, { passive: false })
        element.addEventListener('touchmove', tm, { passive: false })
        element.addEventListener('touchend', te)
        return OnDispose(() => {
          element.removeEventListener('touchstart', ts)
          element.removeEventListener('touchmove', tm)
          element.removeEventListener('touchend', te)
        })
      }
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
        options.onEdgeDoubleClick,
        options.onEdgeContextMenu,
        options.edgeMarkers,
        options.edgeLabels,
        options.visibleEdgeIds,
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
        onPortOffsetsChange,
        transitioning,
        nodeRenderer,
        options.portRenderer,
        options.exitAnimation,
        options.exitDuration,
        options.visibleNodeIds,
        options.onNodeDoubleClick,
        options.diagnostics,
      ),
      ConnectionPreview(interactionState, edgeRouting),
      SelectionBox(interactionState),
      options.alignmentGuidesEnabled
        ? AlignmentGuidesLayer(interactionManager.alignmentGuides, interactionManager.isDragging)
        : null,
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
      interactionLocked: options.interactionLocked,
      toggleLock: options.toggleLock,
    }),
  )
}
