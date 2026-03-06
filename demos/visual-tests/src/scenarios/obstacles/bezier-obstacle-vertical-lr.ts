import type { TestScenario } from '../../types'
import { makeNode, makeEdge, makeGraph } from '../helpers'
import { createBezierStrategy } from '@tempots/flow/edges'
import { manualLayout } from '@tempots/flow/layouts'

export const bezierObstacleVerticalLRScenario: TestScenario = {
  id: 'obstacle--bezier-vertical-lr',
  name: 'Bezier Obstacle (Vertical LR)',
  category: 'obstacles',
  description: 'LR arrangement with vertical port placement, obstacle in between',
  graph: makeGraph(
    [
      makeNode('a', 'Source', [], ['out']),
      makeNode('b', 'Target', ['in'], []),
      makeNode('obstacle', 'Blocker', ['x'], ['y']),
    ],
    [makeEdge('e1', 'a', 'out', 'b', 'in')],
  ),
  config: {
    edgeRouting: createBezierStrategy(),
    layout: manualLayout,
    portPlacement: 'vertical',
    grid: false,
    fitViewOnInit: true,
    initialPositions: new Map([
      ['a', { x: 50, y: 200 }],
      ['b', { x: 600, y: 200 }],
      ['obstacle', { x: 310, y: 190 }],
    ]),
  },
}
