import type { TestScenario } from '../../types'
import { makeNode, makeEdge, makeGraph } from '../helpers'
import { createBezierStrategy } from '@tempots/flow/edges'
import { manualLayout } from '@tempots/flow/layouts'

export const selectedEdgeScenario: TestScenario = {
  id: 'state--selected-edge',
  name: 'Selected Edge',
  category: 'states',
  description: 'Two nodes with one edge, edge e1 is selected',
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
      ['a', { x: 50, y: 150 }],
      ['b', { x: 450, y: 150 }],
    ]),
  },
  interactions: [{ type: 'select-edges', edgeIds: ['e1'] }],
}
