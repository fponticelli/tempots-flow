import { describe, it, expect } from 'vitest'
import { manualLayout } from './manual'
import type { GraphNode } from '../types/graph'

const nodes: readonly GraphNode<string>[] = [
  { id: 'a', data: 'A', ports: [] },
  { id: 'b', data: 'B', ports: [] },
  { id: 'c', data: 'C', ports: [] },
]

describe('manualLayout', () => {
  it('uses existing positions when available', () => {
    const existing = new Map([
      ['a', { x: 10, y: 20 }],
      ['b', { x: 30, y: 40 }],
      ['c', { x: 50, y: 60 }],
    ])
    const result = manualLayout.layout(nodes, new Map(), existing)
    expect(result.get('a')).toEqual({ x: 10, y: 20 })
    expect(result.get('b')).toEqual({ x: 30, y: 40 })
    expect(result.get('c')).toEqual({ x: 50, y: 60 })
  })

  it('stacks unpositioned nodes vertically', () => {
    const result = manualLayout.layout(nodes, new Map(), new Map())
    const posA = result.get('a')
    const posB = result.get('b')
    expect(posA).toBeDefined()
    expect(posB).toBeDefined()
    expect(posA!.x).toBe(0)
    expect(posB!.x).toBe(0)
    expect(posB!.y).toBeGreaterThan(posA!.y)
  })

  it('uses measured dimensions for stacking gap', () => {
    const dims = new Map([
      ['a', { width: 200, height: 50 }],
      ['b', { width: 200, height: 50 }],
    ])
    const result = manualLayout.layout(nodes, dims, new Map())
    const posA = result.get('a')
    const posB = result.get('b')
    expect(posB!.y).toBe(posA!.y + 50 + 20) // height + default spacing
  })

  it('preserves positioned nodes while stacking unpositioned ones', () => {
    const existing = new Map([['a', { x: 100, y: 200 }]])
    const result = manualLayout.layout(nodes, new Map(), existing)
    expect(result.get('a')).toEqual({ x: 100, y: 200 })
    expect(result.get('b')?.x).toBe(0)
    expect(result.get('b')?.y).toBe(0)
  })
})
