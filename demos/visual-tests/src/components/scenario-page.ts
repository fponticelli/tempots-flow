import { html, style, on, Ensure, MapSignal } from '@tempots/dom'
import type { TNode } from '@tempots/dom'
import { computed } from '@tempots/core'
import { allScenarios, scenarioById } from '../scenarios'
import { selectedScenarioId, navigateTo } from '../state'
import { ScenarioViewer } from './scenario-viewer'

export function ScenarioPage(): TNode {
  const currentIndex = computed(() => {
    const id = selectedScenarioId.value
    return id ? allScenarios.findIndex((s) => s.id === id) : -1
  }, [selectedScenarioId])

  const name = selectedScenarioId.map(
    (id): string => (id ? scenarioById.get(id)?.name : null) ?? '',
  )

  const description = selectedScenarioId.map(
    (id): string => (id ? scenarioById.get(id)?.description : null) ?? '',
  )

  const prevId = currentIndex.map((i): string | null =>
    i > 0 ? (allScenarios[i - 1]?.id ?? null) : null,
  )

  const nextId = currentIndex.map((i): string | null =>
    i >= 0 && i < allScenarios.length - 1 ? (allScenarios[i + 1]?.id ?? null) : null,
  )

  return html.div(
    style.display('flex'),
    style.flexDirection('column'),
    style.gap('16px'),
    style.padding('20px'),
    style.flex('1'),
    style.overflowY('auto'),
    style.alignItems('center'),

    // Header
    html.div(
      style.display('flex'),
      style.alignItems('center'),
      style.gap('12px'),
      style.alignSelf('stretch'),

      html.a(
        style.color('#53a8ff'),
        style.cursor('pointer'),
        style.fontSize('14px'),
        on.click(() => navigateTo('gallery')),
        'Back',
      ),

      html.span(style.fontSize('18px'), style.fontWeight('600'), style.color('#e0e0e0'), name),

      Ensure(selectedScenarioId, (id) =>
        html.a(
          style.color('#f59e0b'),
          style.cursor('pointer'),
          style.fontSize('13px'),
          on.click(() => navigateTo('diff', id.value)),
          'View Diff',
        ),
      ),

      // Spacer
      html.div(style.flex('1')),

      // Prev / Next — read signal value at click time for correct navigation
      Ensure(prevId, (id) =>
        html.a(
          style.color('#53a8ff'),
          style.cursor('pointer'),
          style.fontSize('13px'),
          style.padding('4px 10px'),
          style.borderRadius('4px'),
          style.border('1px solid #333'),
          style.background('#1a1a2e'),
          style.userSelect('none'),
          on.click(() => navigateTo('scenario', id.value)),
          'Prev',
        ),
      ),
      Ensure(nextId, (id) =>
        html.a(
          style.color('#53a8ff'),
          style.cursor('pointer'),
          style.fontSize('13px'),
          style.padding('4px 10px'),
          style.borderRadius('4px'),
          style.border('1px solid #333'),
          style.background('#1a1a2e'),
          style.userSelect('none'),
          on.click(() => navigateTo('scenario', id.value)),
          'Next',
        ),
      ),
    ),

    // Description
    html.div(
      style.fontSize('13px'),
      style.color('#888'),
      style.alignSelf('flex-start'),
      description,
    ),

    // Rendered scenario — MapSignal fully re-creates ScenarioViewer on ID change
    MapSignal(selectedScenarioId, (id) => {
      if (!id) return null
      const scenario = scenarioById.get(id)
      if (!scenario) return null
      return ScenarioViewer(scenario)
    }),
  )
}
