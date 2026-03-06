import type { TestScenario } from '../../types'
import { makeNode, makeEdge, makeGraph } from '../helpers'
import { createStraightStrategy } from '@tempots/flow/edges'
import { manualLayout } from '@tempots/flow/layouts'

export const straightObstacleScenario: TestScenario = {
  id: 'obstacle--straight',
  name: 'Straight with Obstacle',
  category: 'obstacles',
  description: 'Two nodes connected with straight edge, obstacle node in between',
  graph: makeGraph(
    [
      makeNode('a', 'Source', [], ['out']),
      makeNode('b', 'Target', ['in'], []),
      makeNode('obstacle', 'Blocker', ['x'], ['y']),
    ],
    [makeEdge('e1', 'a', 'out', 'b', 'in')],
  ),
  config: {
    edgeRouting: createStraightStrategy(),
    layout: manualLayout,
    portPlacement: 'horizontal',
    grid: false,
    fitViewOnInit: true,
    initialPositions: new Map([
      ['a', { x: 50, y: 150 }],
      ['b', { x: 550, y: 150 }],
      ['obstacle', { x: 250, y: 100 }],
    ]),
  },
}
