import type { TestScenario } from '../../types'
import { makeNode, makeEdge, makeGraph } from '../helpers'
import { createBezierStrategy } from '@tempots/flow/edges'
import { hierarchicalLayout } from '@tempots/flow/layouts'

export const hierarchicalTBScenario: TestScenario = {
  id: 'layout--hierarchical-tb',
  name: 'Hierarchical TB',
  category: 'layouts',
  description:
    'Five nodes in a tree with hierarchical top-to-bottom layout',
  graph: makeGraph(
    [
      makeNode('root', 'Root', [], ['out1', 'out2']),
      makeNode('child1', 'Child 1', ['in'], ['out1', 'out2']),
      makeNode('child2', 'Child 2', ['in'], []),
      makeNode('leaf1', 'Leaf 1', ['in'], []),
      makeNode('leaf2', 'Leaf 2', ['in'], []),
    ],
    [
      makeEdge('e1', 'root', 'out1', 'child1', 'in'),
      makeEdge('e2', 'root', 'out2', 'child2', 'in'),
      makeEdge('e3', 'child1', 'out1', 'leaf1', 'in'),
      makeEdge('e4', 'child1', 'out2', 'leaf2', 'in'),
    ],
  ),
  config: {
    edgeRouting: createBezierStrategy(),
    layout: hierarchicalLayout({
      direction: 'TB',
      layerSpacing: 200,
      nodeSpacing: 60,
    }),
    portPlacement: 'horizontal',
    grid: false,
    fitViewOnInit: true,
  },
}
