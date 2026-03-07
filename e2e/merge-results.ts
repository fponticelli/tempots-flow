import fs from 'node:fs'
import path from 'node:path'

const RESULTS_DIR = path.resolve('e2e/.results-parts')
const RESULTS_PATH = path.resolve('e2e/visual-regression-results.json')

export default function globalTeardown() {
  if (!fs.existsSync(RESULTS_DIR)) return
  const files = fs.readdirSync(RESULTS_DIR).filter((f) => f.endsWith('.json'))
  if (files.length === 0) return

  const merged = files.map((f) => JSON.parse(fs.readFileSync(path.join(RESULTS_DIR, f), 'utf-8')))
  fs.writeFileSync(RESULTS_PATH, JSON.stringify(merged, null, 2))
  fs.rmSync(RESULTS_DIR, { recursive: true, force: true })
}
