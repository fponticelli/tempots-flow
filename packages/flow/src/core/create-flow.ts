import { prop } from '@tempots/core'
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
  const graphProp = config.graph

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
    layoutEngine.allowManualPositioning,
  )

  // --- Derived selection signals ---
  const selectedNodeIds = interactionManager.state.map((s) => s.selectedNodeIds)
  const selectedEdgeIds = interactionManager.state.map((s) => s.selectedEdgeIds)

  // --- Dimension change handler ---
  function onDimensionsChange(nodeId: string, dims: Dimensions) {
    layoutEngine.updateDimensions(nodeId, dims)
  }

  // --- Viewport helpers ---
  const zoomStep = config.zoomStep ?? 0.2
  const minZoom = config.minZoom ?? 0.1
  const maxZoom = config.maxZoom ?? 4

  function zoomIn() {
    viewportProp.update((v) => {
      const newZoom = Math.min(maxZoom, v.zoom + zoomStep)
      const rect = getContainerRect()
      const cx = rect.width / 2
      const cy = rect.height / 2
      const ratio = newZoom / v.zoom
      return {
        x: cx - (cx - v.x) * ratio,
        y: cy - (cy - v.y) * ratio,
        zoom: newZoom,
      }
    })
  }

  function zoomOut() {
    viewportProp.update((v) => {
      const newZoom = Math.max(minZoom, v.zoom - zoomStep)
      const rect = getContainerRect()
      const cx = rect.width / 2
      const cy = rect.height / 2
      const ratio = newZoom / v.zoom
      return {
        x: cx - (cx - v.x) * ratio,
        y: cy - (cy - v.y) * ratio,
        zoom: newZoom,
      }
    })
  }

  function fitView(padding = config.fitViewPadding ?? 50) {
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

    const zoom = Math.min(availWidth / contentWidth, availHeight / contentHeight, maxZoom)
    const clampedZoom = Math.max(minZoom, zoom)

    const centerX = (minX + maxX) / 2
    const centerY = (minY + maxY) / 2

    viewportProp.set({
      x: rect.width / 2 - centerX * clampedZoom,
      y: rect.height / 2 - centerY * clampedZoom,
      zoom: clampedZoom,
    })
  }

  // --- Build renderable ---
  const renderable = FlowViewport({
    graph: graphProp,
    viewport: viewportProp,
    positions: layoutEngine.positions,
    dimensions: layoutEngine.dimensions,
    edgePaths,
    interactionManager,
    onDimensionsChange,
    setContainerRect,
    edgeRouting,
    transitioning: layoutEngine.transitioning,
    allowManualPositioning: layoutEngine.allowManualPositioning,
    nodeRenderer: config.nodeRenderer,
    background: config.background,
    controls: config.controls,
    minimap: config.minimap,
    setViewport(partial) {
      viewportProp.update((v) => ({ ...v, ...partial }))
    },
    getContainerRect: () => getContainerRect(),
    zoomIn,
    zoomOut,
    fitView,
  })

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

    fitView,

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
      requestAnimationFrame(() => fitView())
    },

    renderable,

    dispose() {
      // Signals auto-dispose with scope in @tempots/dom
    },
  }
}
