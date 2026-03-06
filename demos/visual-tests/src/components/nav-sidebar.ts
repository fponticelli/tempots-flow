import { html, style, on } from '@tempots/dom'
import type { TNode } from '@tempots/dom'
import { scenariosByCategory } from '../scenarios'
import {
  searchQuery,
  statusFilter,
  navigateTo,
  filteredScenarios,
} from '../state'
import type { TestStatus } from '../types'

function FilterButton(
  label: string,
  value: TestStatus | 'all',
  color: string,
): TNode {
  const isActive = statusFilter.map((f) => f === value)

  return html.button(
    style.padding('4px 8px'),
    style.borderRadius('4px'),
    style.border('1px solid'),
    style.borderColor(isActive.map((a): string => a ? color : '#333')),
    style.background(isActive.map((a): string => a ? `${color}20` : 'transparent')),
    style.color(isActive.map((a): string => a ? color : '#888')),
    style.cursor('pointer'),
    style.fontSize('11px'),
    style.fontWeight('600'),
    on.click(() => statusFilter.set(value)),
    label,
  )
}

export function NavSidebar(): TNode {
  return html.div(
    style.width('240px'),
    style.minWidth('240px'),
    style.borderRight('1px solid #222'),
    style.display('flex'),
    style.flexDirection('column'),
    style.gap('16px'),
    style.padding('16px'),
    style.overflowY('auto'),

    // Title
    html.div(
      style.fontSize('18px'),
      style.fontWeight('700'),
      style.color('#e0e0e0'),
      style.cursor('pointer'),
      on.click(() => navigateTo('gallery')),
      'Visual Tests',
    ),

    // Search
    html.input(
      style.width('100%'),
      style.padding('6px 10px'),
      style.borderRadius('4px'),
      style.border('1px solid #333'),
      style.background('#111'),
      style.color('#e0e0e0'),
      style.fontSize('13px'),
      style.outline('none'),
      on.input((ev) => {
        searchQuery.set((ev.target as HTMLInputElement).value)
      }),
    ),

    // Status filters
    html.div(
      style.display('flex'),
      style.flexWrap('wrap'),
      style.gap('4px'),

      FilterButton('All', 'all', '#888'),
      FilterButton('Pass', 'pass', '#22c55e'),
      FilterButton('Fail', 'fail', '#ef4444'),
      FilterButton('New', 'new', '#f59e0b'),
    ),

    // Count
    html.div(
      style.fontSize('12px'),
      style.color('#666'),
      filteredScenarios.map((s) => `${s.length} scenarios`),
    ),

    // Categories
    html.div(
      style.display('flex'),
      style.flexDirection('column'),
      style.gap('4px'),

      ...Array.from(scenariosByCategory.entries()).map(([category, scenarios]) =>
        html.div(
          style.padding('6px 8px'),
          style.borderRadius('4px'),
          style.cursor('pointer'),
          style.fontSize('13px'),
          style.color('#aaa'),
          style.display('flex'),
          style.justifyContent('space-between'),
          style.alignItems('center'),

          html.span(category),
          html.span(
            style.fontSize('11px'),
            style.color('#666'),
            `${scenarios.length}`,
          ),
        ),
      ),
    ),
  )
}
