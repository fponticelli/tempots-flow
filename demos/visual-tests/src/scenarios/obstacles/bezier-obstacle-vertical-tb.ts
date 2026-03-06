import type { TestScenario } from '../../types'
import { makeNode, makeEdge, makeGraph } from '../helpers'
import { createBezierStrategy } from '@tempots/flow/edges'
import { manualLayout } from '@tempots/flow/layouts'

export const bezierObstacleVerticalTBScenario: TestScenario = {
  id: 'obstacle--bezier-vertical-tb',
  name: 'Bezier Obstacle (Vertical TB)',
  category: 'obstacles',
  description: 'TB arrangement with vertical port placement, obstacle in between',
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
      ['a', { x: 250, y: 50 }],
      ['b', { x: 250, y: 500 }],
      ['obstacle', { x: 240, y: 260 }],
    ]),
  },
}
