import {
  html,
  attr,
  on,
  style,
  Ensure,
  WithElement,
  OnDispose,
  computedOf,
  signal,
} from '@tempots/dom'
import type { TNode } from '@tempots/dom'
import type { Signal, Value } from '@tempots/core'
import type { Graph, GraphNode, PortRef } from '../types/graph'
import type { Position, Dimensions, PortOffset, PortSide } from '../types/layout'
import type { InteractionState } from '../types/interaction'
import type { NodeRenderContext } from '../types/config'
import type { InteractionTarget } from '../interaction/interaction-manager'
import type { Diagnostic } from '../types/validation'
import { Port } from './port'
import { defaultNodeRenderer } from './default-node-renderer'
import type { NodeRenderer, PortRenderer } from '../types/config'

export function NodeWrapper<N, E>(
  nodeSignal: Signal<GraphNode<N>>,
  position: Signal<Position>,
  graph: Signal<Graph<N, E>>,
  interactionState: Signal<InteractionState>,
  onInteraction: (event: PointerEvent, target: InteractionTarget) => void,
  setHoveredNode: (nodeId: string | null) => void,
  setHoveredPort: (portRef: PortRef | null) => void,
  onDimensionsChange: (nodeId: string, dims: Dimensions) => void,
  onPortOffsetsChange: (nodeId: string, offsets: ReadonlyMap<string, PortOffset>) => void,
  transitioning: Signal<boolean>,
  nodeRenderer?: NodeRenderer<N>,
  portRenderer?: PortRenderer,
  isExiting?: Signal<boolean>,
  onNodeDoubleClick?: (node: GraphNode<N>, event: PointerEvent) => void,
  diagnosticsSignal?: Signal<readonly Diagnostic[]>,
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
    diagnostics: diagnosticsSignal
      ? (computedOf(
          diagnosticsSignal,
          nodeId,
        )((ds, id) =>
          ds.filter(
            (d) =>
              (d.target.kind === 'node' && d.target.nodeId === id) ||
              (d.target.kind === 'port' && d.target.nodeId === id),
          ),
        ) as unknown as Signal<readonly Diagnostic[]>)
      : signal([] as readonly Diagnostic[]),
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
    attr.class(nodeSignal.map((n): string => (n.subGraph ? 'flow-node--compound' : ''))),
    attr.class(transitioning.map((t): string => (t ? 'flow-node-wrapper--transitioning' : ''))),
    isExiting ? attr.class(isExiting.map((e): string => (e ? 'flow-node--exiting' : ''))) : null,

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
    onNodeDoubleClick
      ? on.dblclick((e: MouseEvent) => {
          e.stopPropagation()
          onNodeDoubleClick(nodeSignal.value, e as PointerEvent)
        })
      : null,

    WithElement((el: HTMLElement) => {
      function measurePortDots() {
        const offsets = new Map<string, PortOffset>()
        const dots = el.querySelectorAll<HTMLElement>('.flow-port-dot')
        for (const dot of dots) {
          const portEl = dot.closest<HTMLElement>('.flow-port')
          if (!portEl) continue
          const portId = portEl.dataset.portid
          const direction = portEl.dataset.portdirection
          if (!portId) continue
          const dotRect = dot.getBoundingClientRect()
          const nodeRect = el.getBoundingClientRect()
          const nodeW = el.offsetWidth
          const nodeH = el.offsetHeight
          const offsetX = dotRect.left + dotRect.width / 2 - nodeRect.left
          const offsetY = dotRect.top + dotRect.height / 2 - nodeRect.top
          // Infer side from which edge of the node the dot is closest to
          const dL = Math.abs(offsetX)
          const dR = Math.abs(offsetX - nodeW)
          const dT = Math.abs(offsetY)
          const dB = Math.abs(offsetY - nodeH)
          const minD = Math.min(dL, dR, dT, dB)
          const side: PortSide =
            minD === dL ? 'left' : minD === dR ? 'right' : minD === dT ? 'top' : 'bottom'
          offsets.set(portId, { offsetX, offsetY, side })
        }
        if (offsets.size > 0) {
          onPortOffsetsChange(nodeId.value, offsets)
        }
      }

      // Report initial dimensions (offsetWidth/Height are not affected by CSS transforms,
      // unlike getBoundingClientRect which includes the viewport zoom scaling)
      onDimensionsChange(nodeId.value, { width: el.offsetWidth, height: el.offsetHeight })
      // Defer port measurement to next frame so children are laid out
      requestAnimationFrame(() => measurePortDots())

      let ro: ResizeObserver | null = null
      if (typeof ResizeObserver !== 'undefined') {
        ro = new ResizeObserver(() => {
          onDimensionsChange(nodeId.value, { width: el.offsetWidth, height: el.offsetHeight })
          measurePortDots()
        })
        ro.observe(el)
      }

      return OnDispose(() => {
        ro?.disconnect()
      })
    }),
    render(nodeSignal, renderContext),
  )
}
