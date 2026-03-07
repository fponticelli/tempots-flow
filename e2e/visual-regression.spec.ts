import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const THRESHOLD = 0.1
const MAX_DIFF_PERCENT = 0.5

const BASELINES_DIR = path.resolve('e2e/baselines')
const CURRENT_DIR = path.resolve('e2e/current')
const DIFFS_DIR = path.resolve('e2e/diffs')
const RESULTS_DIR = path.resolve('e2e/.results-parts')

const scenarioIds = [
  // Single node
  'single-node--horizontal-ports',
  'single-node--vertical-ports',
  'single-node--many-ports',

  // Single edge
  'single-edge--bezier',
  'single-edge--straight',
  'single-edge--step',
  'single-edge--smooth-step',
  'single-edge--orthogonal',
  'single-edge--bundled',

  // Multi-node
  'multi-node--chain',
  'multi-node--diamond',

  // Port placements
  'port-placement--all-sides',
  'port-placement--mixed',

  // States
  'state--selected-node',
  'state--selected-edge',

  // Markers
  'marker--arrows',

  // Layouts
  'layout--hierarchical-lr',
  'layout--hierarchical-tb',
  'layout--grid',
  'layout--tree',

  // Edge paths
  'edge-paths--bezier-lr',
  'edge-paths--bezier-rl',
  'edge-paths--bezier-tb',
  'edge-paths--bezier-bt',
  'edge-paths--straight-lr',
  'edge-paths--straight-rl',
  'edge-paths--straight-tb',
  'edge-paths--straight-bt',
  'edge-paths--step-lr',
  'edge-paths--step-rl',
  'edge-paths--step-tb',
  'edge-paths--step-bt',
  'edge-paths--smooth-step-lr',
  'edge-paths--smooth-step-rl',
  'edge-paths--smooth-step-tb',
  'edge-paths--smooth-step-bt',
  'edge-paths--orthogonal-lr',
  'edge-paths--orthogonal-rl',
  'edge-paths--orthogonal-tb',
  'edge-paths--orthogonal-bt',
  'edge-paths--bundled-lr',
  'edge-paths--bundled-rl',
  'edge-paths--bundled-tb',
  'edge-paths--bundled-bt',
  'edge-paths--fan-out',
  'edge-paths--fan-in',
  'edge-paths--bidirectional',
  'edge-paths--long-distance',

  // Obstacles
  'obstacle--bezier',
  'obstacle--straight',
  'obstacle--step',
  'obstacle--smooth-step',
  'obstacle--orthogonal',
  'obstacle--bundled',
  'obstacle--bezier-rl',
  'obstacle--bezier-tb',
  'obstacle--bezier-bt',
  'obstacle--bezier-vertical-lr',
  'obstacle--bezier-vertical-rl',
  'obstacle--bezier-vertical-tb',
  'obstacle--bezier-vertical-bt',
]

interface TestResult {
  scenarioId: string
  status: 'pass' | 'fail' | 'new'
  diffPixelCount: number
  diffPercentage: number
}

function writeResult(result: TestResult): void {
  fs.mkdirSync(RESULTS_DIR, { recursive: true })
  fs.writeFileSync(path.join(RESULTS_DIR, `${result.scenarioId}.json`), JSON.stringify(result))
}

async function diffAgainstBaseline(
  scenarioId: string,
  currentPath: string,
  threshold: number,
): Promise<TestResult> {
  const baselinePath = path.join(BASELINES_DIR, `${scenarioId}.png`)

  if (!fs.existsSync(baselinePath)) {
    return {
      scenarioId,
      status: 'new',
      diffPixelCount: 0,
      diffPercentage: 0,
    }
  }

  const { PNG } = await import('pngjs')
  const pixelmatch = (await import('pixelmatch')).default

  const baseline = PNG.sync.read(fs.readFileSync(baselinePath))
  const current = PNG.sync.read(fs.readFileSync(currentPath))

  const width = Math.max(baseline.width, current.width)
  const height = Math.max(baseline.height, current.height)

  const diff = new PNG({ width, height })

  const diffPixels = pixelmatch(baseline.data, current.data, diff.data, width, height, {
    threshold,
  })

  const totalPixels = width * height
  const diffPercentage = (diffPixels / totalPixels) * 100
  const diffPath = path.join(DIFFS_DIR, `${scenarioId}.png`)

  fs.mkdirSync(DIFFS_DIR, { recursive: true })
  fs.writeFileSync(diffPath, PNG.sync.write(diff))

  return {
    scenarioId,
    status: diffPixels === 0 ? 'pass' : 'fail',
    diffPixelCount: diffPixels,
    diffPercentage,
  }
}

test.describe('visual regression', () => {
  for (const scenarioId of scenarioIds) {
    test(scenarioId, async ({ page }) => {
      await page.goto(`/?mode=capture&scenario=${scenarioId}`)

      // Wait for the scenario container to render
      await page.waitForSelector(`[data-scenario-id="${scenarioId}"]`, {
        timeout: 10000,
      })

      // Wait for layout transitions and port measurements to settle
      await page.waitForTimeout(1000)

      const container = page.locator(`[data-scenario-id="${scenarioId}"]`)

      fs.mkdirSync(CURRENT_DIR, { recursive: true })
      const currentPath = path.join(CURRENT_DIR, `${scenarioId}.png`)
      await container.screenshot({ path: currentPath })

      const result = await diffAgainstBaseline(scenarioId, currentPath, THRESHOLD)
      writeResult(result)

      if (result.status === 'new') {
        console.log(`NEW: ${scenarioId} — no baseline, screenshot saved`)
        return
      }

      expect(
        result.diffPercentage,
        `${scenarioId}: ${result.diffPercentage.toFixed(2)}% pixels differ`,
      ).toBeLessThan(MAX_DIFF_PERCENT)
    })
  }
})
