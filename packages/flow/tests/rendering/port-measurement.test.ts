import { describe, it, expect } from 'vitest'
import type { PortOffset, ComputedPortPosition, PortSide } from '../../src/types/layout'

/**
 * Reproduces the port-dot measurement logic from node-wrapper.ts.
 * Extracted here so we can test with controlled DOM geometry.
 */
function measurePortDots(
  el: HTMLElement,
): Map<string, PortOffset> {
  const offsets = new Map<string, PortOffset>()
  const dots = el.querySelectorAll<HTMLElement>('.flow-port-dot')
  for (const dot of dots) {
    const portEl = dot.closest<HTMLElement>('.flow-port')
    if (!portEl) continue
    const portId = portEl.dataset.portid
    if (!portId) continue
    const dotRect = dot.getBoundingClientRect()
    const nodeRect = el.getBoundingClientRect()
    const nodeW = el.offsetWidth
    const nodeH = el.offsetHeight
    // Current code from node-wrapper.ts:
    const scale = nodeW > 0 ? nodeRect.width / nodeW : 1
    const offsetX = (dotRect.left + dotRect.width / 2 - nodeRect.left) / scale
    const offsetY = (dotRect.top + dotRect.height / 2 - nodeRect.top) / scale
    const direction = portEl.dataset.portdirection
    let side: PortSide
    if (direction === 'input') {
      side = Math.abs(offsetX) <= Math.abs(offsetY) ? 'left' : 'top'
    } else if (direction === 'output') {
      side = Math.abs(offsetX - nodeW) <= Math.abs(offsetY - nodeH) ? 'right' : 'bottom'
    } else {
      const dL = Math.abs(offsetX)
      const dR = Math.abs(offsetX - nodeW)
      const dT = Math.abs(offsetY)
      const dB = Math.abs(offsetY - nodeH)
      const minD = Math.min(dL, dR, dT, dB)
      side = minD === dL ? 'left' : minD === dR ? 'right' : minD === dT ? 'top' : 'bottom'
    }
    offsets.set(portId, { offsetX, offsetY, side })
  }
  return offsets
}

/**
 * Reproduces the port-position logic from compute-edge-paths.ts:
 * final position = nodePos + measured offset
 */
function computeEdgeEndpoint(
  nodePos: { x: number; y: number },
  offset: PortOffset,
): ComputedPortPosition {
  return {
    x: nodePos.x + offset.offsetX,
    y: nodePos.y + offset.offsetY,
    side: offset.side,
  }
}

// ---- Helpers to build mock DOM elements with controlled geometry ----

interface MockRect {
  left: number
  top: number
  width: number
  height: number
}

function mockBoundingClientRect(el: HTMLElement, rect: MockRect) {
  el.getBoundingClientRect = () => ({
    x: rect.left,
    y: rect.top,
    left: rect.left,
    top: rect.top,
    right: rect.left + rect.width,
    bottom: rect.top + rect.height,
    width: rect.width,
    height: rect.height,
    toJSON: () => ({}),
  })
}

/**
 * Build a mock node-wrapper DOM element with port dots at specified positions.
 *
 * @param nodeRect  The wrapper element's screen-space rect (from getBoundingClientRect)
 * @param nodeW     The wrapper element's unscaled width (offsetWidth)
 * @param nodeH     The wrapper element's unscaled height (offsetHeight)
 * @param ports     Array of { id, direction, dotScreenCenter } where dotScreenCenter
 *                  is the dot's center in screen coordinates (from getBoundingClientRect)
 */
function buildMockNodeElement(
  nodeRect: MockRect,
  nodeW: number,
  nodeH: number,
  ports: { id: string; direction: string; dotScreenCenter: { x: number; y: number }; dotSize?: number }[],
): HTMLElement {
  const wrapper = document.createElement('div')
  wrapper.className = 'flow-node-wrapper'
  Object.defineProperty(wrapper, 'offsetWidth', { value: nodeW })
  Object.defineProperty(wrapper, 'offsetHeight', { value: nodeH })
  mockBoundingClientRect(wrapper, nodeRect)

  for (const port of ports) {
    const portEl = document.createElement('div')
    portEl.className = `flow-port flow-port--${port.direction}`
    portEl.dataset.portid = port.id
    portEl.dataset.portdirection = port.direction

    const dotEl = document.createElement('div')
    dotEl.className = 'flow-port-dot'
    const dotSize = port.dotSize ?? 12
    mockBoundingClientRect(dotEl, {
      left: port.dotScreenCenter.x - dotSize / 2,
      top: port.dotScreenCenter.y - dotSize / 2,
      width: dotSize,
      height: dotSize,
    })

    portEl.appendChild(dotEl)
    wrapper.appendChild(portEl)
  }

  return wrapper
}

