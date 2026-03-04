import { render, html, svg, attr, svgAttr, dataAttr, on, style, When } from '@tempots/dom'
import type { TNode } from '@tempots/dom'
import type { Signal } from '@tempots/core'
import { prop, type Prop } from '@tempots/core'
import { createFlow, EdgeFlowParticle, EdgeFlowPulse, springEasing } from '@tempots/flow'
import type {
  Graph,
  GraphEdge,
  LayoutAlgorithm,
  BackgroundType,
  EdgeRoutingStrategy,
  PortPlacement,
  EdgeRenderer,
  EdgeRenderContext,
} from '@tempots/flow'
import {
  hierarchicalLayout,
  gridLayout,
  manualLayout,
  forceDirectedLayout,
  treeLayout,
} from '@tempots/flow/layouts'
import {
  createBezierStrategy,
  createStraightStrategy,
  createStepStrategy,
  createSmoothStepStrategy,
  createBundledStrategy,
  createOrthogonalStrategy,
} from '@tempots/flow/edges'
import '@tempots/flow/css'

// Expanded graph with 10 nodes for viewport culling demo
const graph: Graph<string, string> = {
  nodes: [
    {
      id: 'source',
      data: 'Data Source',
      ports: [{ id: 'out', direction: 'output', label: 'Data' }],
    },
    {
      id: 'validate',
      data: 'Validate',
      ports: [
        { id: 'in', direction: 'input', label: 'In' },
        { id: 'ok', direction: 'output', label: 'Valid' },
        { id: 'err', direction: 'output', label: 'Errors' },
      ],
    },
    {
      id: 'filter',
      data: 'Filter',
      ports: [
        { id: 'in', direction: 'input', label: 'In' },
        { id: 'out', direction: 'output', label: 'Out' },
      ],
    },
    {
      id: 'transform',
      data: 'Transform',
      ports: [
        { id: 'in', direction: 'input', label: 'In' },
        { id: 'out', direction: 'output', label: 'Out' },
      ],
    },
    {
      id: 'enrich',
      data: 'Enrich',
      ports: [
        { id: 'in', direction: 'input', label: 'In' },
        { id: 'out', direction: 'output', label: 'Out' },
      ],
    },
    {
      id: 'aggregate',
      data: 'Aggregate',
      ports: [
        { id: 'in1', direction: 'input', label: 'In A' },
        { id: 'in2', direction: 'input', label: 'In B' },
        { id: 'out', direction: 'output', label: 'Out' },
      ],
    },
    {
      id: 'cache',
      data: 'Cache',
      ports: [
        { id: 'in', direction: 'input', label: 'In' },
        { id: 'out', direction: 'output', label: 'Out' },
      ],
    },
    {
      id: 'sink',
      data: 'Output',
      ports: [{ id: 'in', direction: 'input', label: 'In' }],
    },
    {
      id: 'error-handler',
      data: 'Error Handler',
      ports: [
        { id: 'in', direction: 'input', label: 'In' },
        { id: 'out', direction: 'output', label: 'Retry' },
      ],
    },
    {
      id: 'logger',
      data: 'Logger',
      ports: [{ id: 'in', direction: 'input', label: 'In' }],
    },
  ],
  edges: [
    {
      id: 'e1',
      data: '',
      source: { nodeId: 'source', portId: 'out' },
      target: { nodeId: 'validate', portId: 'in' },
      direction: 'forward',
    },
    {
      id: 'e2',
      data: '',
      source: { nodeId: 'validate', portId: 'ok' },
      target: { nodeId: 'filter', portId: 'in' },
      direction: 'forward',
    },
    {
      id: 'e3',
      data: '',
      source: { nodeId: 'validate', portId: 'ok' },
      target: { nodeId: 'transform', portId: 'in' },
      direction: 'forward',
    },
    {
      id: 'e4',
      data: '',
      source: { nodeId: 'filter', portId: 'out' },
      target: { nodeId: 'aggregate', portId: 'in1' },
      direction: 'forward',
    },
    {
      id: 'e5',
      data: '',
      source: { nodeId: 'transform', portId: 'out' },
      target: { nodeId: 'enrich', portId: 'in' },
      direction: 'forward',
    },
    {
      id: 'e6',
      data: '',
      source: { nodeId: 'enrich', portId: 'out' },
      target: { nodeId: 'aggregate', portId: 'in2' },
      direction: 'forward',
    },
    {
      id: 'e7',
      data: '',
      source: { nodeId: 'aggregate', portId: 'out' },
      target: { nodeId: 'cache', portId: 'in' },
      direction: 'forward',
    },
    {
      id: 'e8',
      data: '',
      source: { nodeId: 'cache', portId: 'out' },
      target: { nodeId: 'sink', portId: 'in' },
      direction: 'forward',
    },
    {
      id: 'e9',
      data: '',
      source: { nodeId: 'validate', portId: 'err' },
      target: { nodeId: 'error-handler', portId: 'in' },
      direction: 'forward',
    },
    {
      id: 'e10',
      data: '',
      source: { nodeId: 'error-handler', portId: 'out' },
      target: { nodeId: 'logger', portId: 'in' },
      direction: 'forward',
    },
  ],
}

