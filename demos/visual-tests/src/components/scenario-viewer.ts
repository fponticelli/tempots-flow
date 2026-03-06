import { html, style, dataAttr } from '@tempots/dom'
import type { TNode } from '@tempots/dom'
import { prop } from '@tempots/core'
import { createFlow } from '@tempots/flow'
import { manualLayout } from '@tempots/flow/layouts'
import { createBezierStrategy } from '@tempots/flow/edges'
import type { TestScenario } from '../types'
import '@tempots/flow/css'

export function ScenarioViewer(scenario: TestScenario): TNode {
  const { width, height } = scenario.containerSize ?? {
    width: 800,
    height: 600,
  }

  const graphProp = prop(scenario.graph)

  const flow = createFlow({
    graph: graphProp,
    edgeRouting: scenario.config.edgeRouting ?? createBezierStrategy(),
    layout: scenario.config.layout ?? manualLayout,
    portPlacement: scenario.config.portPlacement ?? 'horizontal',
    edgeMarkers: scenario.config.edgeMarkers,
    viewport: scenario.config.viewport ?? { x: 0, y: 0, zoom: 1 },
    grid: scenario.config.grid === undefined ? false : scenario.config.grid,
    fitViewOnInit: scenario.config.fitViewOnInit ?? true,
    fitViewPadding: 40,
    initialPositions: scenario.config.initialPositions,
    controls: false,
    minimap: false,
    panEnabled: false,
    zoomEnabled: false,
    nodesDraggable: false,
    nodesSelectable: true,
    edgesSelectable: true,
    keyboardEnabled: false,
  })

  // Apply post-render interactions
  if (scenario.interactions) {
    for (const interaction of scenario.interactions) {
      switch (interaction.type) {
        case 'select-nodes':
          setTimeout(() => flow.selectNodes(interaction.nodeIds), 100)
          break
        case 'select-edges':
          setTimeout(() => flow.selectEdges(interaction.edgeIds), 100)
          break
      }
    }
  }

  return html.div(
    dataAttr('scenario-id', scenario.id),
    style.width(`${width}px`),
    style.height(`${height}px`),
    style.position('relative'),
    style.overflow('hidden'),
    style.border('1px solid #333'),
    style.borderRadius('4px'),
    style.background('#1a1a2e'),

    flow.renderable,
  )
}
