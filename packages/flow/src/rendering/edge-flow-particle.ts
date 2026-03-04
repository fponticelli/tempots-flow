import { svg, attr, WithElement, OnDispose } from '@tempots/dom'
import type { TNode } from '@tempots/dom'
import type { Signal } from '@tempots/core'

export interface EdgeFlowParticleConfig {
  /** Number of particles per edge. Default: 3 */
  readonly count?: number
  /** Particle radius in px. Default: 3 */
  readonly radius?: number
  /** Color of the particles. Default: inherits from --flow-edge-color */
  readonly color?: string
  /** Speed in pixels per second. Default: 60 */
  readonly speed?: number
}

/**
 * Renders animated particles flowing along an SVG path.
 * Uses requestAnimationFrame to advance particle positions.
 */
export function EdgeFlowParticle(pathD: Signal<string>, config?: EdgeFlowParticleConfig): TNode {
  const count = config?.count ?? 3
  const radius = config?.radius ?? 3
  const color = config?.color ?? 'var(--flow-edge-color, #53a8ff)'
  const speed = config?.speed ?? 60

  return svg.g(
    attr.class('flow-edge-flow-particles'),
    WithElement((g: HTMLElement) => {
      // Create a hidden path element to get length
      const pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path')
      pathEl.style.display = 'none'
      g.appendChild(pathEl)

      // Create circles for particles
      const circles: SVGCircleElement[] = []
      for (let i = 0; i < count; i++) {
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
        circle.setAttribute('r', String(radius))
        circle.setAttribute('fill', color)
        circle.setAttribute('opacity', '0.8')
        g.appendChild(circle)
        circles.push(circle)
      }

      let rafId = 0
      let lastTime = 0
      let offset = 0

      function animate(time: number) {
        if (lastTime === 0) lastTime = time
        const dt = (time - lastTime) / 1000
        lastTime = time

        const totalLength = pathEl.getTotalLength()
        if (totalLength <= 0) {
          rafId = requestAnimationFrame(animate)
          return
        }

        offset = (offset + speed * dt) % totalLength
        const spacing = totalLength / count

        for (let i = 0; i < count; i++) {
          const pos = (offset + i * spacing) % totalLength
          const pt = pathEl.getPointAtLength(pos)
          circles[i]!.setAttribute('cx', String(pt.x))
          circles[i]!.setAttribute('cy', String(pt.y))
        }

        rafId = requestAnimationFrame(animate)
      }

      // Update path when signal changes (.on() fires with current value)
      const unsubscribe = pathD.on((d) => {
        pathEl.setAttribute('d', d)
      })

      rafId = requestAnimationFrame(animate)

      return OnDispose(() => {
        cancelAnimationFrame(rafId)
        unsubscribe()
      })
    }),
  )
}

/**
 * Creates a particle flow TNode that can be used as an edge overlay.
 */
export function createEdgeFlowParticle(config?: EdgeFlowParticleConfig) {
  return (pathD: Signal<string>): TNode => EdgeFlowParticle(pathD, config)
}
