import { render, html, attr, on, style } from '@tempots/dom'
import { prop, type Prop } from '@tempots/core'
import { createFlow } from '@tempots/flow'
import type { Graph, LayoutAlgorithm } from '@tempots/flow'
import { hierarchicalLayout, gridLayout, manualLayout } from '@tempots/flow/layouts'
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
  Grid: gridLayout({ columns: 3, columnSpacing: 250, rowSpacing: 150 }),
  Manual: manualLayout,
}

const activeLayout: Prop<string> = prop('Hierarchical LR')

const flow = createFlow({
  graph: prop(graph),
  layout: hierarchicalLayout({ direction: 'LR', layerSpacing: 250, nodeSpacing: 60 }),
  viewport: { x: 30, y: 30, zoom: 1 },
  layoutTransitionDuration: 300,
  events: {
    onSelectionChange(nodeIds, edgeIds) {
      console.log('Selection:', { nodes: [...nodeIds], edges: [...edgeIds] })
    },
  },
})

function LayoutButton(label: string, algorithm: LayoutAlgorithm) {
  const isActive = activeLayout.map((a) => a === label)
  return html.button(
    label,
    style.padding('6px 12px'),
    style.cursor('pointer'),
    style.border(
      isActive.map((a) => (a ? '1px solid #53a8ff' : '1px solid rgba(255,255,255,0.15)')),
    ),
    style.borderRadius('4px'),
    style.background(
      isActive.map((a) => (a ? 'rgba(83, 168, 255, 0.3)' : 'rgba(255,255,255,0.05)')),
    ),
    style.color(isActive.map((a) => (a ? '#ffffff' : 'rgba(255,255,255,0.6)'))),
    on.click(() => {
      activeLayout.set(label)
      flow.setLayout(algorithm)
    }),
  )
}

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
      ...Object.entries(layouts).map(([label, algo]) => LayoutButton(label, algo)),
    ),

    html.div(style.flex('1'), style.position('relative'), flow.renderable),
  ),
  '#app',
)
