import { describe, it, expect } from 'vitest'
import {
  screenToGraph,
  graphToScreen,
  clampZoom,
  snapToGrid,
} from '../../src/core/coordinate-utils'

const rect = { left: 100, top: 50, width: 800, height: 600 } as DOMRect

describe('screenToGraph', () => {
  it('converts screen coordinates to graph space at zoom 1', () => {
    const result = screenToGraph(200, 150, { x: 0, y: 0, zoom: 1 }, rect)
    expect(result.x).toBe(100) // 200 - 100 (left) - 0 (viewport x)
    expect(result.y).toBe(100) // 150 - 50 (top) - 0 (viewport y)
  })

  it('accounts for viewport offset', () => {
    const result = screenToGraph(200, 150, { x: 50, y: 30, zoom: 1 }, rect)
    expect(result.x).toBe(50) // (200 - 100 - 50) / 1
    expect(result.y).toBe(70) // (150 - 50 - 30) / 1
  })

  it('accounts for zoom', () => {
    const result = screenToGraph(200, 150, { x: 0, y: 0, zoom: 2 }, rect)
    expect(result.x).toBe(50) // (200 - 100) / 2
    expect(result.y).toBe(50) // (150 - 50) / 2
  })
})

describe('graphToScreen', () => {
  it('converts graph coordinates to screen space', () => {
    const result = graphToScreen({ x: 100, y: 100 }, { x: 0, y: 0, zoom: 1 }, rect)
    expect(result.x).toBe(200)
    expect(result.y).toBe(150)
  })

  it('is the inverse of screenToGraph', () => {
    const viewport = { x: 30, y: 20, zoom: 1.5 }
    const graphPos = screenToGraph(300, 250, viewport, rect)
    const screenPos = graphToScreen(graphPos, viewport, rect)
    expect(screenPos.x).toBeCloseTo(300)
    expect(screenPos.y).toBeCloseTo(250)
  })
})

describe('clampZoom', () => {
  it('clamps below minimum', () => {
    expect(clampZoom(0.05, 0.1, 4)).toBe(0.1)
  })

  it('clamps above maximum', () => {
    expect(clampZoom(5, 0.1, 4)).toBe(4)
  })

  it('passes through valid values', () => {
    expect(clampZoom(1.5, 0.1, 4)).toBe(1.5)
  })
})

describe('snapToGrid', () => {
  it('snaps to nearest grid point', () => {
    expect(snapToGrid(23, 20)).toBe(20)
    expect(snapToGrid(37, 20)).toBe(40)
    expect(snapToGrid(10, 20)).toBe(20)
  })

  it('handles exact grid values', () => {
    expect(snapToGrid(40, 20)).toBe(40)
  })

  it('handles negative values', () => {
    expect(snapToGrid(-23, 20)).toBe(-20)
  })
})
