import { test, expect } from '@playwright/test'

/**
 * E2E test that loads the visual demo and verifies that every edge endpoint
 * (the start/end of the SVG path) aligns with its corresponding port dot
 * in the DOM.
 *
 * The test extracts:
 * 1. Each port dot's screen-space center (from getBoundingClientRect)
 * 2. Each edge path's start/end coordinates (parsed from the SVG `d` attribute)
 *    converted to screen-space via the SVG's getScreenCTM()
 *
 * If the difference exceeds a threshold, the test fails — reproducing the
 * visual mismatch seen in the bug report.
 */
test.describe('Port dot ↔ edge endpoint alignment', () => {
  test('every edge endpoint should align with its port dot', async ({ page }) => {
    await page.goto('/')
    // Wait for the flow to render and layout to settle
    await page.waitForSelector('.flow-node-wrapper', { timeout: 10000 })
    // Allow layout transitions and port measurements to complete
    await page.waitForTimeout(1000)

    const mismatches = await page.evaluate(() => {
      const results: {
        edgeId: string
        end: 'source' | 'target'
        portId: string
        nodeId: string
        dotScreen: { x: number; y: number }
        edgeScreen: { x: number; y: number }
        delta: number
      }[] = []

      // --- 1. Collect port dot screen positions ---
      // Map: "nodeId:portId" → { x, y } screen center
      const portDotPositions = new Map<string, { x: number; y: number }>()
      const portElements = document.querySelectorAll<HTMLElement>('.flow-port')
      for (const portEl of portElements) {
        const portId = portEl.dataset.portid
        if (!portId) continue
        const nodeWrapper = portEl.closest<HTMLElement>('.flow-node-wrapper')
        if (!nodeWrapper) continue
        // Find the node ID from the wrapper's data or by looking at the Tempo signal
        // We'll derive it from the port's data attributes or DOM structure
        const dot = portEl.querySelector<HTMLElement>('.flow-port-dot')
        if (!dot) continue
        const dotRect = dot.getBoundingClientRect()
        const cx = dotRect.left + dotRect.width / 2
        const cy = dotRect.top + dotRect.height / 2
        // We need a way to associate this with a nodeId.
        // The edge paths reference source/target by nodeId+portId.
        // Let's store by the wrapper element reference for later matching.
        portDotPositions.set(`${portEl.closest('.flow-node-wrapper')?.id ?? ''}:${portId}`, {
          x: cx,
          y: cy,
        })
      }

      // --- 2. Build a map from wrapper index to node ID ---
      // We can't directly get the node ID from DOM without Tempo internals.
      // Instead, we'll match edge endpoints to the NEAREST port dot.

      // --- 3. Extract edge path endpoints in screen space ---
      const svgLayer = document.querySelector<SVGSVGElement>('.flow-edge-layer')
      if (!svgLayer) return results

      const ctm = svgLayer.getScreenCTM()
      if (!ctm) return results

      // Convert SVG user-space point to screen space
      function svgToScreen(x: number, y: number): { x: number; y: number } {
        return {
          x: ctm!.a * x + ctm!.c * y + ctm!.e,
          y: ctm!.b * x + ctm!.d * y + ctm!.f,
        }
      }

      // Parse the first and last point from an SVG path `d` attribute
      function parseEndpoints(
        d: string,
      ): { start: { x: number; y: number }; end: { x: number; y: number } } | null {
        // Match M x y at the start
        const mMatch = d.match(/^M\s+([-\d.]+)\s+([-\d.]+)/)
        if (!mMatch) return null
        const start = { x: parseFloat(mMatch[1]!), y: parseFloat(mMatch[2]!) }

        // Find the last coordinate pair — look for the last two numbers
        const allNumbers = d.match(/[-\d.]+/g)
        if (!allNumbers || allNumbers.length < 2) return null
        const end = {
          x: parseFloat(allNumbers[allNumbers.length - 2]!),
          y: parseFloat(allNumbers[allNumbers.length - 1]!),
        }
        return { start, end }
      }

      // Get all edge paths (the visible ones, not hitboxes)
      const edgePaths = svgLayer.querySelectorAll<SVGPathElement>('path.flow-edge')
      const allDots = Array.from(document.querySelectorAll<HTMLElement>('.flow-port-dot'))

      for (const pathEl of edgePaths) {
        const d = pathEl.getAttribute('d')
        if (!d) continue

        // Get the edge group to find edge ID
        const group = pathEl.closest<SVGGElement>('.flow-edge-group')
        const edgeId = group?.dataset?.edgeid ?? 'unknown'

        const endpoints = parseEndpoints(d)
        if (!endpoints) continue

        const startScreen = svgToScreen(endpoints.start.x, endpoints.start.y)
        const endScreen = svgToScreen(endpoints.end.x, endpoints.end.y)

        // Find the closest port dot to each endpoint
        for (const [label, edgeScreen] of [
          ['source', startScreen],
          ['target', endScreen],
        ] as const) {
          let bestDot: HTMLElement | null = null
          let bestDist = Infinity
          let bestCenter = { x: 0, y: 0 }

          for (const dot of allDots) {
            const r = dot.getBoundingClientRect()
            const cx = r.left + r.width / 2
            const cy = r.top + r.height / 2
            const dist = Math.hypot(cx - edgeScreen.x, cy - edgeScreen.y)
            if (dist < bestDist) {
              bestDist = dist
              bestDot = dot
              bestCenter = { x: cx, y: cy }
            }
          }

          // Only report mismatches within a reasonable radius — if the nearest
          // dot is very far away the target node is likely culled (off-screen)
          if (bestDot && bestDist > 3 && bestDist < 50) {
            const portEl = bestDot.closest<HTMLElement>('.flow-port')
            const portId = portEl?.dataset.portid ?? 'unknown'
            const nodeWrapper = bestDot.closest<HTMLElement>('.flow-node-wrapper')
            // Try to get node label from header text
            const header = nodeWrapper?.querySelector('.flow-node-header')
            const nodeId = header?.textContent?.trim() ?? 'unknown'

            results.push({
              edgeId,
              end: label,
              portId,
              nodeId,
              dotScreen: {
                x: Math.round(bestCenter.x * 10) / 10,
                y: Math.round(bestCenter.y * 10) / 10,
              },
              edgeScreen: {
                x: Math.round(edgeScreen.x * 10) / 10,
                y: Math.round(edgeScreen.y * 10) / 10,
              },
              delta: Math.round(bestDist * 10) / 10,
            })
          }
        }
      }

      return results
    })

    // Log all mismatches for diagnosis
    if (mismatches.length > 0) {
      console.log('\n=== Port-Edge Alignment Mismatches ===')
      for (const m of mismatches) {
        console.log(
          `  edge=${m.edgeId} ${m.end}: node="${m.nodeId}" port="${m.portId}"`,
          `dot=(${m.dotScreen.x}, ${m.dotScreen.y})`,
          `edge=(${m.edgeScreen.x}, ${m.edgeScreen.y})`,
          `delta=${m.delta}px`,
        )
      }
      console.log('======================================\n')
    }

    // The test fails if ANY edge endpoint is more than 3px from its nearest port dot
    expect(mismatches.length, `${mismatches.length} edge endpoints misaligned with port dots`).toBe(
      0,
    )
  })

  test('compare signal data with DOM and SVG', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('.flow-node-wrapper', { timeout: 10000 })
    await page.waitForTimeout(1500)

    const diagnostics = await page.evaluate(() => {
      const flow = (window as unknown as Record<string, unknown>).__FLOW__ as {
        graph: {
          value: {
            nodes: { id: string; ports: { id: string; direction: string }[] }[]
            edges: {
              id: string
              source: { nodeId: string; portId: string }
              target: { nodeId: string; portId: string }
            }[]
          }
        }
        getNodePosition: (id: string) => { value: { x: number; y: number } }
        getNodeDimensions: (id: string) => { value: { width: number; height: number } }
        edgePaths: {
          value: {
            edgeId: string
            d: string
            sourcePoint: { x: number; y: number; side: string }
            targetPoint: { x: number; y: number; side: string }
          }[]
        }
        portOffsets: {
          value: ReadonlyMap<
            string,
            ReadonlyMap<string, { offsetX: number; offsetY: number; side: string }>
          >
        }
      }
      if (!flow) return { error: 'flow not found on window' }

      const g = flow.graph.value
      const nodeData: Record<
        string,
        {
          signalPos: { x: number; y: number }
          signalDims: { width: number; height: number }
          cssPos: { x: number; y: number } | null
          domDims: { width: number; height: number } | null
        }
      > = {}

      // Get signal positions vs CSS transform positions
      for (const node of g.nodes) {
        const sigPos = flow.getNodePosition(node.id).value
        const sigDims = flow.getNodeDimensions(node.id).value

        // Find the DOM wrapper with matching header text
        let cssPos: { x: number; y: number } | null = null
        let domDims: { width: number; height: number } | null = null
        const wrappers = document.querySelectorAll<HTMLElement>('.flow-node-wrapper')
        for (const w of wrappers) {
          const header = w.querySelector('.flow-node-header')
          // Can't match by header text to nodeId reliably. Instead use the CSS transform.
          const transform = w.style.transform
          const m = transform.match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)/)
          if (m) {
            const tx = parseFloat(m[1]!)
            const ty = parseFloat(m[2]!)
            // Check if this wrapper's position matches the signal position
            if (Math.abs(tx - sigPos.x) < 1 && Math.abs(ty - sigPos.y) < 1) {
              cssPos = { x: tx, y: ty }
              domDims = { width: w.offsetWidth, height: w.offsetHeight }
              break
            }
          }
        }

        nodeData[node.id] = { signalPos: sigPos, signalDims: sigDims, cssPos, domDims }
      }

      // Get edge path data from signal
      const edgeData = flow.edgePaths.value.map((ep) => ({
        edgeId: ep.edgeId,
        sourcePoint: ep.sourcePoint,
        targetPoint: ep.targetPoint,
        dStart: (() => {
          const m = ep.d.match(/^M\s+([-\d.]+)\s+([-\d.]+)/)
          return m ? { x: parseFloat(m[1]!), y: parseFloat(m[2]!) } : null
        })(),
        dEnd: (() => {
          const nums = ep.d.match(/[-\d.]+/g)
          return nums && nums.length >= 4
            ? { x: parseFloat(nums[nums.length - 2]!), y: parseFloat(nums[nums.length - 1]!) }
            : null
        })(),
        source: g.edges.find((e) => e.id === ep.edgeId)?.source,
        target: g.edges.find((e) => e.id === ep.edgeId)?.target,
      }))

      // Get port dot positions in flow-space from DOM
      const portDotFlowPositions: Record<string, Record<string, { x: number; y: number }>> = {}
      for (const node of g.nodes) {
        const info = nodeData[node.id]
        if (!info?.cssPos) continue
        const wrapper = Array.from(
          document.querySelectorAll<HTMLElement>('.flow-node-wrapper'),
        ).find((w) => {
          const m = w.style.transform.match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)/)
          if (!m) return false
          return (
            Math.abs(parseFloat(m[1]!) - info.signalPos.x) < 1 &&
            Math.abs(parseFloat(m[2]!) - info.signalPos.y) < 1
          )
        })
        if (!wrapper) continue
        const wrapperRect = wrapper.getBoundingClientRect()
        const scale = wrapper.offsetWidth > 0 ? wrapperRect.width / wrapper.offsetWidth : 1
        const ports: Record<string, { x: number; y: number }> = {}
        for (const portEl of wrapper.querySelectorAll<HTMLElement>('.flow-port')) {
          const pid = portEl.dataset.portid
          if (!pid) continue
          const dot = portEl.querySelector<HTMLElement>('.flow-port-dot')
          if (!dot) continue
          const dotRect = dot.getBoundingClientRect()
          const offX = (dotRect.left + dotRect.width / 2 - wrapperRect.left) / scale
          const offY = (dotRect.top + dotRect.height / 2 - wrapperRect.top) / scale
          ports[pid] = { x: info.signalPos.x + offX, y: info.signalPos.y + offY }
        }
        portDotFlowPositions[node.id] = ports
      }

      // Get stored port offsets from signal
      const storedPortOffsets: Record<
        string,
        Record<string, { offsetX: number; offsetY: number; side: string }>
      > = {}
      const offsets = flow.portOffsets.value
      for (const [nodeId, portMap] of offsets) {
        const ports: Record<string, { offsetX: number; offsetY: number; side: string }> = {}
        for (const [portId, offset] of portMap) {
          ports[portId] = { offsetX: offset.offsetX, offsetY: offset.offsetY, side: offset.side }
        }
        storedPortOffsets[nodeId] = ports
      }

      // Check if port direction classes are present
      const portClassCheck: { portId: string; classes: string; hasDirection: boolean }[] = []
      for (const portEl of document.querySelectorAll<HTMLElement>('.flow-port')) {
        const pid = portEl.dataset.portid ?? '?'
        portClassCheck.push({
          portId: pid,
          classes: portEl.className,
          hasDirection:
            portEl.classList.contains('flow-port--input') ||
            portEl.classList.contains('flow-port--output'),
        })
      }

      // Test: trigger a re-measurement by programmatically calling it
      // We can't access measurePortDots directly, but we can force a ResizeObserver
      // by temporarily changing node wrapper dimensions
      const remeasuredOffsets: Record<
        string,
        Record<string, { offsetX: number; offsetY: number }>
      > = {}
      for (const wrapper of document.querySelectorAll<HTMLElement>('.flow-node-wrapper')) {
        const header = wrapper.querySelector('.flow-node-header')
        const nodeLabel = header?.textContent?.trim() ?? 'unknown'
        const wrapperRect = wrapper.getBoundingClientRect()
        const scale = wrapper.offsetWidth > 0 ? wrapperRect.width / wrapper.offsetWidth : 1
        const ports: Record<string, { offsetX: number; offsetY: number }> = {}
        for (const dot of wrapper.querySelectorAll<HTMLElement>('.flow-port-dot')) {
          const portEl = dot.closest<HTMLElement>('.flow-port')
          if (!portEl) continue
          const pid = portEl.dataset.portid
          if (!pid) continue
          const dotRect = dot.getBoundingClientRect()
          const offX = (dotRect.left + dotRect.width / 2 - wrapperRect.left) / scale
          const offY = (dotRect.top + dotRect.height / 2 - wrapperRect.top) / scale
          ports[pid] = { offsetX: offX, offsetY: offY }
        }
        // Find the nodeId by matching positions
        for (const node of g.nodes) {
          const sp = flow.getNodePosition(node.id).value
          const m = wrapper.style.transform.match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)/)
          if (
            m &&
            Math.abs(parseFloat(m[1]!) - sp.x) < 1 &&
            Math.abs(parseFloat(m[2]!) - sp.y) < 1
          ) {
            remeasuredOffsets[node.id] = ports
            break
          }
        }
      }

      return {
        nodeData,
        edgeData,
        portDotFlowPositions,
        storedPortOffsets,
        portClassCheck,
        remeasuredOffsets,
      }
    })

    if ('error' in diagnostics) {
      console.log('ERROR:', diagnostics.error)
      expect(diagnostics.error).toBeUndefined()
      return
    }

    console.log('\n=== SIGNAL vs DOM COMPARISON ===')

    console.log('\n--- Node Signal Positions vs CSS Positions ---')
    for (const [nodeId, data] of Object.entries(diagnostics.nodeData)) {
      const sp = data.signalPos
      const cp = data.cssPos
      const sd = data.signalDims
      const dd = data.domDims
      const posMatch = cp ? Math.abs(sp.x - cp.x) < 1 && Math.abs(sp.y - cp.y) < 1 : false
      const dimsMatch = dd ? sd.width === dd.width && sd.height === dd.height : false
      console.log(
        `  ${nodeId}: signal=(${sp.x}, ${sp.y}) css=${cp ? `(${cp.x}, ${cp.y})` : 'NOT_FOUND'}`,
        posMatch ? 'POS_OK' : 'POS_MISMATCH',
        `dims: signal=${sd.width}×${sd.height} dom=${dd ? `${dd.width}×${dd.height}` : 'N/A'}`,
        dimsMatch ? 'DIMS_OK' : 'DIMS_MISMATCH',
      )
    }

    console.log('\n--- Stored Port Offsets vs DOM-Measured Offsets ---')
    for (const [nodeId, data] of Object.entries(diagnostics.nodeData)) {
      const stored = diagnostics.storedPortOffsets[nodeId]
      const domPorts = diagnostics.portDotFlowPositions[nodeId]
      if (!stored && !domPorts) continue
      const sp = data.signalPos
      console.log(`  ${nodeId} (pos=${sp.x},${sp.y}):`)
      const allPortIds = new Set([...Object.keys(stored ?? {}), ...Object.keys(domPorts ?? {})])
      for (const portId of allPortIds) {
        const s = stored?.[portId]
        const d = domPorts?.[portId]
        const domOff = d ? { x: d.x - sp.x, y: d.y - sp.y } : null
        console.log(
          `    ${portId}: stored=(${s ? s.offsetX.toFixed(1) + ',' + s.offsetY.toFixed(1) + ' ' + s.side : 'N/A'})`,
          `dom=(${domOff ? domOff.x.toFixed(1) + ',' + domOff.y.toFixed(1) : 'N/A'})`,
          s && domOff
            ? `delta=(${(s.offsetX - domOff.x).toFixed(1)}, ${(s.offsetY - domOff.y).toFixed(1)})`
            : '',
        )
      }
    }

    console.log('\n--- Edge Source/Target Points vs Port Dot Positions ---')
    for (const edge of diagnostics.edgeData) {
      const srcPortPos =
        diagnostics.portDotFlowPositions[edge.source?.nodeId ?? '']?.[edge.source?.portId ?? '']
      const tgtPortPos =
        diagnostics.portDotFlowPositions[edge.target?.nodeId ?? '']?.[edge.target?.portId ?? '']

      const srcDelta = srcPortPos
        ? Math.hypot(edge.sourcePoint.x - srcPortPos.x, edge.sourcePoint.y - srcPortPos.y)
        : -1
      const tgtDelta = tgtPortPos
        ? Math.hypot(edge.targetPoint.x - tgtPortPos.x, edge.targetPoint.y - tgtPortPos.y)
        : -1

      // Also check d attribute start/end vs sourcePoint/targetPoint
      const dStartDelta = edge.dStart
        ? Math.hypot(edge.sourcePoint.x - edge.dStart.x, edge.sourcePoint.y - edge.dStart.y)
        : -1
      const dEndDelta = edge.dEnd
        ? Math.hypot(edge.targetPoint.x - edge.dEnd.x, edge.targetPoint.y - edge.dEnd.y)
        : -1

      console.log(
        `  ${edge.edgeId}: ${edge.source?.nodeId}:${edge.source?.portId} → ${edge.target?.nodeId}:${edge.target?.portId}`,
      )
      console.log(
        `    sourcePoint=(${edge.sourcePoint.x.toFixed(1)}, ${edge.sourcePoint.y.toFixed(1)})`,
        srcPortPos
          ? `dotFlow=(${srcPortPos.x.toFixed(1)}, ${srcPortPos.y.toFixed(1)}) delta=${srcDelta.toFixed(1)}`
          : 'NO_DOT',
        `d_start=(${edge.dStart?.x.toFixed(1)}, ${edge.dStart?.y.toFixed(1)}) d_delta=${dStartDelta.toFixed(1)}`,
      )
      console.log(
        `    targetPoint=(${edge.targetPoint.x.toFixed(1)}, ${edge.targetPoint.y.toFixed(1)})`,
        tgtPortPos
          ? `dotFlow=(${tgtPortPos.x.toFixed(1)}, ${tgtPortPos.y.toFixed(1)}) delta=${tgtDelta.toFixed(1)}`
          : 'NO_DOT',
        `d_end=(${edge.dEnd?.x.toFixed(1)}, ${edge.dEnd?.y.toFixed(1)}) d_delta=${dEndDelta.toFixed(1)}`,
      )
    }
    console.log('=================================\n')

    // Check that sourcePoint/targetPoint match the d attribute start/end
    for (const edge of diagnostics.edgeData) {
      if (edge.dStart) {
        const delta = Math.hypot(
          edge.sourcePoint.x - edge.dStart.x,
          edge.sourcePoint.y - edge.dStart.y,
        )
        expect(delta, `${edge.edgeId} sourcePoint vs d start`).toBeLessThan(1)
      }
    }
  })
})
