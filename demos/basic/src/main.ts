import { render, html, attr, style, on, When } from '@tempots/dom'
import type { TNode } from '@tempots/dom'
import type { Signal } from '@tempots/core'
import { prop } from '@tempots/core'
import { createFlow, springEasing } from '@tempots/flow'
import type { Graph } from '@tempots/flow'
import { requiredPorts, portTypeCheck, acyclic } from '@tempots/flow/validators'
import '@tempots/flow/css'

let edgeCounter = 6

const graph: Graph<string, string> = {
  nodes: [
    {
      id: 'source-1',
      data: 'Source A',
      ports: [{ id: 'out', direction: 'output', label: 'Output', type: 'data' }],
    },
    {
      id: 'source-2',
      data: 'Source B',
      ports: [{ id: 'out', direction: 'output', label: 'Output', type: 'data' }],
    },
    {
      id: 'filter',
      data: 'Filter',
      ports: [
        { id: 'in', direction: 'input', label: 'Input', type: 'data' },
        { id: 'out', direction: 'output', label: 'Output', type: 'data' },
      ],
    },
    {
      id: 'transform',
      data: 'Transform',
      ports: [
        { id: 'in', direction: 'input', label: 'Input', type: 'data' },
        { id: 'out', direction: 'output', label: 'Output', type: 'data' },
      ],
    },
    {
      id: 'merge',
      data: 'Merge',
      ports: [
        { id: 'in1', direction: 'input', label: 'In A', type: 'data' },
        { id: 'in2', direction: 'input', label: 'In B', type: 'data' },
        { id: 'out', direction: 'output', label: 'Output', type: 'data' },
      ],
    },
    {
      id: 'validate',
      data: 'Validate',
      ports: [
        { id: 'in', direction: 'input', label: 'Input', type: 'data', required: true },
        { id: 'ok', direction: 'output', label: 'Valid', type: 'data' },
        { id: 'err', direction: 'output', label: 'Error', type: 'signal' },
      ],
    },
    {
      id: 'output',
      data: 'Output',
      ports: [{ id: 'in', direction: 'input', label: 'Input', type: 'data', required: true }],
    },
    {
      id: 'logger',
      data: 'Logger',
      ports: [{ id: 'in', direction: 'input', label: 'Signal', type: 'signal' }],
    },
  ],
  edges: [
    {
      id: 'e1',
      data: '',
      source: { nodeId: 'source-1', portId: 'out' },
      target: { nodeId: 'filter', portId: 'in' },
      direction: 'forward',
    },
    {
      id: 'e2',
      data: '',
      source: { nodeId: 'source-2', portId: 'out' },
      target: { nodeId: 'transform', portId: 'in' },
      direction: 'forward',
    },
    {
      id: 'e3',
      data: '',
      source: { nodeId: 'filter', portId: 'out' },
      target: { nodeId: 'merge', portId: 'in1' },
      direction: 'forward',
    },
    {
      id: 'e4',
      data: '',
      source: { nodeId: 'transform', portId: 'out' },
      target: { nodeId: 'merge', portId: 'in2' },
      direction: 'forward',
    },
    {
      id: 'e5',
      data: '',
      source: { nodeId: 'merge', portId: 'out' },
      target: { nodeId: 'validate', portId: 'in' },
      direction: 'forward',
    },
    {
      id: 'e6',
      data: '',
      source: { nodeId: 'validate', portId: 'ok' },
      target: { nodeId: 'output', portId: 'in' },
      direction: 'forward',
    },
  ],
}

