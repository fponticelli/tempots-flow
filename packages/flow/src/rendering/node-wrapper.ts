import { html, attr, on, style, WithElement, OnDispose } from '@tempots/dom'
import type { TNode } from '@tempots/dom'
import type { Signal, Prop } from '@tempots/core'
import { signal } from '@tempots/core'
import type { GraphNode } from '../types/graph'
import type { Position, Dimensions } from '../types/layout'
import type { InteractionState } from '../types/interaction'
import type { NodeRenderContext, PortWithState } from '../types/config'
import type { InteractionTarget } from '../interaction/interaction-manager'
import type { Diagnostic } from '../types/validation'
import { Port } from './port'
import { defaultNodeRenderer } from './default-node-renderer'
import type { NodeRenderer } from '../types/config'

export function NodeWrapper<N>(
  node: GraphNode<N>,
  position: Signal<Position>,
  interactionState: Prop<InteractionState>,
  onInteraction: (event: PointerEvent, target: InteractionTarget) => void,
  onDimensionsChange: (nodeId: string, dims: Dimensions) => void,
  nodeRenderer?: NodeRenderer<N>,
): TNode {
  const nodeId = node.id
  const isSelected = interactionState.map((s) => s.selectedNodeIds.has(nodeId))
  const isHovered = interactionState.map((s) => s.hoveredNodeId === nodeId)
  const isDragging = interactionState.map(
    (s) => s.mode === 'dragging-nodes' && (s.drag?.nodeIds.includes(nodeId) ?? false),
  )

  const render = nodeRenderer ?? defaultNodeRenderer

  const renderContext: NodeRenderContext = {
    isSelected,
    isHovered,
    isDragging,
    diagnostics: signal([] as readonly Diagnostic[]),
    port: (portId: string) => {
      const portDef = node.ports.find((p) => p.id === portId)
      if (!portDef) return null
      return Port(portDef, signal(false))
    },
    ports: signal(
      node.ports.map((p) => ({
        definition: p,
        isConnected: signal(false),
        connectionCount: signal(0),
      })) as readonly PortWithState[],
    ),
  }

  return html.div(
    attr.class('flow-node-wrapper'),
    attr.class(isSelected.map((s): string => (s ? 'flow-node--selected' : ''))),
    attr.class(isHovered.map((h): string => (h ? 'flow-node--hovered' : ''))),
    attr.class(isDragging.map((d): string => (d ? 'flow-node--dragging' : ''))),

    style.transform(position.map((p) => `translate(${p.x}px, ${p.y}px)`)),

    on.pointerdown((e: PointerEvent) => {
      e.stopPropagation()
      onInteraction(e, { type: 'node', nodeId })
    }),
    on.pointerenter(() => {
      interactionState.update((s) => ({ ...s, hoveredNodeId: nodeId }))
    }),
    on.pointerleave(() => {
      interactionState.update((s) =>
        s.hoveredNodeId === nodeId ? { ...s, hoveredNodeId: null } : s,
      )
    }),

    // Measure dimensions with ResizeObserver
    WithElement((element: HTMLElement) => {
      const observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const { width, height } = entry.contentRect
          onDimensionsChange(nodeId, { width, height })
        }
      })
      observer.observe(element)
      return OnDispose(() => {
        observer.disconnect()
      })
    }),

    render(node, renderContext),
  )
}
