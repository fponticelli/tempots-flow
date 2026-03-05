import { prop } from '@tempots/core'
import type { Prop, Signal } from '@tempots/core'
import type { InteractionState } from '../types/interaction'
import { createInitialInteractionState } from '../types/interaction'
import type {
  Position,
  Viewport,
  Dimensions,
  PortPlacement,
  PortOffset,
  PortSide,
} from '../types/layout'
import type { FlowConfig } from '../types/config'
import type { Graph, GraphNode, GraphEdge } from '../types/graph'
import type { PanConfig } from './pan-handler'
import { handlePanStart, handlePanMove, handlePanEnd, computeContentBounds } from './pan-handler'
import { handleZoom } from './zoom-handler'
import { handleDragStart, handleDragMove, handleDragEnd, type DragConfig } from './drag-handler'
import {
  handleConnectionStart,
  handleConnectionMove,
  handleConnectionEnd,
} from './connection-handler'
import {
  handleBoxSelectStart,
  handleBoxSelectMove,
  handleBoxSelectEnd,
} from './box-selection-handler'
import { handleNodeClick, handleEdgeClick } from './selection-handler'
import { screenToGraph } from '../core/coordinate-utils'
import { computePortPositionsForNode } from '../edges/port-positions'
import { expandGroupDragIds } from '../layout/compound-utils'
import type { AlignmentGuide } from './alignment-guides'

export type InteractionTarget =
  | { readonly type: 'viewport' }
  | { readonly type: 'node'; readonly nodeId: string }
  | { readonly type: 'edge'; readonly edgeId: string }
  | { readonly type: 'port'; readonly nodeId: string; readonly portId: string }

export interface InteractionManager {
  readonly state: Prop<InteractionState>
  readonly alignmentGuides: Signal<readonly AlignmentGuide[]>
  readonly isDragging: Signal<boolean>
  handlePointerDown(event: PointerEvent, target: InteractionTarget): void
  handlePointerMove(event: PointerEvent): void
  handlePointerUp(event: PointerEvent): void
  handleWheel(event: WheelEvent): void
  handleKeyDown(event: KeyboardEvent): void
  handleKeyUp(event: KeyboardEvent): void
}

