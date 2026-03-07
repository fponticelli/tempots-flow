import type { TestScenario } from '../../types'
import { makeNode, makeEdge, makeGraph } from '../helpers'
import { createSmoothStepStrategy } from '@tempots/flow/edges'
import { manualLayout } from '@tempots/flow/layouts'

export const smoothStepEdgeScenario: TestScenario = {
  id: 'single-edge--smooth-step',
  name: 'Smooth Step Edge',
  category: 'single-edge',
  description: 'Two nodes connected with a smooth step edge',
  graph: makeGraph(
    [makeNode('a', 'Source', [], ['out']), makeNode('b', 'Target', ['in'], [])],
    [makeEdge('e1', 'a', 'out', 'b', 'in')],
  ),
  config: {
    edgeRouting: createSmoothStepStrategy(),
    layout: manualLayout,
    portPlacement: 'horizontal',
    grid: false,
    fitViewOnInit: true,
    initialPositions: new Map([
      ['a', { x: 50, y: 100 }],
      ['b', { x: 450, y: 250 }],
    ]),
  },
}
