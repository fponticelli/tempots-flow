import {
  render,
  html,
  svg,
  attr,
  svgAttr,
  style,
  on,
  computedOf,
  ForEach,
  Ensure,
} from '@tempots/dom'
import type { TNode } from '@tempots/dom'
import type { Signal } from '@tempots/core'
import { prop, type Prop } from '@tempots/core'
import {
  createFlow,
  createEdgeOverlay,
  EdgeFlowParticle,
  collapseToSubGraph,
  expandSubGraph,
} from '@tempots/flow'
import type {
  Graph,
  GraphNode,
  GraphEdge,
  PortDefinition,
  LayoutAlgorithm,
  BackgroundType,
  EdgeRoutingStrategy,
  PortPlacement,
  NodeRenderer,
  NodeRenderContext,
  EdgeRenderer,
  EdgeRenderContext,
  PortRenderer,
  PortRenderContext,
} from '@tempots/flow'
import { portTypeCheck, requiredPorts } from '@tempots/flow/validators'
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

// --- Types ---

type NodeType = 'source' | 'math' | 'mix' | 'output'
type DataType = 'float' | 'color' | 'vec2'

interface VisualNodeData {
  readonly label: string
  readonly type: NodeType
  readonly sourceKind?: 'number' | 'colorpicker' | 'texture' | 'uv'
  readonly value?: number
  readonly color?: string
  readonly formula?: string
}

interface VisualEdgeData {
  readonly dataType: DataType
  readonly quantity?: string
}

// --- Color maps ---

const nodeTypeColors: Record<NodeType, string> = {
  source: '#2d6a4f',
  math: '#e07c24',
  mix: '#7b2cbf',
  output: '#c1121f',
}

const dataTypeColors: Record<DataType, string> = {
  float: '#f0a500',
  color: '#4caf50',
  vec2: '#42a5f5',
}

const portTypeColors: Record<string, string> = {
  float: '#f0a500',
  color: '#4caf50',
  vec2: '#42a5f5',
}

// --- SVG ID utility ---

let _svgIdCounter = 0
function nextSvgId(prefix: string): string {
  return `visual-${prefix}-${++_svgIdCounter}`
}

// --- Dataflow evaluation ---

type PortValue =
  | { readonly type: 'float'; readonly value: number }
  | { readonly type: 'color'; readonly value: string }
  | { readonly type: 'vec2'; readonly value: readonly [number, number] }

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff]
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)))
  return '#' + [clamp(r), clamp(g), clamp(b)].map((c) => c.toString(16).padStart(2, '0')).join('')
}

function lerpColor(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(a)
  const [br, bg, bb] = hexToRgb(b)
  return rgbToHex(ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t)
}

function formatPortValue(v: PortValue): string {
  switch (v.type) {
    case 'float':
      return v.value.toFixed(2)
    case 'color':
      return v.value
    case 'vec2':
      return `(${v.value[0].toFixed(1)}, ${v.value[1].toFixed(1)})`
  }
}

function evaluate(
  g: Graph<VisualNodeData, VisualEdgeData>,
): ReadonlyMap<string, ReadonlyMap<string, PortValue>> {
  const results = new Map<string, Map<string, PortValue>>()

  function getInputs(nodeId: string): Map<string, PortValue> {
    const inputs = new Map<string, PortValue>()
    for (const edge of g.edges) {
      if (edge.target.nodeId === nodeId) {
        const sourceVals = computeNode(edge.source.nodeId)
        const val = sourceVals.get(edge.source.portId)
        if (val) inputs.set(edge.target.portId, val)
      }
    }
    return inputs
  }

  function computeNode(nodeId: string): Map<string, PortValue> {
    if (results.has(nodeId)) return results.get(nodeId)!
    const vals = new Map<string, PortValue>()
    results.set(nodeId, vals)

    const node = g.nodes.find((n) => n.id === nodeId)
    if (!node) return vals

    switch (nodeId) {
      case 'number':
        vals.set('out', { type: 'float', value: node.data.value ?? 0.5 })
        break
      case 'colorpicker':
        vals.set('out', { type: 'color', value: node.data.color ?? '#ff6b35' })
        break
      case 'texture':
        vals.set('color_out', { type: 'color', value: '#4caf50' })
        vals.set('alpha_out', { type: 'float', value: 0.85 })
        break
      case 'uv':
        vals.set('uv_out', { type: 'vec2', value: [0.5, 0.8] })
        break
      case 'multiply': {
        const ins = getInputs(nodeId)
        const a = ins.get('a')
        const b = ins.get('b')
        const aVal = a?.type === 'float' ? a.value : 0
        const bVal = b?.type === 'float' ? b.value : 0
        vals.set('out', { type: 'float', value: aVal * bVal })
        break
      }
      case 'colormix': {
        const ins = getInputs(nodeId)
        const colorA = ins.get('color_a')
        const colorB = ins.get('color_b')
        const factor = ins.get('factor')
        const cA = colorA?.type === 'color' ? colorA.value : '#000000'
        const cB = colorB?.type === 'color' ? colorB.value : '#000000'
        const f = factor?.type === 'float' ? Math.max(0, Math.min(1, factor.value)) : 0.5
        vals.set('out', { type: 'color', value: lerpColor(cA, cB, f) })
        // Store inputs for display
        vals.set('color_a', { type: 'color', value: cA })
        vals.set('color_b', { type: 'color', value: cB })
        vals.set('factor', { type: 'float', value: f })
        break
      }
      case 'output': {
        const ins = getInputs(nodeId)
        for (const [portId, value] of ins) {
          vals.set(portId, value)
        }
        break
      }
    }
    return vals
  }

  for (const node of g.nodes) {
    computeNode(node.id)
  }
  return results
}

