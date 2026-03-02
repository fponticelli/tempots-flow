import { describe, it, expect } from 'vitest'
import { prop } from '@tempots/core'
import type { Graph } from '../../src/types/graph'
import type { Position } from '../../src/types/layout'
import { createHistoryManager } from '../../src/core/history-manager'

function makeGraph(nodeIds: string[]): Graph<string, string> {
  return {
    nodes: nodeIds.map((id) => ({ id, data: id, ports: [] })),
    edges: [],
  }
}

function setup(nodeIds: string[] = ['a', 'b']) {
  const graphProp = prop(makeGraph(nodeIds))
  let positions = new Map<string, Position>([
    ['a', { x: 0, y: 0 }],
    ['b', { x: 100, y: 0 }],
  ])
  const history = createHistoryManager(
    graphProp,
    () => positions,
    (restored) => {
      positions = new Map(restored)
    },
  )
  return {
    graphProp,
    getPositions: () => positions,
    setPositions: (p: Map<string, Position>) => {
      positions = p
    },
    history,
  }
}

describe('HistoryManager', () => {
  it('starts with canUndo false and canRedo false', () => {
    const { history } = setup()
    expect(history.canUndo.value).toBe(false)
    expect(history.canRedo.value).toBe(false)
  })

  it('canUndo becomes true after record', () => {
    const { graphProp, history } = setup()
    graphProp.set(makeGraph(['a', 'b', 'c']))
    history.record()
    expect(history.canUndo.value).toBe(true)
    expect(history.canRedo.value).toBe(false)
  })

  it('undo restores previous graph state', () => {
    const { graphProp, history } = setup()
    const original = graphProp.value
    graphProp.set(makeGraph(['a', 'b', 'c']))
    history.record()
    history.undo()
    expect(graphProp.value).toEqual(original)
    expect(history.canUndo.value).toBe(false)
    expect(history.canRedo.value).toBe(true)
  })

  it('redo restores forward state', () => {
    const { graphProp, history } = setup()
    const modified = makeGraph(['a', 'b', 'c'])
    graphProp.set(modified)
    history.record()
    history.undo()
    history.redo()
    expect(graphProp.value).toEqual(modified)
    expect(history.canUndo.value).toBe(true)
    expect(history.canRedo.value).toBe(false)
  })

  it('new record after undo clears future', () => {
    const { graphProp, history } = setup()
    graphProp.set(makeGraph(['a', 'b', 'c']))
    history.record()
    history.undo()
    // Now add a different change
    graphProp.set(makeGraph(['x']))
    history.record()
    expect(history.canRedo.value).toBe(false)
    expect(history.canUndo.value).toBe(true)
  })

  it('undo when canUndo is false is a no-op', () => {
    const { graphProp, history } = setup()
    const original = graphProp.value
    history.undo()
    expect(graphProp.value).toEqual(original)
  })

  it('redo when canRedo is false is a no-op', () => {
    const { graphProp, history } = setup()
    const original = graphProp.value
    history.redo()
    expect(graphProp.value).toEqual(original)
  })

  it('respects max history size', () => {
    const graphProp = prop(makeGraph(['a']))
    let positions = new Map<string, Position>()
    const history = createHistoryManager(
      graphProp,
      () => positions,
      (restored) => {
        positions = new Map(restored)
      },
      { maxSize: 3 },
    )
    // Record 5 changes — only 3 should be kept
    for (let i = 0; i < 5; i++) {
      graphProp.set(makeGraph([`node-${i}`]))
      history.record()
    }
    // Should be able to undo at most 2 times (3 entries, pointer at 2)
    let undoCount = 0
    while (history.canUndo.value) {
      history.undo()
      undoCount++
    }
    expect(undoCount).toBe(2)
  })

  it('undo restores positions', () => {
    const { graphProp, getPositions, setPositions, history } = setup()
    // Modify positions
    setPositions(
      new Map([
        ['a', { x: 200, y: 200 }],
        ['b', { x: 300, y: 300 }],
      ]),
    )
    graphProp.set(makeGraph(['a', 'b', 'c']))
    history.record()
    history.undo()
    // Original positions should be restored
    expect(getPositions().get('a')).toEqual({ x: 0, y: 0 })
    expect(getPositions().get('b')).toEqual({ x: 100, y: 0 })
  })
})
