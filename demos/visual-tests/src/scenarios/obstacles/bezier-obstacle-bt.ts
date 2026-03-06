import type { TestScenario } from '../../types'
import { makeNode, makeEdge, makeGraph } from '../helpers'
import { createBezierStrategy } from '@tempots/flow/edges'
import { manualLayout } from '@tempots/flow/layouts'

export const bezierObstacleBTScenario: TestScenario = {
  id: 'obstacle--bezier-bt',
  name: 'Bezier Obstacle (BT)',
  category: 'obstacles',
  description: 'Target above source (vertical flip), obstacle in between',
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
      ['a', { x: 250, y: 500 }],
      ['b', { x: 250, y: 50 }],
      ['obstacle', { x: 240, y: 260 }],
    ]),
  },
}
