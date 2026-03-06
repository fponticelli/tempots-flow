import type { TestScenario } from '../../types'
import { makeNode, makeEdge, makeGraph } from '../helpers'
import { createOrthogonalStrategy } from '@tempots/flow/edges'
import { manualLayout } from '@tempots/flow/layouts'

export const orthogonalEdgeScenario: TestScenario = {
  id: 'single-edge--orthogonal',
  name: 'Orthogonal Edge',
  category: 'single-edge',
  description: 'Two nodes connected with an orthogonal edge',
  graph: makeGraph(
    [
      makeNode('a', 'Source', [], ['out']),
      makeNode('b', 'Target', ['in'], []),
    ],
    [makeEdge('e1', 'a', 'out', 'b', 'in')],
  ),
  config: {
    edgeRouting: createOrthogonalStrategy(),
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
