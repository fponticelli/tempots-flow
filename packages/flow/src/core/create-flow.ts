import { prop } from '@tempots/core'
import type { Viewport, Dimensions } from '../types/layout'
import type { FlowConfig, FlowInstance } from '../types/config'
import { createLayoutEngine } from '../layout/layout-engine'
import { createEdgePathsSignal } from '../edges/compute-edge-paths'
import { createBezierStrategy } from '../edges/bezier'
import { createInteractionManager } from '../interaction/interaction-manager'
import type { FlowEvents } from '../types/events'
import { FlowViewport } from '../rendering/flow-viewport'
import { createHistoryManager } from './history-manager'
import { createClipboardManager } from './clipboard-manager'
import { handleKeyDown } from '../interaction/keyboard-handler'
import { removeNodes, removeEdges } from './graph-mutations'

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

  // --- History manager ---
  const historyManager = createHistoryManager(
    graphProp,
    () => layoutEngine.positions.value,
    (positions) => layoutEngine.setAllPositions(positions),
    { maxSize: config.maxUndoHistory ?? 100 },
  )

  // --- Clipboard manager ---
  const clipboardManager = createClipboardManager<N, E>()

  // --- Interaction manager (wrap drag end for history) ---
  const originalDragEnd = config.events?.onNodeDragEnd
  const wrappedEvents: Partial<FlowEvents<N, E>> = {
    ...config.events,
    onNodeDragEnd: (
      nodeIds: readonly string[],
      positions: ReadonlyMap<string, { x: number; y: number }>,
    ) => {
      historyManager.record()
      originalDragEnd?.(nodeIds, positions)
    },
  }

  const interactionManager = createInteractionManager(
    viewportProp,
    () => getContainerRect(),
    { ...config, events: wrappedEvents },
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

    let mnX = Infinity
    let mnY = Infinity
    let mxX = -Infinity
    let mxY = -Infinity

    for (const [nodeId, pos] of positions) {
      const dims = dimensions.get(nodeId) ?? { width: 180, height: 80 }
      mnX = Math.min(mnX, pos.x)
      mnY = Math.min(mnY, pos.y)
      mxX = Math.max(mxX, pos.x + dims.width)
      mxY = Math.max(mxY, pos.y + dims.height)
    }

    const rect = getContainerRect()
    const contentWidth = mxX - mnX
    const contentHeight = mxY - mnY
    const availWidth = rect.width - padding * 2
    const availHeight = rect.height - padding * 2

    if (availWidth <= 0 || availHeight <= 0) return

    const zoom = Math.min(availWidth / contentWidth, availHeight / contentHeight, maxZoom)
    const clampedZoom = Math.max(minZoom, zoom)

    const centerX = (mnX + mxX) / 2
    const centerY = (mnY + mxY) / 2

    viewportProp.set({
      x: rect.width / 2 - centerX * clampedZoom,
      y: rect.height / 2 - centerY * clampedZoom,
      zoom: clampedZoom,
    })
  }

  // --- Selection helpers ---
  function selectNodes(nodeIds: readonly string[]) {
    interactionManager.state.update((s) => ({
      ...s,
      selectedNodeIds: new Set(nodeIds),
    }))
  }

  function selectEdges(edgeIds: readonly string[]) {
    interactionManager.state.update((s) => ({
      ...s,
      selectedEdgeIds: new Set(edgeIds),
    }))
  }

  function clearSelection() {
    interactionManager.state.update((s) => ({
      ...s,
      selectedNodeIds: new Set<string>(),
      selectedEdgeIds: new Set<string>(),
    }))
  }

  // --- Editing helpers ---
  function updateGraph(updater: (g: typeof graphProp.value) => typeof graphProp.value) {
    graphProp.update(updater)
    historyManager.record()
  }

  function deleteSelection() {
    const nodeIds = selectedNodeIds.value
    const edgeIds = selectedEdgeIds.value
    if (nodeIds.size === 0 && edgeIds.size === 0) return
    graphProp.update((g) => {
      let result = g
      if (nodeIds.size > 0) result = removeNodes(result, nodeIds)
      if (edgeIds.size > 0) result = removeEdges(result, edgeIds)
      return result
    })
    clearSelection()
    historyManager.record()
    config.events?.onDelete?.(nodeIds, edgeIds)
  }

  function copySelection() {
    const nodeIds = selectedNodeIds.value
    clipboardManager.copy(graphProp.value, nodeIds, layoutEngine.positions.value)
    config.events?.onCopy?.(nodeIds)
  }

  function pasteSelection() {
    const result = clipboardManager.paste(graphProp.value, layoutEngine.positions.value)
    if (!result) return
    graphProp.set(result.graph)
    for (const [nodeId, pos] of result.positionUpdates) {
      layoutEngine.setNodePosition(nodeId, pos)
    }
    selectNodes(result.pastedNodeIds)
    historyManager.record()
    config.events?.onPaste?.(result.pastedNodeIds)
  }

  function cutSelection() {
    copySelection()
    deleteSelection()
  }

  function selectAll() {
    selectNodes(graphProp.value.nodes.map((n) => n.id))
  }

  // --- Keyboard handler ---
  const keyboardEnabled = config.keyboardEnabled !== false

  function onKeyDown(event: KeyboardEvent) {
    if (!keyboardEnabled) return
    handleKeyDown(event, {
      getGraph: () => graphProp.value,
      updateGraph(updater) {
        graphProp.update(updater)
      },
      getSelectedNodeIds: () => selectedNodeIds.value,
      getSelectedEdgeIds: () => selectedEdgeIds.value,
      selectNodes,
      clearSelection,
      getPositions: () => layoutEngine.positions.value,
      setNodePosition: layoutEngine.setNodePosition,
      history: historyManager,
      clipboard: clipboardManager,
      onDelete: config.events?.onDelete,
      onCopy: config.events?.onCopy,
      onPaste: config.events?.onPaste,
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
    onKeyDown,
  })

  // --- Instance API ---
  return {
    graph: graphProp,
    viewport: viewportProp,
    selectedNodeIds,
    selectedEdgeIds,
    edgePaths,

    updateGraph,

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

    selectNodes,
    selectEdges,
    clearSelection,

    setNodePosition(nodeId, position) {
      layoutEngine.setNodePosition(nodeId, position)
    },

    setLayout(algorithm) {
      layoutEngine.setAlgorithm(algorithm)
      requestAnimationFrame(() => fitView())
    },

    canUndo: historyManager.canUndo,
    canRedo: historyManager.canRedo,
    undo: () => historyManager.undo(),
    redo: () => historyManager.redo(),
    copySelection,
    pasteSelection,
    cutSelection,
    deleteSelection,
    selectAll,

    renderable,

    dispose() {
      // Signals auto-dispose with scope in @tempots/dom
    },
  }
}
