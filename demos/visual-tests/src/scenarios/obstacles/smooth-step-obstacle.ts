import type { TestScenario } from '../../types'
import { makeNode, makeEdge, makeGraph } from '../helpers'
import { createSmoothStepStrategy } from '@tempots/flow/edges'
import { manualLayout } from '@tempots/flow/layouts'

export const smoothStepObstacleScenario: TestScenario = {
  id: 'obstacle--smooth-step',
  name: 'Smooth Step with Obstacle',
  category: 'obstacles',
  description: 'Two nodes connected with smooth step edge, obstacle node in between',
  graph: makeGraph(
    [
      makeNode('a', 'Source', [], ['out']),
      makeNode('b', 'Target', ['in'], []),
      makeNode('obstacle', 'Blocker', ['x'], ['y']),
    ],
    [makeEdge('e1', 'a', 'out', 'b', 'in')],
  ),
  config: {
    edgeRouting: createSmoothStepStrategy(),
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
