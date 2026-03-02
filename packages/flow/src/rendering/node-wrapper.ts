import { html, attr, on, style, Ensure, computedOf, effectOf, signal } from '@tempots/dom'
import type { TNode } from '@tempots/dom'
import type { Signal, Value } from '@tempots/core'
import type { Graph, GraphNode, PortRef } from '../types/graph'
import type { Position, Dimensions } from '../types/layout'
import type { InteractionState } from '../types/interaction'
import type { NodeRenderContext } from '../types/config'
import type { InteractionTarget } from '../interaction/interaction-manager'
import type { Diagnostic } from '../types/validation'
import { Port } from './port'
import { defaultNodeRenderer } from './default-node-renderer'
import type { NodeRenderer, PortRenderer } from '../types/config'
import { ElementRect } from '@tempots/ui'

export function NodeWrapper<N, E>(
  nodeSignal: Signal<GraphNode<N>>,
  position: Signal<Position>,
  graph: Signal<Graph<N, E>>,
  interactionState: Signal<InteractionState>,
  onInteraction: (event: PointerEvent, target: InteractionTarget) => void,
  setHoveredNode: (nodeId: string | null) => void,
  setHoveredPort: (portRef: PortRef | null) => void,
  onDimensionsChange: (nodeId: string, dims: Dimensions) => void,
  transitioning: Signal<boolean>,
  nodeRenderer?: NodeRenderer<N>,
  portRenderer?: PortRenderer,
): TNode {
  const nodeId = nodeSignal.$.id
  const isSelected = computedOf(interactionState, nodeId)((s, id) => s.selectedNodeIds.has(id))
  const isHovered = computedOf(interactionState, nodeId)((s, id) => s.hoveredNodeId === id)
  const isDragging = computedOf(
    interactionState,
    nodeId,
  )((s, id) => s.mode === 'dragging-nodes' && (s.drag?.nodeIds.includes(id) ?? false))

  const render = nodeRenderer ?? defaultNodeRenderer

  const portStates = computedOf(
    nodeSignal,
    graph,
  )((node, g) =>
    node.ports.map((portDef) => {
      const count = g.edges.filter(
        (e) =>
          (e.source.nodeId === node.id && e.source.portId === portDef.id) ||
          (e.target.nodeId === node.id && e.target.portId === portDef.id),
      ).length
      return { definition: portDef, isConnected: count > 0, connectionCount: count }
    }),
  )

  const renderContext: NodeRenderContext = {
    isSelected,
    isHovered,
    isDragging,
    diagnostics: signal([] as readonly Diagnostic[]),
    port: (portId: Value<string>) => {
      const pid = typeof portId === 'string' ? signal(portId) : portId
      const portIsConnected = computedOf(
        portStates,
        pid,
      )((ps, id) => ps.find((p) => p.definition.id === id)?.isConnected ?? false)
      const portIsHovered = computedOf(
        interactionState,
        nodeId,
        pid,
      )((s, nid, id): boolean => s.hoveredPort?.nodeId === nid && s.hoveredPort?.portId === id)
      const portDef = computedOf(nodeSignal, pid)((n, id) => n.ports.find((p) => p.id === id))
      return Ensure(portDef, (def) =>
        Port(
          def,
          nodeId,
          portIsConnected,
          portIsHovered,
          onInteraction,
          setHoveredPort,
          portRenderer,
        ),
      )
    },
    ports: portStates,
  }

  return html.div(
    attr.class('flow-node-wrapper'),
    attr.class(isSelected.map((s): string => (s ? 'flow-node--selected' : ''))),
    attr.class(isHovered.map((h): string => (h ? 'flow-node--hovered' : ''))),
    attr.class(isDragging.map((d): string => (d ? 'flow-node--dragging' : ''))),
    attr.class(transitioning.map((t): string => (t ? 'flow-node-wrapper--transitioning' : ''))),

    style.transform(position.map((p) => `translate(${p.x}px, ${p.y}px)`)),

    on.pointerdown((e: PointerEvent) => {
      e.stopPropagation()
      onInteraction(e, { type: 'node', nodeId: nodeId.value })
    }),
    on.pointerenter(() => {
      setHoveredNode(nodeId.value)
    }),
    on.pointerleave(() => {
      setHoveredNode(null)
    }),

    ElementRect((rect) => {
      effectOf(rect)((r) => {
        onDimensionsChange(nodeId.value, { width: r.width, height: r.height })
      })
      return render(nodeSignal, renderContext)
    }),
  )
}
