import type { TestScenario } from '../../types'
import { makeNode, makeEdge, makeGraph } from '../helpers'
import { createBundledStrategy } from '@tempots/flow/edges'
import { manualLayout } from '@tempots/flow/layouts'

export const bundledObstacleScenario: TestScenario = {
  id: 'obstacle--bundled',
  name: 'Bundled with Obstacle',
  category: 'obstacles',
  description: 'Three bundled edges routed around an obstacle node',
  graph: makeGraph(
    [
      makeNode('a', 'Source', [], ['out1', 'out2', 'out3']),
      makeNode('b', 'Target', ['in1', 'in2', 'in3'], []),
      makeNode('obstacle', 'Blocker', ['x'], ['y']),
    ],
    [
      makeEdge('e1', 'a', 'out1', 'b', 'in1'),
      makeEdge('e2', 'a', 'out2', 'b', 'in2'),
      makeEdge('e3', 'a', 'out3', 'b', 'in3'),
    ],
  ),
  config: {
    edgeRouting: createBundledStrategy(),
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
