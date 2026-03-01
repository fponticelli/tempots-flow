import { describe, it, expect } from 'vitest'
import { prop } from '@tempots/core'
import { createInitialInteractionState } from '../types/interaction'
import { handleNodeClick, handleEdgeClick, handleBackgroundClick } from './selection-handler'

function makeState() {
  return prop(createInitialInteractionState())
}

describe('handleNodeClick', () => {
  it('selects a node on single click', () => {
    const state = makeState()
    handleNodeClick(state, 'n1', false)
    expect(state.value.selectedNodeIds.has('n1')).toBe(true)
    expect(state.value.selectedEdgeIds.size).toBe(0)
  })

  it('replaces selection on single click', () => {
    const state = makeState()
    handleNodeClick(state, 'n1', false)
    handleNodeClick(state, 'n2', false)
    expect(state.value.selectedNodeIds.has('n1')).toBe(false)
    expect(state.value.selectedNodeIds.has('n2')).toBe(true)
  })

  it('toggles node in multi-select mode', () => {
    const state = makeState()
    handleNodeClick(state, 'n1', false)
    handleNodeClick(state, 'n2', true)
    expect(state.value.selectedNodeIds.has('n1')).toBe(true)
    expect(state.value.selectedNodeIds.has('n2')).toBe(true)
  })

  it('deselects node on multi-select toggle', () => {
    const state = makeState()
    handleNodeClick(state, 'n1', false)
    handleNodeClick(state, 'n1', true)
    expect(state.value.selectedNodeIds.has('n1')).toBe(false)
  })
})

describe('handleEdgeClick', () => {
  it('selects an edge and clears node selection', () => {
    const state = makeState()
    handleNodeClick(state, 'n1', false)
    handleEdgeClick(state, 'e1', false)
    expect(state.value.selectedEdgeIds.has('e1')).toBe(true)
    expect(state.value.selectedNodeIds.size).toBe(0)
  })

  it('toggles edge in multi-select mode', () => {
    const state = makeState()
    handleEdgeClick(state, 'e1', false)
    handleEdgeClick(state, 'e2', true)
    expect(state.value.selectedEdgeIds.has('e1')).toBe(true)
    expect(state.value.selectedEdgeIds.has('e2')).toBe(true)
  })
})

describe('handleBackgroundClick', () => {
  it('clears all selection', () => {
    const state = makeState()
    handleNodeClick(state, 'n1', false)
    handleEdgeClick(state, 'e1', true)
    handleBackgroundClick(state)
    expect(state.value.selectedNodeIds.size).toBe(0)
    expect(state.value.selectedEdgeIds.size).toBe(0)
  })
})