// --- CSS layout constants from flow.css ---
// --flow-node-padding: 8px
// --flow-port-size: 12px
// Input dot left: calc(-1 * 8 - 12/2 - 3) = -17px from port element left
// Output dot right: calc(-1 * 8 - 12/2 - 3) = -17px from port element right
// Port dot center offset from edge: -17 + 6 = -11px (half of 12px size)

describe('Port dot measurement → edge endpoint pipeline', () => {
  describe('zoom = 1 (no scaling)', () => {
    // A node at flow position (200, 100) with unscaled size 300×180.
    // At zoom=1, screen rect matches flow rect.
    const nodeFlowPos = { x: 200, y: 100 }
    const nodeW = 300
    const nodeH = 180
    const zoom = 1

    // Screen rect (with hypothetical viewport offset of 50,30)
    const viewportOffset = { x: 50, y: 30 }
    const nodeScreenRect: MockRect = {
      left: viewportOffset.x + nodeFlowPos.x * zoom,
      top: viewportOffset.y + nodeFlowPos.y * zoom,
      width: nodeW * zoom,
      height: nodeH * zoom,
    }

    it('input port dot at left edge: measured offset places edge at dot center', () => {
      // Input port dot is at the left edge of the node.
      // Port dot center in flow-space: (nodeFlowPos.x - 11, nodeFlowPos.y + 50)
      // That means offset from wrapper top-left = (-11, 50)
      const dotFlowX = nodeFlowPos.x - 11  // 11px left of wrapper left edge
      const dotFlowY = nodeFlowPos.y + 50  // 50px below wrapper top

      const dotScreenCenter = {
        x: viewportOffset.x + dotFlowX * zoom,
        y: viewportOffset.y + dotFlowY * zoom,
      }

      const el = buildMockNodeElement(nodeScreenRect, nodeW, nodeH, [
        { id: 'in1', direction: 'input', dotScreenCenter },
      ])

      const offsets = measurePortDots(el)
      const portOffset = offsets.get('in1')!

      // Expected: offsetX = -11 (dot is 11px left of node wrapper)
      // offsetY = 50
      expect(portOffset.offsetX).toBeCloseTo(-11)
      expect(portOffset.offsetY).toBeCloseTo(50)
      expect(portOffset.side).toBe('left')

      // Final edge endpoint should be at the dot's flow-space position
      const endpoint = computeEdgeEndpoint(nodeFlowPos, portOffset)
      expect(endpoint.x).toBeCloseTo(dotFlowX)
      expect(endpoint.y).toBeCloseTo(dotFlowY)
    })

    it('output port dot at right edge: measured offset places edge at dot center', () => {
      // Output port dot center in flow-space: (nodeFlowPos.x + nodeW + 11, nodeFlowPos.y + 50)
      const dotFlowX = nodeFlowPos.x + nodeW + 11
      const dotFlowY = nodeFlowPos.y + 50

      const dotScreenCenter = {
        x: viewportOffset.x + dotFlowX * zoom,
        y: viewportOffset.y + dotFlowY * zoom,
      }

      const el = buildMockNodeElement(nodeScreenRect, nodeW, nodeH, [
        { id: 'out1', direction: 'output', dotScreenCenter },
      ])

      const offsets = measurePortDots(el)
      const portOffset = offsets.get('out1')!

      // Expected: offsetX = nodeW + 11 = 311
      expect(portOffset.offsetX).toBeCloseTo(nodeW + 11)
      expect(portOffset.offsetY).toBeCloseTo(50)
      expect(portOffset.side).toBe('right')

      const endpoint = computeEdgeEndpoint(nodeFlowPos, portOffset)
      expect(endpoint.x).toBeCloseTo(dotFlowX)
      expect(endpoint.y).toBeCloseTo(dotFlowY)
    })

    it('multiple ports: each edge endpoint matches its dot position', () => {
      // Two input ports at different Y positions, one output port
      const ports = [
        {
          id: 'color_a',
          direction: 'input',
          dotFlowOffset: { x: -11, y: 50 },
        },
        {
          id: 'color_b',
          direction: 'input',
          dotFlowOffset: { x: -11, y: 74 },
        },
        {
          id: 'result',
          direction: 'output',
          dotFlowOffset: { x: nodeW + 11, y: 50 },
        },
      ]

      const el = buildMockNodeElement(
        nodeScreenRect,
        nodeW,
        nodeH,
        ports.map((p) => ({
          id: p.id,
          direction: p.direction,
          dotScreenCenter: {
            x: viewportOffset.x + (nodeFlowPos.x + p.dotFlowOffset.x) * zoom,
            y: viewportOffset.y + (nodeFlowPos.y + p.dotFlowOffset.y) * zoom,
          },
        })),
      )

      const offsets = measurePortDots(el)

      for (const p of ports) {
        const offset = offsets.get(p.id)!
        const endpoint = computeEdgeEndpoint(nodeFlowPos, offset)
        const expectedX = nodeFlowPos.x + p.dotFlowOffset.x
        const expectedY = nodeFlowPos.y + p.dotFlowOffset.y
        expect(endpoint.x).toBeCloseTo(expectedX, 1)
        expect(endpoint.y).toBeCloseTo(expectedY, 1)
      }
    })
  })

  describe('zoom = 0.75 (scaled viewport)', () => {
    const nodeFlowPos = { x: 200, y: 100 }
    const nodeW = 300
    const nodeH = 180
    const zoom = 0.75

    const viewportOffset = { x: 50, y: 30 }
    const nodeScreenRect: MockRect = {
      left: viewportOffset.x + nodeFlowPos.x * zoom,
      top: viewportOffset.y + nodeFlowPos.y * zoom,
      width: nodeW * zoom,
      height: nodeH * zoom,
    }

    it('input port dot offset is correctly normalized to flow-space', () => {
      const dotFlowX = nodeFlowPos.x - 11
      const dotFlowY = nodeFlowPos.y + 50

      const dotScreenCenter = {
        x: viewportOffset.x + dotFlowX * zoom,
        y: viewportOffset.y + dotFlowY * zoom,
      }

      const el = buildMockNodeElement(nodeScreenRect, nodeW, nodeH, [
        { id: 'in1', direction: 'input', dotScreenCenter },
      ])

      const offsets = measurePortDots(el)
      const portOffset = offsets.get('in1')!

      expect(portOffset.offsetX).toBeCloseTo(-11)
      expect(portOffset.offsetY).toBeCloseTo(50)

      const endpoint = computeEdgeEndpoint(nodeFlowPos, portOffset)
      expect(endpoint.x).toBeCloseTo(dotFlowX)
      expect(endpoint.y).toBeCloseTo(dotFlowY)
    })

    it('output port dot offset is correctly normalized to flow-space', () => {
      const dotFlowX = nodeFlowPos.x + nodeW + 11
      const dotFlowY = nodeFlowPos.y + 50

      const dotScreenCenter = {
        x: viewportOffset.x + dotFlowX * zoom,
        y: viewportOffset.y + dotFlowY * zoom,
      }

      const el = buildMockNodeElement(nodeScreenRect, nodeW, nodeH, [
        { id: 'out1', direction: 'output', dotScreenCenter },
      ])

      const offsets = measurePortDots(el)
      const portOffset = offsets.get('out1')!

      expect(portOffset.offsetX).toBeCloseTo(nodeW + 11)
      expect(portOffset.offsetY).toBeCloseTo(50)

      const endpoint = computeEdgeEndpoint(nodeFlowPos, portOffset)
      expect(endpoint.x).toBeCloseTo(dotFlowX)
      expect(endpoint.y).toBeCloseTo(dotFlowY)
    })
  })

  describe('zoom = 1.5 (zoomed in)', () => {
    const nodeFlowPos = { x: 200, y: 100 }
    const nodeW = 300
    const nodeH = 180
    const zoom = 1.5

    const viewportOffset = { x: 50, y: 30 }
    const nodeScreenRect: MockRect = {
      left: viewportOffset.x + nodeFlowPos.x * zoom,
      top: viewportOffset.y + nodeFlowPos.y * zoom,
      width: nodeW * zoom,
      height: nodeH * zoom,
    }

    it('port offsets are correct at 1.5x zoom', () => {
      const dotFlowX = nodeFlowPos.x - 11
      const dotFlowY = nodeFlowPos.y + 50

      const dotScreenCenter = {
        x: viewportOffset.x + dotFlowX * zoom,
        y: viewportOffset.y + dotFlowY * zoom,
      }

      const el = buildMockNodeElement(nodeScreenRect, nodeW, nodeH, [
        { id: 'in1', direction: 'input', dotScreenCenter },
      ])

      const offsets = measurePortDots(el)
      const portOffset = offsets.get('in1')!

      expect(portOffset.offsetX).toBeCloseTo(-11)
      expect(portOffset.offsetY).toBeCloseTo(50)

      const endpoint = computeEdgeEndpoint(nodeFlowPos, portOffset)
      expect(endpoint.x).toBeCloseTo(dotFlowX)
      expect(endpoint.y).toBeCloseTo(dotFlowY)
    })
  })

  describe('visual demo: wide node with custom content', () => {
    // Simulate the COLOR node from the visual demo.
    // The node is wider than default due to custom content (color preview).
    // Node is at flow position (100, 200), size 350×160.
    const nodeFlowPos = { x: 100, y: 200 }
    const nodeW = 350
    const nodeH = 160
    const zoom = 1

    const viewportOffset = { x: 50, y: 30 }
    const nodeScreenRect: MockRect = {
      left: viewportOffset.x + nodeFlowPos.x * zoom,
      top: viewportOffset.y + nodeFlowPos.y * zoom,
      width: nodeW * zoom,
      height: nodeH * zoom,
    }

    it('output port on wide node: edge endpoint matches dot center', () => {
      // Output port "Color" — the dot should be at the right edge of the node
      // Dot center at (nodeX + nodeW + 11, nodeY + 55) in flow-space
      const dotFlowX = nodeFlowPos.x + nodeW + 11
      const dotFlowY = nodeFlowPos.y + 55

      const el = buildMockNodeElement(nodeScreenRect, nodeW, nodeH, [
        {
          id: 'color_out',
          direction: 'output',
          dotScreenCenter: {
            x: viewportOffset.x + dotFlowX * zoom,
            y: viewportOffset.y + dotFlowY * zoom,
          },
        },
      ])

      const offsets = measurePortDots(el)
      const portOffset = offsets.get('color_out')!
      const endpoint = computeEdgeEndpoint(nodeFlowPos, portOffset)

      expect(endpoint.x).toBeCloseTo(dotFlowX)
      expect(endpoint.y).toBeCloseTo(dotFlowY)
      expect(portOffset.side).toBe('right')
    })

    it('wide node with 3 inputs + 1 output: all edges connect to dots', () => {
      // COLOR MIX node: inputs (Color A, Color B, Factor) on left, Result on right
      const ports = [
        { id: 'color_a', direction: 'input', dotFlowOffset: { x: -11, y: 48 } },
        { id: 'color_b', direction: 'input', dotFlowOffset: { x: -11, y: 72 } },
        { id: 'factor', direction: 'input', dotFlowOffset: { x: -11, y: 96 } },
        { id: 'result', direction: 'output', dotFlowOffset: { x: nodeW + 11, y: 48 } },
      ]

      const el = buildMockNodeElement(
        nodeScreenRect,
        nodeW,
        nodeH,
        ports.map((p) => ({
          id: p.id,
          direction: p.direction,
          dotScreenCenter: {
            x: viewportOffset.x + (nodeFlowPos.x + p.dotFlowOffset.x) * zoom,
            y: viewportOffset.y + (nodeFlowPos.y + p.dotFlowOffset.y) * zoom,
          },
        })),
      )

      const offsets = measurePortDots(el)

      for (const p of ports) {
        const offset = offsets.get(p.id)
        expect(offset, `Port ${p.id} should be measured`).toBeDefined()

        const endpoint = computeEdgeEndpoint(nodeFlowPos, offset!)
        expect(endpoint.x).toBeCloseTo(nodeFlowPos.x + p.dotFlowOffset.x, 1)
        expect(endpoint.y).toBeCloseTo(nodeFlowPos.y + p.dotFlowOffset.y, 1)

        if (p.direction === 'input') {
          expect(offset!.side).toBe('left')
        } else {
          expect(offset!.side).toBe('right')
        }
      }
    })
  })
})