// Strict connection mode: only matching port types can connect.
// Self-connection disabled. Box selection with edge selection enabled.
// Validators produce reactive diagnostics.
const flow = createFlow({
  graph: prop(graph),
  initialPositions: new Map([
    ['source-1', { x: 50, y: 50 }],
    ['source-2', { x: 50, y: 250 }],
    ['filter', { x: 300, y: 50 }],
    ['transform', { x: 300, y: 250 }],
    ['merge', { x: 550, y: 150 }],
    ['validate', { x: 800, y: 150 }],
    ['output', { x: 1050, y: 100 }],
    ['logger', { x: 1050, y: 280 }],
  ]),
  alignmentGuides: true,
  panInertia: true,
  cullMargin: 50,
  connection: {
    mode: 'strict',
    selfConnection: false,
    onValidate(source, target) {
      console.log('Validate connection:', source, '->', target)
      return true
    },
  },
  boxSelection: { mode: 'intersect', selectEdges: true, modifier: 'shift' },
  keyboard: { arrowMode: 'spatial' },
  validators: [requiredPorts(), portTypeCheck(), acyclic()],
  animation: {
    layout: { duration: 400, easing: springEasing(170, 26) },
  },
  controls: { position: 'bottom-left', showLock: true },
  minimap: { position: 'bottom-right', width: 180, height: 120 },
  events: {
    onConnect(source, target) {
      edgeCounter++
      flow.updateGraph((g) => ({
        ...g,
        edges: [
          ...g.edges,
          {
            id: `edge-${edgeCounter}`,
            data: '',
            source,
            target,
            direction: 'forward' as const,
          },
        ],
      }))
    },
    onDelete(nodeIds, edgeIds) {
      flow.updateGraph((g) => ({
        nodes: g.nodes.filter((n) => !nodeIds.has(n.id)),
        edges: g.edges.filter(
          (e) =>
            !edgeIds.has(e.id) && !nodeIds.has(e.source.nodeId) && !nodeIds.has(e.target.nodeId),
        ),
      }))
    },
  },
})

// --- Toolbar helpers ---

function ActionButton(label: string, onClick: () => void): TNode {
  return html.button(
    label,
    style.padding('4px 10px'),
    style.cursor('pointer'),
    style.fontSize('0.8em'),
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

function Label(text: string): TNode {
  return html.span(
    style.fontSize('0.7em'),
    style.color('rgba(255,255,255,0.4)'),
    style.textTransform('uppercase'),
    style.letterSpacing('0.05em'),
    text,
  )
}

// --- Render ---

render(
  html.div(
    style.width('100%'),
    style.height('100%'),
    style.display('flex'),
    style.flexDirection('column'),

    // Toolbar
    html.div(
      style.display('flex'),
      style.gap('6px'),
      style.padding('6px 8px'),
      style.background('rgba(0,0,0,0.6)'),
      style.zIndex('10'),
      style.flexWrap('wrap'),
      style.alignItems('center'),

      Label('View:'),
      ActionButton('Fit View', () => flow.fitView(40)),
      ActionButton('Center Selection', () => flow.centerOnSelection(40, true)),
      ActionButton('Center on Source', () => flow.centerOnNode('source-1', 1, true)),
      ActionButton('Pan to Origin', () => flow.panTo({ x: 0, y: 0 }, true)),

      Separator(),

      Label('Edit:'),
      ActionButton('Select All', () => flow.selectAll()),
      ActionButton('Clear Selection', () => flow.clearSelection()),
      ActionButton('Delete Selected', () => flow.deleteSelection()),
      ActionButton('Undo', () => flow.undo()),
      ActionButton('Redo', () => flow.redo()),

      Separator(),

      Label('Info:'),
      html.span(
        style.fontSize('0.75em'),
        style.color('rgba(255,255,255,0.4)'),
        'Strict port types (data/signal) | Shift+drag for box select | Space+drag to pan | Arrow keys to navigate',
      ),
    ),

    // Flow canvas
    html.div(style.flex('1'), style.position('relative'), flow.renderable),

    // Status bar
    html.div(
      style.display('flex'),
      style.gap('16px'),
      style.padding('4px 12px'),
      style.background('rgba(0,0,0,0.6)'),
      style.fontSize('0.75em'),
      style.color('rgba(255,255,255,0.5)'),

      html.span(
        'Selected: ',
        flow.selectedNodeIds.map((s) => `${s.size} nodes`),
        ', ',
        flow.selectedEdgeIds.map((s) => `${s.size} edges`),
      ),

      html.span(
        'Visible: ',
        flow.visibleNodeIds.map((s) => `${s.size}`),
        ' / ',
        flow.graph.map((g) => `${g.nodes.length} nodes`),
      ),

      html.span(
        style.color(
          flow.diagnostics.map((d): string =>
            d.length > 0 ? 'rgba(255, 180, 50, 0.8)' : 'rgba(100, 255, 100, 0.6)',
          ),
        ),
        flow.diagnostics.map((d): string =>
          d.length > 0 ? `${d.length} diagnostic(s)` : 'No issues',
        ),
      ),

      When(
        flow.diagnostics.map((d) => d.length > 0),
        () =>
          html.span(
            style.color('rgba(255, 180, 50, 0.6)'),
            flow.diagnostics.map((d) =>
              d.map((diag) => `${diag.severity}: ${diag.message}`).join(' | '),
            ),
          ),
      ),
    ),
  ),
  '#app',
)