// --- Graph ---

const graph: Graph<VisualNodeData, VisualEdgeData> = {
  nodes: [
    {
      id: 'number',
      data: { label: 'Number', type: 'source', sourceKind: 'number', value: 0.5 },
      ports: [{ id: 'out', direction: 'output', label: 'Value', type: 'float' }],
    },
    {
      id: 'colorpicker',
      data: { label: 'Color', type: 'source', sourceKind: 'colorpicker', color: '#ff6b35' },
      ports: [{ id: 'out', direction: 'output', label: 'Color', type: 'color' }],
    },
    {
      id: 'texture',
      data: { label: 'Texture', type: 'source', sourceKind: 'texture' },
      ports: [
        { id: 'color_out', direction: 'output', label: 'Color', type: 'color' },
        { id: 'alpha_out', direction: 'output', label: 'Alpha', type: 'float' },
      ],
    },
    {
      id: 'uv',
      data: { label: 'UV Coords', type: 'source', sourceKind: 'uv' },
      ports: [{ id: 'uv_out', direction: 'output', label: 'UV', type: 'vec2' }],
    },
    {
      id: 'multiply',
      data: { label: 'Multiply', type: 'math', formula: 'A \u00d7 B' },
      ports: [
        { id: 'a', direction: 'input', label: 'A', type: 'float' },
        { id: 'b', direction: 'input', label: 'B', type: 'float' },
        { id: 'out', direction: 'output', label: 'Result', type: 'float' },
      ],
    },
    {
      id: 'colormix',
      data: { label: 'Color Mix', type: 'mix' },
      ports: [
        { id: 'color_a', direction: 'input', label: 'Color A', type: 'color' },
        { id: 'color_b', direction: 'input', label: 'Color B', type: 'color' },
        { id: 'factor', direction: 'input', label: 'Factor', type: 'float' },
        { id: 'out', direction: 'output', label: 'Result', type: 'color' },
      ],
    },
    {
      id: 'output',
      data: { label: 'Material Output', type: 'output' },
      ports: [
        { id: 'color', direction: 'input', label: 'Color', type: 'color' },
        { id: 'alpha', direction: 'input', label: 'Alpha', type: 'float' },
        { id: 'uv', direction: 'input', label: 'UV', type: 'vec2' },
      ],
    },
  ],
  edges: [
    {
      id: 'e1',
      data: { dataType: 'float' },
      source: { nodeId: 'number', portId: 'out' },
      target: { nodeId: 'multiply', portId: 'b' },
      direction: 'forward',
    },
    {
      id: 'e2',
      data: { dataType: 'float' },
      source: { nodeId: 'texture', portId: 'alpha_out' },
      target: { nodeId: 'multiply', portId: 'a' },
      direction: 'forward',
    },
    {
      id: 'e3',
      data: { dataType: 'color' },
      source: { nodeId: 'colorpicker', portId: 'out' },
      target: { nodeId: 'colormix', portId: 'color_a' },
      direction: 'forward',
    },
    {
      id: 'e4',
      data: { dataType: 'color' },
      source: { nodeId: 'texture', portId: 'color_out' },
      target: { nodeId: 'colormix', portId: 'color_b' },
      direction: 'forward',
    },
    {
      id: 'e5',
      data: { dataType: 'float' },
      source: { nodeId: 'multiply', portId: 'out' },
      target: { nodeId: 'colormix', portId: 'factor' },
      direction: 'forward',
    },
    {
      id: 'e6',
      data: { dataType: 'color' },
      source: { nodeId: 'colormix', portId: 'out' },
      target: { nodeId: 'output', portId: 'color' },
      direction: 'forward',
    },
    {
      id: 'e7',
      data: { dataType: 'float' },
      source: { nodeId: 'multiply', portId: 'out' },
      target: { nodeId: 'output', portId: 'alpha' },
      direction: 'forward',
    },
    {
      id: 'e8',
      data: { dataType: 'vec2' },
      source: { nodeId: 'uv', portId: 'uv_out' },
      target: { nodeId: 'output', portId: 'uv' },
      direction: 'forward',
    },
  ],
}

