import type { Prop } from '@tempots/core'
import type { InteractionState } from '../types/interaction'
import type { Position, Dimensions, PortSide, PortPlacement } from '../types/layout'
import type { Graph, PortRef, PortDefinition } from '../types/graph'
import type { FlowEvents } from '../types/events'
import type { PortTypeConfig, ConnectionConfig } from '../types/config'
import { computePortPositionsForNode } from '../edges/port-positions'

export function handleConnectionStart(
  state: Prop<InteractionState>,
  sourcePort: PortRef,
  sourceSide: PortSide,
  sourcePosition: Position,
): void {
  state.update((s) => ({
    ...s,
    mode: 'connecting',
    connection: {
      sourcePort,
      sourceSide,
      sourcePosition,
      currentPosition: sourcePosition,
      targetPort: null,
      isValid: false,
    },
  }))
}

export function handleConnectionMove<N, E>(
  state: Prop<InteractionState>,
  currentPosition: Position,
  graph: Graph<N, E>,
  positions: ReadonlyMap<string, Position>,
  dimensions: ReadonlyMap<string, Dimensions>,
  snapRadius: number,
  portTypeConfig?: PortTypeConfig,
  portPlacement: PortPlacement = 'horizontal',
  connectionConfig?: ConnectionConfig,
): void {
  const connection = state.value.connection
  if (!connection) return

  const sourceNode = graph.nodes.find((n) => n.id === connection.sourcePort.nodeId)
  if (!sourceNode) return

  const sourcePortDef = sourceNode.ports.find((p) => p.id === connection.sourcePort.portId)
  if (!sourcePortDef) return

  const looseMode = connectionConfig?.mode === 'loose'
  const allowSelfConnection = connectionConfig?.selfConnection === true

  let bestTarget: { portRef: PortRef; x: number; y: number; distance: number } | null = null

  for (const node of graph.nodes) {
    if (!allowSelfConnection && node.id === connection.sourcePort.nodeId) continue

    const nodePos = positions.get(node.id)
    const nodeDims = dimensions.get(node.id)
    if (!nodePos || !nodeDims) continue

    const portPositions = computePortPositionsForNode(nodePos, nodeDims, node.ports, portPlacement)

    for (const port of node.ports) {
      if (!isPortCompatible(sourcePortDef, port, graph, node.id, portTypeConfig, looseMode))
        continue

      const portPos = portPositions.get(port.id)
      if (!portPos) continue

      const dx = portPos.x - currentPosition.x
      const dy = portPos.y - currentPosition.y
      const dist = Math.sqrt(dx * dx + dy * dy)

      if (dist <= snapRadius && (!bestTarget || dist < bestTarget.distance)) {
        bestTarget = {
          portRef: { nodeId: node.id, portId: port.id },
          x: portPos.x,
          y: portPos.y,
          distance: dist,
        }
      }
    }
  }

  // Apply custom validation
  if (bestTarget && connectionConfig?.onValidate) {
    if (!connectionConfig.onValidate(connection.sourcePort, bestTarget.portRef)) {
      bestTarget = null
    }
  }

  state.update((s) => ({
    ...s,
    connection: {
      ...connection,
      currentPosition: bestTarget ? { x: bestTarget.x, y: bestTarget.y } : currentPosition,
      targetPort: bestTarget?.portRef ?? null,
      isValid: bestTarget !== null,
    },
    hoveredPort: bestTarget?.portRef ?? null,
  }))
}

export function handleConnectionEnd<N, E>(
  state: Prop<InteractionState>,
  events?: Partial<FlowEvents<N, E>>,
): void {
  const connection = state.value.connection
  if (connection?.isValid && connection.targetPort) {
    events?.onConnect?.(connection.sourcePort, connection.targetPort)
  }
  state.update((s) => ({
    ...s,
    mode: 'idle',
    connection: null,
    hoveredPort: null,
  }))
}

function isPortCompatible<N, E>(
  sourcePortDef: PortDefinition,
  targetPortDef: PortDefinition,
  graph: Graph<N, E>,
  targetNodeId: string,
  portTypeConfig?: PortTypeConfig,
  looseMode = false,
): boolean {
  if (targetPortDef.direction === sourcePortDef.direction) return false

  if (!looseMode && !isTypeCompatible(sourcePortDef.type, targetPortDef.type, portTypeConfig))
    return false

  if (targetPortDef.maxConnections !== undefined) {
    const count = countPortConnections(graph, targetNodeId, targetPortDef.id)
    if (count >= targetPortDef.maxConnections) return false
  }

  return true
}

function isTypeCompatible(
  sourceType: string | undefined,
  targetType: string | undefined,
  config?: PortTypeConfig,
): boolean {
  if (config?.isCompatible) {
    return config.isCompatible(sourceType, targetType)
  }
  if (sourceType === undefined || targetType === undefined) return true
  return sourceType === targetType
}

function countPortConnections<N, E>(graph: Graph<N, E>, nodeId: string, portId: string): number {
  return graph.edges.filter(
    (e) =>
      (e.source.nodeId === nodeId && e.source.portId === portId) ||
      (e.target.nodeId === nodeId && e.target.portId === portId),
  ).length
}
