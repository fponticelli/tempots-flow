import type { TestScenario } from '../../types'
import { makeNode, makeGraph } from '../helpers'
import { createBezierStrategy } from '@tempots/flow/edges'
import { gridLayout } from '@tempots/flow/layouts'

export const gridLayoutScenario: TestScenario = {
  id: 'layout--grid',
  name: 'Grid Layout',
  category: 'layouts',
  description: 'Six nodes arranged in a 3-column grid layout with no edges',
  graph: makeGraph(
    [
      makeNode('n1', 'Node 1', [], []),
      makeNode('n2', 'Node 2', [], []),
      makeNode('n3', 'Node 3', [], []),
      makeNode('n4', 'Node 4', [], []),
      makeNode('n5', 'Node 5', [], []),
      makeNode('n6', 'Node 6', [], []),
    ],
    [],
  ),
  config: {
    edgeRouting: createBezierStrategy(),
    layout: gridLayout({
      columns: 3,
      columnSpacing: 200,
      rowSpacing: 120,
    }),
    portPlacement: 'horizontal',
    grid: false,
    fitViewOnInit: true,
  },
}
