// Compound node hierarchy utilities — pure functions for parent/child relationships

import type { GraphNode } from '../types/graph'
import type { Position, Dimensions } from '../types/layout'

/** Get direct child IDs (nodes whose parentId === nodeId) */
export function getChildIds(nodeId: string, nodes: readonly GraphNode<unknown>[]): string[] {
  return nodes.filter((n) => n.parentId === nodeId).map((n) => n.id)
}

/** Get all descendant IDs recursively */
export function getDescendantIds(nodeId: string, nodes: readonly GraphNode<unknown>[]): string[] {
  const result: string[] = []
  const stack = getChildIds(nodeId, nodes)

  while (stack.length > 0) {
    const childId = stack.pop()
    if (childId === undefined) continue
    result.push(childId)
    stack.push(...getChildIds(childId, nodes))
  }

  return result
}

/** Get Set of node IDs that are group containers (have at least one child) */
export function getParentIds(nodes: readonly GraphNode<unknown>[]): Set<string> {
  const parents = new Set<string>()
  for (const node of nodes) {
    if (node.parentId !== undefined) {
      parents.add(node.parentId)
    }
  }
  return parents
}

/** Compute bounding box of a set of nodes including their dimensions, with padding */
export function getGroupBounds(
  childIds: readonly string[],
  positions: ReadonlyMap<string, Position>,
  dimensions: ReadonlyMap<string, Dimensions>,
  padding: number,
): { x: number; y: number; width: number; height: number } | null {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  let found = false

  for (const id of childIds) {
    const pos = positions.get(id)
    if (pos === undefined) continue
    found = true

    const dims = dimensions.get(id)
    const w = dims?.width ?? 0
    const h = dims?.height ?? 0

    minX = Math.min(minX, pos.x)
    minY = Math.min(minY, pos.y)
    maxX = Math.max(maxX, pos.x + w)
    maxY = Math.max(maxY, pos.y + h)
  }

  if (!found) return null

  return {
    x: minX - padding,
    y: minY - padding,
    width: maxX - minX + padding * 2,
    height: maxY - minY + padding * 2,
  }
}

/**
 * Expand a set of drag IDs to include all descendants of any group containers.
 * Deduplicates to prevent double-displacement.
 */
export function expandGroupDragIds(
  dragIds: readonly string[],
  nodes: readonly GraphNode<unknown>[],
): string[] {
  const result = new Set<string>(dragIds)

  for (const id of dragIds) {
    for (const descendant of getDescendantIds(id, nodes)) {
      result.add(descendant)
    }
  }

  return Array.from(result)
}
