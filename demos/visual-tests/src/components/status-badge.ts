import { html, style } from '@tempots/dom'
import type { TNode } from '@tempots/dom'
import type { TestStatus } from '../types'

const statusColors: Record<TestStatus | 'pending', string> = {
  pass: '#22c55e',
  fail: '#ef4444',
  new: '#f59e0b',
  pending: '#6b7280',
}

const statusLabels: Record<TestStatus | 'pending', string> = {
  pass: 'PASS',
  fail: 'FAIL',
  new: 'NEW',
  pending: '...',
}

export function StatusBadge(status: TestStatus | 'pending'): TNode {
  const color = statusColors[status]
  return html.span(
    style.display('inline-block'),
    style.padding('2px 6px'),
    style.borderRadius('3px'),
    style.fontSize('10px'),
    style.fontWeight('700'),
    style.letterSpacing('0.05em'),
    style.color(color),
    style.background(`${color}20`),
    style.border(`1px solid ${color}40`),
    statusLabels[status],
  )
}
