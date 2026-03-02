import { prop } from '@tempots/core'
import type { Prop } from '@tempots/core'
import type { Graph } from '../types/graph'
import type { Viewport, Dimensions } from '../types/layout'
import type { FlowConfig, FlowInstance } from '../types/config'
import { createLayoutEngine } from '../layout/layout-engine'
import { createEdgePathsSignal } from '../edges/compute-edge-paths'
import { createBezierStrategy } from '../edges/bezier'
import { createInteractionManager } from '../interaction/interaction-manager'
import { FlowViewport } from '../rendering/flow-viewport'

const DEFAULT_VIEWPORT: Viewport = { x: 0, y: 0, zoom: 1 }

export function createFlow<N, E>(config: FlowConfig<N, E>): FlowInstance<N, E> {
  // --- Graph signal ---
  const graphProp: Prop<Graph<N, E>> = isSignal(config.graph)
    ? (config.graph as Prop<Graph<N, E>>)
    : prop(config.graph as Graph<N, E>)

  // --- Viewport signal ---
  const viewportProp = prop<Viewport>({
    ...DEFAULT_VIEWPORT,
    ...config.viewport,
  })

  // --- Layout engine ---
  const layoutEngine = createLayoutEngine(
    graphProp,
    config.layout,
    config.initialPositions,
    config.layoutTransitionDuration,
  )

  // --- Edge routing ---
  const edgeRouting = config.edgeRouting ?? createBezierStrategy()
  const edgePaths = createEdgePathsSignal(
    graphProp,
    layoutEngine.positions,
    layoutEngine.dimensions,
    edgeRouting,
  )

  // --- Container rect ---
  let getContainerRect: () => DOMRect = () => new DOMRect(0, 0, 0, 0)
  function setContainerRect(getter: () => DOMRect) {
    getContainerRect = getter
  }

  // --- Interaction manager ---
  const interactionManager = createInteractionManager(
    viewportProp,
    () => getContainerRect(),
    config,
    graphProp,
    layoutEngine.setNodePosition,
    layoutEngine.positions,
    layoutEngine.dimensions,
  )

  // --- Derived selection signals ---
  const selectedNodeIds = interactionManager.state.map((s) => s.selectedNodeIds)
  const selectedEdgeIds = interactionManager.state.map((s) => s.selectedEdgeIds)

  // --- Dimension change handler ---
  function onDimensionsChange(nodeId: string, dims: Dimensions) {
    layoutEngine.updateDimensions(nodeId, dims)
  }

  // --- Build renderable ---
  const renderable = FlowViewport(
    graphProp,
    viewportProp,
    layoutEngine.positions,
    edgePaths,
    interactionManager,
    onDimensionsChange,
    setContainerRect,
    edgeRouting,
    layoutEngine.transitioning,
    config.nodeRenderer,
  )

  // --- Instance API ---
  return {
    graph: graphProp,
    viewport: viewportProp,
    selectedNodeIds,
    selectedEdgeIds,
    edgePaths,

    updateGraph(updater) {
      graphProp.update(updater)
    },

    setViewport(partial) {
      viewportProp.update((v) => ({ ...v, ...partial }))
    },

    fitView(padding = config.fitViewPadding ?? 50) {
      const positions = layoutEngine.positions.value
      const dimensions = layoutEngine.dimensions.value
      if (positions.size === 0) return

      let minX = Infinity
      let minY = Infinity
      let maxX = -Infinity
      let maxY = -Infinity

      for (const [nodeId, pos] of positions) {
        const dims = dimensions.get(nodeId) ?? { width: 180, height: 80 }
        minX = Math.min(minX, pos.x)
        minY = Math.min(minY, pos.y)
        maxX = Math.max(maxX, pos.x + dims.width)
        maxY = Math.max(maxY, pos.y + dims.height)
      }

      const rect = getContainerRect()
      const contentWidth = maxX - minX
      const contentHeight = maxY - minY
      const availWidth = rect.width - padding * 2
      const availHeight = rect.height - padding * 2

      if (availWidth <= 0 || availHeight <= 0) return

      const zoom = Math.min(
        availWidth / contentWidth,
        availHeight / contentHeight,
        config.maxZoom ?? 4,
      )
      const clampedZoom = Math.max(config.minZoom ?? 0.1, zoom)

      const centerX = (minX + maxX) / 2
      const centerY = (minY + maxY) / 2

      viewportProp.set({
        x: rect.width / 2 - centerX * clampedZoom,
        y: rect.height / 2 - centerY * clampedZoom,
        zoom: clampedZoom,
      })
    },

    zoomTo(zoom, center) {
      const min = config.minZoom ?? 0.1
      const max = config.maxZoom ?? 4
      const clamped = Math.min(max, Math.max(min, zoom))

      if (center) {
        viewportProp.update((v) => {
          const ratio = clamped / v.zoom
          return {
            x: center.x - (center.x - v.x) * ratio,
            y: center.y - (center.y - v.y) * ratio,
            zoom: clamped,
          }
        })
      } else {
        viewportProp.update((v) => ({ ...v, zoom: clamped }))
      }
    },

    selectNodes(nodeIds) {
      interactionManager.state.update((s) => ({
        ...s,
        selectedNodeIds: new Set(nodeIds),
      }))
    },

    selectEdges(edgeIds) {
      interactionManager.state.update((s) => ({
        ...s,
        selectedEdgeIds: new Set(edgeIds),
      }))
    },

    clearSelection() {
      interactionManager.state.update((s) => ({
        ...s,
        selectedNodeIds: new Set<string>(),
        selectedEdgeIds: new Set<string>(),
      }))
    },

    setNodePosition(nodeId, position) {
      layoutEngine.setNodePosition(nodeId, position)
    },

    setLayout(algorithm) {
      layoutEngine.setAlgorithm(algorithm)
    },

    renderable,

    dispose() {
      // Signals auto-dispose with scope in @tempots/dom
    },
  }
}

function isSignal(value: unknown): boolean {
  return (
    value !== null &&
    typeof value === 'object' &&
    'value' in (value as Record<string, unknown>) &&
    'map' in (value as Record<string, unknown>)
  )
}
