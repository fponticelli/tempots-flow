import type { TestScenario } from '../../types'
import { makeNode, makeEdge, makeGraph } from '../helpers'
import { createBezierStrategy } from '@tempots/flow/edges'
import { manualLayout } from '@tempots/flow/layouts'

export const bidirectionalScenario: TestScenario = {
  id: 'edge-paths--bidirectional',
  name: 'Bidirectional',
  category: 'edge-paths',
  description: 'Two nodes with edges in both directions (A→B and B→A)',
  graph: makeGraph(
    [
      makeNode('a', 'Node A', ['in'], ['out']),
      makeNode('b', 'Node B', ['in'], ['out']),
    ],
    [
      makeEdge('e1', 'a', 'out', 'b', 'in'),
      makeEdge('e2', 'b', 'out', 'a', 'in'),
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
      ['b', { x: 450, y: 150 }],
    ]),
  },
}
