import type { LayoutAlgorithm } from '../types/config'
import type { Graph, GraphEdge } from '../types/graph'
import type { Position, Dimensions } from '../types/layout'

// --- Public types ---

export type TreeDirection = 'LR' | 'RL' | 'TB' | 'BT'

export type MultiRootStrategy = 'super-root' | 'stack'

export interface TreeLayoutOptions {
  readonly direction?: TreeDirection
  readonly siblingSpacing?: number
  readonly subtreeSpacing?: number
  readonly levelSpacing?: number
  readonly rootId?: string
  readonly multiRootStrategy?: MultiRootStrategy
}

// --- Defaults ---

const DEFAULT_DIRECTION: TreeDirection = 'TB'
const DEFAULT_SIBLING_SPACING = 50
const DEFAULT_SUBTREE_SPACING = 80
const DEFAULT_LEVEL_SPACING = 150
const DEFAULT_NODE_WIDTH = 180
const DEFAULT_NODE_HEIGHT = 80

// --- Internal types ---

/** Mutable working data for a single node during layout. */
interface NodeLayout {
  crossAxis: number
  mainAxis: number
}

// --- Internal helpers ---

/**
 * Build a parent-to-children map from graph edges.
 * Source -> target is treated as parent -> child.
 * Also computes in-degree for each node.
 */
function buildChildMap(
  nodeIds: readonly string[],
  edges: readonly GraphEdge<unknown>[],
): {
  childMap: Map<string, string[]>
  inDegree: Map<string, number>
} {
  const childMap = new Map<string, string[]>()
  const inDegree = new Map<string, number>()

  // Initialize all nodes with zero in-degree
  for (const id of nodeIds) {
    inDegree.set(id, 0)
  }

  for (const edge of edges) {
    const parent = edge.source.nodeId
    const child = edge.target.nodeId

    const children = childMap.get(parent)
    if (children) {
      children.push(child)
    } else {
      childMap.set(parent, [child])
    }

    inDegree.set(child, (inDegree.get(child) ?? 0) + 1)
  }

  return { childMap, inDegree }
}

/**
 * Find root nodes: nodes with in-degree 0, or the specified rootId.
 * If rootId is specified and exists in the node set, use only that root.
 */
function findRoots(
  nodeIds: readonly string[],
  inDegree: ReadonlyMap<string, number>,
  rootId: string | undefined,
): string[] {
  if (rootId !== undefined) {
    const nodeSet = new Set(nodeIds)
    if (nodeSet.has(rootId)) {
      return [rootId]
    }
  }

  const roots: string[] = []
  for (const id of nodeIds) {
    if ((inDegree.get(id) ?? 0) === 0) {
      roots.push(id)
    }
  }

  // If no roots found (all nodes in cycles), pick the first node as fallback
  if (roots.length === 0 && nodeIds.length > 0) {
    const first = nodeIds[0]
    if (first !== undefined) {
      roots.push(first)
    }
  }

  return roots
}

/**
 * Build a spanning tree via DFS from the given roots.
 * Back-edges (to already-visited nodes) are ignored, breaking cycles.
 * Returns a clean parent->children map representing the spanning tree,
 * and the set of reachable node IDs.
 */
function buildSpanningTree(
  roots: readonly string[],
  childMap: ReadonlyMap<string, readonly string[]>,
): {
  treeChildren: Map<string, string[]>
  reachable: Set<string>
} {
  const treeChildren = new Map<string, string[]>()
  const visited = new Set<string>()

  function dfs(nodeId: string): void {
    visited.add(nodeId)
    const children = childMap.get(nodeId)
    if (!children) return

    for (const child of children) {
      if (visited.has(child)) continue
      const siblings = treeChildren.get(nodeId)
      if (siblings) {
        siblings.push(child)
      } else {
        treeChildren.set(nodeId, [child])
      }
      dfs(child)
    }
  }

  for (const root of roots) {
    if (!visited.has(root)) {
      dfs(root)
    }
  }

  return { treeChildren, reachable: visited }
}

/**
 * Get the cross-axis extent (width for TB/BT, height for LR/RL) of a node.
 */
function getCrossExtent(
  nodeId: string,
  dimensions: ReadonlyMap<string, Dimensions>,
  isHorizontal: boolean,
): number {
  const dims = dimensions.get(nodeId)
  const w = dims?.width ?? DEFAULT_NODE_WIDTH
  const h = dims?.height ?? DEFAULT_NODE_HEIGHT
  return isHorizontal ? h : w
}

/**
 * Get the main-axis extent (height for TB/BT, width for LR/RL) of a node.
 */
