import type { LayoutAlgorithm } from '../types/config'
import type { Graph, GraphEdge } from '../types/graph'
import type { Position, Dimensions } from '../types/layout'

// --- Public types ---

export type HierarchicalDirection = 'LR' | 'RL' | 'TB' | 'BT'
export type HierarchicalAlignment = 'center' | 'start' | 'end'

export interface HierarchicalLayoutOptions {
  readonly direction?: HierarchicalDirection
  readonly nodeSpacing?: number
  readonly layerSpacing?: number
  readonly alignment?: HierarchicalAlignment
}

// --- Defaults ---

const DEFAULT_NODE_SPACING = 50
const DEFAULT_LAYER_SPACING = 200
const DEFAULT_NODE_WIDTH = 180
const DEFAULT_NODE_HEIGHT = 80

// --- Internal helpers ---

/** Build adjacency list (successors) and reverse adjacency (predecessors) from edges. */
function buildAdjacency(edges: readonly GraphEdge<unknown>[]): {
  successors: ReadonlyMap<string, readonly string[]>
  predecessors: ReadonlyMap<string, readonly string[]>
} {
  const succ = new Map<string, string[]>()
  const pred = new Map<string, string[]>()

  for (const edge of edges) {
    const src = edge.source.nodeId
    const tgt = edge.target.nodeId

    const srcList = succ.get(src)
    if (srcList) {
      srcList.push(tgt)
    } else {
      succ.set(src, [tgt])
    }

    const tgtList = pred.get(tgt)
    if (tgtList) {
      tgtList.push(src)
    } else {
      pred.set(tgt, [src])
    }
  }

  return { successors: succ, predecessors: pred }
}

/**
 * Phase 1: Layer assignment using longest-path ranking.
 *
 * Source nodes (no incoming edges) start at layer 0.
 * Each node's layer = max(predecessor layers) + 1, computed via topological BFS.
 * Disconnected or cycle-only nodes fall back to layer 0.
 */
function assignLayers(
  nodeIds: readonly string[],
  successors: ReadonlyMap<string, readonly string[]>,
  predecessors: ReadonlyMap<string, readonly string[]>,
): ReadonlyMap<string, number> {
  const layers = new Map<string, number>()
  const inDegree = new Map<string, number>()

  // Initialize in-degree for all nodes
  for (const id of nodeIds) {
    const preds = predecessors.get(id)
    inDegree.set(id, preds ? preds.length : 0)
  }

  // Seed BFS with source nodes (in-degree 0)
  const queue: string[] = []
  for (const id of nodeIds) {
    if (inDegree.get(id) === 0) {
      layers.set(id, 0)
      queue.push(id)
    }
  }

  // BFS: propagate layers via longest-path
  let head = 0
  while (head < queue.length) {
    const current = queue[head++]!
    const currentLayer = layers.get(current)!
    const succs = successors.get(current)
    if (!succs) continue

    for (const next of succs) {
      const existingLayer = layers.get(next)
      const candidateLayer = currentLayer + 1

      if (existingLayer === undefined || candidateLayer > existingLayer) {
        layers.set(next, candidateLayer)
      }

      // Track remaining in-degree; enqueue when all predecessors processed
      const remaining = inDegree.get(next)! - 1
      inDegree.set(next, remaining)
      if (remaining === 0) {
        queue.push(next)
      }
    }
  }

  // Fallback: nodes not reached (cycles or truly disconnected) get layer 0
  for (const id of nodeIds) {
    if (!layers.has(id)) {
      layers.set(id, 0)
    }
  }

  return layers
}

/**
 * Phase 2: Crossing minimization via barycenter heuristic.
 *
 * Groups nodes by layer, then for each layer (starting from 1) sorts nodes
 * by the average position index of their predecessors in the previous layer.
 * A single forward sweep is performed.
 */
function minimizeCrossings(
  layerAssignment: ReadonlyMap<string, number>,
  predecessors: ReadonlyMap<string, readonly string[]>,
): ReadonlyMap<number, readonly string[]> {
  // Group nodes by layer
  const layerGroups = new Map<number, string[]>()
  for (const [nodeId, layer] of layerAssignment) {
    const group = layerGroups.get(layer)
    if (group) {
      group.push(nodeId)
    } else {
      layerGroups.set(layer, [nodeId])
    }
  }

  const maxLayer = Math.max(0, ...layerGroups.keys())

  // Build index lookup for layer 0 (initial ordering is insertion order)
  const layerIndices = new Map<string, number>()
  const layer0 = layerGroups.get(0) ?? []
  layer0.forEach((id, i) => layerIndices.set(id, i))

  const result = new Map<number, readonly string[]>()
  result.set(0, layer0)

  // Forward sweep: layers 1..maxLayer
  for (let l = 1; l <= maxLayer; l++) {
    const nodes = layerGroups.get(l) ?? []

    const withBarycenter = nodes.map((nodeId) => {
      const preds = predecessors.get(nodeId) ?? []
      // Only consider predecessors in the immediately previous layer
      const prevLayerPreds = preds.filter((p) => layerAssignment.get(p) === l - 1)

      if (prevLayerPreds.length === 0) {
        return { nodeId, barycenter: Infinity }
      }

      const sum = prevLayerPreds.reduce((acc, p) => acc + (layerIndices.get(p) ?? 0), 0)
      return { nodeId, barycenter: sum / prevLayerPreds.length }
    })

    withBarycenter.sort((a, b) => a.barycenter - b.barycenter)

    const sorted = withBarycenter.map((entry) => entry.nodeId)
    sorted.forEach((id, i) => layerIndices.set(id, i))
    result.set(l, sorted)
  }

  return result
}

/**
 * Get the dimension along the "main axis" (layer-progression direction)
 * and the "cross axis" (within-layer direction).
 */
