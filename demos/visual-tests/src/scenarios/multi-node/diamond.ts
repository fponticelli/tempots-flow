import type { TestScenario } from '../../types'
import { makeNode, makeEdge, makeGraph } from '../helpers'
import { createBezierStrategy } from '@tempots/flow/edges'
import { manualLayout } from '@tempots/flow/layouts'

export const diamondScenario: TestScenario = {
  id: 'multi-node--diamond',
  name: 'Diamond',
  category: 'multi-node',
  description: 'Four nodes in a diamond pattern: A -> {B, C} -> D',
  graph: makeGraph(
    [
      makeNode('a', 'A', [], ['out1', 'out2']),
      makeNode('b', 'B', ['in'], ['out']),
      makeNode('c', 'C', ['in'], ['out']),
      makeNode('d', 'D', ['in1', 'in2'], []),
    ],
    [
      makeEdge('e1', 'a', 'out1', 'b', 'in'),
      makeEdge('e2', 'a', 'out2', 'c', 'in'),
      makeEdge('e3', 'b', 'out', 'd', 'in1'),
      makeEdge('e4', 'c', 'out', 'd', 'in2'),
    ],
  ),
  config: {
    edgeRouting: createBezierStrategy(),
    layout: manualLayout,
    portPlacement: 'horizontal',
    grid: false,
    fitViewOnInit: true,
    initialPositions: new Map([
      ['a', { x: 50, y: 200 }],
      ['b', { x: 300, y: 50 }],
      ['c', { x: 300, y: 350 }],
      ['d', { x: 550, y: 200 }],
    ]),
  },
}
