import type { TestScenario } from '../../types'
import { makeNode, makeEdge, makeGraph } from '../helpers'
import { createBezierStrategy } from '@tempots/flow/edges'
import { manualLayout } from '@tempots/flow/layouts'

export const mixedPlacementScenario: TestScenario = {
  id: 'port-placement--mixed',
  name: 'Mixed Placements',
  category: 'port-placements',
  description: 'Three nodes in a vertical layout with vertical port placement',
  graph: makeGraph(
    [
      makeNode('a', 'A', [], ['out']),
      makeNode('b', 'B', ['in'], ['out']),
      makeNode('c', 'C', ['in'], []),
    ],
    [makeEdge('e1', 'a', 'out', 'b', 'in'), makeEdge('e2', 'b', 'out', 'c', 'in')],
  ),
  config: {
    edgeRouting: createBezierStrategy(),
    layout: manualLayout,
    portPlacement: 'vertical',
    grid: false,
    fitViewOnInit: true,
    initialPositions: new Map([
      ['a', { x: 200, y: 50 }],
      ['b', { x: 200, y: 250 }],
      ['c', { x: 200, y: 450 }],
    ]),
  },
}
