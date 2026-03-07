import type { TestScenario } from '../../types'
import { makeNode, makeEdge, makeGraph } from '../helpers'
import { createBezierStrategy } from '@tempots/flow/edges'
import { manualLayout } from '@tempots/flow/layouts'

export const arrowMarkersScenario: TestScenario = {
  id: 'marker--arrows',
  name: 'Arrow Markers',
  category: 'markers',
  description: 'Two nodes with one bezier edge displaying arrow markers',
  graph: makeGraph(
    [makeNode('a', 'Source', [], ['out']), makeNode('b', 'Target', ['in'], [])],
    [makeEdge('e1', 'a', 'out', 'b', 'in')],
  ),
  config: {
    edgeRouting: createBezierStrategy(),
    layout: manualLayout,
    portPlacement: 'horizontal',
    edgeMarkers: true,
    grid: false,
    fitViewOnInit: true,
    initialPositions: new Map([
      ['a', { x: 50, y: 150 }],
      ['b', { x: 450, y: 150 }],
    ]),
  },
}