// --- Graph prop (keep reference for direct updates from inputs) ---

const graphProp = prop(graph)

// --- Computed dataflow values ---

const computedValues = graphProp.map(evaluate)

function portValue(nodeId: string, portId: string): Signal<PortValue | undefined> {
  return computedValues.map((m) => m.get(nodeId)?.get(portId))
}

// --- Node content builders ---

function numberConstantContent(node: Signal<GraphNode<VisualNodeData>>): TNode {
  const value = node.map((n) => n.data.value ?? 0.5)
  return html.div(
    attr.class('visual-node-content'),
    html.input(
      attr.type('range'),
      attr.min(0),
      attr.max(1),
      attr.step(0.01),
      attr.value(value.map(String)),
      on.pointerdown((e: PointerEvent) => e.stopPropagation()),
      on.input((e: Event) => {
        const val = parseFloat((e.target as HTMLInputElement).value)
        graphProp.update((g) => ({
          ...g,
          nodes: g.nodes.map((n) =>
            n.id === 'number' ? { ...n, data: { ...n.data, value: val } } : n,
          ),
        }))
      }),
    ),
    html.div(
      attr.class('visual-value-display'),
      value.map((v) => v.toFixed(2)),
    ),
  )
}

function colorPickerContent(node: Signal<GraphNode<VisualNodeData>>): TNode {
  const color = node.map((n) => n.data.color ?? '#ff6b35')
  return html.div(
    attr.class('visual-node-content'),
    html.input(
      attr.type('color'),
      attr.value(color),
      style.width('48px'),
      style.height('32px'),
      on.pointerdown((e: PointerEvent) => e.stopPropagation()),
      on.input((e: Event) => {
        const c = (e.target as HTMLInputElement).value
        graphProp.update((g) => ({
          ...g,
          nodes: g.nodes.map((n) =>
            n.id === 'colorpicker' ? { ...n, data: { ...n.data, color: c } } : n,
          ),
        }))
      }),
    ),
    html.span(attr.class('visual-hex-display'), color),
  )
}

function textureContent(): TNode {
  const checkerId = nextSvgId('checker')
  const gradientId = nextSvgId('tex-grad')
  return html.div(
    attr.class('visual-node-content'),
    html.div(
      attr.class('visual-texture-preview'),
      svg.svg(
        attr.width('80'),
        attr.height('60'),
        svgAttr.viewBox('0 0 80 60'),
        svg.defs(
          svg.pattern(
            svgAttr.id(checkerId),
            svgAttr.width(16),
            svgAttr.height(16),
            svgAttr.patternUnits('userSpaceOnUse'),
            svg.rect(svgAttr.width(8), svgAttr.height(8), svgAttr.fill('#555')),
            svg.rect(
              svgAttr.x(8),
              svgAttr.y(8),
              svgAttr.width(8),
              svgAttr.height(8),
              svgAttr.fill('#555'),
            ),
            svg.rect(
              svgAttr.x(8),
              svgAttr.y(0),
              svgAttr.width(8),
              svgAttr.height(8),
              svgAttr.fill('#333'),
            ),
            svg.rect(
              svgAttr.x(0),
              svgAttr.y(8),
              svgAttr.width(8),
              svgAttr.height(8),
              svgAttr.fill('#333'),
            ),
          ),
          svg.linearGradient(
            svgAttr.id(gradientId),
            svgAttr.x1('0%'),
            svgAttr.y1('0%'),
            svgAttr.x2('100%'),
            svgAttr.y2('100%'),
            svg.stop(
              svgAttr.offset('0%'),
              svgAttr['stop-color']('#ff6b35'),
              svgAttr['stop-opacity'](0.6),
            ),
            svg.stop(
              svgAttr.offset('100%'),
              svgAttr['stop-color']('#4caf50'),
              svgAttr['stop-opacity'](0.6),
            ),
          ),
        ),
        svg.rect(svgAttr.width(80), svgAttr.height(60), svgAttr.fill(`url(#${checkerId})`)),
        svg.rect(svgAttr.width(80), svgAttr.height(60), svgAttr.fill(`url(#${gradientId})`)),
      ),
    ),
  )
}

