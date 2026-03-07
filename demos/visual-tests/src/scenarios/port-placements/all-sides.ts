import type { TestScenario } from '../../types'
import { makeNode, makeEdge, makeGraph } from '../helpers'
import { createBezierStrategy } from '@tempots/flow/edges'
import { manualLayout } from '@tempots/flow/layouts'

export const allSidesScenario: TestScenario = {
  id: 'port-placement--all-sides',
  name: 'All Sides',
  category: 'port-placements',
  description: 'Four nodes in a cross pattern with edges connecting from all sides',
  graph: makeGraph(
    [
      makeNode('top', 'Top', [], ['out']),
      makeNode('center', 'Center', ['in'], ['out']),
      makeNode('right', 'Right', ['in'], []),
      makeNode('bottom', 'Bottom', ['in'], []),
    ],
    [makeEdge('e1', 'top', 'out', 'center', 'in'), makeEdge('e2', 'center', 'out', 'right', 'in')],
  ),
  config: {
    edgeRouting: createBezierStrategy(),
    layout: manualLayout,
    portPlacement: 'horizontal',
    grid: false,
    fitViewOnInit: true,
    initialPositions: new Map([
      ['top', { x: 250, y: 50 }],
      ['center', { x: 250, y: 250 }],
      ['right', { x: 500, y: 250 }],
      ['bottom', { x: 250, y: 450 }],
    ]),
  },
}
