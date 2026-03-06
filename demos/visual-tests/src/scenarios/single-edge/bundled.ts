import type { TestScenario } from '../../types'
import { makeNode, makeEdge, makeGraph } from '../helpers'
import { createBundledStrategy } from '@tempots/flow/edges'
import { manualLayout } from '@tempots/flow/layouts'

export const bundledEdgeScenario: TestScenario = {
  id: 'single-edge--bundled',
  name: 'Bundled Edges',
  category: 'single-edge',
  description: 'Three edges between two nodes showing edge bundling',
  graph: makeGraph(
    [
      makeNode('a', 'Source', [], ['out1', 'out2', 'out3']),
      makeNode('b', 'Target', ['in1', 'in2', 'in3'], []),
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
      ['a', { x: 50, y: 150 }],
      ['b', { x: 450, y: 150 }],
    ]),
  },
}
