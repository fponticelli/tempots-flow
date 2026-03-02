// @tempots/flow/validators — Built-in validators

import type { Graph } from '../types/graph'
import type { Diagnostic } from '../types/validation'
import type { PortTypeConfig } from '../types/config'

export type Validator<N, E> = (graph: Graph<N, E>) => readonly Diagnostic[]

export function portTypeCheck<N, E>(portTypeConfig?: PortTypeConfig): Validator<N, E> {
  return (graph) => {
    const diagnostics: Diagnostic[] = []
    for (const edge of graph.edges) {
      const sourceNode = graph.nodes.find((n) => n.id === edge.source.nodeId)
      const targetNode = graph.nodes.find((n) => n.id === edge.target.nodeId)
      if (!sourceNode || !targetNode) continue

      const sourcePort = sourceNode.ports.find((p) => p.id === edge.source.portId)
      const targetPort = targetNode.ports.find((p) => p.id === edge.target.portId)
      if (!sourcePort || !targetPort) continue

      const compatible = portTypeConfig?.isCompatible
        ? portTypeConfig.isCompatible(sourcePort.type, targetPort.type)
        : sourcePort.type === undefined ||
          targetPort.type === undefined ||
          sourcePort.type === targetPort.type

      if (!compatible) {
        diagnostics.push({
          severity: 'error',
          message: `Incompatible types: "${sourcePort.type}" -> "${targetPort.type}"`,
          target: { kind: 'edge', edgeId: edge.id },
        })
      }
    }
    return diagnostics
  }
}

export function portCardinality<N, E>(): Validator<N, E> {
  return (graph) => {
    const diagnostics: Diagnostic[] = []
    const portCounts = new Map<string, number>()

    for (const edge of graph.edges) {
      const sourceKey = `${edge.source.nodeId}:${edge.source.portId}`
      const targetKey = `${edge.target.nodeId}:${edge.target.portId}`
      portCounts.set(sourceKey, (portCounts.get(sourceKey) ?? 0) + 1)
      portCounts.set(targetKey, (portCounts.get(targetKey) ?? 0) + 1)
    }

    for (const node of graph.nodes) {
      for (const port of node.ports) {
        if (port.maxConnections === undefined) continue
        const key = `${node.id}:${port.id}`
        const count = portCounts.get(key) ?? 0
        if (count > port.maxConnections) {
          diagnostics.push({
            severity: 'error',
            message: `Port "${port.label ?? port.id}" exceeds max connections (${count}/${port.maxConnections})`,
            target: { kind: 'port', nodeId: node.id, portId: port.id },
          })
        }
      }
    }
    return diagnostics
  }
}

export function requiredPorts<N, E>(): Validator<N, E> {
  return (graph) => {
    const diagnostics: Diagnostic[] = []
    const connectedPorts = new Set<string>()

    for (const edge of graph.edges) {
      connectedPorts.add(`${edge.source.nodeId}:${edge.source.portId}`)
      connectedPorts.add(`${edge.target.nodeId}:${edge.target.portId}`)
    }

    for (const node of graph.nodes) {
      for (const port of node.ports) {
        if (!port.required) continue
        if (!connectedPorts.has(`${node.id}:${port.id}`)) {
          diagnostics.push({
            severity: 'warning',
            message: `Required port "${port.label ?? port.id}" is not connected`,
            target: { kind: 'port', nodeId: node.id, portId: port.id },
          })
        }
      }
    }
    return diagnostics
  }
}

export function acyclic<N, E>(): Validator<N, E> {
  return (graph) => {
    const adj = new Map<string, string[]>()
    for (const edge of graph.edges) {
      if (edge.direction === 'forward' || edge.direction === 'bidirectional') {
        const list = adj.get(edge.source.nodeId) ?? []
        list.push(edge.target.nodeId)
        adj.set(edge.source.nodeId, list)
      }
      if (edge.direction === 'backward' || edge.direction === 'bidirectional') {
        const list = adj.get(edge.target.nodeId) ?? []
        list.push(edge.source.nodeId)
        adj.set(edge.target.nodeId, list)
      }
    }

    const visited = new Set<string>()
    const inStack = new Set<string>()
    let hasCycle = false

    function dfs(nodeId: string): void {
      if (hasCycle) return
      visited.add(nodeId)
      inStack.add(nodeId)

      for (const neighbor of adj.get(nodeId) ?? []) {
        if (inStack.has(neighbor)) {
          hasCycle = true
          return
        }
        if (!visited.has(neighbor)) {
          dfs(neighbor)
        }
      }

      inStack.delete(nodeId)
    }

    for (const node of graph.nodes) {
      if (!visited.has(node.id)) {
        dfs(node.id)
      }
    }

    if (hasCycle) {
      return [
        {
          severity: 'error',
          message: 'Graph contains a cycle',
          target: { kind: 'graph' as const },
        },
      ]
    }
    return []
  }
}

export function validHierarchy<N, E>(): Validator<N, E> {
  return (graph) => {
    const diagnostics: Diagnostic[] = []
    const nodeIds = new Set(graph.nodes.map((n) => n.id))

    for (const node of graph.nodes) {
      if (node.parentId === undefined) continue

      // Self-reference check
      if (node.parentId === node.id) {
        diagnostics.push({
          severity: 'error',
          message: `Node "${node.id}" references itself as parent`,
          target: { kind: 'node', nodeId: node.id },
        })
        continue
      }

      // Missing parent check
      if (!nodeIds.has(node.parentId)) {
        diagnostics.push({
          severity: 'error',
          message: `Node "${node.id}" references non-existent parent "${node.parentId}"`,
          target: { kind: 'node', nodeId: node.id },
        })
        continue
      }
    }

    // Cycle detection in parent chains
    for (const node of graph.nodes) {
      if (node.parentId === undefined) continue

      const visited = new Set<string>()
      let current: string | undefined = node.id

      while (current !== undefined) {
        if (visited.has(current)) {
          diagnostics.push({
            severity: 'error',
            message: `Cycle detected in parent chain involving node "${node.id}"`,
            target: { kind: 'node', nodeId: node.id },
          })
          break
        }
        visited.add(current)
        current = graph.nodes.find((n) => n.id === current)?.parentId
      }
    }

    return diagnostics
  }
}

export function compose<N, E>(...validators: Validator<N, E>[]): Validator<N, E> {
  return (graph) => {
    const all: Diagnostic[] = []
    for (const v of validators) {
      all.push(...v(graph))
    }
    return all
  }
}
