import type {
  Graph,
  EdgeRoutingStrategy,
  LayoutAlgorithm,
  PortPlacement,
  EdgeMarkerConfig,
} from '@tempots/flow'

export interface TestScenario {
  readonly id: string
  readonly name: string
  readonly category: string
  readonly description: string
  readonly graph: Graph<unknown, unknown>
  readonly config: Partial<ScenarioConfig>
  readonly containerSize?: { readonly width: number; readonly height: number }
  readonly interactions?: readonly ScenarioInteraction[]
}

export interface ScenarioConfig {
  readonly edgeRouting: EdgeRoutingStrategy
  readonly layout: LayoutAlgorithm
  readonly portPlacement: PortPlacement
  readonly edgeMarkers: boolean | EdgeMarkerConfig
  readonly viewport: { readonly x: number; readonly y: number; readonly zoom: number }
  readonly grid: false | { readonly size: number; readonly type: 'dots' | 'lines' | 'cross' }
  readonly fitViewOnInit: boolean
  readonly initialPositions: ReadonlyMap<string, { readonly x: number; readonly y: number }>
}

export type ScenarioInteraction =
  | { readonly type: 'select-nodes'; readonly nodeIds: readonly string[] }
  | { readonly type: 'select-edges'; readonly edgeIds: readonly string[] }

export type TestStatus = 'pass' | 'fail' | 'new' | 'pending'

export interface TestResult {
  readonly scenarioId: string
  readonly status: TestStatus
  readonly baselinePath: string | null
  readonly currentPath: string | null
  readonly diffPath: string | null
  readonly diffPixelCount: number
  readonly diffPercentage: number
}
