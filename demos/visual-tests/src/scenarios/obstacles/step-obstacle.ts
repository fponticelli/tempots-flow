import type { TestScenario } from '../../types'
import { makeNode, makeEdge, makeGraph } from '../helpers'
import { createStepStrategy } from '@tempots/flow/edges'
import { manualLayout } from '@tempots/flow/layouts'

export const stepObstacleScenario: TestScenario = {
  id: 'obstacle--step',
  name: 'Step with Obstacle',
  category: 'obstacles',
  description: 'Two nodes connected with step edge, obstacle node in between',
  graph: makeGraph(
    [
      makeNode('a', 'Source', [], ['out']),
      makeNode('b', 'Target', ['in'], []),
      makeNode('obstacle', 'Blocker', ['x'], ['y']),
    ],
    [makeEdge('e1', 'a', 'out', 'b', 'in')],
  ),
  config: {
    edgeRouting: createStepStrategy(),
    layout: manualLayout,
    portPlacement: 'horizontal',
    grid: false,
    fitViewOnInit: true,
    initialPositions: new Map([
      ['a', { x: 50, y: 200 }],
      ['b', { x: 600, y: 200 }],
      ['obstacle', { x: 310, y: 190 }],
    ]),
  },
}