function uvContent(): TNode {
  return html.div(
    attr.class('visual-node-content'),
    svg.svg(
      attr.width('60'),
      attr.height('60'),
      svgAttr.viewBox('0 0 60 60'),
      // Grid lines
      ...[10, 20, 30, 40, 50].flatMap((v) => [
        svg.line(
          svgAttr.x1(v),
          svgAttr.y1(0),
          svgAttr.x2(v),
          svgAttr.y2(60),
          svgAttr.stroke('rgba(255,255,255,0.12)'),
          svgAttr['stroke-width'](0.5),
        ),
        svg.line(
          svgAttr.x1(0),
          svgAttr.y1(v),
          svgAttr.x2(60),
          svgAttr.y2(v),
          svgAttr.stroke('rgba(255,255,255,0.12)'),
          svgAttr['stroke-width'](0.5),
        ),
      ]),
      // U axis (red)
      svg.line(
        svgAttr.x1(5),
        svgAttr.y1(55),
        svgAttr.x2(55),
        svgAttr.y2(55),
        svgAttr.stroke('#f44336'),
        svgAttr['stroke-width'](1.5),
      ),
      // U arrowhead
      svg.polygon(svgAttr.points('55,52 55,58 59,55'), svgAttr.fill('#f44336')),
      // V axis (green)
      svg.line(
        svgAttr.x1(5),
        svgAttr.y1(55),
        svgAttr.x2(5),
        svgAttr.y2(5),
        svgAttr.stroke('#4caf50'),
        svgAttr['stroke-width'](1.5),
      ),
      // V arrowhead
      svg.polygon(svgAttr.points('2,5 8,5 5,1'), svgAttr.fill('#4caf50')),
      // Origin dot
      svg.circle(svgAttr.cx(5), svgAttr.cy(55), svgAttr.r(2.5), svgAttr.fill('#ffffff')),
      // Labels
      svg.text(
        svgAttr.x(54),
        svgAttr.y(50),
        svgAttr.fill('#f44336'),
        svgAttr['font-size']('9px'),
        svgAttr['font-weight']('bold'),
        'U',
      ),
      svg.text(
        svgAttr.x(9),
        svgAttr.y(10),
        svgAttr.fill('#4caf50'),
        svgAttr['font-size']('9px'),
        svgAttr['font-weight']('bold'),
        'V',
      ),
    ),
  )
}

function multiplyContent(node: Signal<GraphNode<VisualNodeData>>): TNode {
  const result = portValue('multiply', 'out')
  return html.div(
    attr.class('visual-node-content visual-formula'),
    html.span(
      attr.class('visual-formula-text'),
      node.map((n) => n.data.formula ?? 'A \u00d7 B'),
    ),
    svg.svg(
      attr.width('32'),
      attr.height('32'),
      svgAttr.viewBox('0 0 32 32'),
      svg.line(
        svgAttr.x1(8),
        svgAttr.y1(8),
        svgAttr.x2(24),
        svgAttr.y2(24),
        svgAttr.stroke('#e07c24'),
        svgAttr['stroke-width'](2.5),
        svgAttr['stroke-linecap']('round'),
      ),
      svg.line(
        svgAttr.x1(24),
        svgAttr.y1(8),
        svgAttr.x2(8),
        svgAttr.y2(24),
        svgAttr.stroke('#e07c24'),
        svgAttr['stroke-width'](2.5),
        svgAttr['stroke-linecap']('round'),
      ),
    ),
    html.div(
      attr.class('visual-value-display'),
      result.map((v) => (v?.type === 'float' ? `= ${v.value.toFixed(2)}` : '')),
    ),
  )
}

