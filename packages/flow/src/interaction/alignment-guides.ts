import type { Position, Dimensions } from '../types/layout'

export interface AlignmentGuide {
  readonly axis: 'horizontal' | 'vertical'
  readonly position: number
}

export interface AlignmentResult {
  readonly guides: readonly AlignmentGuide[]
  readonly snappedPosition: Position | null
}

/**
 * Computes alignment guides and optional snap position for a set of dragged nodes
 * relative to all other (non-dragged) nodes in the graph.
 *
 * Checks top/bottom/center-y (horizontal guides) and left/right/center-x (vertical guides)
 * of non-dragged nodes for alignment with the dragged node bounding box.
 */
export function computeAlignmentGuides(
  dragNodeIds: readonly string[],
  dragPositions: ReadonlyMap<string, Position>,
  allPositions: ReadonlyMap<string, Position>,
  allDimensions: ReadonlyMap<string, Dimensions>,
  snapThreshold: number,
): AlignmentResult {
  const dragSet = new Set(dragNodeIds)

  // Compute bounding box of dragged nodes
  let dragMinX = Infinity
  let dragMinY = Infinity
  let dragMaxX = -Infinity
  let dragMaxY = -Infinity

  for (const id of dragNodeIds) {
    const pos = dragPositions.get(id)
    if (!pos) continue
    const dims = allDimensions.get(id) ?? { width: 180, height: 80 }
    dragMinX = Math.min(dragMinX, pos.x)
    dragMinY = Math.min(dragMinY, pos.y)
    dragMaxX = Math.max(dragMaxX, pos.x + dims.width)
    dragMaxY = Math.max(dragMaxY, pos.y + dims.height)
  }

  if (!isFinite(dragMinX)) return { guides: [], snappedPosition: null }

  const dragCenterX = (dragMinX + dragMaxX) / 2
  const dragCenterY = (dragMinY + dragMaxY) / 2

  // Reference edges of dragged group
  const dragEdgesX = [dragMinX, dragCenterX, dragMaxX]
  const dragEdgesY = [dragMinY, dragCenterY, dragMaxY]

  const guides: AlignmentGuide[] = []
  let bestSnapDx: number | null = null
  let bestSnapDy: number | null = null
  let bestDistX = snapThreshold + 1
  let bestDistY = snapThreshold + 1

  // Check each non-dragged node
  for (const [nodeId, pos] of allPositions) {
    if (dragSet.has(nodeId)) continue
    const dims = allDimensions.get(nodeId) ?? { width: 180, height: 80 }

    const refLeft = pos.x
    const refRight = pos.x + dims.width
    const refCenterX = (refLeft + refRight) / 2
    const refTop = pos.y
    const refBottom = pos.y + dims.height
    const refCenterY = (refTop + refBottom) / 2

    const refEdgesX = [refLeft, refCenterX, refRight]
    const refEdgesY = [refTop, refCenterY, refBottom]

    // Vertical guides (x alignment)
    for (const refX of refEdgesX) {
      for (const dragX of dragEdgesX) {
        const d = Math.abs(refX - dragX)
        if (d <= snapThreshold) {
          guides.push({ axis: 'vertical', position: refX })
          if (d < bestDistX) {
            bestDistX = d
            bestSnapDx = refX - dragX
          }
        }
      }
    }

    // Horizontal guides (y alignment)
    for (const refY of refEdgesY) {
      for (const dragY of dragEdgesY) {
        const d = Math.abs(refY - dragY)
        if (d <= snapThreshold) {
          guides.push({ axis: 'horizontal', position: refY })
          if (d < bestDistY) {
            bestDistY = d
            bestSnapDy = refY - dragY
          }
        }
      }
    }
  }

  // Deduplicate guides
  const seen = new Set<string>()
  const uniqueGuides: AlignmentGuide[] = []
  for (const g of guides) {
    const key = `${g.axis}:${g.position}`
    if (!seen.has(key)) {
      seen.add(key)
      uniqueGuides.push(g)
    }
  }

  const snappedPosition: Position | null =
    bestSnapDx !== null || bestSnapDy !== null ? { x: bestSnapDx ?? 0, y: bestSnapDy ?? 0 } : null

  return { guides: uniqueGuides, snappedPosition }
}
