import { prop } from '@tempots/core'
import type { Prop, Signal } from '@tempots/core'
import type { InteractionState } from '../types/interaction'
import { createInitialInteractionState } from '../types/interaction'
import type { Position, Viewport } from '../types/layout'
import type { FlowConfig } from '../types/config'
import type { Graph, GraphNode, GraphEdge } from '../types/graph'
import { handlePanStart, handlePanMove, handlePanEnd } from './pan-handler'
import { handleZoom } from './zoom-handler'
import { handleDragStart, handleDragMove, handleDragEnd } from './drag-handler'
import { handleNodeClick, handleEdgeClick } from './selection-handler'
import { screenToGraph } from '../core/coordinate-utils'

export type InteractionTarget =
  | { readonly type: 'viewport' }
  | { readonly type: 'node'; readonly nodeId: string }
  | { readonly type: 'edge'; readonly edgeId: string }
  | { readonly type: 'port'; readonly nodeId: string; readonly portId: string }

export interface InteractionManager {
  readonly state: Prop<InteractionState>
  handlePointerDown(event: PointerEvent, target: InteractionTarget): void
  handlePointerMove(event: PointerEvent): void
  handlePointerUp(event: PointerEvent): void
  handleWheel(event: WheelEvent): void
}

export function createInteractionManager<N, E>(
  viewportProp: Prop<Viewport>,
  getContainerRect: () => DOMRect,
  config: FlowConfig<N, E>,
  graphSignal: Signal<Graph<N, E>>,
  setNodePosition: (nodeId: string, position: Position) => void,
): InteractionManager {
  const state = prop(createInitialInteractionState())

  const multiKey = config.multiSelectionKey ?? 'shift'

  function isMultiSelect(event: PointerEvent | MouseEvent): boolean {
    switch (multiKey) {
      case 'shift':
        return event.shiftKey
      case 'meta':
        return event.metaKey
      case 'ctrl':
        return event.ctrlKey
    }
  }

  function graphPos(event: PointerEvent | MouseEvent): Position {
    return screenToGraph(event.clientX, event.clientY, viewportProp.value, getContainerRect())
  }

  return {
    state,

    handlePointerDown(event: PointerEvent, target: InteractionTarget) {
      if (target.type === 'viewport') {
        if (config.panEnabled !== false) {
          handlePanStart(state, event)
        }
        return
      }

      if (target.type === 'node') {
        if (config.nodesSelectable !== false) {
          handleNodeClick(state, target.nodeId, isMultiSelect(event))
        }
        if (config.nodesDraggable !== false) {
          const selected = state.value.selectedNodeIds
          const dragIds = selected.has(target.nodeId) ? [...selected] : [target.nodeId]
          handleDragStart(state, dragIds, graphPos(event))
        }
        config.events?.onNodeClick?.(
          graphSignal.value.nodes.find((n) => n.id === target.nodeId) as GraphNode<N>,
          event,
        )
        return
      }

      if (target.type === 'edge') {
        if (config.edgesSelectable !== false) {
          handleEdgeClick(state, target.edgeId, isMultiSelect(event))
        }
        config.events?.onEdgeClick?.(
          graphSignal.value.edges.find((e) => e.id === target.edgeId) as GraphEdge<E>,
          event,
        )
        return
      }
    },

    handlePointerMove(event: PointerEvent) {
      const mode = state.value.mode

      if (mode === 'panning') {
        handlePanMove(state, viewportProp, event)
        return
      }

      if (mode === 'dragging-nodes') {
        const drag = state.value.drag
        if (!drag) return
        const currentGraph = graphPos(event)
        handleDragMove(
          drag,
          currentGraph,
          setNodePosition,
          config.snapToGrid ?? false,
          config.snapGridSize ?? 20,
        )
        state.update((s) => ({
          ...s,
          drag: { ...drag, startMousePosition: drag.startMousePosition },
        }))
        return
      }
    },

    handlePointerUp(_event: PointerEvent) {
      const mode = state.value.mode

      if (mode === 'panning') {
        handlePanEnd(state)
        return
      }

      if (mode === 'dragging-nodes') {
        handleDragEnd(state, config.events)
        return
      }

      // If still idle and clicked on viewport background
      if (mode === 'idle') {
        // Background click handled by pointerdown target check
      }
    },

    handleWheel(event: WheelEvent) {
      if (config.zoomEnabled !== false) {
        handleZoom(viewportProp, event, getContainerRect(), {
          minZoom: config.minZoom ?? 0.1,
          maxZoom: config.maxZoom ?? 4,
          zoomStep: config.zoomStep ?? 0.1,
        })
      }
    },
  }
}