function colorMixContent(): TNode {
  const gradientId = nextSvgId('mix-grad')
  const colorA = portValue('colormix', 'color_a').map((v) =>
    v?.type === 'color' ? v.value : '#000000',
  )
  const colorB = portValue('colormix', 'color_b').map((v) =>
    v?.type === 'color' ? v.value : '#000000',
  )
  const factor = portValue('colormix', 'factor').map((v) => (v?.type === 'float' ? v.value : 0.5))
  return html.div(
    attr.class('visual-node-content'),
    svg.svg(
      attr.width('120'),
      attr.height('30'),
      svgAttr.viewBox('0 0 120 30'),
      svg.defs(
        svg.linearGradient(
          svgAttr.id(gradientId),
          svgAttr.x1('0%'),
          svgAttr.y1('0%'),
          svgAttr.x2('100%'),
          svgAttr.y2('0%'),
          svg.stop(svgAttr.offset('0%'), attr.style(colorA.map((c) => `stop-color: ${c}`))),
          svg.stop(svgAttr.offset('100%'), attr.style(colorB.map((c) => `stop-color: ${c}`))),
        ),
      ),
      svg.rect(
        svgAttr.width(120),
        svgAttr.height(24),
        svgAttr.rx(4),
        svgAttr.ry(4),
        svgAttr.fill(`url(#${gradientId})`),
      ),
      // Factor indicator
      svg.line(
        svgAttr.x1(factor.map((f) => Math.round(f * 120))),
        svgAttr.y1(0),
        svgAttr.x2(factor.map((f) => Math.round(f * 120))),
        svgAttr.y2(24),
        svgAttr.stroke('rgba(255,255,255,0.8)'),
        svgAttr['stroke-width'](2),
      ),
      svg.text(
        svgAttr.x(10),
        svgAttr.y(16),
        svgAttr.fill('#fff'),
        svgAttr['font-size']('9px'),
        svgAttr['font-weight']('bold'),
        'A',
      ),
      svg.text(
        svgAttr.x(106),
        svgAttr.y(16),
        svgAttr.fill('#fff'),
        svgAttr['font-size']('9px'),
        svgAttr['font-weight']('bold'),
        'B',
      ),
      // Factor label
      svg.text(
        svgAttr.x(60),
        svgAttr.y(29),
        svgAttr.fill('rgba(255,255,255,0.6)'),
        svgAttr['text-anchor']('middle'),
        svgAttr['font-size']('7px'),
        svgAttr['font-family']("'SF Mono', 'Fira Code', monospace"),
        factor.map((f) => f.toFixed(2)),
      ),
    ),
  )
}

function materialOutputContent(): TNode {
  const checkerId = nextSvgId('out-checker')
  const gradientId = nextSvgId('out-mat')
  const outColor = portValue('output', 'color').map((v) =>
    v?.type === 'color' ? v.value : '#888888',
  )
  const outAlpha = portValue('output', 'alpha').map((v) => (v?.type === 'float' ? v.value : 1))
  return html.div(
    attr.class('visual-node-content visual-output-preview'),
    svg.svg(
      attr.width('140'),
      attr.height('100'),
      svgAttr.viewBox('0 0 140 100'),
      svg.defs(
        svg.pattern(
          svgAttr.id(checkerId),
          svgAttr.width(14),
          svgAttr.height(14),
          svgAttr.patternUnits('userSpaceOnUse'),
          svg.rect(svgAttr.width(7), svgAttr.height(7), svgAttr.fill('#444')),
          svg.rect(
            svgAttr.x(7),
            svgAttr.y(7),
            svgAttr.width(7),
            svgAttr.height(7),
            svgAttr.fill('#444'),
          ),
          svg.rect(
            svgAttr.x(7),
            svgAttr.y(0),
            svgAttr.width(7),
            svgAttr.height(7),
            svgAttr.fill('#333'),
          ),
          svg.rect(
            svgAttr.x(0),
            svgAttr.y(7),
            svgAttr.width(7),
            svgAttr.height(7),
            svgAttr.fill('#333'),
          ),
        ),
        svg.radialGradient(
          svgAttr.id(gradientId),
          svgAttr.cx('50%'),
          svgAttr.cy('40%'),
          svgAttr.r('60%'),
          svg.stop(
            svgAttr.offset('0%'),
            attr.style(
              computedOf(outColor, outAlpha)((c, a) => `stop-color: ${c}; stop-opacity: ${a}`),
            ),
          ),
          svg.stop(
            svgAttr.offset('60%'),
            attr.style(
              outColor.map((c) => {
                // Darken the color for the mid-ring
                const [r, g, b] = hexToRgb(c)
                return `stop-color: ${rgbToHex(r * 0.5, g * 0.5, b * 0.5)}; stop-opacity: 0.8`
              }),
            ),
          ),
          svg.stop(svgAttr.offset('100%'), attr.style('stop-color: #1a1a2e; stop-opacity: 0.9')),
        ),
      ),
      svg.rect(
        svgAttr.width(140),
        svgAttr.height(100),
        svgAttr.rx(6),
        svgAttr.fill(`url(#${checkerId})`),
      ),
      svg.rect(
        svgAttr.width(140),
        svgAttr.height(100),
        svgAttr.rx(6),
        svgAttr.fill(`url(#${gradientId})`),
      ),
      svg.text(
        svgAttr.x(70),
        svgAttr.y(92),
        svgAttr.fill('rgba(255,255,255,0.4)'),
        svgAttr['text-anchor']('middle'),
        svgAttr['font-size']('8px'),
        svgAttr['letter-spacing']('0.15em'),
        'MATERIAL PREVIEW',
      ),
    ),
  )
}

