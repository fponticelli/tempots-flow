import type { TestScenario } from '../../types'
import { makeNode, makeGraph } from '../helpers'
import { manualLayout } from '@tempots/flow/layouts'

export const manyPortsScenario: TestScenario = {
  id: 'single-node--many-ports',
  name: 'Many Ports',
  category: 'single-node',
  description: 'Single node with many input and output ports',
  graph: makeGraph(
    [makeNode('n1', 'Multi-Port', ['in1', 'in2', 'in3', 'in4', 'in5'], ['out1', 'out2', 'out3'])],
    [],
  ),
  config: {
    layout: manualLayout,
    portPlacement: 'horizontal',
    grid: false,
    fitViewOnInit: true,
    initialPositions: new Map([['n1', { x: 200, y: 100 }]]),
  },
  containerSize: { width: 600, height: 400 },
}
