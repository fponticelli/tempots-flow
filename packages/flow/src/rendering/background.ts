import { svg, attr, svgAttr } from '@tempots/dom'
import type { TNode } from '@tempots/dom'
import type { Signal } from '@tempots/core'
import type { Viewport } from '../types/layout'
import type { BackgroundConfig } from '../types/config'

let _patternIdCounter = 0

function nextPatternId(): string {
  return `flow-bg-pattern-${++_patternIdCounter}`
}

function dotsPattern(gap: number, size: number, color: string): TNode {
  return svg.circle(svgAttr.cx(gap / 2), svgAttr.cy(gap / 2), svgAttr.r(size), svgAttr.fill(color))
}

function linesPattern(gap: number, size: number, color: string): TNode[] {
  return [
    svg.line(
      svgAttr.x1(0),
      svgAttr.y1(gap),
      svgAttr.x2(gap),
      svgAttr.y2(gap),
      svgAttr.stroke(color),
      svgAttr['stroke-width'](size),
    ),
    svg.line(
      svgAttr.x1(gap),
      svgAttr.y1(0),
      svgAttr.x2(gap),
      svgAttr.y2(gap),
      svgAttr.stroke(color),
      svgAttr['stroke-width'](size),
    ),
  ]
}

function crossPattern(gap: number, size: number, color: string): TNode[] {
  const half = gap / 2
  const arm = (size * 4) / 2
  return [
    svg.line(
      svgAttr.x1(half - arm),
      svgAttr.y1(half),
      svgAttr.x2(half + arm),
      svgAttr.y2(half),
      svgAttr.stroke(color),
      svgAttr['stroke-width'](size),
    ),
    svg.line(
      svgAttr.x1(half),
      svgAttr.y1(half - arm),
      svgAttr.x2(half),
      svgAttr.y2(half + arm),
      svgAttr.stroke(color),
      svgAttr['stroke-width'](size),
    ),
  ]
}

export function Background(viewport: Signal<Viewport>, config: BackgroundConfig = {}): TNode {
  const type = config.type ?? 'dots'
  const gap = config.gap ?? 20
  const size = config.size ?? 1
  const color = config.color ?? 'var(--flow-grid-color, rgba(255, 255, 255, 0.05))'

  const patternId = nextPatternId()
  const patternTransform = viewport.map((v) => `translate(${v.x}, ${v.y}) scale(${v.zoom})`)

  let patternContent: TNode | TNode[]
  if (type === 'lines') {
    patternContent = linesPattern(gap, size, color)
  } else if (type === 'cross') {
    patternContent = crossPattern(gap, size, color)
  } else {
    patternContent = dotsPattern(gap, size, color)
  }

  return svg.svg(
    attr.class('flow-background'),
    attr.width('100%'),
    attr.height('100%'),
    svg.defs(
      svg.pattern(
        svgAttr.id(patternId),
        svgAttr.width(gap),
        svgAttr.height(gap),
        svgAttr.patternUnits('userSpaceOnUse'),
        svgAttr.patternTransform(patternTransform),
        ...(Array.isArray(patternContent) ? patternContent : [patternContent]),
      ),
    ),
    svg.rect(attr.width('100%'), attr.height('100%'), svgAttr.fill(`url(#${patternId})`)),
  )
}
