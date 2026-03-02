import type { LayoutAlgorithm } from '../types/config'
import type { GraphNode } from '../types/graph'
import type { Position } from '../types/layout'

const DEFAULT_COLUMN_SPACING = 250
const DEFAULT_ROW_SPACING = 150
const DEFAULT_NODE_WIDTH = 180
const DEFAULT_NODE_HEIGHT = 80

/**
 * Options for the grid layout algorithm.
 */
export interface GridLayoutOptions {
  /** Number of columns. Defaults to ceil(sqrt(nodeCount)). */
  readonly columns?: number
  /** Horizontal spacing between columns in pixels. Defaults to 250. */
  readonly columnSpacing?: number
  /** Vertical spacing between rows in pixels. Defaults to 150. */
  readonly rowSpacing?: number
  /** Optional comparator to sort nodes before placement. */
  readonly sortBy?: (a: GraphNode<unknown>, b: GraphNode<unknown>) => number
}

/**
 * Creates a grid layout algorithm that arranges nodes in a uniform grid.
 *
 * Nodes are placed left-to-right, top-to-bottom. Column widths and row heights
 * adapt to the measured dimensions of their largest node, so heterogeneous
 * node sizes are handled gracefully.
 *
 * @param options - Grid layout configuration
 * @returns A LayoutAlgorithm that positions nodes in a grid
 *
 * @example
 * ```ts
 * const layout = gridLayout({ columns: 3, columnSpacing: 200 })
 * flow.setLayout(layout)
 * ```
 */
export function gridLayout(options: GridLayoutOptions = {}): LayoutAlgorithm {
  const {
    columns: fixedColumns,
    columnSpacing = DEFAULT_COLUMN_SPACING,
    rowSpacing = DEFAULT_ROW_SPACING,
    sortBy,
  } = options

  return {
    layout(graph, dimensions) {
      const { nodes } = graph
      if (nodes.length === 0) return new Map<string, Position>()

      const ordered = sortBy ? [...nodes].sort(sortBy) : nodes
      const columnCount = fixedColumns ?? Math.ceil(Math.sqrt(ordered.length))
      const rowCount = Math.ceil(ordered.length / columnCount)

      // Pre-compute max width per column and max height per row
      const maxColumnWidths = new Array<number>(columnCount).fill(0)
      const maxRowHeights = new Array<number>(rowCount).fill(0)

      for (let i = 0; i < ordered.length; i++) {
        const col = i % columnCount
        const row = Math.floor(i / columnCount)
        const dims = dimensions.get(ordered[i]!.id)
        const w = dims?.width ?? DEFAULT_NODE_WIDTH
        const h = dims?.height ?? DEFAULT_NODE_HEIGHT

        if (w > maxColumnWidths[col]!) maxColumnWidths[col] = w
        if (h > maxRowHeights[row]!) maxRowHeights[row] = h
      }

      // Build cumulative x-offsets per column
      const columnX = new Array<number>(columnCount).fill(0)
      for (let c = 1; c < columnCount; c++) {
        columnX[c] = columnX[c - 1]! + maxColumnWidths[c - 1]! + columnSpacing
      }

      // Build cumulative y-offsets per row
      const rowY = new Array<number>(rowCount).fill(0)
      for (let r = 1; r < rowCount; r++) {
        rowY[r] = rowY[r - 1]! + maxRowHeights[r - 1]! + rowSpacing
      }

      // Assign positions
      const result = new Map<string, Position>()
      for (let i = 0; i < ordered.length; i++) {
        const col = i % columnCount
        const row = Math.floor(i / columnCount)
        result.set(ordered[i]!.id, { x: columnX[col]!, y: rowY[row]! })
      }

      return result
    },
  }
}
