import { prop } from '@tempots/core'
import type { Viewport, Dimensions, PortPlacement } from '../types/layout'
import type { FlowConfig, FlowInstance, BackgroundType } from '../types/config'
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
import { resolveAnimationConfig } from '../animation/animation-config'
import { createViewportTween } from '../animation/viewport-tween'
import { createReducedMotionSignal } from '../animation/reduced-motion'
import { createTouchHandler } from '../interaction/touch-handler'

const DEFAULT_VIEWPORT: Viewport = { x: 0, y: 0, zoom: 1 }

export function createFlow<N, E>(config: FlowConfig<N, E>): FlowInstance<N, E> {
  // --- Graph signal ---
  const graphProp = config.graph

  // --- Viewport signal ---
  const viewportProp = prop<Viewport>({
    ...DEFAULT_VIEWPORT,
    ...config.viewport,
  })

  // --- Grid config (unifies snap + background) ---
  const gridEnabled = config.grid !== false && config.grid !== undefined
  const gridSize = gridEnabled ? ((config.grid as { size?: number }).size ?? 20) : undefined

  // Grid overrides snap settings when present
  const effectiveConfig = gridEnabled
    ? {
        ...config,
        snapToGrid: config.snapToGrid ?? true,
        snapGridSize: config.snapGridSize ?? gridSize,
      }
    : config

  // Grid provides background (unless background is explicitly configured)
  const gridBackground = gridEnabled
    ? (() => {
        const g = config.grid as { type?: string; color?: string }
        return {
          type: (g.type as 'dots' | 'lines' | 'cross') ?? 'lines',
          gap: gridSize,
          color: g.color,
        }
      })()
    : undefined

  const effectiveBackground = config.background !== undefined ? config.background : gridBackground

  // Grid visibility signal (toggleable at runtime)
  const gridVisibleProp = prop(
    gridEnabled
      ? (config.grid as { visible?: boolean }).visible !== false
      : config.background !== false && config.background !== undefined,
  )

  // Grid type signal (switchable at runtime)
  const initialGridType: BackgroundType = gridEnabled
    ? ((config.grid as { type?: BackgroundType }).type ?? 'lines')
    : ((effectiveBackground as { type?: BackgroundType } | undefined)?.type ?? 'dots')
  const gridTypeProp = prop<BackgroundType>(initialGridType)

  // --- Animation config ---
  const animationConfig = resolveAnimationConfig(config.animation, config.layoutTransitionDuration)
  const reducedMotion = createReducedMotionSignal()
  // Snapshot at creation time — reduced motion preference is not reactive after init
  const effectivelyDisabled =
    !animationConfig.enabled || (animationConfig.respectReducedMotion && reducedMotion.value)

  // --- Layout engine ---
  const layoutDuration = effectivelyDisabled ? 0 : animationConfig.layout.duration
  const layoutEngine = createLayoutEngine(graphProp, config.layout, config.initialPositions)

  // --- Layout transition timer (CSS handles the actual animation) ---
  let transitionTimer: ReturnType<typeof setTimeout> | null = null

  function triggerLayoutTransition() {
    if (layoutDuration <= 0) return
    if (transitionTimer) clearTimeout(transitionTimer)
    layoutEngine.transitioning.set(true)
    transitionTimer = setTimeout(() => {
      layoutEngine.transitioning.set(false)
      transitionTimer = null
    }, layoutDuration)
  }

  // --- Port placement ---
  const portPlacementProp = prop<PortPlacement>(config.portPlacement ?? 'horizontal')

  // --- Edge routing ---
  const edgeRoutingProp = prop(config.edgeRouting ?? createBezierStrategy())
  const edgePaths = createEdgePathsSignal(
    graphProp,
    layoutEngine.positions,
    layoutEngine.dimensions,
    edgeRoutingProp,
    portPlacementProp,
  )

  // --- Viewport tween ---
  const viewportTween = createViewportTween(viewportProp, animationConfig.viewport, reducedMotion)

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
    { ...effectiveConfig, events: wrappedEvents },
    graphProp,
    layoutEngine.setNodePosition,
    layoutEngine.positions,
    layoutEngine.dimensions,
    layoutEngine.allowManualPositioning,
    portPlacementProp,
  )

  // --- Derived signals ---
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

  function computeZoomViewport(current: Viewport, newZoom: number): Viewport {
    const rect = getContainerRect()
    const cx = rect.width / 2
    const cy = rect.height / 2
    const ratio = newZoom / current.zoom
    return {
      x: cx - (cx - current.x) * ratio,
      y: cy - (cy - current.y) * ratio,
      zoom: newZoom,
    }
  }

  function zoomIn() {
    const current = viewportProp.value
    const newZoom = Math.min(maxZoom, current.zoom + zoomStep)
    viewportTween.tweenTo(computeZoomViewport(current, newZoom))
  }

  function zoomOut() {
    const current = viewportProp.value
    const newZoom = Math.max(minZoom, current.zoom - zoomStep)
    viewportTween.tweenTo(computeZoomViewport(current, newZoom))
  }

  function computeFitViewport(padding: number): Viewport | null {
    const positions = layoutEngine.positions.value
    const dimensions = layoutEngine.dimensions.value
    if (positions.size === 0) return null

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

    if (availWidth <= 0 || availHeight <= 0) return null

    const zoom = Math.min(availWidth / contentWidth, availHeight / contentHeight, maxZoom)
    const clampedZoom = Math.max(minZoom, zoom)

    const centerX = (mnX + mxX) / 2
    const centerY = (mnY + mxY) / 2

    return {
      x: rect.width / 2 - centerX * clampedZoom,
      y: rect.height / 2 - centerY * clampedZoom,
      zoom: clampedZoom,
    }
  }

  function fitView(padding = config.fitViewPadding ?? 50) {
    const target = computeFitViewport(padding)
    if (target) viewportTween.tweenTo(target)
  }

  // --- Cancel viewport tween on user interaction ---
  function onViewportInteraction() {
    viewportTween.cancel()
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
      zoomIn,
      zoomOut,
      fitView,
    })
  }

  // --- Interaction lock ---
  const interactionLockedProp = prop(false)
  const interactionLocked = interactionLockedProp.map((v) => v)

  function setInteractionLocked(locked: boolean) {
    interactionLockedProp.set(locked)
  }

  function toggleLock() {
    interactionLockedProp.update((v) => !v)
  }

  // --- Viewport navigation helpers ---
  function panTo(position: { x: number; y: number }, animate = true) {
    const rect = getContainerRect()
    const current = viewportProp.value
    const target: Viewport = {
      x: rect.width / 2 - position.x * current.zoom,
      y: rect.height / 2 - position.y * current.zoom,
      zoom: current.zoom,
    }
    if (animate) {
      viewportTween.tweenTo(target)
    } else {
      viewportProp.set(target)
    }
  }

  function centerOnNode(nodeId: string, zoom?: number, animate = true) {
    const pos = layoutEngine.positions.value.get(nodeId)
    if (!pos) return
    const dims = layoutEngine.dimensions.value.get(nodeId) ?? { width: 180, height: 80 }
    const centerX = pos.x + dims.width / 2
    const centerY = pos.y + dims.height / 2
    const rect = getContainerRect()
    const z = zoom ?? viewportProp.value.zoom
    const target: Viewport = {
      x: rect.width / 2 - centerX * z,
      y: rect.height / 2 - centerY * z,
      zoom: z,
    }
    if (animate) {
      viewportTween.tweenTo(target)
    } else {
      viewportProp.set(target)
    }
  }

  function centerOnSelection(padding = 50, animate = true) {
    const selected = selectedNodeIds.value
    if (selected.size === 0) return
    const positions = layoutEngine.positions.value
    const dimensions = layoutEngine.dimensions.value

    let mnX = Infinity
    let mnY = Infinity
    let mxX = -Infinity
    let mxY = -Infinity

    for (const id of selected) {
      const pos = positions.get(id)
      if (!pos) continue
      const dims = dimensions.get(id) ?? { width: 180, height: 80 }
      mnX = Math.min(mnX, pos.x)
      mnY = Math.min(mnY, pos.y)
      mxX = Math.max(mxX, pos.x + dims.width)
      mxY = Math.max(mxY, pos.y + dims.height)
    }

    if (!isFinite(mnX)) return

    const rect = getContainerRect()
    const contentWidth = mxX - mnX
    const contentHeight = mxY - mnY
    const availWidth = rect.width - padding * 2
    const availHeight = rect.height - padding * 2
    if (availWidth <= 0 || availHeight <= 0) return

    const z = Math.min(availWidth / contentWidth, availHeight / contentHeight, maxZoom)
    const clampedZoom = Math.max(minZoom, z)
    const centerX = (mnX + mxX) / 2
    const centerY = (mnY + mxY) / 2

    const target: Viewport = {
      x: rect.width / 2 - centerX * clampedZoom,
      y: rect.height / 2 - centerY * clampedZoom,
      zoom: clampedZoom,
    }
    if (animate) {
      viewportTween.tweenTo(target)
    } else {
      viewportProp.set(target)
    }
  }

  // --- Animation state (tracks CSS transition period) ---
  const isAnimating = layoutEngine.transitioning

  // --- Touch handler ---
  const touchHandler = createTouchHandler(viewportProp, () => getContainerRect(), {
    minZoom,
    maxZoom,
    onZoom: config.events?.onZoom,
  })

  // --- Enter animation config ---
  const enterAnimation = animationConfig.enterExit.enabled
    ? animationConfig.enterExit.enter
    : ('none' as const)

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
    edgeRouting: edgeRoutingProp,
    transitioning: layoutEngine.transitioning,
    allowManualPositioning: layoutEngine.allowManualPositioning,
    nodeRenderer: config.nodeRenderer,
    edgeRenderer: config.edgeRenderer,
    portRenderer: config.portRenderer,
    background: effectiveBackground,
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
    onViewportInteraction,
    enterAnimation,
    animationsEnabled: animationConfig.enabled && !effectivelyDisabled,
    gridVisible: gridVisibleProp,
    gridType: gridTypeProp,
    portPlacement: portPlacementProp,
    onPortHover: config.events?.onPortHover,
    onPortLeave: config.events?.onPortLeave,
    onEdgeDoubleClick: config.events?.onEdgeDoubleClick,
    onEdgeContextMenu: config.events?.onEdgeContextMenu,
    edgeMarkers:
      config.edgeMarkers === true
        ? { type: 'arrow-closed' }
        : config.edgeMarkers === false
          ? undefined
          : config.edgeMarkers,
    edgeLabels: config.edgeLabels,
    theme: config.theme,
    interactionLocked,
    toggleLock,
    onTouchStart: touchHandler.onTouchStart,
    onTouchMove: touchHandler.onTouchMove,
    onTouchEnd: touchHandler.onTouchEnd,
    alignmentGuidesEnabled: config.alignmentGuides,
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
      viewportTween.cancel()
      viewportProp.update((v) => ({ ...v, ...partial }))
    },

    fitView,

    zoomTo(zoom, center) {
      const min = config.minZoom ?? 0.1
      const max = config.maxZoom ?? 4
      const clamped = Math.min(max, Math.max(min, zoom))

      if (center) {
        const current = viewportProp.value
        const ratio = clamped / current.zoom
        viewportTween.tweenTo({
          x: center.x - (center.x - current.x) * ratio,
          y: center.y - (center.y - current.y) * ratio,
          zoom: clamped,
        })
      } else {
        viewportTween.tweenTo({ ...viewportProp.value, zoom: clamped })
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
      triggerLayoutTransition()
      requestAnimationFrame(() => fitView())
    },

    setEdgeRouting(strategy) {
      edgeRoutingProp.set(strategy)
    },

    portPlacement: portPlacementProp,
    setPortPlacement(placement: PortPlacement) {
      portPlacementProp.set(placement)
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

    gridVisible: gridVisibleProp,
    setGridVisible(visible: boolean) {
      gridVisibleProp.set(visible)
    },
    gridType: gridTypeProp,
    setGridType(type: BackgroundType) {
      gridTypeProp.set(type)
    },

    panTo,
    centerOnNode,
    centerOnSelection,

    interactionLocked,
    setInteractionLocked,

    isAnimating,

    renderable,

    dispose() {
      viewportTween.cancel()
    },
  }
}