function getNodeExtents(
  nodeId: string,
  dimensions: ReadonlyMap<string, Dimensions>,
  isHorizontal: boolean,
): { main: number; cross: number } {
  const dims = dimensions.get(nodeId)
  const w = dims?.width ?? DEFAULT_NODE_WIDTH
  const h = dims?.height ?? DEFAULT_NODE_HEIGHT

  return isHorizontal ? { main: w, cross: h } : { main: h, cross: w }
}

/**
 * Phase 3: Assign concrete positions based on direction, spacing, and alignment.
 *
 * - LR: layers along +X, nodes within layer along +Y
 * - RL: layers along -X, nodes within layer along +Y
 * - TB: layers along +Y, nodes within layer along +X
 * - BT: layers along -Y, nodes within layer along +X
 */
function assignPositions(
  orderedLayers: ReadonlyMap<number, readonly string[]>,
  dimensions: ReadonlyMap<string, Dimensions>,
  direction: HierarchicalDirection,
  nodeSpacing: number,
  layerSpacing: number,
  alignment: HierarchicalAlignment,
): ReadonlyMap<string, Position> {
  const isHorizontal = direction === 'LR' || direction === 'RL'
  const isReversed = direction === 'RL' || direction === 'BT'

  const maxLayer = Math.max(0, ...orderedLayers.keys())

  // Compute the maximum "main axis" extent per layer and each layer's cross-axis total
  const layerMainExtent: number[] = []
  const layerCrossTotal: number[] = []

  for (let l = 0; l <= maxLayer; l++) {
    const nodes = orderedLayers.get(l) ?? []
    let maxMain = 0
    let totalCross = 0

    for (let i = 0; i < nodes.length; i++) {
      const ext = getNodeExtents(nodes[i]!, dimensions, isHorizontal)
      maxMain = Math.max(maxMain, ext.main)
      totalCross += ext.cross
      if (i > 0) totalCross += nodeSpacing
    }

    layerMainExtent.push(maxMain)
    layerCrossTotal.push(totalCross)
  }

  // Cumulative main-axis offsets per layer
  const layerMainOffset: number[] = []
  let cumulative = 0
  for (let l = 0; l <= maxLayer; l++) {
    layerMainOffset.push(cumulative)
    cumulative += layerMainExtent[l]! + layerSpacing
  }

  // For alignment, find the widest cross-axis extent
  const maxCross = Math.max(0, ...layerCrossTotal)

  // Compute positions
  const positions = new Map<string, Position>()

  for (let l = 0; l <= maxLayer; l++) {
    const nodes = orderedLayers.get(l) ?? []

    // Cross-axis alignment offset
    const layerCross = layerCrossTotal[l]!
    let crossStart: number
    switch (alignment) {
      case 'start':
        crossStart = 0
        break
      case 'end':
        crossStart = maxCross - layerCross
        break
      case 'center':
      default:
        crossStart = (maxCross - layerCross) / 2
        break
    }

    let crossOffset = crossStart
    const mainPos = isReversed ? -layerMainOffset[l]! : layerMainOffset[l]!

    for (const nodeId of nodes) {
      const ext = getNodeExtents(nodeId, dimensions, isHorizontal)

      // Center the node within the layer's main-axis slot
      const mainCenter = isReversed
        ? mainPos - ext.main / 2 + layerMainExtent[l]! / 2
        : mainPos + layerMainExtent[l]! / 2 - ext.main / 2

      const position: Position = isHorizontal
        ? { x: mainCenter, y: crossOffset }
        : { x: crossOffset, y: mainCenter }

      positions.set(nodeId, position)
      crossOffset += ext.cross + nodeSpacing
    }
  }

  return positions
}

// --- Public factory ---

/**
 * Creates a hierarchical (layered) layout algorithm using the Sugiyama framework.
 *
 * The algorithm proceeds in three phases:
 * 1. **Layer assignment** — longest-path ranking from source nodes
 * 2. **Crossing minimization** — barycenter heuristic (single forward sweep)
 * 3. **Position assignment** — respects direction, spacing, alignment, and measured node dimensions
 *
 * @param options - Configuration for direction, spacing, and alignment
 * @returns A `LayoutAlgorithm` instance
 *
 * @example
 * ```ts
 * const layout = hierarchicalLayout({ direction: 'TB', nodeSpacing: 30 })
 * const positions = layout.layout(graph, dimensions, currentPositions)
 * ```
 */
export function hierarchicalLayout(options?: HierarchicalLayoutOptions): LayoutAlgorithm {
  const direction = options?.direction ?? 'LR'
  const nodeSpacing = options?.nodeSpacing ?? DEFAULT_NODE_SPACING
  const layerSpacing = options?.layerSpacing ?? DEFAULT_LAYER_SPACING
  const alignment = options?.alignment ?? 'center'

  return {
    layout(
      graph: Graph<unknown, unknown>,
      dimensions: ReadonlyMap<string, Dimensions>,
      _currentPositions: ReadonlyMap<string, Position>,
    ): ReadonlyMap<string, Position> {
      if (graph.nodes.length === 0) {
        return new Map()
      }

      const nodeIds = graph.nodes.map((n) => n.id)
      const { successors, predecessors } = buildAdjacency(graph.edges)

      // Phase 1: Layer assignment
      const layerAssignment = assignLayers(nodeIds, successors, predecessors)

      // Phase 2: Crossing minimization
      const orderedLayers = minimizeCrossings(layerAssignment, predecessors)

      // Phase 3: Position assignment
      return assignPositions(
        orderedLayers,
        dimensions,
        direction,
        nodeSpacing,
        layerSpacing,
        alignment,
      )
    },
  }
}