const layouts: Record<string, LayoutAlgorithm> = {
  'Hierarchical LR': hierarchicalLayout({ direction: 'LR', layerSpacing: 250, nodeSpacing: 60 }),
  'Hierarchical TB': hierarchicalLayout({ direction: 'TB', layerSpacing: 150, nodeSpacing: 80 }),
  'Tree LR': treeLayout({ direction: 'LR', levelSpacing: 250, siblingSpacing: 60 }),
  'Tree TB': treeLayout({ direction: 'TB', levelSpacing: 150, siblingSpacing: 60 }),
  Grid: gridLayout({ columns: 4, columnSpacing: 250, rowSpacing: 150 }),
  Force: forceDirectedLayout(),
  Manual: manualLayout,
}

const activeLayout: Prop<string> = prop('Hierarchical LR')
const showGrid: Prop<boolean> = prop(true)
const activeGridType: Prop<BackgroundType> = prop<BackgroundType>('lines')
const activeRouting: Prop<string> = prop('Bezier')
const activePortPlacement: Prop<PortPlacement> = prop<PortPlacement>('horizontal')

const routingStrategies: Record<string, EdgeRoutingStrategy> = {
  Bezier: createBezierStrategy(),
  'Bezier Wide': createBezierStrategy({ controlOffset: 80 }),
  Straight: createStraightStrategy(),
  Step: createStepStrategy(),
  'Smooth Step': createSmoothStepStrategy({ borderRadius: 32 }),
  Bundled: createBundledStrategy(),
  Orthogonal: createOrthogonalStrategy(),
}

type EdgeEffect = 'none' | 'particle' | 'pulse'

const activeEffect: Prop<EdgeEffect> = prop<EdgeEffect>('none')
const mixedRouting: Prop<boolean> = prop(false)

const pipelineEdgeRenderer: EdgeRenderer<string> = (
  _edge: Signal<GraphEdge<string>>,
  context: EdgeRenderContext,
): TNode => {
  const d = context.path.map((ep) => ep.d)

  return svg.g(
    attr.class('flow-edge-group'),
    attr.class(context.isSelected.map((s): string => (s ? 'flow-edge--selected' : ''))),
    attr.class(context.isHovered.map((h): string => (h ? 'flow-edge--hovered' : ''))),
    dataAttr.edgeid!(context.path.map((ep) => ep.edgeId)),

    svg.path(svgAttr.d(d), attr.class('flow-edge')),

    When(
      activeEffect.map((e) => e === 'particle'),
      () =>
        EdgeFlowParticle(d, {
          count: 5,
          speed: 120,
          radius: 4,
          color: '#53d8ff',
        }),
    ),

    When(
      activeEffect.map((e) => e === 'pulse'),
      () =>
        EdgeFlowPulse(d, context.path.value.edgeId, {
          speed: 60,
          width: 4,
          dashArray: '16 10',
          color: '#53d8ff',
        }),
    ),
  )
}

function ToolbarButton(label: TNode, isActive: Signal<boolean>, onClick: () => void) {
  return html.button(
    label,
    style.padding('6px 12px'),
    style.cursor('pointer'),
    style.border(
      isActive.map((a): string => (a ? '1px solid #53a8ff' : '1px solid rgba(255,255,255,0.15)')),
    ),
    style.borderRadius('4px'),
    style.background(
      isActive.map((a): string => (a ? 'rgba(83, 168, 255, 0.3)' : 'rgba(255,255,255,0.05)')),
    ),
    style.color(isActive.map((a): string => (a ? '#ffffff' : 'rgba(255,255,255,0.6)'))),
    on.click(onClick),
  )
}

function ActionButton(label: string, onClick: () => void): TNode {
  return html.button(
    label,
    style.padding('6px 12px'),
    style.cursor('pointer'),
    style.border('1px solid rgba(255,255,255,0.15)'),
    style.borderRadius('4px'),
    style.background('rgba(255,255,255,0.05)'),
    style.color('rgba(255,255,255,0.6)'),
    on.click(onClick),
  )
}

function Separator(): TNode {
  return html.span(
    style.width('1px'),
    style.background('rgba(255,255,255,0.15)'),
    style.alignSelf('stretch'),
  )
}

