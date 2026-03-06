import { html, style, on, Ensure } from '@tempots/dom'
import type { TNode } from '@tempots/dom'
import { computed } from '@tempots/core'
import { scenarioById } from '../scenarios'
import { selectedScenarioId, navigateTo } from '../state'
import { ScenarioViewer } from './scenario-viewer'

export function ScenarioPage(): TNode {
  const scenario = computed(
    () => {
      const id = selectedScenarioId.value
      return id ? scenarioById.get(id) ?? null : null
    },
    [selectedScenarioId],
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
      style.alignSelf('flex-start'),

      html.a(
        style.color('#53a8ff'),
        style.cursor('pointer'),
        style.fontSize('14px'),
        on.click(() => navigateTo('gallery')),
        'Back',
      ),

      Ensure(
        scenario.map((s) => s?.name ?? null),
        (name) =>
          html.span(
            style.fontSize('18px'),
            style.fontWeight('600'),
            style.color('#e0e0e0'),
            name,
          ),
      ),

      Ensure(
        selectedScenarioId,
        (id) =>
          html.a(
            style.color('#f59e0b'),
            style.cursor('pointer'),
            style.fontSize('13px'),
            on.click(() => navigateTo('diff', id.value)),
            'View Diff',
          ),
      ),
    ),

    // Description
    Ensure(
      scenario.map((s) => s?.description ?? null),
      (desc) =>
        html.div(
          style.fontSize('13px'),
          style.color('#888'),
          style.alignSelf('flex-start'),
          desc,
        ),
    ),

    // Rendered scenario
    Ensure(scenario, (s) => ScenarioViewer(s.value)),
  )
}
