import type { TestScenario } from '../../types'
import { makeNode, makeEdge, makeGraph } from '../helpers'
import { createBezierStrategy } from '@tempots/flow/edges'
import { manualLayout } from '@tempots/flow/layouts'

export const fanOutScenario: TestScenario = {
  id: 'edge-paths--fan-out',
  name: 'Fan Out',
  category: 'edge-paths',
  description: 'One source node with edges to 4 target nodes',
  graph: makeGraph(
    [
      makeNode('src', 'Source', [], ['o1', 'o2', 'o3', 'o4']),
      makeNode('t1', 'Target 1', ['in'], []),
      makeNode('t2', 'Target 2', ['in'], []),
      makeNode('t3', 'Target 3', ['in'], []),
      makeNode('t4', 'Target 4', ['in'], []),
    ],
    [
      makeEdge('e1', 'src', 'o1', 't1', 'in'),
      makeEdge('e2', 'src', 'o2', 't2', 'in'),
      makeEdge('e3', 'src', 'o3', 't3', 'in'),
      makeEdge('e4', 'src', 'o4', 't4', 'in'),
    ],
  ),
  config: {
    edgeRouting: createBezierStrategy(),
    layout: manualLayout,
    portPlacement: 'horizontal',
    grid: false,
    fitViewOnInit: true,
    initialPositions: new Map([
      ['src', { x: 50, y: 200 }],
      ['t1', { x: 400, y: 50 }],
      ['t2', { x: 400, y: 175 }],
      ['t3', { x: 400, y: 300 }],
      ['t4', { x: 400, y: 425 }],
    ]),
  },
}