// --- Node content dispatch ---

function nodeContent(node: Signal<GraphNode<VisualNodeData>>): TNode {
  const id = node.value.id
  switch (id) {
    case 'number':
      return numberConstantContent(node)
    case 'colorpicker':
      return colorPickerContent(node)
    case 'texture':
      return textureContent()
    case 'uv':
      return uvContent()
    case 'multiply':
      return multiplyContent(node)
    case 'colormix':
      return colorMixContent()
    case 'output':
      return materialOutputContent()
    default:
      return null
  }
}

// --- Custom node renderer ---

const visualNodeRenderer: NodeRenderer<VisualNodeData> = (
  node: Signal<GraphNode<VisualNodeData>>,
  context: NodeRenderContext,
): TNode => {
  const nodeType = node.map((n) => n.data.type)
  const label = node.map((n) => n.data.label)
  const inputPorts = node.map((n) => n.ports.filter((p) => p.direction === 'input'))
  const outputPorts = node.map((n) => n.ports.filter((p) => p.direction === 'output'))

  return html.div(
    attr.class('flow-node'),
    html.div(
      attr.class('flow-node-header'),
      style.background(nodeType.map((t) => nodeTypeColors[t])),
      label,
    ),
    html.div(
      attr.class('flow-node-body'),
      html.div(
        attr.class('flow-node-ports flow-node-ports--input'),
        ForEach(inputPorts, (port) => context.port(port.$.id)),
      ),
      nodeContent(node),
      html.div(
        attr.class('flow-node-ports flow-node-ports--output'),
        ForEach(outputPorts, (port) => context.port(port.$.id)),
      ),
    ),
  )
}

// --- Custom edge renderer ---

const visualEdgeRenderer: EdgeRenderer<VisualEdgeData> = (
  edge: Signal<GraphEdge<VisualEdgeData>>,
  context: EdgeRenderContext,
): TNode => {
  const d = context.path.map((ep) => ep.d)
  const color = edge.map((e) => dataTypeColors[e.data.dataType])
  const typeLabel = edge.map((e): string => e.data.dataType)
  const quantity = computedOf(
    computedValues,
    edge,
  )((cv, e) => {
    const val = cv.get(e.source.nodeId)?.get(e.source.portId)
    return val ? formatPortValue(val) : ''
  })

  return svg.g(
    attr.class('flow-edge-group flow-edge--flowing'),
    attr.class(context.isSelected.map((s): string => (s ? 'flow-edge--selected' : ''))),
    attr.class(context.isHovered.map((h): string => (h ? 'flow-edge--hovered' : ''))),

    // Main edge path — use inline style to override .flow-edge CSS
    svg.path(
      svgAttr.d(d),
      attr.class('flow-edge'),
      attr.style(
        computedOf(
          context.isSelected,
          color,
        )((s, c): string => (s ? 'stroke: #ffffff' : `stroke: ${c}`)),
      ),
    ),

    // Data flow particles colored per type
    EdgeFlowParticle(d, {
      count: 4,
      speed: 100,
      radius: 3,
      color:
        edge.value.data.dataType === 'float'
          ? '#f0a500'
          : edge.value.data.dataType === 'color'
            ? '#4caf50'
            : '#42a5f5',
    }),

    // Label overlay at center
    createEdgeOverlay(context.path, {
      content: svg.text(
        svgAttr.x(0),
        svgAttr.dy('0.35em'),
        svgAttr['text-anchor']('middle'),
        svgAttr['font-size']('0.65em'),
        svgAttr['font-family']("'SF Mono', 'Fira Code', monospace"),
        attr.style(
          'paint-order: stroke; stroke-linejoin: round; stroke-linecap: round; stroke: rgba(26,26,46,0.85); stroke-width: 4px',
        ),
        svg.tspan(svgAttr.fill(color), svgAttr['font-weight']('600'), typeLabel),
        svg.tspan(svgAttr.fill('rgba(255,255,255,0.4)'), '\u2009'),
        svg.tspan(svgAttr.fill('rgba(255,255,255,0.9)'), quantity),
      ),
    }),
  )
}

