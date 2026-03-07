import { prop, computed } from '@tempots/core'
import type { Signal } from '@tempots/core'
import type { TestResult, TestStatus } from './types'
import { allScenarios, scenariosByCategory } from './scenarios'
import type { TestScenario } from './types'

export type ViewMode = 'gallery' | 'scenario' | 'diff'

export const viewMode = prop<ViewMode>('gallery')
export const selectedScenarioId = prop<string | null>(null)
export const searchQuery = prop('')
export const statusFilter = prop<TestStatus | 'all'>('all')
export const categoryFilter = prop<string | null>(null)
export const testResults = prop<TestResult[]>([])
export const cacheBuster = prop(0)

export const resultsByScenarioId: Signal<Map<string, TestResult>> = computed(
  () => {
    const results = testResults.value
    return new Map(results.map((r) => [r.scenarioId, r]))
  },
  [testResults],
)

export const filteredScenarios: Signal<TestScenario[]> = computed(
  () => {
    const query = searchQuery.value.toLowerCase()
    const filter = statusFilter.value
    const category = categoryFilter.value
    const resultsMap = resultsByScenarioId.value

    return allScenarios.filter((s) => {
      if (category && s.category !== category) return false
      if (query && !s.name.toLowerCase().includes(query) && !s.id.toLowerCase().includes(query)) {
        return false
      }
      if (filter !== 'all') {
        const result = resultsMap.get(s.id)
        const status = result?.status ?? 'pending'
        if (status !== filter) return false
      }
      return true
    })
  },
  [searchQuery, statusFilter, categoryFilter, resultsByScenarioId],
)

export const categoryCounts: Signal<
  Map<string, { total: number; pass: number; fail: number; new_: number }>
> = computed(
  () => {
    const resultsMap = resultsByScenarioId.value
    const counts = new Map<string, { total: number; pass: number; fail: number; new_: number }>()

    for (const [category, scenarios] of scenariosByCategory) {
      let pass = 0
      let fail = 0
      let new_ = 0
      for (const s of scenarios) {
        const result = resultsMap.get(s.id)
        if (result?.status === 'pass') pass++
        else if (result?.status === 'fail') fail++
        else if (result?.status === 'new') new_++
      }
      counts.set(category, { total: scenarios.length, pass, fail, new_ })
    }

    return counts
  },
  [resultsByScenarioId],
)

// Load test results from API
export async function loadResults(): Promise<void> {
  try {
    const res = await fetch('/api/results')
    const data = await res.json()
    if (Array.isArray(data)) {
      testResults.set(data)
    }
  } catch {
    // Results not available yet
  }
}

// Approve a scenario (copy current to baseline)
export async function approveScenario(scenarioId: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/approve/${scenarioId}`, { method: 'POST' })
    return res.ok
  } catch {
    return false
  }
}

// Hash-based routing
export function initRouter(): void {
  const handleHash = () => {
    const hash = window.location.hash || '#/'
    if (hash.startsWith('#/scenario/')) {
      const id = hash.slice('#/scenario/'.length)
      selectedScenarioId.set(id)
      viewMode.set('scenario')
    } else if (hash.startsWith('#/diff/')) {
      const id = hash.slice('#/diff/'.length)
      selectedScenarioId.set(id)
      viewMode.set('diff')
    } else {
      selectedScenarioId.set(null)
      viewMode.set('gallery')
    }
  }

  window.addEventListener('hashchange', handleHash)
  handleHash()
}

export function navigateTo(mode: ViewMode, scenarioId?: string): void {
  if (mode === 'gallery') {
    window.location.hash = '#/'
  } else if (mode === 'scenario' && scenarioId) {
    window.location.hash = `#/scenario/${scenarioId}`
  } else if (mode === 'diff' && scenarioId) {
    window.location.hash = `#/diff/${scenarioId}`
  }
}
