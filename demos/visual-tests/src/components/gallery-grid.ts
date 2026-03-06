import { html, style, on, ForEach, Ensure, attr } from '@tempots/dom'
import type { TNode } from '@tempots/dom'
import { computed } from '@tempots/core'
import type { Signal } from '@tempots/core'
import type { TestResult } from '../types'
import type { TestScenario } from '../types'
import {
  filteredScenarios,
  resultsByScenarioId,
  navigateTo,
} from '../state'

function ScenarioCard(scenario: {
  readonly id: string
  readonly name: string
  readonly category: string
}): TNode {
  const result: Signal<TestResult | undefined> = computed(
    () => resultsByScenarioId.value.get(scenario.id),
    [resultsByScenarioId],
  )
  const status = result.map((r): string => r?.status ?? 'pending')

  return html.div(
    style.display('flex'),
    style.flexDirection('column'),
    style.gap('8px'),
    style.padding('12px'),
    style.borderRadius('6px'),
    style.border('1px solid #333'),
    style.background('#1a1a2e'),
    style.cursor('pointer'),
    style.transition('border-color 0.15s'),
    on.click(() => navigateTo('scenario', scenario.id)),

    // Header with name and status
    html.div(
      style.display('flex'),
      style.justifyContent('space-between'),
      style.alignItems('center'),

      html.div(
        style.fontSize('13px'),
        style.fontWeight('600'),
        style.color('#e0e0e0'),
        scenario.name,
      ),

      html.span(
        style.display('inline-block'),
        style.padding('2px 6px'),
        style.borderRadius('3px'),
        style.fontSize('10px'),
        style.fontWeight('700'),
        style.letterSpacing('0.05em'),
        status,
      ),
    ),

    // Category label
    html.div(
      style.fontSize('11px'),
      style.color('#666'),
      scenario.category,
    ),

    // Thumbnail (baseline image if available)
    Ensure(
      result.map((r) => (r ? scenario.id : null)),
      (_id) =>
        html.img(
          style.width('100%'),
          style.maxHeight('200px'),
          style.objectFit('contain'),
          style.borderRadius('4px'),
          style.border('1px solid #222'),
          attr.src(_id.map((v) => `/screenshots/baselines/${v}.png`)),
        ),
    ),

    // Actions
    html.div(
      style.display('flex'),
      style.gap('8px'),
      style.fontSize('11px'),

      html.a(
        style.color('#53a8ff'),
        style.cursor('pointer'),
        on.click((ev) => {
          ev.stopPropagation()
          navigateTo('scenario', scenario.id)
        }),
        'View',
      ),

      Ensure(
        result.map((r) => (r?.status === 'fail' || r?.status === 'new' ? scenario.id : null)),
        () =>
          html.a(
            style.color('#f59e0b'),
            style.cursor('pointer'),
            on.click((ev) => {
              ev.stopPropagation()
              navigateTo('diff', scenario.id)
            }),
            'Diff',
          ),
      ),
    ),
  )
}

export function GalleryGrid(): TNode {
  return html.div(
    style.display('grid'),
    style.gridTemplateColumns('repeat(auto-fill, minmax(240px, 1fr))'),
    style.gap('16px'),
    style.padding('20px'),

    ForEach(
      filteredScenarios as Signal<TestScenario[]>,
      (scenario) => ScenarioCard(scenario.value),
    ),
  )
}
