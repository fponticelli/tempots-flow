import { defineConfig } from 'vite'
import fs from 'node:fs'
import path from 'node:path'

function approvalApiPlugin() {
  return {
    name: 'visual-test-approval-api',
    configureServer(server: { middlewares: { use: Function } }) {
      server.middlewares.use(
        '/api/results',
        (_req: { method?: string }, res: { setHeader: Function; end: Function; statusCode?: number }) => {
          const resultsPath = path.resolve(__dirname, '../../e2e/visual-regression-results.json')
          if (fs.existsSync(resultsPath)) {
            res.setHeader('Content-Type', 'application/json')
            res.end(fs.readFileSync(resultsPath, 'utf-8'))
          } else {
            res.setHeader('Content-Type', 'application/json')
            res.end('[]')
          }
        },
      )

      server.middlewares.use(
        '/api/approve',
        (
          req: { method?: string; url?: string },
          res: { statusCode?: number; end: Function },
        ) => {
          if (req.method !== 'POST') {
            res.statusCode = 405
            res.end()
            return
          }
          const scenarioId = req.url?.replace(/^\//, '')
          if (!scenarioId) {
            res.statusCode = 400
            res.end()
            return
          }
          const currentPath = path.resolve(
            __dirname,
            `../../e2e/current/${scenarioId}.png`,
          )
          const baselinePath = path.resolve(
            __dirname,
            `../../e2e/baselines/${scenarioId}.png`,
          )
          if (fs.existsSync(currentPath)) {
            fs.mkdirSync(path.dirname(baselinePath), { recursive: true })
            fs.copyFileSync(currentPath, baselinePath)
            res.end('ok')
          } else {
            res.statusCode = 404
            res.end('current not found')
          }
        },
      )

      server.middlewares.use(
        '/screenshots',
        (
          req: { url?: string },
          res: { setHeader: Function; statusCode?: number; end: Function },
        ) => {
          const filePath = path.resolve(
            __dirname,
            '../../e2e',
            req.url?.slice(1) ?? '',
          )
          if (fs.existsSync(filePath) && filePath.endsWith('.png')) {
            res.setHeader('Content-Type', 'image/png')
            res.end(fs.readFileSync(filePath))
          } else {
            res.statusCode = 404
            res.end()
          }
        },
      )
    },
  }
}

export default defineConfig({
  server: {
    port: 3010,
    strictPort: true,
  },
  plugins: [approvalApiPlugin()],
})
