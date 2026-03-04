import { prop, computed } from '@tempots/core'
import type { Signal, Prop } from '@tempots/core'
import type { Graph } from '../types/graph'
import type { Viewport, Dimensions, Position, PortPlacement, PortOffset } from '../types/layout'
import type { Diagnostic } from '../types/validation'
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
import { computeVisibleNodeIds, computeVisibleEdgeIds } from './viewport-culling'

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

  // --- Measured port offsets (DOM-driven) ---
  const portOffsetsProp: Prop<ReadonlyMap<string, ReadonlyMap<string, PortOffset>>> = prop(
    new Map() as ReadonlyMap<string, ReadonlyMap<string, PortOffset>>,
  )

  // --- Edge routing ---
  const edgeRoutingProp = prop(config.edgeRouting ?? createBezierStrategy())
  const edgePaths = createEdgePathsSignal(
    graphProp,
    layoutEngine.positions,
    layoutEngine.dimensions,
    edgeRoutingProp,
    portPlacementProp,
    portOffsetsProp,
  )

  // --- Container rect ---
  const containerMounted = prop(0)
  let getContainerRect: () => DOMRect = () => new DOMRect(0, 0, 0, 0)
  function setContainerRect(getter: () => DOMRect) {
    getContainerRect = getter
    containerMounted.set(containerMounted.value + 1)
  }

  // --- Viewport tween (before culling so target signal is available) ---
  const viewportTween = createViewportTween(viewportProp, animationConfig.viewport, reducedMotion)

  // --- Viewport culling ---
  const cullMargin = config.cullMargin ?? 100
  const visibleNodeIds = computed(() => {
    const rect = getContainerRect()
    const positions = layoutEngine.positions.value
    const dimensions = layoutEngine.dimensions.value
    const visible = computeVisibleNodeIds(
      viewportProp.value,
      rect.width,
      rect.height,
      positions,
      dimensions,
      cullMargin,
    )

    // During animated viewport transitions, also include nodes visible at
    // the target viewport so they are already in the DOM when the animation
    // reaches them (prevents pop-in).
    const tweenTarget = viewportTween.target.value
    if (tweenTarget) {
      const atTarget = computeVisibleNodeIds(
        tweenTarget,
        rect.width,
        rect.height,
        positions,
        dimensions,
        cullMargin,
      )
      if (atTarget.size !== visible.size) {
        const union = new Set(visible)
        for (const id of atTarget) union.add(id)
        return union as ReadonlySet<string>
      }
    }

    return visible
  }, [
    viewportProp,
    layoutEngine.positions,
    layoutEngine.dimensions,
    containerMounted,
    viewportTween.target,
  ])
  const visibleEdgeIds = computed(
    () => computeVisibleEdgeIds(visibleNodeIds.value, graphProp.value.edges),
    [visibleNodeIds, graphProp],
  )

  // --- Per-node signal caches ---
  const nodePositionCache = new Map<string, Signal<Position>>()
  const nodeDimensionsCache = new Map<string, Signal<Dimensions>>()
  const nodeSelectedCache = new Map<string, Signal<boolean>>()
  const nodeHoveredCache = new Map<string, Signal<boolean>>()
  const nodeDiagnosticsCache = new Map<string, Signal<readonly Diagnostic[]>>()

  const DEFAULT_POS: Position = { x: 0, y: 0 }
  const DEFAULT_DIMS: Dimensions = { width: 180, height: 80 }

  // --- Reactive diagnostics ---
  const EMPTY_DIAGNOSTICS: readonly Diagnostic[] = []
  const diagnostics = computed<readonly Diagnostic[]>(() => {
    if (!config.validators?.length) return EMPTY_DIAGNOSTICS
    const g = graphProp.value
    return config.validators.flatMap((v) => v(g))
  }, [graphProp])

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
      if (config.dragEndBehavior === 'relayout' && config.layout) {
        layoutEngine.setAlgorithm(config.layout)
        triggerLayoutTransition()
      } else if (config.dragEndBehavior === 'settle' && config.layout) {
        // Re-run layout but pin dragged nodes to their current positions
        const currentPositions = layoutEngine.positions.value
        const dims = layoutEngine.dimensions.value
        const g = graphProp.value
        const newPositions = config.layout.layout(g, dims, currentPositions)
        // Merge: use current positions for dragged nodes, layout for others
        const merged = new Map(newPositions)
        for (const id of nodeIds) {
          const pos = currentPositions.get(id)
          if (pos) merged.set(id, pos)
        }
        layoutEngine.setAllPositions(merged)
        triggerLayoutTransition()
      }
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
    portOffsetsProp,
  )

  // --- Derived signals ---
  const selectedNodeIds = interactionManager.state.map((s) => s.selectedNodeIds)
  const selectedEdgeIds = interactionManager.state.map((s) => s.selectedEdgeIds)

  // --- Sub-graph navigation stack ---
  interface SubGraphFrame {
    graph: Graph<N, E>
    positions: ReadonlyMap<string, Position>
    viewport: Viewport
    compoundNodeId: string
  }
  const subGraphStack: SubGraphFrame[] = []
  const subGraphDepthProp = prop(0)

  function enterSubGraph(compoundNodeId: string) {
    const g = graphProp.value
    const node = g.nodes.find((n) => n.id === compoundNodeId)
    if (!node?.subGraph) return

    // Push current frame
    subGraphStack.push({
      graph: g,
      positions: new Map(layoutEngine.positions.value),
      viewport: viewportProp.value,
      compoundNodeId,
    })

    // Swap to inner graph
    ;(graphProp as Prop<Graph<N, E>>).set(node.subGraph.innerGraph as Graph<N, E>)
    clearSelection()
    subGraphDepthProp.set(subGraphStack.length)

    // Re-layout and fit
    if (config.layout) {
      layoutEngine.setAlgorithm(config.layout)
      triggerLayoutTransition()
    }
    requestAnimationFrame(() => fitView())
    config.events?.onEnterSubGraph?.(compoundNodeId)
  }

  function exitSubGraph() {
    if (subGraphStack.length === 0) return
    const frame = subGraphStack.pop()!

    // Restore parent graph, positions, viewport
    ;(graphProp as Prop<Graph<N, E>>).set(frame.graph)
    layoutEngine.setAllPositions(frame.positions)
    viewportProp.set(frame.viewport)
    clearSelection()
    subGraphDepthProp.set(subGraphStack.length)
    config.events?.onExitSubGraph?.(frame.compoundNodeId)
  }

  // --- Dimension change handler ---
  function onDimensionsChange(nodeId: string, dims: Dimensions) {
    layoutEngine.updateDimensions(nodeId, dims)
  }

  // --- Port offset change handler (DOM-measured) ---
  function onPortOffsetsChange(nodeId: string, offsets: ReadonlyMap<string, PortOffset>) {
    portOffsetsProp.update((current) => {
      const next = new Map(current)
      next.set(nodeId, offsets)
      return next
    })
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
    onPortOffsetsChange,
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
    exitAnimation: animationConfig.enterExit.enabled ? animationConfig.enterExit.exit : undefined,
    exitDuration: animationConfig.enterExit.enabled
      ? animationConfig.enterExit.duration
      : undefined,
    alignmentGuidesEnabled: config.alignmentGuides,
    visibleNodeIds,
    visibleEdgeIds,
    onNodeDoubleClick: (node, event) => {
      config.events?.onNodeDoubleClick?.(node, event)
      if (node.subGraph) {
        enterSubGraph(node.id)
      }
    },
    onBackgroundDoubleClick: () => exitSubGraph(),
    diagnostics,
  })

  // --- Instance API ---
  return {
    graph: graphProp,
    viewport: viewportProp,
    selectedNodeIds,
    selectedEdgeIds,
    edgePaths,
    visibleNodeIds,
    visibleEdgeIds,

    getNodePosition(nodeId: string): Signal<Position> {
      let sig = nodePositionCache.get(nodeId)
      if (!sig) {
        sig = layoutEngine.positions.map((p) => p.get(nodeId) ?? DEFAULT_POS)
        nodePositionCache.set(nodeId, sig)
      }
      return sig
    },

    getNodeDimensions(nodeId: string): Signal<Dimensions> {
      let sig = nodeDimensionsCache.get(nodeId)
      if (!sig) {
        sig = layoutEngine.dimensions.map((d) => d.get(nodeId) ?? DEFAULT_DIMS)
        nodeDimensionsCache.set(nodeId, sig)
      }
      return sig
    },

    isNodeSelected(nodeId: string): Signal<boolean> {
      let sig = nodeSelectedCache.get(nodeId)
      if (!sig) {
        sig = selectedNodeIds.map((s) => s.has(nodeId))
        nodeSelectedCache.set(nodeId, sig)
      }
      return sig
    },

    isNodeHovered(nodeId: string): Signal<boolean> {
      let sig = nodeHoveredCache.get(nodeId)
      if (!sig) {
        sig = interactionManager.state.map((s) => s.hoveredNodeId === nodeId)
        nodeHoveredCache.set(nodeId, sig)
      }
      return sig
    },

    diagnostics,

    nodeDiagnostics(nodeId: string): Signal<readonly Diagnostic[]> {
      let sig = nodeDiagnosticsCache.get(nodeId)
      if (!sig) {
        sig = diagnostics.map((ds) =>
          ds.filter(
            (d) =>
              (d.target.kind === 'node' && d.target.nodeId === nodeId) ||
              (d.target.kind === 'port' && d.target.nodeId === nodeId),
          ),
        ) as unknown as Signal<readonly Diagnostic[]>
        nodeDiagnosticsCache.set(nodeId, sig)
      }
      return sig
    },

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

    subGraphDepth: subGraphDepthProp,
    enterSubGraph,
    exitSubGraph,

    renderable,

    dispose() {
      viewportTween.cancel()
    },
  }
}
