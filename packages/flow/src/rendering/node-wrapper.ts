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
        // Use .flow-node as measurement reference when available.  The inner
        // .flow-node element may have a CSS enter animation (e.g. scale(0.8) →
        // scale(1)) that affects getBoundingClientRect() for all descendants
        // (including port dots) but NOT for the wrapper element.  By measuring
        // both dots and reference in the same transform context the animation
        // scale cancels out, yielding correct flow-space offsets.
        const refEl = el.querySelector<HTMLElement>('.flow-node') ?? el
        const dots = el.querySelectorAll<HTMLElement>('.flow-port-dot')
        const nodeW = el.offsetWidth
        const nodeH = el.offsetHeight
        for (const dot of dots) {
          const portEl = dot.closest<HTMLElement>('.flow-port')
          if (!portEl) continue
          const portId = portEl.dataset.portid
          if (!portId) continue
          const dotRect = dot.getBoundingClientRect()
          const refRect = refEl.getBoundingClientRect()
          const refW = refEl.offsetWidth
          // getBoundingClientRect returns screen-scaled values (affected by
          // viewport zoom transforms and CSS animations), while offsetWidth is
          // unscaled.  Derive the current scale so we can normalize to flow-space.
          const scale = refW > 0 ? refRect.width / refW : 1
          let offsetX = (dotRect.left + dotRect.width / 2 - refRect.left) / scale
          let offsetY = (dotRect.top + dotRect.height / 2 - refRect.top) / scale
          // Adjust if the reference element is offset from the wrapper
          if (refEl !== el) {
            offsetX += refEl.offsetLeft
            offsetY += refEl.offsetTop
          }
          // Determine side from the port direction attribute and the dot's
          // position relative to the node center.  Using the declared direction
          // (input vs output) narrows the candidates to two sides, then we pick
          // the one the dot is actually closest to.  This avoids mis-classifying
          // ports on wide/tall nodes where pure distance-to-edge is ambiguous.
          const direction = portEl.dataset.portdirection
          let side: PortSide
          if (direction === 'input') {
            // Input ports attach on the "incoming" side: left or top
            side = Math.abs(offsetX) <= Math.abs(offsetY) ? 'left' : 'top'
          } else if (direction === 'output') {
            // Output ports attach on the "outgoing" side: right or bottom
            side = Math.abs(offsetX - nodeW) <= Math.abs(offsetY - nodeH) ? 'right' : 'bottom'
          } else {
            // Fallback for unknown direction: use closest edge
            const dL = Math.abs(offsetX)
            const dR = Math.abs(offsetX - nodeW)
            const dT = Math.abs(offsetY)
            const dB = Math.abs(offsetY - nodeH)
            const minD = Math.min(dL, dR, dT, dB)
            side = minD === dL ? 'left' : minD === dR ? 'right' : minD === dT ? 'top' : 'bottom'
          }
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
