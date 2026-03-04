import { describe, it, expect } from 'vitest'
import { computeVisibleNodeIds, computeVisibleEdgeIds } from '../../src/core/viewport-culling'
import type { Viewport, Position, Dimensions } from '../../src/types/layout'

function makePositions(entries: [string, Position][]): ReadonlyMap<string, Position> {
  return new Map(entries)
}

function makeDimensions(entries: [string, Dimensions][]): ReadonlyMap<string, Dimensions> {
  return new Map(entries)
}

describe('computeVisibleNodeIds', () => {
  const defaultViewport: Viewport = { x: 0, y: 0, zoom: 1 }
  const containerWidth = 800
  const containerHeight = 600

  it('returns all nodes when all are within viewport', () => {
    const positions = makePositions([
      ['a', { x: 100, y: 100 }],
      ['b', { x: 300, y: 200 }],
    ])
    const dimensions = makeDimensions([
      ['a', { width: 100, height: 50 }],
      ['b', { width: 100, height: 50 }],
    ])

    const visible = computeVisibleNodeIds(
      defaultViewport,
      containerWidth,
      containerHeight,
      positions,
      dimensions,
      0,
    )
    expect(visible.has('a')).toBe(true)
    expect(visible.has('b')).toBe(true)
    expect(visible.size).toBe(2)
  })

  it('excludes nodes outside viewport', () => {
    const positions = makePositions([
      ['inside', { x: 100, y: 100 }],
      ['outside', { x: 2000, y: 2000 }],
    ])
    const dimensions = makeDimensions([
      ['inside', { width: 100, height: 50 }],
      ['outside', { width: 100, height: 50 }],
    ])

    const visible = computeVisibleNodeIds(
      defaultViewport,
      containerWidth,
      containerHeight,
      positions,
      dimensions,
      0,
    )
    expect(visible.has('inside')).toBe(true)
    expect(visible.has('outside')).toBe(false)
  })

  it('includes nodes within the margin', () => {
    const positions = makePositions([['barely-outside', { x: 850, y: 100 }]])
    const dimensions = makeDimensions([['barely-outside', { width: 100, height: 50 }]])

    // Without margin: outside (800 < 850)
    const withoutMargin = computeVisibleNodeIds(
      defaultViewport,
      containerWidth,
      containerHeight,
      positions,
      dimensions,
      0,
    )
    expect(withoutMargin.has('barely-outside')).toBe(false)

    // With margin of 100: inside (900 > 850)
    const withMargin = computeVisibleNodeIds(
      defaultViewport,
      containerWidth,
      containerHeight,
      positions,
      dimensions,
      100,
    )
    expect(withMargin.has('barely-outside')).toBe(true)
  })

  it('handles zoomed-in viewport', () => {
    const zoomedViewport: Viewport = { x: 0, y: 0, zoom: 2 }
    const positions = makePositions([
      ['close', { x: 100, y: 100 }],
      ['far', { x: 500, y: 500 }],
    ])
    const dimensions = makeDimensions([
      ['close', { width: 100, height: 50 }],
      ['far', { width: 100, height: 50 }],
    ])

    // At zoom 2, visible graph area is 0..400 x 0..300
    const visible = computeVisibleNodeIds(
      zoomedViewport,
      containerWidth,
      containerHeight,
      positions,
      dimensions,
      0,
    )
    expect(visible.has('close')).toBe(true)
    expect(visible.has('far')).toBe(false)
  })

  it('handles panned viewport', () => {
    // Pan viewport by -200, so visible graph area starts at 200
    const pannedViewport: Viewport = { x: -200, y: -200, zoom: 1 }
    const positions = makePositions([
      ['at-origin', { x: 0, y: 0 }],
      ['in-view', { x: 300, y: 300 }],
    ])
    const dimensions = makeDimensions([
      ['at-origin', { width: 100, height: 50 }],
      ['in-view', { width: 100, height: 50 }],
    ])

    // graphLeft = (200 - 0) / 1 = 200, so node at x=0 (extends to x=100) is outside
    // Node at x=300 is within [200, 1000]
    const visible = computeVisibleNodeIds(
      pannedViewport,
      containerWidth,
      containerHeight,
      positions,
      dimensions,
      0,
    )
    expect(visible.has('at-origin')).toBe(false)
    expect(visible.has('in-view')).toBe(true)
  })

  it('uses default dimensions for unknown nodes', () => {
    const positions = makePositions([['x', { x: 100, y: 100 }]])
    const dimensions = makeDimensions([]) // no dimensions registered

    const visible = computeVisibleNodeIds(
      defaultViewport,
      containerWidth,
      containerHeight,
      positions,
      dimensions,
      0,
    )
    expect(visible.has('x')).toBe(true)
  })

  it('returns empty set when no nodes', () => {
    const visible = computeVisibleNodeIds(
      defaultViewport,
      containerWidth,
      containerHeight,
      new Map(),
      new Map(),
      0,
    )
    expect(visible.size).toBe(0)
  })

  it('includes partially visible nodes (edge overlap)', () => {
    const positions = makePositions([['partial', { x: -50, y: -20 }]])
    const dimensions = makeDimensions([['partial', { width: 100, height: 50 }]])

    // Node extends from -50 to 50 horizontally, overlaps viewport at x=0
    const visible = computeVisibleNodeIds(
      defaultViewport,
      containerWidth,
      containerHeight,
      positions,
      dimensions,
      0,
    )
    expect(visible.has('partial')).toBe(true)
  })
})

describe('computeVisibleEdgeIds', () => {
  const edges = [
    { id: 'e1', source: { nodeId: 'a' }, target: { nodeId: 'b' } },
    { id: 'e2', source: { nodeId: 'b' }, target: { nodeId: 'c' } },
    { id: 'e3', source: { nodeId: 'c' }, target: { nodeId: 'd' } },
  ]

  it('includes edges where at least one endpoint is visible', () => {
    const visibleNodes = new Set(['a', 'b'])
    const visible = computeVisibleEdgeIds(visibleNodes, edges)

    expect(visible.has('e1')).toBe(true) // both endpoints visible
    expect(visible.has('e2')).toBe(true) // source visible
    expect(visible.has('e3')).toBe(false) // neither visible
  })

  it('returns empty set for no visible nodes', () => {
    const visible = computeVisibleEdgeIds(new Set(), edges)
    expect(visible.size).toBe(0)
  })

  it('includes edge when only target is visible', () => {
    const visibleNodes = new Set(['d'])
    const visible = computeVisibleEdgeIds(visibleNodes, edges)

    expect(visible.has('e3')).toBe(true) // target d is visible
    expect(visible.has('e1')).toBe(false)
    expect(visible.has('e2')).toBe(false)
  })
})
