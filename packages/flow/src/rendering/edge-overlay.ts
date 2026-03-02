import { svg, attr, svgAttr } from '@tempots/dom'
import type { TNode } from '@tempots/dom'
import type { Signal } from '@tempots/core'
import type { ComputedEdgePath } from '../types/layout'
import type { EdgeOverlayConfig } from '../types/config'

export function computeEdgeAngle(path: ComputedEdgePath): number {
  const dx = path.targetPoint.x - path.sourcePoint.x
  const dy = path.targetPoint.y - path.sourcePoint.y
  if (dx === 0 && dy === 0) return 0
  let deg = Math.atan2(dy, dx) * (180 / Math.PI)
  if (deg > 90) deg -= 180
  if (deg < -90) deg += 180
  return deg
}

export function createEdgeOverlay(
  path: Signal<ComputedEdgePath>,
  config: EdgeOverlayConfig,
): TNode {
  const t = config.position ?? 0.5
  const offset = config.offset ?? 0
  const orientation = config.orientation ?? 'horizontal'

  const transform = path.map((p) => {
    const x = p.sourcePoint.x + (p.targetPoint.x - p.sourcePoint.x) * t
    const y = p.sourcePoint.y + (p.targetPoint.y - p.sourcePoint.y) * t

    if (offset !== 0) {
      const dx = p.targetPoint.x - p.sourcePoint.x
      const dy = p.targetPoint.y - p.sourcePoint.y
      const len = Math.sqrt(dx * dx + dy * dy) || 1
      const nx = -dy / len
      const ny = dx / len
      const ox = x + nx * offset
      const oy = y + ny * offset

      if (orientation === 'path') {
        let deg = Math.atan2(dy, dx) * (180 / Math.PI)
        if (deg > 90) deg -= 180
        if (deg < -90) deg += 180
        return `translate(${ox}, ${oy}) rotate(${deg})`
      }
      return `translate(${ox}, ${oy})`
    }

    if (orientation === 'path') {
      const dx = p.targetPoint.x - p.sourcePoint.x
      const dy = p.targetPoint.y - p.sourcePoint.y
      let deg = Math.atan2(dy, dx) * (180 / Math.PI)
      if (deg > 90) deg -= 180
      if (deg < -90) deg += 180
      return `translate(${x}, ${y}) rotate(${deg})`
    }

    return `translate(${x}, ${y})`
  })

  return svg.g(attr.class('flow-edge-overlay'), svgAttr.transform(transform), config.content)
}
