import { html, style, Ensure } from '@tempots/dom'
import type { Renderable } from '@tempots/dom'
import { viewMode, initRouter, loadResults } from './state'
import { NavSidebar } from './components/nav-sidebar'
import { GalleryGrid } from './components/gallery-grid'
import { ScenarioPage } from './components/scenario-page'
import { DiffViewer } from './components/diff-viewer'

export function App(): Renderable {
  // Initialize routing and load results
  initRouter()
  loadResults()

  return html.div(
    style.display('flex'),
    style.width('100%'),
    style.height('100vh'),
    style.overflow('hidden'),

    // Sidebar
    NavSidebar(),

    // Main content area
    html.div(
      style.flex('1'),
      style.display('flex'),
      style.flexDirection('column'),
      style.overflow('auto'),

      Ensure(
        viewMode.map((m) => (m === 'gallery' ? true : null)),
        () => GalleryGrid(),
      ),

      Ensure(
        viewMode.map((m) => (m === 'scenario' ? true : null)),
        () => ScenarioPage(),
      ),

      Ensure(
        viewMode.map((m) => (m === 'diff' ? true : null)),
        () => DiffViewer(),
      ),
    ),
  )
}
