import type { TestScenario } from '../../types'
import { makeNode, makeEdge, makeGraph } from '../helpers'
import { createBezierStrategy } from '@tempots/flow/edges'
import { manualLayout } from '@tempots/flow/layouts'

export const fanInScenario: TestScenario = {
  id: 'edge-paths--fan-in',
  name: 'Fan In',
  category: 'edge-paths',
  description: '4 source nodes converging to one target node',
  graph: makeGraph(
    [
      makeNode('s1', 'Source 1', [], ['out']),
      makeNode('s2', 'Source 2', [], ['out']),
      makeNode('s3', 'Source 3', [], ['out']),
      makeNode('s4', 'Source 4', [], ['out']),
      makeNode('tgt', 'Target', ['i1', 'i2', 'i3', 'i4'], []),
    ],
    [
      makeEdge('e1', 's1', 'out', 'tgt', 'i1'),
      makeEdge('e2', 's2', 'out', 'tgt', 'i2'),
      makeEdge('e3', 's3', 'out', 'tgt', 'i3'),
      makeEdge('e4', 's4', 'out', 'tgt', 'i4'),
    ],
  ),
  config: {
    edgeRouting: createBezierStrategy(),
    layout: manualLayout,
    portPlacement: 'horizontal',
    grid: false,
    fitViewOnInit: true,
    initialPositions: new Map([
      ['s1', { x: 50, y: 50 }],
      ['s2', { x: 50, y: 175 }],
      ['s3', { x: 50, y: 300 }],
      ['s4', { x: 50, y: 425 }],
      ['tgt', { x: 400, y: 200 }],
    ]),
  },
}
