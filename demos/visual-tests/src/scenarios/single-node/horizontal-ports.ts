import type { TestScenario } from '../../types'
import { makeNode, makeGraph } from '../helpers'
import { manualLayout } from '@tempots/flow/layouts'

export const horizontalPortsScenario: TestScenario = {
  id: 'single-node--horizontal-ports',
  name: 'Horizontal Ports',
  category: 'single-node',
  description: 'Single node with input ports on the left and output ports on the right',
  graph: makeGraph(
    [makeNode('n1', 'Node A', ['in1', 'in2'], ['out1', 'out2'])],
    [],
  ),
  config: {
    layout: manualLayout,
    portPlacement: 'horizontal',
    grid: false,
    fitViewOnInit: true,
    initialPositions: new Map([['n1', { x: 200, y: 150 }]]),
  },
  containerSize: { width: 600, height: 400 },
}
