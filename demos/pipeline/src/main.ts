import { render, html, on, style } from '@tempots/dom'
import type { TNode } from '@tempots/dom'
import type { Signal } from '@tempots/core'
import { prop, type Prop } from '@tempots/core'
import { createFlow } from '@tempots/flow'
import type {
  Graph,
  LayoutAlgorithm,
  BackgroundType,
  EdgeRoutingStrategy,
  PortPlacement,
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

const graph: Graph<string, string> = {
  nodes: [
    {
      id: 'source',
      data: 'Data Source',
      ports: [{ id: 'out', direction: 'output', label: 'Data' }],
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
      id: 'aggregate',
      data: 'Aggregate',
      ports: [
        { id: 'in1', direction: 'input', label: 'In A' },
        { id: 'in2', direction: 'input', label: 'In B' },
        { id: 'out', direction: 'output', label: 'Out' },
      ],
    },
    {
      id: 'sink',
      data: 'Output',
      ports: [{ id: 'in', direction: 'input', label: 'In' }],
    },
  ],
  edges: [
    {
      id: 'e1',
      data: '',
      source: { nodeId: 'source', portId: 'out' },
      target: { nodeId: 'filter', portId: 'in' },
      direction: 'forward',
    },
    {
      id: 'e2',
      data: '',
      source: { nodeId: 'source', portId: 'out' },
      target: { nodeId: 'transform', portId: 'in' },
      direction: 'forward',
    },
    {
      id: 'e3',
      data: '',
      source: { nodeId: 'filter', portId: 'out' },
      target: { nodeId: 'aggregate', portId: 'in1' },
      direction: 'forward',
    },
    {
      id: 'e4',
      data: '',
      source: { nodeId: 'transform', portId: 'out' },
      target: { nodeId: 'aggregate', portId: 'in2' },
      direction: 'forward',
    },
    {
      id: 'e5',
      data: '',
      source: { nodeId: 'aggregate', portId: 'out' },
      target: { nodeId: 'sink', portId: 'in' },
      direction: 'forward',
    },
  ],
}

const layouts: Record<string, LayoutAlgorithm> = {
  'Hierarchical LR': hierarchicalLayout({ direction: 'LR', layerSpacing: 250, nodeSpacing: 60 }),
  'Hierarchical TB': hierarchicalLayout({ direction: 'TB', layerSpacing: 150, nodeSpacing: 80 }),
  'Tree LR': treeLayout({ direction: 'LR', levelSpacing: 250, siblingSpacing: 60 }),
  'Tree TB': treeLayout({ direction: 'TB', levelSpacing: 150, siblingSpacing: 60 }),
  Grid: gridLayout({ columns: 3, columnSpacing: 250, rowSpacing: 150 }),
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
  Straight: createStraightStrategy(),
  Step: createStepStrategy(),
  'Smooth Step': createSmoothStepStrategy({ borderRadius: 32 }),
  Bundled: createBundledStrategy(),
  Orthogonal: createOrthogonalStrategy(),
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

const flow = createFlow({
  graph: prop(graph),
  layout: hierarchicalLayout({ direction: 'LR', layerSpacing: 250, nodeSpacing: 60 }),
  viewport: { x: 30, y: 30, zoom: 1 },
  layoutTransitionDuration: 300,
  grid: { size: 20, type: 'lines' },
  controls: { position: 'bottom-left', showLock: true },
  minimap: { position: 'bottom-right', width: 200, height: 150 },
  alignmentGuides: true,
  panInertia: true,
  edgeMarkers: true,
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

      html.span(
        style.width('1px'),
        style.background('rgba(255,255,255,0.15)'),
        style.alignSelf('stretch'),
      ),

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

      html.span(
        style.width('1px'),
        style.background('rgba(255,255,255,0.15)'),
        style.alignSelf('stretch'),
      ),

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

      html.span(
        style.width('1px'),
        style.background('rgba(255,255,255,0.15)'),
        style.alignSelf('stretch'),
      ),

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
    ),

    html.div(style.flex('1'), style.position('relative'), flow.renderable),
  ),
  '#app',
)