function getMainExtent(
  nodeId: string,
  dimensions: ReadonlyMap<string, Dimensions>,
  isHorizontal: boolean,
): number {
  const dims = dimensions.get(nodeId)
  const w = dims?.width ?? DEFAULT_NODE_WIDTH
  const h = dims?.height ?? DEFAULT_NODE_HEIGHT
  return isHorizontal ? w : h
}

/**
 * Recursively compute the subtree layout for a single tree rooted at `nodeId`.
 *
 * Each node is assigned a cross-axis center position and a main-axis position
 * based on its depth. The function returns the total cross-axis width of the
 * subtree, which is used to position sibling subtrees without overlap.
 *
 * The algorithm works bottom-up: leaf nodes take their own cross-axis extent
 * as subtree width. Internal nodes lay out children left-to-right (in cross-axis
 * terms) with siblingSpacing gaps, then center themselves over their children.
 */
function layoutSubtree(
  nodeId: string,
  depth: number,
  treeChildren: ReadonlyMap<string, readonly string[]>,
  dimensions: ReadonlyMap<string, Dimensions>,
  positions: Map<string, NodeLayout>,
  isHorizontal: boolean,
  siblingSpacing: number,
  levelSpacing: number,
): number {
  const children = treeChildren.get(nodeId)
  const nodeCross = getCrossExtent(nodeId, dimensions, isHorizontal)

  // Store raw depth index; actual main-axis position is resolved later
  // in resolveMainAxis to account for variable node sizes per depth level.
  const mainPos = depth

  if (!children || children.length === 0) {
    // Leaf node: subtree width is just the node's cross-axis extent
    positions.set(nodeId, { crossAxis: nodeCross / 2, mainAxis: mainPos })
    return nodeCross
  }

  // Layout each child subtree sequentially, accumulating cross-axis offset
  let offset = 0
  const childCenters: number[] = []

  for (let i = 0; i < children.length; i++) {
    const child = children[i]!
    const subtreeWidth = layoutSubtree(
      child,
      depth + 1,
      treeChildren,
      dimensions,
      positions,
      isHorizontal,
      siblingSpacing,
      levelSpacing,
    )

    // The child's center within the overall coordinate space
    const childLayout = positions.get(child)!
    // Shift the child (and its entire subtree) by the current offset
    shiftSubtree(child, treeChildren, positions, offset)

    childCenters.push(offset + childLayout.crossAxis)
    offset += subtreeWidth

    // Add spacing between siblings (not after the last one)
    if (i < children.length - 1) {
      offset += siblingSpacing
    }
  }

  // Center the parent over its children
  const firstCenter = childCenters[0]!
  const lastCenter = childCenters[childCenters.length - 1]!
  const parentCenter = (firstCenter + lastCenter) / 2

  // Ensure the subtree width accommodates the parent's own cross-axis extent
  const totalChildrenWidth = offset
  const subtreeWidth = Math.max(totalChildrenWidth, nodeCross)

  // If the parent is wider than its children spread, re-center children
  if (nodeCross > totalChildrenWidth) {
    const childShift = (nodeCross - totalChildrenWidth) / 2
    for (const child of children) {
      shiftSubtree(child, treeChildren, positions, childShift)
    }
    positions.set(nodeId, { crossAxis: nodeCross / 2, mainAxis: mainPos })
  } else {
    positions.set(nodeId, { crossAxis: parentCenter, mainAxis: mainPos })
  }

  return subtreeWidth
}

/**
 * Shift a node and all its descendants by a cross-axis delta.
 */
function shiftSubtree(
  nodeId: string,
  treeChildren: ReadonlyMap<string, readonly string[]>,
  positions: Map<string, NodeLayout>,
  delta: number,
): void {
  if (delta === 0) return

  const layout = positions.get(nodeId)
  if (!layout) return

  positions.set(nodeId, {
    crossAxis: layout.crossAxis + delta,
    mainAxis: layout.mainAxis,
  })

  const children = treeChildren.get(nodeId)
  if (!children) return

  for (const child of children) {
    shiftSubtree(child, treeChildren, positions, delta)
  }
}

/**
 * Resolve raw depth indices in mainAxis to actual positions that account
 * for the maximum node main-axis extent at each depth level plus spacing.
 */
