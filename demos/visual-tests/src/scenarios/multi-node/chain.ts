import type { TestScenario } from '../../types'
import { makeNode, makeEdge, makeGraph } from '../helpers'
import { createBezierStrategy } from '@tempots/flow/edges'
import { manualLayout } from '@tempots/flow/layouts'

export const chainScenario: TestScenario = {
  id: 'multi-node--chain',
  name: 'Linear Chain',
  category: 'multi-node',
  description: 'Four nodes connected in a linear chain: A -> B -> C -> D',
  graph: makeGraph(
    [
      makeNode('a', 'A', ['in'], ['out']),
      makeNode('b', 'B', ['in'], ['out']),
      makeNode('c', 'C', ['in'], ['out']),
      makeNode('d', 'D', ['in'], ['out']),
    ],
    [
      makeEdge('e1', 'a', 'out', 'b', 'in'),
      makeEdge('e2', 'b', 'out', 'c', 'in'),
      makeEdge('e3', 'c', 'out', 'd', 'in'),
    ],
  ),
  config: {
    edgeRouting: createBezierStrategy(),
    layout: manualLayout,
    portPlacement: 'horizontal',
    grid: false,
    fitViewOnInit: true,
    initialPositions: new Map([
      ['a', { x: 50, y: 150 }],
      ['b', { x: 250, y: 150 }],
      ['c', { x: 450, y: 150 }],
      ['d', { x: 650, y: 150 }],
    ]),
  },
}
