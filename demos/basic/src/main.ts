import { render } from '@tempots/dom'
import { createFlow } from '@tempots/flow'
import type { Graph } from '@tempots/flow'
import '@tempots/flow/css'

const graph: Graph<string, string> = {
  nodes: [
    {
      id: 'node-1',
      data: 'Input',
      ports: [{ id: 'out', direction: 'output', label: 'Output' }],
    },
    {
      id: 'node-2',
      data: 'Transform',
      ports: [
        { id: 'in', direction: 'input', label: 'Input' },
        { id: 'out', direction: 'output', label: 'Output' },
      ],
    },
    {
      id: 'node-3',
      data: 'Output',
      ports: [{ id: 'in', direction: 'input', label: 'Input' }],
    },
  ],
  edges: [
    {
      id: 'edge-1',
      data: '',
      source: { nodeId: 'node-1', portId: 'out' },
      target: { nodeId: 'node-2', portId: 'in' },
      direction: 'forward',
    },
    {
      id: 'edge-2',
      data: '',
      source: { nodeId: 'node-2', portId: 'out' },
      target: { nodeId: 'node-3', portId: 'in' },
      direction: 'forward',
    },
  ],
}

const flow = createFlow({
  graph,
  initialPositions: new Map([
    ['node-1', { x: 50, y: 50 }],
    ['node-2', { x: 300, y: 150 }],
    ['node-3', { x: 550, y: 50 }],
  ]),
  events: {
    onSelectionChange(nodeIds, edgeIds) {
      console.log('Selection:', { nodes: [...nodeIds], edges: [...edgeIds] })
    },
    onViewportChange(viewport) {
      console.log('Viewport:', viewport)
    },
  },
})

render(flow.renderable, '#app')