function resolveMainAxis(
  positions: Map<string, NodeLayout>,
  dimensions: ReadonlyMap<string, Dimensions>,
  isHorizontal: boolean,
  levelSpacing: number,
): void {
  // Collect max main-axis extent per depth level
  const maxExtentPerLevel = new Map<number, number>()
  for (const [nodeId, layout] of positions) {
    const depth = layout.mainAxis
    const extent = getMainExtent(nodeId, dimensions, isHorizontal)
    const current = maxExtentPerLevel.get(depth) ?? 0
    if (extent > current) {
      maxExtentPerLevel.set(depth, extent)
    }
  }

  // Compute cumulative main-axis offsets per depth level
  const maxDepth = Math.max(0, ...maxExtentPerLevel.keys())
  const levelOffsets = new Map<number, number>()
  let cumulative = 0
  for (let d = 0; d <= maxDepth; d++) {
    levelOffsets.set(d, cumulative)
    cumulative += (maxExtentPerLevel.get(d) ?? 0) + levelSpacing
  }

  // Replace depth indices with actual positions
  for (const [nodeId, layout] of positions) {
    positions.set(nodeId, {
      crossAxis: layout.crossAxis,
      mainAxis: levelOffsets.get(layout.mainAxis) ?? 0,
    })
  }
}

/**
 * Apply direction transform to convert canonical (crossAxis, mainAxis)
 * coordinates into final (x, y) positions.
 *
 * Canonical layout is TB: mainAxis = Y (downward), crossAxis = X (rightward).
 */
function applyDirection(
  positions: ReadonlyMap<string, NodeLayout>,
  direction: TreeDirection,
): Map<string, Position> {
  const result = new Map<string, Position>()

  for (const [nodeId, layout] of positions) {
    let x: number
    let y: number

    switch (direction) {
      case 'TB':
        x = layout.crossAxis
        y = layout.mainAxis
        break
      case 'BT':
        x = layout.crossAxis
        y = -layout.mainAxis
        break
      case 'LR':
        x = layout.mainAxis
        y = layout.crossAxis
        break
      case 'RL':
        x = -layout.mainAxis
        y = layout.crossAxis
        break
    }

    result.set(nodeId, { x, y })
  }

  return result
}

/**
 * Layout a single tree rooted at the given root node.
 * Returns the positioned nodes and the total cross-axis width of the tree.
 */
function layoutSingleTree(
  root: string,
  treeChildren: ReadonlyMap<string, readonly string[]>,
  dimensions: ReadonlyMap<string, Dimensions>,
  isHorizontal: boolean,
  siblingSpacing: number,
  levelSpacing: number,
): { positions: Map<string, NodeLayout>; width: number } {
  const positions = new Map<string, NodeLayout>()
  const width = layoutSubtree(
    root,
    0,
    treeChildren,
    dimensions,
    positions,
    isHorizontal,
    siblingSpacing,
    levelSpacing,
  )
  resolveMainAxis(positions, dimensions, isHorizontal, levelSpacing)
  return { positions, width }
}

/**
 * Multi-root strategy: 'super-root'.
 * Treats all roots as children of a virtual node, lays out the virtual
 * subtree, then removes the virtual root and shifts positions so the
 * top-level nodes start at main-axis 0.
 */
function layoutSuperRoot(
  roots: readonly string[],
  treeChildren: ReadonlyMap<string, readonly string[]>,
  dimensions: ReadonlyMap<string, Dimensions>,
  isHorizontal: boolean,
  siblingSpacing: number,
  levelSpacing: number,
): Map<string, NodeLayout> {
  const virtualRootId = '__tree_virtual_root__'

  // Create an extended tree children map with the virtual root
  const extendedChildren = new Map<string, readonly string[]>(treeChildren)
  extendedChildren.set(virtualRootId, roots)

  const positions = new Map<string, NodeLayout>()
  layoutSubtree(
    virtualRootId,
    0,
    extendedChildren,
    dimensions,
    positions,
    isHorizontal,
    siblingSpacing,
    levelSpacing,
  )

  // Remove the virtual root and shift depth indices down by 1
  positions.delete(virtualRootId)
  for (const [nodeId, layout] of positions) {
    positions.set(nodeId, {
      crossAxis: layout.crossAxis,
      mainAxis: layout.mainAxis - 1,
    })
  }

  resolveMainAxis(positions, dimensions, isHorizontal, levelSpacing)
  return positions
}

/**
 * Multi-root strategy: 'stack'.
 * Lays out each tree independently, then stacks them along the cross-axis
 * with subtreeSpacing gaps between them.
 */