// --- Custom port renderer ---

const visualPortRenderer: PortRenderer = (
  port: Signal<PortDefinition>,
  context: PortRenderContext,
): TNode => {
  const portColor = port.map((p) => portTypeColors[p.type ?? ''] ?? '#888888')
  const portType = port.map((p) => p.type ?? '')

  const shapeClass = portType.map((t): string => {
    if (t === 'color') return 'visual-port-square'
    if (t === 'vec2') return 'visual-port-diamond'
    return ''
  })

  const typeAbbrev = portType.map((t): string => {
    if (t === 'float') return 'f'
    if (t === 'color') return 'c'
    if (t === 'vec2') return 'v2'
    return ''
  })

  return [
    html.div(
      attr.class('flow-port-dot'),
      attr.class(shapeClass),
      attr.class(context.isConnected.map((c): string => (c ? 'visual-port-connected' : ''))),
      style.background(
        computedOf(context.isConnected, portColor)((c, pc): string => (c ? pc : 'transparent')),
      ),
      style.borderColor(portColor),
    ),
    html.span(
      attr.class('flow-port-label'),
      port.map((p) => p.label ?? p.id),
    ),
    html.span(attr.class('visual-port-badge'), style.color(portColor), typeAbbrev),
  ]
}

// --- Layout options ---

const layouts: Record<string, LayoutAlgorithm> = {
  'Hierarchical LR': hierarchicalLayout({ direction: 'LR', layerSpacing: 300, nodeSpacing: 60 }),
  'Hierarchical TB': hierarchicalLayout({ direction: 'TB', layerSpacing: 180, nodeSpacing: 100 }),
  'Tree LR': treeLayout({ direction: 'LR', levelSpacing: 300, siblingSpacing: 80 }),
  'Tree TB': treeLayout({ direction: 'TB', levelSpacing: 180, siblingSpacing: 80 }),
  Grid: gridLayout({ columns: 3, columnSpacing: 320, rowSpacing: 180 }),
  Force: forceDirectedLayout(),
  Manual: manualLayout,
}

const activeLayout: Prop<string> = prop('Hierarchical LR')
const showGrid: Prop<boolean> = prop(true)
const activeGridType: Prop<BackgroundType> = prop<BackgroundType>('dots')
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

// --- Create flow instance ---

const sourcesCollapsed: Prop<boolean> = prop(false)

const flow = createFlow<VisualNodeData, VisualEdgeData>({
  graph: graphProp,
  nodeRenderer: visualNodeRenderer,
  edgeRenderer: visualEdgeRenderer,
  portRenderer: visualPortRenderer,
  layout: hierarchicalLayout({ direction: 'LR', layerSpacing: 300, nodeSpacing: 60 }),
  viewport: { x: 30, y: 30, zoom: 1 },
  layoutTransitionDuration: 300,
  grid: { size: 20, type: 'dots' },
  controls: { position: 'bottom-left', showLock: true },
  minimap: { position: 'bottom-right', width: 200, height: 150 },
  alignmentGuides: true,
  panInertia: true,
  cullMargin: 100,
  connection: { mode: 'strict', selfConnection: false },
  validators: [portTypeCheck(), requiredPorts()],
  theme: {
    portTypeStyles: {
      float: { color: '#f0a500' },
      color: { color: '#4caf50' },
      vec2: { color: '#42a5f5' },
    },
  },
  events: {
    onSelectionChange(nodeIds, edgeIds) {
      console.log('Selection:', { nodes: [...nodeIds], edges: [...edgeIds] })
    },
  },
})

// --- Toolbar UI ---

