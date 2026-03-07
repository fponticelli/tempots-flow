import type { TestScenario } from '../types'

// Single node
import { horizontalPortsScenario } from './single-node/horizontal-ports'
import { verticalPortsScenario } from './single-node/vertical-ports'
import { manyPortsScenario } from './single-node/many-ports'

// Single edge
import { bezierEdgeScenario } from './single-edge/bezier'
import { straightEdgeScenario } from './single-edge/straight'
import { stepEdgeScenario } from './single-edge/step'
import { smoothStepEdgeScenario } from './single-edge/smooth-step'
import { orthogonalEdgeScenario } from './single-edge/orthogonal'
import { bundledEdgeScenario } from './single-edge/bundled'

// Multi-node
import { chainScenario } from './multi-node/chain'
import { diamondScenario } from './multi-node/diamond'

// Port placements
import { allSidesScenario } from './port-placements/all-sides'
import { mixedPlacementScenario } from './port-placements/mixed'

// States
import { selectedNodeScenario } from './states/selected-node'
import { selectedEdgeScenario } from './states/selected-edge'

// Markers
import { arrowMarkersScenario } from './markers/arrow-markers'

// Layouts
import { hierarchicalLRScenario } from './layouts/hierarchical-lr'
import { hierarchicalTBScenario } from './layouts/hierarchical-tb'
import { gridLayoutScenario } from './layouts/grid-layout'
import { treeLayoutScenario } from './layouts/tree-layout'

// Edge paths
import { bezierPathScenarios } from './edge-paths/bezier-paths'
import { straightPathScenarios } from './edge-paths/straight-paths'
import { stepPathScenarios } from './edge-paths/step-paths'
import { smoothStepPathScenarios } from './edge-paths/smooth-step-paths'
import { orthogonalPathScenarios } from './edge-paths/orthogonal-paths'
import { bundledPathScenarios } from './edge-paths/bundled-paths'
import { fanOutScenario } from './edge-paths/fan-out'
import { fanInScenario } from './edge-paths/fan-in'
import { bidirectionalScenario as bidirectionalPathScenario } from './edge-paths/bidirectional'
import { longDistanceScenario } from './edge-paths/long-distance'

// Obstacles
import { bezierObstacleScenario } from './obstacles/bezier-obstacle'
import { straightObstacleScenario } from './obstacles/straight-obstacle'
import { stepObstacleScenario } from './obstacles/step-obstacle'
import { smoothStepObstacleScenario } from './obstacles/smooth-step-obstacle'
import { orthogonalObstacleScenario } from './obstacles/orthogonal-obstacle'
import { bundledObstacleScenario } from './obstacles/bundled-obstacle'
import { bezierObstacleRLScenario } from './obstacles/bezier-obstacle-rl'
import { bezierObstacleTBScenario } from './obstacles/bezier-obstacle-tb'
import { bezierObstacleBTScenario } from './obstacles/bezier-obstacle-bt'
import { bezierObstacleVerticalLRScenario } from './obstacles/bezier-obstacle-vertical-lr'
import { bezierObstacleVerticalRLScenario } from './obstacles/bezier-obstacle-vertical-rl'
import { bezierObstacleVerticalTBScenario } from './obstacles/bezier-obstacle-vertical-tb'
import { bezierObstacleVerticalBTScenario } from './obstacles/bezier-obstacle-vertical-bt'

export const allScenarios: readonly TestScenario[] = [
  // Single node
  horizontalPortsScenario,
  verticalPortsScenario,
  manyPortsScenario,

  // Single edge
  bezierEdgeScenario,
  straightEdgeScenario,
  stepEdgeScenario,
  smoothStepEdgeScenario,
  orthogonalEdgeScenario,
  bundledEdgeScenario,

  // Multi-node
  chainScenario,
  diamondScenario,

  // Port placements
  allSidesScenario,
  mixedPlacementScenario,

  // States
  selectedNodeScenario,
  selectedEdgeScenario,

  // Markers
  arrowMarkersScenario,

  // Layouts
  hierarchicalLRScenario,
  hierarchicalTBScenario,
  gridLayoutScenario,
  treeLayoutScenario,

  // Edge paths
  ...bezierPathScenarios,
  ...straightPathScenarios,
  ...stepPathScenarios,
  ...smoothStepPathScenarios,
  ...orthogonalPathScenarios,
  ...bundledPathScenarios,
  fanOutScenario,
  fanInScenario,
  bidirectionalPathScenario,
  longDistanceScenario,

  // Obstacles
  bezierObstacleScenario,
  straightObstacleScenario,
  stepObstacleScenario,
  smoothStepObstacleScenario,
  orthogonalObstacleScenario,
  bundledObstacleScenario,
  bezierObstacleRLScenario,
  bezierObstacleTBScenario,
  bezierObstacleBTScenario,
  bezierObstacleVerticalLRScenario,
  bezierObstacleVerticalRLScenario,
  bezierObstacleVerticalTBScenario,
  bezierObstacleVerticalBTScenario,
]

export const scenariosByCategory = new Map(
  [...new Set(allScenarios.map((s) => s.category))].map((cat) => [
    cat,
    allScenarios.filter((s) => s.category === cat),
  ]),
)

export const scenarioById = new Map(
  allScenarios.map((s) => [s.id, s]),
)