// Per-edge routing: assign different strategies to individual edges
function applyMixedRouting(enabled: boolean) {
  const straight = createStraightStrategy()
  const step = createStepStrategy()
  flow.updateGraph((g) => ({
    ...g,
    edges: g.edges.map((e) => {
      if (!enabled) {
        const { routing: _, ...rest } = e
        return rest as GraphEdge<string>
      }
      // Assign different routing to specific edges
      if (e.id === 'e1' || e.id === 'e9') return { ...e, routing: straight }
      if (e.id === 'e4' || e.id === 'e6') return { ...e, routing: step }
      return e
    }),
  }))
}

const flow = createFlow({
  graph: prop(graph),
  edgeRenderer: pipelineEdgeRenderer,
  layout: hierarchicalLayout({ direction: 'LR', layerSpacing: 250, nodeSpacing: 60 }),
  viewport: { x: 30, y: 30, zoom: 1 },
  animation: {
    layout: { duration: 400, easing: springEasing(170, 26) },
  },
  grid: { size: 20, type: 'lines' },
  controls: { position: 'bottom-left', showLock: true },
  minimap: { position: 'bottom-right', width: 200, height: 150 },
  alignmentGuides: true,
  panInertia: true,
  edgeMarkers: true,
  cullMargin: 100,
  connection: { mode: 'loose' },
  dragEndBehavior: 'pin',
  events: {
    onSelectionChange(nodeIds, edgeIds) {
      console.log('Selection:', { nodes: [...nodeIds], edges: [...edgeIds] })
    },
  },
})

render(
  html.div(
    style.width('100%'),
    style.height('100%'),
    style.display('flex'),
    style.flexDirection('column'),

    html.div(
      style.display('flex'),
      style.gap('8px'),
      style.padding('8px'),
      style.background('rgba(0,0,0,0.6)'),
      style.zIndex('10'),
      style.flexWrap('wrap'),
      style.alignItems('center'),

      ...Object.entries(layouts).map(([label, algo]) =>
        ToolbarButton(
          label,
          activeLayout.map((a) => a === label),
          () => {
            activeLayout.set(label)
            const placement =
              label.includes('TB') || label.includes('BT') ? 'vertical' : 'horizontal'
            activePortPlacement.set(placement as PortPlacement)
            flow.setPortPlacement(placement as PortPlacement)
            flow.setLayout(algo)
          },
        ),
      ),

      Separator(),

      ToolbarButton(
        showGrid.map((v): string => (v ? 'Hide Grid' : 'Show Grid')),
        showGrid,
        () => {
          const next = !showGrid.value
          showGrid.set(next)
          flow.setGridVisible(next)
        },
      ),

      ...(['lines', 'dots', 'cross'] as const).map((gridType) =>
        ToolbarButton(
          gridType.charAt(0).toUpperCase() + gridType.slice(1),
          activeGridType.map((t) => t === gridType),
          () => {
            activeGridType.set(gridType)
            flow.setGridType(gridType)
          },
        ),
      ),

      Separator(),

      ...Object.entries(routingStrategies).map(([label, strategy]) =>
        ToolbarButton(
          label,
          activeRouting.map((a) => a === label),
          () => {
            activeRouting.set(label)
            flow.setEdgeRouting(strategy)
          },
        ),
      ),

      ToolbarButton('Mixed', mixedRouting, () => {
        const next = !mixedRouting.value
        mixedRouting.set(next)
        applyMixedRouting(next)
      }),

      Separator(),

      ...(['horizontal', 'vertical'] as const).map((placement) =>
        ToolbarButton(
          placement === 'horizontal' ? 'Ports L/R' : 'Ports T/B',
          activePortPlacement.map((p) => p === placement),
          () => {
            activePortPlacement.set(placement)
            flow.setPortPlacement(placement)
          },
        ),
      ),

      Separator(),

      ...(['none', 'particle', 'pulse'] as const).map((effect) =>
        ToolbarButton(
          effect === 'none' ? 'No Effect' : effect === 'particle' ? 'Particles' : 'Pulse',
          activeEffect.map((e) => e === effect),
          () => activeEffect.set(effect),
        ),
      ),

      Separator(),

      ActionButton('Fit View', () => flow.fitView(40)),
      ActionButton('Center', () => flow.centerOnSelection(40, true)),
    ),

    // Flow canvas with culling indicator overlay
    html.div(
      style.flex('1'),
      style.position('relative'),

      flow.renderable,

      // Culling indicator
      html.div(
        style.position('absolute'),
        style.top('8px'),
        style.right('8px'),
        style.padding('4px 10px'),
        style.borderRadius('4px'),
        style.background('rgba(0,0,0,0.5)'),
        style.fontSize('0.75em'),
        style.color('rgba(255,255,255,0.5)'),
        style.pointerEvents('none'),
        'Visible: ',
        flow.visibleNodeIds.map((s) => `${s.size}`),
        ' / ',
        flow.graph.map((g) => `${g.nodes.length} nodes`),
      ),
    ),
  ),
  '#app',
)
