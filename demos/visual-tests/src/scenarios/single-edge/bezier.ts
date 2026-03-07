import type { TestScenario } from '../../types'
import { makeNode, makeEdge, makeGraph } from '../helpers'
import { createBezierStrategy } from '@tempots/flow/edges'
import { manualLayout } from '@tempots/flow/layouts'

export const bezierEdgeScenario: TestScenario = {
  id: 'single-edge--bezier',
  name: 'Bezier Edge',
  category: 'single-edge',
  description: 'Two nodes connected with a bezier edge',
  graph: makeGraph(
    [makeNode('a', 'Source', [], ['out']), makeNode('b', 'Target', ['in'], [])],
    [makeEdge('e1', 'a', 'out', 'b', 'in')],
  ),
  config: {
    edgeRouting: createBezierStrategy(),
    layout: manualLayout,
    portPlacement: 'horizontal',
    grid: false,
    fitViewOnInit: true,
    initialPositions: new Map([
      ['a', { x: 50, y: 100 }],
      ['b', { x: 450, y: 250 }],
    ]),
  },
}
