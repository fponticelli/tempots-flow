import { describe, it, expect } from 'vitest'
import { prop } from '@tempots/core'
import type { Viewport } from '../../src/types/layout'
import { createTouchHandler } from '../../src/interaction/touch-handler'

function makeTouchEvent(
  type: string,
  touches: Array<{ clientX: number; clientY: number }>,
): TouchEvent {
  const touchList = touches.map(
    (t, i) =>
      ({
        identifier: i,
        clientX: t.clientX,
        clientY: t.clientY,
        target: null,
      }) as unknown as Touch,
  )
  return {
    type,
    touches: touchList,
    preventDefault: () => {},
  } as unknown as TouchEvent
}

describe('createTouchHandler', () => {
  const rect = new DOMRect(0, 0, 800, 600)

  it('does nothing on single touch', () => {
    const vp = prop<Viewport>({ x: 0, y: 0, zoom: 1 })
    const handler = createTouchHandler(vp, () => rect, { minZoom: 0.1, maxZoom: 4 })

    handler.onTouchStart(makeTouchEvent('touchstart', [{ clientX: 100, clientY: 100 }]))
    expect(vp.value).toEqual({ x: 0, y: 0, zoom: 1 })
  })

  it('initializes on two-finger touch', () => {
    const vp = prop<Viewport>({ x: 0, y: 0, zoom: 1 })
    const handler = createTouchHandler(vp, () => rect, { minZoom: 0.1, maxZoom: 4 })

    handler.onTouchStart(
      makeTouchEvent('touchstart', [
        { clientX: 100, clientY: 200 },
        { clientX: 300, clientY: 200 },
      ]),
    )
    // Viewport shouldn't change on start
    expect(vp.value.zoom).toBe(1)
  })

  it('zooms in on pinch out (fingers spreading)', () => {
    const vp = prop<Viewport>({ x: 0, y: 0, zoom: 1 })
    const handler = createTouchHandler(vp, () => rect, { minZoom: 0.1, maxZoom: 4 })

    handler.onTouchStart(
      makeTouchEvent('touchstart', [
        { clientX: 300, clientY: 300 },
        { clientX: 500, clientY: 300 },
      ]),
    )
    // Spread fingers to 2x distance
    handler.onTouchMove(
      makeTouchEvent('touchmove', [
        { clientX: 200, clientY: 300 },
        { clientX: 600, clientY: 300 },
      ]),
    )
    expect(vp.value.zoom).toBe(2)
  })

  it('zooms out on pinch in (fingers closing)', () => {
    const vp = prop<Viewport>({ x: 0, y: 0, zoom: 2 })
    const handler = createTouchHandler(vp, () => rect, { minZoom: 0.1, maxZoom: 4 })

    handler.onTouchStart(
      makeTouchEvent('touchstart', [
        { clientX: 200, clientY: 300 },
        { clientX: 600, clientY: 300 },
      ]),
    )
    // Close fingers to half distance
    handler.onTouchMove(
      makeTouchEvent('touchmove', [
        { clientX: 300, clientY: 300 },
        { clientX: 500, clientY: 300 },
      ]),
    )
    expect(vp.value.zoom).toBe(1)
  })

  it('clamps zoom to maxZoom', () => {
    const vp = prop<Viewport>({ x: 0, y: 0, zoom: 3 })
    const handler = createTouchHandler(vp, () => rect, { minZoom: 0.1, maxZoom: 4 })

    handler.onTouchStart(
      makeTouchEvent('touchstart', [
        { clientX: 300, clientY: 300 },
        { clientX: 500, clientY: 300 },
      ]),
    )
    // 10x spread
    handler.onTouchMove(
      makeTouchEvent('touchmove', [
        { clientX: 0, clientY: 300 },
        { clientX: 2000, clientY: 300 },
      ]),
    )
    expect(vp.value.zoom).toBe(4)
  })

  it('clamps zoom to minZoom', () => {
    const vp = prop<Viewport>({ x: 0, y: 0, zoom: 0.5 })
    const handler = createTouchHandler(vp, () => rect, { minZoom: 0.1, maxZoom: 4 })

    handler.onTouchStart(
      makeTouchEvent('touchstart', [
        { clientX: 200, clientY: 300 },
        { clientX: 600, clientY: 300 },
      ]),
    )
    // Close to near-zero
    handler.onTouchMove(
      makeTouchEvent('touchmove', [
        { clientX: 399, clientY: 300 },
        { clientX: 401, clientY: 300 },
      ]),
    )
    expect(vp.value.zoom).toBe(0.1)
  })

  it('resets state on touch end', () => {
    const vp = prop<Viewport>({ x: 0, y: 0, zoom: 1 })
    const handler = createTouchHandler(vp, () => rect, { minZoom: 0.1, maxZoom: 4 })

    handler.onTouchStart(
      makeTouchEvent('touchstart', [
        { clientX: 300, clientY: 300 },
        { clientX: 500, clientY: 300 },
      ]),
    )
    handler.onTouchEnd(makeTouchEvent('touchend', []))

    // After end, move should be ignored
    handler.onTouchMove(
      makeTouchEvent('touchmove', [
        { clientX: 100, clientY: 300 },
        { clientX: 700, clientY: 300 },
      ]),
    )
    expect(vp.value.zoom).toBe(1)
  })

  it('fires onZoom callback', () => {
    const vp = prop<Viewport>({ x: 0, y: 0, zoom: 1 })
    let firedZoom: number | null = null
    const handler = createTouchHandler(vp, () => rect, {
      minZoom: 0.1,
      maxZoom: 4,
      onZoom: (z) => {
        firedZoom = z
      },
    })

    handler.onTouchStart(
      makeTouchEvent('touchstart', [
        { clientX: 300, clientY: 300 },
        { clientX: 500, clientY: 300 },
      ]),
    )
    handler.onTouchMove(
      makeTouchEvent('touchmove', [
        { clientX: 200, clientY: 300 },
        { clientX: 600, clientY: 300 },
      ]),
    )
    expect(firedZoom).toBe(2)
  })
})
