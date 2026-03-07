import { html, style, on, Ensure, attr } from '@tempots/dom'
import type { TNode } from '@tempots/dom'
import type { Signal } from '@tempots/core'
import { prop, computed } from '@tempots/core'
import { scenarioById } from '../scenarios'
import {
  selectedScenarioId,
  resultsByScenarioId,
  navigateTo,
  approveScenario,
  loadResults,
  cacheBuster,
} from '../state'

type DiffMode = 'side-by-side' | 'overlay' | 'blink'

function ImagePanel(label: string, src: Signal<string>): TNode {
  return html.div(
    style.display('flex'),
    style.flexDirection('column'),
    style.gap('4px'),
    style.flex('1'),

    html.div(
      style.fontSize('12px'),
      style.fontWeight('600'),
      style.color('#888'),
      style.textTransform('uppercase'),
      label,
    ),

    html.img(
      style.width('100%'),
      style.border('1px solid #333'),
      style.borderRadius('4px'),
      style.background('#0a0a0a'),
      attr.src(src),
    ),
  )
}

export function DiffViewer(): TNode {
  const diffMode = prop<DiffMode>('side-by-side')

  const scenario = computed(
    () => {
      const id = selectedScenarioId.value
      return id ? scenarioById.get(id) : undefined
    },
    [selectedScenarioId],
  )

  const result = computed(
    () => {
      const id = selectedScenarioId.value
      return id ? resultsByScenarioId.value.get(id) : undefined
    },
    [selectedScenarioId, resultsByScenarioId],
  )

  return html.div(
    style.display('flex'),
    style.flexDirection('column'),
    style.gap('16px'),
    style.padding('20px'),
    style.flex('1'),
    style.overflowY('auto'),

    // Header
    html.div(
      style.display('flex'),
      style.justifyContent('space-between'),
      style.alignItems('center'),

      html.div(
        style.display('flex'),
        style.alignItems('center'),
        style.gap('12px'),

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
      ),

      // Diff stats
      Ensure(
        result.map((r) =>
          r ? `${r.diffPixelCount} px (${r.diffPercentage.toFixed(2)}%)` : null,
        ),
        (stats) =>
          html.span(
            style.fontSize('13px'),
            style.color('#888'),
            stats,
          ),
      ),
    ),

    // Diff mode toggles
    html.div(
      style.display('flex'),
      style.gap('8px'),

      ...(['side-by-side', 'overlay', 'blink'] as const).map((mode) =>
        html.button(
          style.padding('4px 12px'),
          style.borderRadius('4px'),
          style.border('1px solid'),
          style.borderColor(diffMode.map((m): string => m === mode ? '#53a8ff' : '#333')),
          style.background(diffMode.map((m): string => m === mode ? '#53a8ff20' : 'transparent')),
          style.color(diffMode.map((m): string => m === mode ? '#53a8ff' : '#888')),
          style.cursor('pointer'),
          style.fontSize('12px'),
          on.click(() => diffMode.set(mode)),
          mode,
        ),
      ),
    ),

    // Images
    Ensure(
      selectedScenarioId,
      (id) => {
        const bust = cacheBuster.map((t) => (t ? `?t=${t}` : ''))
        return html.div(
          style.display('flex'),
          style.gap('16px'),

          ImagePanel('Baseline', bust.map((b) => `/screenshots/baselines/${id.value}.png${b}`)),
          ImagePanel('Current', bust.map((b) => `/screenshots/current/${id.value}.png${b}`)),
          ImagePanel('Diff', bust.map((b) => `/screenshots/diffs/${id.value}.png${b}`)),
        )
      },
    ),

    // Approve button
    Ensure(
      result.map((r) =>
        r?.status === 'fail' || r?.status === 'new' ? true : null,
      ),
      () =>
        html.button(
          style.padding('8px 20px'),
          style.borderRadius('6px'),
          style.border('none'),
          style.background('#22c55e'),
          style.color('#fff'),
          style.fontWeight('600'),
          style.cursor('pointer'),
          style.fontSize('14px'),
          style.alignSelf('flex-start'),
          on.click(async () => {
            const id = selectedScenarioId.value
            if (id) {
              const ok = await approveScenario(id)
              if (ok) {
                await loadResults()
                cacheBuster.set(Date.now())
              }
            }
          }),
          'Approve (copy current to baseline)',
        ),
    ),
  )
}
