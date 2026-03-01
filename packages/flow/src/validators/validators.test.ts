import { describe, it, expect } from 'vitest'
import type { Graph } from '../types/graph'
import { portTypeCheck, portCardinality, requiredPorts, acyclic, compose } from './index'

function makeGraph(): Graph<string, string> {
  return {
    nodes: [
      {
        id: 'n1',
        data: 'A',
        ports: [
          { id: 'out1', direction: 'output', type: 'Float' },
          { id: 'in1', direction: 'input', type: 'Float', required: true },
        ],
      },
      {
        id: 'n2',
        data: 'B',
        ports: [
          { id: 'in1', direction: 'input', type: 'Float', maxConnections: 1 },
          { id: 'in2', direction: 'input', type: 'Int' },
          { id: 'out1', direction: 'output', type: 'Float' },
        ],
      },
    ],
    edges: [],
  }
}

describe('portTypeCheck', () => {
  it('passes for compatible types', () => {
    const graph = {
      ...makeGraph(),
      edges: [
        {
          id: 'e1',
          data: '',
          source: { nodeId: 'n1', portId: 'out1' },
          target: { nodeId: 'n2', portId: 'in1' },
          direction: 'forward' as const,
        },
      ],
    }
    const diagnostics = portTypeCheck()(graph)
    expect(diagnostics).toHaveLength(0)
  })

  it('detects incompatible types', () => {
    const graph = {
      ...makeGraph(),
      edges: [
        {
          id: 'e1',
          data: '',
          source: { nodeId: 'n1', portId: 'out1' },
          target: { nodeId: 'n2', portId: 'in2' },
          direction: 'forward' as const,
        },
      ],
    }
    const diagnostics = portTypeCheck()(graph)
    expect(diagnostics).toHaveLength(1)
    expect(diagnostics[0]?.severity).toBe('error')
    expect(diagnostics[0]?.target).toEqual({ kind: 'edge', edgeId: 'e1' })
  })

  it('uses custom isCompatible function', () => {
    const graph = {
      ...makeGraph(),
      edges: [
        {
          id: 'e1',
          data: '',
          source: { nodeId: 'n1', portId: 'out1' },
          target: { nodeId: 'n2', portId: 'in2' },
          direction: 'forward' as const,
        },
      ],
    }
    const config = {
      isCompatible: (s: string | undefined, t: string | undefined) =>
        (s === 'Float' && t === 'Int') || s === t,
    }
    const diagnostics = portTypeCheck(config)(graph)
    expect(diagnostics).toHaveLength(0)
  })
})

describe('portCardinality', () => {
  it('detects exceeded maxConnections', () => {
    const graph = {
      ...makeGraph(),
      edges: [
        {
          id: 'e1',
          data: '',
          source: { nodeId: 'n1', portId: 'out1' },
          target: { nodeId: 'n2', portId: 'in1' },
          direction: 'forward' as const,
        },
        {
          id: 'e2',
          data: '',
          source: { nodeId: 'n2', portId: 'out1' },
          target: { nodeId: 'n2', portId: 'in1' },
          direction: 'forward' as const,
        },
      ],
    }
    const diagnostics = portCardinality()(graph)
    expect(diagnostics).toHaveLength(1)
    expect(diagnostics[0]?.target).toEqual({ kind: 'port', nodeId: 'n2', portId: 'in1' })
  })

  it('passes when within limits', () => {
    const graph = {
      ...makeGraph(),
      edges: [
        {
          id: 'e1',
          data: '',
          source: { nodeId: 'n1', portId: 'out1' },
          target: { nodeId: 'n2', portId: 'in1' },
          direction: 'forward' as const,
        },
      ],
    }
    const diagnostics = portCardinality()(graph)
    expect(diagnostics).toHaveLength(0)
  })
})

describe('requiredPorts', () => {
  it('detects disconnected required ports', () => {
    const diagnostics = requiredPorts()(makeGraph())
    expect(diagnostics).toHaveLength(1)
    expect(diagnostics[0]?.severity).toBe('warning')
    expect(diagnostics[0]?.target).toEqual({ kind: 'port', nodeId: 'n1', portId: 'in1' })
  })

  it('passes when required ports are connected', () => {
    const graph = {
      ...makeGraph(),
      edges: [
        {
          id: 'e1',
          data: '',
          source: { nodeId: 'n2', portId: 'out1' },
          target: { nodeId: 'n1', portId: 'in1' },
          direction: 'forward' as const,
        },
      ],
    }
    const diagnostics = requiredPorts()(graph)
    expect(diagnostics).toHaveLength(0)
  })
})

describe('acyclic', () => {
  it('detects cycles', () => {
    const graph: Graph<string, string> = {
      nodes: [
        { id: 'a', data: '', ports: [] },
        { id: 'b', data: '', ports: [] },
        { id: 'c', data: '', ports: [] },
      ],
      edges: [
        {
          id: 'e1',
          data: '',
          source: { nodeId: 'a', portId: 'out' },
          target: { nodeId: 'b', portId: 'in' },
          direction: 'forward',
        },
        {
          id: 'e2',
          data: '',
          source: { nodeId: 'b', portId: 'out' },
          target: { nodeId: 'c', portId: 'in' },
          direction: 'forward',
        },
        {
          id: 'e3',
          data: '',
          source: { nodeId: 'c', portId: 'out' },
          target: { nodeId: 'a', portId: 'in' },
          direction: 'forward',
        },
      ],
    }
    const diagnostics = acyclic()(graph)
    expect(diagnostics).toHaveLength(1)
    expect(diagnostics[0]?.severity).toBe('error')
    expect(diagnostics[0]?.target).toEqual({ kind: 'graph' })
  })

  it('passes on DAGs', () => {
    const graph: Graph<string, string> = {
      nodes: [
        { id: 'a', data: '', ports: [] },
        { id: 'b', data: '', ports: [] },
        { id: 'c', data: '', ports: [] },
      ],
      edges: [
        {
          id: 'e1',
          data: '',
          source: { nodeId: 'a', portId: 'out' },
          target: { nodeId: 'b', portId: 'in' },
          direction: 'forward',
        },
        {
          id: 'e2',
          data: '',
          source: { nodeId: 'a', portId: 'out' },
          target: { nodeId: 'c', portId: 'in' },
          direction: 'forward',
        },
      ],
    }
    const diagnostics = acyclic()(graph)
    expect(diagnostics).toHaveLength(0)
  })
})

describe('compose', () => {
  it('merges diagnostics from multiple validators', () => {
    const graph = makeGraph() // has disconnected required port
    const validator = compose(requiredPorts(), portCardinality())
    const diagnostics = validator(graph)
    expect(diagnostics).toHaveLength(1) // only the required port warning
  })
})
