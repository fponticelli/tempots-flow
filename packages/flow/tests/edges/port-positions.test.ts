import { describe, it, expect } from 'vitest'
import { computePortPosition, computePortPositionsForNode } from '../../src/edges/port-positions'

describe('computePortPosition', () => {
  it('places input ports on the left side', () => {
    const result = computePortPosition(
      { x: 100, y: 50 },
      { width: 200, height: 100 },
      'input',
      0,
      1,
    )
    expect(result.side).toBe('left')
    expect(result.x).toBe(100)
  })

  it('places output ports on the right side', () => {
    const result = computePortPosition(
      { x: 100, y: 50 },
      { width: 200, height: 100 },
      'output',
      0,
      1,
    )
    expect(result.side).toBe('right')
    expect(result.x).toBe(300) // 100 + 200
  })

  it('staggers ports vertically by index', () => {
    const p0 = computePortPosition({ x: 0, y: 0 }, { width: 100, height: 100 }, 'input', 0, 2)
    const p1 = computePortPosition({ x: 0, y: 0 }, { width: 100, height: 100 }, 'input', 1, 2)
    expect(p1.y).toBeGreaterThan(p0.y)
  })

  it('places input ports on top for vertical placement', () => {
    const result = computePortPosition(
      { x: 100, y: 50 },
      { width: 200, height: 100 },
      'input',
      0,
      2,
      'vertical',
    )
    expect(result.side).toBe('top')
    expect(result.y).toBe(50) // nodePos.y
  })

  it('places output ports on bottom for vertical placement', () => {
    const result = computePortPosition(
      { x: 100, y: 50 },
      { width: 200, height: 100 },
      'output',
      0,
      2,
      'vertical',
    )
    expect(result.side).toBe('bottom')
    expect(result.y).toBe(150) // nodePos.y + height
  })

  it('distributes vertical ports evenly across width', () => {
    const p0 = computePortPosition(
      { x: 0, y: 0 },
      { width: 200, height: 100 },
      'input',
      0,
      2,
      'vertical',
    )
    const p1 = computePortPosition(
      { x: 0, y: 0 },
      { width: 200, height: 100 },
      'input',
      1,
      2,
      'vertical',
    )
    expect(p0.x).toBe(50) // (200 * 1) / 4
    expect(p1.x).toBe(150) // (200 * 3) / 4
  })
})

describe('computePortPositionsForNode', () => {
  it('returns positions keyed by port id', () => {
    const ports = [
      { id: 'in', direction: 'input' as const },
      { id: 'out', direction: 'output' as const },
    ]
    const result = computePortPositionsForNode({ x: 0, y: 0 }, { width: 200, height: 100 }, ports)
    expect(result.size).toBe(2)
    expect(result.get('in')?.side).toBe('left')
    expect(result.get('out')?.side).toBe('right')
  })

  it('uses vertical placement when specified', () => {
    const ports = [
      { id: 'in', direction: 'input' as const },
      { id: 'out', direction: 'output' as const },
    ]
    const result = computePortPositionsForNode(
      { x: 0, y: 0 },
      { width: 200, height: 100 },
      ports,
      'vertical',
    )
    expect(result.get('in')?.side).toBe('top')
    expect(result.get('out')?.side).toBe('bottom')
  })

  it('handles multiple ports of the same direction', () => {
    const ports = [
      { id: 'in1', direction: 'input' as const },
      { id: 'in2', direction: 'input' as const },
      { id: 'out', direction: 'output' as const },
    ]
    const result = computePortPositionsForNode({ x: 0, y: 0 }, { width: 200, height: 100 }, ports)
    expect(result.size).toBe(3)
    // Two input ports should have different y positions
    expect(result.get('in1')?.y).not.toBe(result.get('in2')?.y)
  })
})