function layoutStacked(
  roots: readonly string[],
  treeChildren: ReadonlyMap<string, readonly string[]>,
  dimensions: ReadonlyMap<string, Dimensions>,
  isHorizontal: boolean,
  siblingSpacing: number,
  subtreeSpacing: number,
  levelSpacing: number,
): Map<string, NodeLayout> {
  const allPositions = new Map<string, NodeLayout>()
  let crossOffset = 0

  for (let i = 0; i < roots.length; i++) {
    const root = roots[i]!
    const { positions, width } = layoutSingleTree(
      root,
      treeChildren,
      dimensions,
      isHorizontal,
      siblingSpacing,
      levelSpacing,
    )

    // Shift this tree's positions by the accumulated cross-axis offset
    for (const [nodeId, layout] of positions) {
      allPositions.set(nodeId, {
        crossAxis: layout.crossAxis + crossOffset,
        mainAxis: layout.mainAxis,
      })
    }

    crossOffset += width
    if (i < roots.length - 1) {
      crossOffset += subtreeSpacing
    }
  }

  return allPositions
}

// --- Public factory ---

/**
 * Creates a tree layout algorithm using a simplified Buchheim-Walker approach.
 *
 * The algorithm proceeds in three phases:
 * 1. **Tree construction** -- builds a spanning tree from graph edges via DFS,
 *    breaking cycles by ignoring back-edges
 * 2. **Subtree layout** -- recursively positions nodes bottom-up, centering
 *    parents over their children with guaranteed non-overlapping subtrees
 * 3. **Direction transform** -- maps canonical (cross, main) axes to final
 *    (x, y) coordinates based on the chosen direction
 *
 * Supports multiple disconnected trees via `multiRootStrategy`:
 * - `'super-root'` (default): treats all roots as children of a virtual node
 * - `'stack'`: lays out each tree independently and stacks them
 *
 * @param options - Configuration for direction, spacing, root selection, and multi-root handling
 * @returns A `LayoutAlgorithm` instance
 *
 * @example
 * ```ts
 * const layout = treeLayout({ direction: 'TB', siblingSpacing: 40 })
 * const positions = layout.layout(graph, dimensions, currentPositions)
 * ```
 */
export function treeLayout(options?: TreeLayoutOptions): LayoutAlgorithm {
  const direction = options?.direction ?? DEFAULT_DIRECTION
  const siblingSpacing = options?.siblingSpacing ?? DEFAULT_SIBLING_SPACING
  const subtreeSpacing = options?.subtreeSpacing ?? DEFAULT_SUBTREE_SPACING
  const levelSpacing = options?.levelSpacing ?? DEFAULT_LEVEL_SPACING
  const rootId = options?.rootId
  const multiRootStrategy = options?.multiRootStrategy ?? 'super-root'

  const isHorizontal = direction === 'LR' || direction === 'RL'

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
      const { childMap, inDegree } = buildChildMap(nodeIds, graph.edges)

      // Phase 0: Detect roots and build spanning tree
      const roots = findRoots(nodeIds, inDegree, rootId)
      const { treeChildren, reachable } = buildSpanningTree(roots, childMap)

      // Phase 1: Layout tree(s)
      let nodePositions: Map<string, NodeLayout>

      if (roots.length <= 1) {
        // Single root (or empty): layout directly
        const root = roots[0]
        if (root === undefined) {
          return new Map()
        }
        const { positions } = layoutSingleTree(
          root,
          treeChildren,
          dimensions,
          isHorizontal,
          siblingSpacing,
          levelSpacing,
        )
        nodePositions = positions
      } else if (multiRootStrategy === 'stack') {
        nodePositions = layoutStacked(
          roots,
          treeChildren,
          dimensions,
          isHorizontal,
          siblingSpacing,
          subtreeSpacing,
          levelSpacing,
        )
      } else {
        // 'super-root' (default)
        nodePositions = layoutSuperRoot(
          roots,
          treeChildren,
          dimensions,
          isHorizontal,
          siblingSpacing,
          levelSpacing,
        )
      }

      // Handle unreachable nodes: place them after the main layout
      const unreachableNodes = nodeIds.filter((id) => !reachable.has(id))
      if (unreachableNodes.length > 0) {
        // Find the maximum cross-axis extent of the laid-out nodes
        let maxCross = 0
        for (const layout of nodePositions.values()) {
          maxCross = Math.max(maxCross, layout.crossAxis)
        }

        const fallbackCrossStart = maxCross + subtreeSpacing
        let fallbackOffset = fallbackCrossStart

        for (const id of unreachableNodes) {
          const nodeCross = getCrossExtent(id, dimensions, isHorizontal)
          nodePositions.set(id, {
            crossAxis: fallbackOffset + nodeCross / 2,
            mainAxis: 0,
          })
          fallbackOffset += nodeCross + siblingSpacing
        }
      }

      // Phase 2: Apply direction transform
      return applyDirection(nodePositions, direction)
    },
  }
}
