import { svg, svgAttr, attr } from '@tempots/dom'
import type { TNode } from '@tempots/dom'
import type { EdgeDirection } from '../types/graph'
import type { EdgeMarkerConfig, EdgeMarkerType } from '../types/config'

export interface ResolvedMarkers {
  readonly start?: string
  readonly end?: string
}

function markerId(type: EdgeMarkerType, position: 'start' | 'end'): string {
  return `flow-marker-${type}-${position}`
}

function markerPathD(type: EdgeMarkerType, customSvg?: string): string {
  switch (type) {
    case 'arrow':
      return 'M 0 0 L 10 5 L 0 10'
    case 'arrow-closed':
      return 'M 0 0 L 10 5 L 0 10 Z'
    case 'dot':
      return 'M 5 0 A 5 5 0 1 0 5 10 A 5 5 0 1 0 5 0 Z'
    case 'diamond':
      return 'M 0 5 L 5 0 L 10 5 L 5 10 Z'
    case 'custom':
      return customSvg ?? 'M 0 0 L 10 5 L 0 10 Z'
  }
}

function markerFill(type: EdgeMarkerType): boolean {
  return type !== 'arrow'
}

function createMarkerElement(
  type: EdgeMarkerType,
  position: 'start' | 'end',
  size: number,
  color: string,
  customSvg?: string,
): TNode {
  const id = markerId(type, position)
  const refX = position === 'end' ? 10 : 0
  const orient = position === 'end' ? 'auto' : 'auto-start-reverse'
  const isFilled = markerFill(type)

  return svg.marker(
    attr.id(id),
    svgAttr.viewBox('0 0 10 10'),
    svgAttr.refX(String(refX)),
    svgAttr.refY('5'),
    svgAttr.markerWidth(String(size)),
    svgAttr.markerHeight(String(size)),
    svgAttr.orient(orient),
    svg.path(
      svgAttr.d(markerPathD(type, customSvg)),
      isFilled ? svgAttr.fill(color) : svgAttr.fill('none'),
      isFilled ? null : svgAttr.stroke(color),
      isFilled ? null : svgAttr['stroke-width']('1'),
    ),
  )
}

export function createMarkerDefs(markerConfig: EdgeMarkerConfig): TNode {
  const type = markerConfig.type ?? 'arrow-closed'
  const size = markerConfig.size ?? 10
  const color = markerConfig.color ?? 'var(--flow-edge-color, #666)'

  return svg.defs(
    createMarkerElement(type, 'start', size, color, markerConfig.customSvg),
    createMarkerElement(type, 'end', size, color, markerConfig.customSvg),
  )
}

export function resolveEdgeMarkers(
  direction: EdgeDirection,
  markerConfig: EdgeMarkerConfig,
): ResolvedMarkers {
  const type = markerConfig.type ?? 'arrow-closed'
  const result: { start?: string; end?: string } = {}

  switch (direction) {
    case 'forward':
      result.end = `url(#${markerId(type, 'end')})`
      break
    case 'backward':
      result.start = `url(#${markerId(type, 'start')})`
      break
    case 'bidirectional':
      result.start = `url(#${markerId(type, 'start')})`
      result.end = `url(#${markerId(type, 'end')})`
      break
    case 'none':
      break
  }

  return result
}
