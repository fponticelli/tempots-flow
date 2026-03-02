import type { Graph, GraphNode, GraphEdge } from '../types/graph'
import type { Position } from '../types/layout'

export interface ClipboardContents<N, E> {
  readonly nodes: readonly GraphNode<N>[]
  readonly edges: readonly GraphEdge<E>[]
  readonly positions: ReadonlyMap<string, Position>
}

export interface ClipboardManager<N, E> {
  copy(
    graph: Graph<N, E>,
    selectedNodeIds: ReadonlySet<string>,
    positions: ReadonlyMap<string, Position>,
  ): void
  paste(
    graph: Graph<N, E>,
    positions: ReadonlyMap<string, Position>,
    offset?: Position,
  ): {
    graph: Graph<N, E>
    pastedNodeIds: string[]
    positionUpdates: ReadonlyMap<string, Position>
  } | null
  hasCopied(): boolean
}

let pasteCounter = 0

export function createClipboardManager<N, E>(): ClipboardManager<N, E> {
  let clipboard: ClipboardContents<N, E> | null = null

  return {
    copy(graph, selectedNodeIds, positions) {
      if (selectedNodeIds.size === 0) {
        clipboard = null
        return
      }

      const nodes = graph.nodes.filter((n) => selectedNodeIds.has(n.id))
      const edges = graph.edges.filter(
        (e) => selectedNodeIds.has(e.source.nodeId) && selectedNodeIds.has(e.target.nodeId),
      )
      const posMap = new Map<string, Position>()
      for (const id of selectedNodeIds) {
        const pos = positions.get(id)
        if (pos) posMap.set(id, pos)
      }

      clipboard = { nodes, edges, positions: posMap }
    },

    paste(graph, _positions, offset = { x: 50, y: 50 }) {
      if (clipboard === null || clipboard.nodes.length === 0) return null

      pasteCounter++
      const suffix = `_copy_${pasteCounter}`
      const idMap = new Map<string, string>()

      // Generate new node IDs
      for (const node of clipboard.nodes) {
        idMap.set(node.id, `${node.id}${suffix}`)
      }

      // Remap nodes
      const newNodes: GraphNode<N>[] = clipboard.nodes.map((node) => ({
        ...node,
        id: idMap.get(node.id)!,
        ports: node.ports.map((p) => ({ ...p })),
      }))

      // Remap edges
      const newEdges: GraphEdge<E>[] = clipboard.edges.map((edge) => ({
        ...edge,
        id: `${edge.id}${suffix}`,
        source: {
          ...edge.source,
          nodeId: idMap.get(edge.source.nodeId)!,
        },
        target: {
          ...edge.target,
          nodeId: idMap.get(edge.target.nodeId)!,
        },
      }))

      // Offset positions
      const positionUpdates = new Map<string, Position>()
      for (const [oldId, pos] of clipboard.positions) {
        const newId = idMap.get(oldId)
        if (newId) {
          positionUpdates.set(newId, { x: pos.x + offset.x, y: pos.y + offset.y })
        }
      }

      const pastedNodeIds = newNodes.map((n) => n.id)

      return {
        graph: {
          ...graph,
          nodes: [...graph.nodes, ...newNodes],
          edges: [...graph.edges, ...newEdges],
        },
        pastedNodeIds,
        positionUpdates,
      }
    },

    hasCopied() {
      return clipboard !== null && clipboard.nodes.length > 0
    },
  }
}
