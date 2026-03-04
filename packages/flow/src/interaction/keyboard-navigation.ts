import type { Graph } from '../types/graph'
import type { Position } from '../types/layout'

/**
 * Navigate to the next node in the given arrow direction.
 * - right: follow outgoing edges, fallback to nearest right neighbor
 * - left: follow incoming edges, fallback to nearest left neighbor
 * - up/down: spatial neighbor by Y position
 */
export function navigateByArrow<N, E>(
  direction: 'up' | 'down' | 'left' | 'right',
  graph: Graph<N, E>,
  selectedNodeIds: ReadonlySet<string>,
  positions: ReadonlyMap<string, Position>,
): string | null {
  if (selectedNodeIds.size !== 1) return null
  const currentId = [...selectedNodeIds][0]!
  const currentPos = positions.get(currentId)
  if (!currentPos) return null

  // Try edge-based navigation for left/right
  if (direction === 'right') {
    const targets = graph.edges
      .filter((e) => e.source.nodeId === currentId)
      .map((e) => e.target.nodeId)
    if (targets.length > 0) return targets[0]!
  }
  if (direction === 'left') {
    const sources = graph.edges
      .filter((e) => e.target.nodeId === currentId)
      .map((e) => e.source.nodeId)
    if (sources.length > 0) return sources[0]!
  }

  // Fallback to spatial
  return findSpatialNeighbor(direction, currentId, currentPos, positions)
}

function findSpatialNeighbor(
  direction: 'up' | 'down' | 'left' | 'right',
  currentId: string,
  currentPos: Position,
  positions: ReadonlyMap<string, Position>,
): string | null {
  let bestId: string | null = null
  let bestDist = Infinity

  for (const [id, pos] of positions) {
    if (id === currentId) continue

    const dx = pos.x - currentPos.x
    const dy = pos.y - currentPos.y

    // Check direction constraint
    const valid =
      (direction === 'right' && dx > 0) ||
      (direction === 'left' && dx < 0) ||
      (direction === 'down' && dy > 0) ||
      (direction === 'up' && dy < 0)

    if (!valid) continue

    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist < bestDist) {
      bestDist = dist
      bestId = id
    }
  }

  return bestId
}

/**
 * Cycle through nodes in position order (left→right, top→bottom).
 * direction: 'forward' (Tab) or 'backward' (Shift+Tab)
 */
export function cycleToNode(
  direction: 'forward' | 'backward',
  selectedNodeIds: ReadonlySet<string>,
  positions: ReadonlyMap<string, Position>,
): string | null {
  const sorted = sortNodesByPosition(positions)
  if (sorted.length === 0) return null

  if (selectedNodeIds.size !== 1) {
    return direction === 'forward' ? sorted[0]! : sorted[sorted.length - 1]!
  }

  const currentId = [...selectedNodeIds][0]!
  const currentIndex = sorted.indexOf(currentId)
  if (currentIndex === -1) return sorted[0]!

  if (direction === 'forward') {
    return sorted[(currentIndex + 1) % sorted.length]!
  }
  return sorted[(currentIndex - 1 + sorted.length) % sorted.length]!
}

/**
 * Get the first node in position order.
 */
export function getFirstNode(positions: ReadonlyMap<string, Position>): string | null {
  const sorted = sortNodesByPosition(positions)
  return sorted[0] ?? null
}

/**
 * Get the last node in position order.
 */
export function getLastNode(positions: ReadonlyMap<string, Position>): string | null {
  const sorted = sortNodesByPosition(positions)
  return sorted[sorted.length - 1] ?? null
}

function sortNodesByPosition(positions: ReadonlyMap<string, Position>): string[] {
  return [...positions.entries()]
    .sort(([, a], [, b]) => {
      const dy = a.y - b.y
      if (Math.abs(dy) > 10) return dy
      return a.x - b.x
    })
    .map(([id]) => id)
}