function ToolbarButton(label: TNode, isActive: Signal<boolean>, onClick: () => void): TNode {
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

function ActionButton(label: TNode, onClick: () => void): TNode {
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

// --- Sub-graph collapse/expand ---

const sourceNodeIds = new Set(['number', 'colorpicker', 'texture', 'uv'])

function collapseSourceNodes() {
  const compoundNode: GraphNode<VisualNodeData> = {
    id: 'sources-group',
    data: { label: 'Sources', type: 'source' },
    ports: [
      { id: 'out', direction: 'output', label: 'Value', type: 'float' },
      { id: 'color_out', direction: 'output', label: 'Color', type: 'color' },
      { id: 'alpha_out', direction: 'output', label: 'Alpha', type: 'float' },
      { id: 'uv_out', direction: 'output', label: 'UV', type: 'vec2' },
    ],
  }
  graphProp.update((g) => collapseToSubGraph(g, sourceNodeIds, compoundNode))
  sourcesCollapsed.set(true)
}

function expandSourceNodes() {
  graphProp.update((g) => expandSubGraph(g, 'sources-group'))
  sourcesCollapsed.set(false)
}

// --- Per-node signal info ---

function NodeInfoPanel(): TNode {
  const firstSelectedId = flow.selectedNodeIds.map((ids): string | null => {
    const arr = [...ids]
    return arr.length > 0 ? arr[0] : null
  })

  // Reactively derive position/dimension text from edgePaths (which updates on position changes)
  const posText = computedOf(
    firstSelectedId,
    flow.edgePaths,
  )((id): string => {
    if (id === null) return ''
    const p = flow.getNodePosition(id).value
    return `(${Math.round(p.x)}, ${Math.round(p.y)})`
  })

  const dimsText = computedOf(
    firstSelectedId,
    flow.edgePaths,
  )((id): string => {
    if (id === null) return ''
    const d = flow.getNodeDimensions(id).value
    return `${Math.round(d.width)} x ${Math.round(d.height)}`
  })

  return Ensure(firstSelectedId, (selectedId) =>
    html.div(
      style.position('absolute'),
      style.top('8px'),
      style.left('8px'),
      style.padding('8px 12px'),
      style.borderRadius('6px'),
      style.background('rgba(0,0,0,0.7)'),
      style.fontSize('0.75em'),
      style.color('rgba(255,255,255,0.6)'),
      style.pointerEvents('none'),
      style.lineHeight('1.6'),
      html.div(html.strong(style.color('rgba(255,255,255,0.8)'), 'Node: '), selectedId),
      html.div('Pos: ', posText),
      html.div('Size: ', dimsText),
    ),
  )
}

// --- Render ---

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

      ...(['dots', 'lines', 'cross'] as const).map((gridType) =>
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

      // Sub-graph collapse/expand
      ActionButton(
        sourcesCollapsed.map((c): string => (c ? 'Expand Sources' : 'Collapse Sources')),
        () => {
          if (sourcesCollapsed.value) expandSourceNodes()
          else collapseSourceNodes()
        },
      ),

      Separator(),

      // Viewport controls
      ActionButton('Fit View', () => flow.fitView(40)),
      ActionButton('Center on Output', () => flow.centerOnNode('output', 1, true)),

      Separator(),

      // Diagnostics badge
      html.span(
        style.fontSize('0.75em'),
        style.padding('4px 8px'),
        style.borderRadius('4px'),
        style.background(
          flow.diagnostics.map((d): string =>
            d.length > 0 ? 'rgba(255, 180, 50, 0.2)' : 'rgba(100, 255, 100, 0.1)',
          ),
        ),
        style.color(
          flow.diagnostics.map((d): string =>
            d.length > 0 ? 'rgba(255, 180, 50, 0.9)' : 'rgba(100, 255, 100, 0.7)',
          ),
        ),
        flow.diagnostics.map((d): string => (d.length > 0 ? `${d.length} warning(s)` : 'Valid')),
      ),

      Separator(),

      html.span(
        style.fontSize('0.75em'),
        style.color('rgba(255,255,255,0.4)'),
        style.padding('0 4px'),
        'Ports: ',
        html.span(style.color(portTypeColors.float), '\u25cf float'),
        ' / ',
        html.span(style.color(portTypeColors.color), '\u25a0 color'),
        ' / ',
        html.span(style.color(portTypeColors.vec2), '\u25c6 vec2'),
      ),
    ),

    html.div(
      style.flex('1'),
      style.position('relative'),

      flow.renderable,

      // Per-node info panel (shows when a node is selected)
      NodeInfoPanel(),
    ),
  ),
  '#app',
)