export function createInteractionManager<N, E>(
  viewportProp: Prop<Viewport>,
  getContainerRect: () => DOMRect,
  config: FlowConfig<N, E>,
  graphSignal: Signal<Graph<N, E>>,
  setNodePosition: (nodeId: string, position: Position) => void,
  positions: Signal<ReadonlyMap<string, Position>>,
  dimensions: Signal<ReadonlyMap<string, Dimensions>>,
  allowManualPositioning: Signal<boolean>,
  portPlacement: Signal<PortPlacement>,
  portOffsets: Signal<ReadonlyMap<string, ReadonlyMap<string, PortOffset>>>,
): InteractionManager {
  const state = prop(createInitialInteractionState())
  const alignmentGuidesProp = prop<readonly AlignmentGuide[]>([])
  const isDragging = state.map((s) => s.mode === 'dragging-nodes')
  let spaceHeld = false

  const multiKey = config.multiSelectionKey ?? 'shift'

  const panConfig: PanConfig = {
    inertia: config.panInertia,
    bounds: config.panBounds,
  }

  const dragConfig: DragConfig = {
    alignmentGuides: config.alignmentGuides,
    dragBounds: config.dragBounds,
  }

  const boxSelectModifier = config.boxSelection?.modifier ?? 'shift'

  function isBoxSelectModifier(event: PointerEvent | MouseEvent): boolean {
    switch (boxSelectModifier) {
      case 'shift':
        return event.shiftKey
      case 'meta':
        return event.metaKey
      case 'ctrl':
        return event.ctrlKey
    }
  }

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
    alignmentGuides: alignmentGuidesProp,
    isDragging,

    handlePointerDown(event: PointerEvent, target: InteractionTarget) {
      if (target.type === 'viewport') {
        if (isBoxSelectModifier(event)) {
          handleBoxSelectStart(state, graphPos(event))
        } else if (config.panEnabled !== false) {
          handlePanStart(state, event)
        }
        return
      }

      if (target.type === 'node') {
        // Space-bar pan: treat node click as viewport pan
        if (spaceHeld && config.panEnabled !== false) {
          handlePanStart(state, event)
          return
        }
        if (config.nodesSelectable !== false) {
          handleNodeClick(state, target.nodeId, isMultiSelect(event))
        }
        if (config.nodesDraggable !== false && allowManualPositioning.value) {
          const selected = state.value.selectedNodeIds
          let dragIds = selected.has(target.nodeId) ? [...selected] : [target.nodeId]
          dragIds = expandGroupDragIds(dragIds, graphSignal.value.nodes)
          handleDragStart(state, dragIds, graphPos(event), positions.value)
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

      if (target.type === 'port') {
        const node = graphSignal.value.nodes.find((n) => n.id === target.nodeId)
        if (!node) return

        const nodePos = positions.value.get(target.nodeId)
        const nodeDims = dimensions.value.get(target.nodeId)
        if (!nodePos || !nodeDims) return

        const measured = portOffsets.value.get(target.nodeId)
        const portPositions = measured
          ? toMeasuredPositions(nodePos, node.ports, measured)
          : computePortPositionsForNode(nodePos, nodeDims, node.ports, portPlacement.value)
        const portPos = portPositions.get(target.portId)
        if (!portPos) return

        const portRef = { nodeId: target.nodeId, portId: target.portId }
        handleConnectionStart(state, portRef, portPos.side, { x: portPos.x, y: portPos.y })
        config.events?.onConnectionStart?.(portRef)
        return
      }
    },

    handlePointerMove(event: PointerEvent) {
      const mode = state.value.mode

      if (mode === 'panning') {
        const contentBounds = computeContentBounds(positions.value, dimensions.value)
        handlePanMove(state, viewportProp, event, panConfig, contentBounds)
        return
      }

      if (mode === 'dragging-nodes') {
        const drag = state.value.drag
        if (!drag) return
        const currentGraph = graphPos(event)
        const alignmentResult = handleDragMove(
          drag,
          currentGraph,
          setNodePosition,
          config.snapToGrid ?? false,
          config.snapGridSize ?? 20,
          dragConfig,
          positions.value,
          dimensions.value,
        )
        alignmentGuidesProp.set(alignmentResult?.guides ?? [])
        state.update((s) => ({
          ...s,
          drag: { ...drag, startMousePosition: drag.startMousePosition },
        }))
        return
      }

      if (mode === 'connecting') {
        const pos = graphPos(event)
        handleConnectionMove(
          state,
          pos,
          graphSignal.value,
          positions.value,
          dimensions.value,
          config.connectionSnapRadius ?? 20,
          config.portTypes,
          portPlacement.value,
          config.connection,
          portOffsets.value,
        )
        const conn = state.value.connection
        if (conn) {
          config.events?.onConnectionDrag?.(conn.sourcePort, pos)
        }
        return
      }

      if (mode === 'box-selecting') {
        handleBoxSelectMove(state, graphPos(event))
        return
      }
    },

    handlePointerUp(_event: PointerEvent) {
      const mode = state.value.mode

      if (mode === 'panning') {
        const contentBounds = computeContentBounds(positions.value, dimensions.value)
        handlePanEnd(state, viewportProp, panConfig, contentBounds)
        return
      }

      if (mode === 'dragging-nodes') {
        alignmentGuidesProp.set([])
        handleDragEnd(state, config.events)
        return
      }

      if (mode === 'connecting') {
        const conn = state.value.connection
        if (conn) {
          config.events?.onConnectionEnd?.(conn.sourcePort, conn.targetPort)
        }
        handleConnectionEnd(state, config.events)
        return
      }

      if (mode === 'box-selecting') {
        handleBoxSelectEnd(
          state,
          positions.value,
          dimensions.value,
          config.boxSelection,
          graphSignal.value.edges,
        )
        return
      }
    },

    handleWheel(event: WheelEvent) {
      if (config.zoomEnabled !== false) {
        handleZoom(
          viewportProp,
          event,
          getContainerRect(),
          {
            minZoom: config.minZoom ?? 0.1,
            maxZoom: config.maxZoom ?? 4,
            zoomStep: config.zoomStep ?? 0.1,
          },
          config.events?.onZoom,
        )
      }
    },

    handleKeyDown(event: KeyboardEvent) {
      if (event.code === 'Space') {
        spaceHeld = true
      }
    },

    handleKeyUp(event: KeyboardEvent) {
      if (event.code === 'Space') {
        spaceHeld = false
      }
    },
  }
}

function toMeasuredPositions(
  nodePos: Position,
  ports: readonly { readonly id: string }[],
  offsets: ReadonlyMap<string, PortOffset>,
): ReadonlyMap<string, { x: number; y: number; side: PortSide }> {
  const result = new Map<string, { x: number; y: number; side: PortSide }>()
  for (const port of ports) {
    const offset = offsets.get(port.id)
    if (offset) {
      result.set(port.id, {
        x: nodePos.x + offset.offsetX,
        y: nodePos.y + offset.offsetY,
        side: offset.side,
      })
    }
  }
  return result
}
