import { render, html, style } from '@tempots/dom'
import '@tempots/flow/css'

const params = new URLSearchParams(window.location.search)
const mode = params.get('mode')
const scenarioId = params.get('scenario')

if (mode === 'capture' && scenarioId) {
  // Capture mode: render a single scenario with no chrome
  // Dynamic import to keep this path lean
  import('./scenarios').then(({ scenarioById }) => {
    import('./components/scenario-viewer').then(({ ScenarioViewer }) => {
      const scenario = scenarioById.get(scenarioId)
      if (scenario) {
        render(
          html.div(
            style.display('flex'),
            style.alignItems('center'),
            style.justifyContent('center'),
            style.width('100vw'),
            style.height('100vh'),
            style.background('#1a1a2e'),

            ScenarioViewer(scenario),
          ),
          '#app',
        )
      } else {
        render(
          html.div(
            style.padding('20px'),
            style.color('#ff4444'),
            `Scenario not found: ${scenarioId}`,
          ),
          '#app',
        )
      }
    })
  })
} else {
  // Gallery mode: full app with navigation
  import('./app').then(({ App }) => {
    render(App(), '#app')
  })
}
