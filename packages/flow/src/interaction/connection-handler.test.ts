import { describe, it, expect, vi } from 'vitest'
import { prop } from '@tempots/core'
import { createInitialInteractionState } from '../types/interaction'
import type { Graph } from '../types/graph'
import type { Position, Dimensions } from '../types/layout'
import {
  handleConnectionStart,
  handleConnectionMove,
  handleConnectionEnd,
} from './connection-handler'

function makeState() {
  return prop(createInitialInteractionState())
}

function makeGraph(): Graph<string, string> {
  return {
    nodes: [
      {
        id: 'n1',
        data: 'Node 1',
        ports: [
          { id: 'out1', direction: 'output', type: 'Float' },
          { id: 'in1', direction: 'input', type: 'Float' },
        ],
      },
      {
        id: 'n2',
        data: 'Node 2',
        ports: [
          { id: 'in1', direction: 'input', type: 'Float' },
          { id: 'in2', direction: 'input', type: 'Int', maxConnections: 1 },
          { id: 'out1', direction: 'output', type: 'Float' },
        ],
      },
      {
        id: 'n3',
        data: 'Node 3',
        ports: [{ id: 'in1', direction: 'input', type: 'Color' }],
      },
    ],
    edges: [],
  }
}

const positions: ReadonlyMap<string, Position> = new Map([
  ['n1', { x: 0, y: 0 }],
  ['n2', { x: 300, y: 0 }],
  ['n3', { x: 600, y: 0 }],
])

const dimensions: ReadonlyMap<string, Dimensions> = new Map([
  ['n1', { width: 180, height: 100 }],
  ['n2', { width: 180, height: 120 }],
  ['n3', { width: 180, height: 80 }],
])

describe('handleConnectionStart', () => {
  it('sets mode to connecting and populates connection state', () => {
    const state = makeState()
    handleConnectionStart(state, { nodeId: 'n1', portId: 'out1' }, 'right', { x: 180, y: 48 })

    expect(state.value.mode).toBe('connecting')
    expect(state.value.connection).not.toBeNull()
    expect(state.value.connection?.sourcePort).toEqual({ nodeId: 'n1', portId: 'out1' })
    expect(state.value.connection?.sourceSide).toBe('right')
    expect(state.value.connection?.sourcePosition).toEqual({ x: 180, y: 48 })
    expect(state.value.connection?.isValid).toBe(false)
    expect(state.value.connection?.targetPort).toBeNull()
  })
})

describe('handleConnectionMove', () => {
  it('leaves targetPort null when no port is nearby', () => {
    const state = makeState()
    handleConnectionStart(state, { nodeId: 'n1', portId: 'out1' }, 'right', { x: 180, y: 48 })

    handleConnectionMove(state, { x: 200, y: 200 }, makeGraph(), positions, dimensions, 20)

    expect(state.value.connection?.targetPort).toBeNull()
    expect(state.value.connection?.isValid).toBe(false)
  })

  it('snaps to a compatible port within snap radius', () => {
    const state = makeState()
    handleConnectionStart(state, { nodeId: 'n1', portId: 'out1' }, 'right', { x: 180, y: 48 })

    // Position cursor very close to n2's input port
    // n2 is at x:300, input port is at x:300 (left side), y: 300 + 32 + 16 = 348
    const nearN2In1 = { x: 301, y: 49 }
    handleConnectionMove(state, nearN2In1, makeGraph(), positions, dimensions, 20)

    expect(state.value.connection?.targetPort).toEqual({ nodeId: 'n2', portId: 'in1' })
    expect(state.value.connection?.isValid).toBe(true)
  })

  it('rejects ports with same direction as source', () => {
    const state = makeState()
    handleConnectionStart(state, { nodeId: 'n1', portId: 'out1' }, 'right', { x: 180, y: 48 })

    // Position cursor near n2's output port (same direction as source)
    // n2 output is at x:480 (right side), y: 0 + 32 + 16 + 2*24 = 96
    handleConnectionMove(state, { x: 480, y: 96 }, makeGraph(), positions, dimensions, 20)

    expect(state.value.connection?.targetPort).toBeNull()
    expect(state.value.connection?.isValid).toBe(false)
  })

  it('rejects incompatible types', () => {
    const state = makeState()
    handleConnectionStart(state, { nodeId: 'n1', portId: 'out1' }, 'right', { x: 180, y: 48 })

    // Position cursor near n3's input port (type: Color, source is Float)
    // n3 input is at x:600, y: 0 + 32 + 16 = 48
    handleConnectionMove(state, { x: 600, y: 48 }, makeGraph(), positions, dimensions, 20)

    expect(state.value.connection?.targetPort).toBeNull()
    expect(state.value.connection?.isValid).toBe(false)
  })

  it('rejects ports that exceed maxConnections', () => {
    const state = makeState()
    const graph = makeGraph()
    // Add an existing edge to n2.in2 (maxConnections: 1)
    const graphWithEdge: Graph<string, string> = {
      ...graph,
      edges: [
        {
          id: 'e1',
          data: '',
          source: { nodeId: 'n1', portId: 'out1' },
          target: { nodeId: 'n2', portId: 'in2' },
          direction: 'forward',
        },
      ],
    }

    handleConnectionStart(state, { nodeId: 'n1', portId: 'out1' }, 'right', { x: 180, y: 48 })

    // Position cursor near n2's in2 port (already at max)
    // n2 in2 is at x:300, y: 0 + 32 + 16 + 24 = 72
    handleConnectionMove(state, { x: 300, y: 72 }, graphWithEdge, positions, dimensions, 20)

    expect(state.value.connection?.targetPort).toBeNull()
    expect(state.value.connection?.isValid).toBe(false)
  })
})

describe('handleConnectionEnd', () => {
  it('calls onConnect when target is valid', () => {
    const state = makeState()
    const onConnect = vi.fn()

    handleConnectionStart(state, { nodeId: 'n1', portId: 'out1' }, 'right', { x: 180, y: 48 })

    // Manually set a valid target
    state.update((s) => ({
      ...s,
      connection: {
        ...s.connection!,
        targetPort: { nodeId: 'n2', portId: 'in1' },
        isValid: true,
      },
    }))

    handleConnectionEnd(state, { onConnect })

    expect(onConnect).toHaveBeenCalledWith(
      { nodeId: 'n1', portId: 'out1' },
      { nodeId: 'n2', portId: 'in1' },
    )
    expect(state.value.mode).toBe('idle')
    expect(state.value.connection).toBeNull()
  })

  it('does not call onConnect when target is invalid', () => {
    const state = makeState()
    const onConnect = vi.fn()

    handleConnectionStart(state, { nodeId: 'n1', portId: 'out1' }, 'right', { x: 180, y: 48 })
    handleConnectionEnd(state, { onConnect })

    expect(onConnect).not.toHaveBeenCalled()
    expect(state.value.mode).toBe('idle')
    expect(state.value.connection).toBeNull()
  })

  it('always resets to idle mode', () => {
    const state = makeState()
    handleConnectionStart(state, { nodeId: 'n1', portId: 'out1' }, 'right', { x: 180, y: 48 })
    handleConnectionEnd(state)

    expect(state.value.mode).toBe('idle')
    expect(state.value.connection).toBeNull()
    expect(state.value.hoveredPort).toBeNull()
  })
})
