import type { Position, Dimensions, Viewport } from '../types/layout'

/**
 * Computes the set of node IDs visible within the current viewport,
 * using AABB intersection with an optional margin for smooth scrolling.
 */
export function computeVisibleNodeIds(
  viewport: Viewport,
  containerWidth: number,
  containerHeight: number,
  positions: ReadonlyMap<string, Position>,
  dimensions: ReadonlyMap<string, Dimensions>,
  margin = 100,
): ReadonlySet<string> {
  // Viewport defines a transform: screen = graph * zoom + offset
  // Visible graph area: invert to get graph-space bounds
  const invZoom = 1 / viewport.zoom
  const graphLeft = (-viewport.x - margin) * invZoom
  const graphTop = (-viewport.y - margin) * invZoom
  const graphRight = (containerWidth - viewport.x + margin) * invZoom
  const graphBottom = (containerHeight - viewport.y + margin) * invZoom

  const visible = new Set<string>()

  for (const [nodeId, pos] of positions) {
    const dims = dimensions.get(nodeId) ?? { width: 180, height: 80 }
    const nodeRight = pos.x + dims.width
    const nodeBottom = pos.y + dims.height

    // AABB intersection
    if (
      pos.x <= graphRight &&
      nodeRight >= graphLeft &&
      pos.y <= graphBottom &&
      nodeBottom >= graphTop
    ) {
      visible.add(nodeId)
    }
  }

  return visible
}

/**
 * Computes the set of edge IDs that should be rendered based on visible nodes.
 * An edge is visible if at least one of its endpoints is visible.
 */
export function computeVisibleEdgeIds(
  visibleNodeIds: ReadonlySet<string>,
  edges: readonly {
    readonly id: string
    readonly source: { readonly nodeId: string }
    readonly target: { readonly nodeId: string }
  }[],
): ReadonlySet<string> {
  const visible = new Set<string>()

  for (const edge of edges) {
    if (visibleNodeIds.has(edge.source.nodeId) || visibleNodeIds.has(edge.target.nodeId)) {
      visible.add(edge.id)
    }
  }

  return visible
}
