import type { TestScenario } from '../../types'
import { makeNode, makeEdge, makeGraph } from '../helpers'
import { createBezierStrategy } from '@tempots/flow/edges'
import { manualLayout } from '@tempots/flow/layouts'

export const bezierObstacleRLScenario: TestScenario = {
  id: 'obstacle--bezier-rl',
  name: 'Bezier Obstacle (RL)',
  category: 'obstacles',
  description: 'Target to the left of source, obstacle in between',
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
    portPlacement: 'horizontal',
    grid: false,
    fitViewOnInit: true,
    initialPositions: new Map([
      ['a', { x: 600, y: 200 }],
      ['b', { x: 50, y: 200 }],
      ['obstacle', { x: 310, y: 190 }],
    ]),
  },
}
