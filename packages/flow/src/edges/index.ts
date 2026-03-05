// @tempots/flow/edges — Edge routing strategies

export { createBezierStrategy } from './bezier'
export type { BezierOptions } from './bezier'
export { createStraightStrategy } from './straight'
export type { StraightOptions } from './straight'
export { createStepStrategy } from './step'
export type { StepOptions } from './step'
export { createSmoothStepStrategy } from './smooth-step'
export type { SmoothStepOptions } from './smooth-step'
export { createBundledStrategy } from './bundle'
export type { BundlingOptions } from './bundle'
export { createOrthogonalStrategy } from './orthogonal'
export type { OrthogonalOptions } from './orthogonal'
export { computePortPositionsForNode, computePortPosition } from './port-positions'
export { createEdgePathsSignal } from './compute-edge-paths'

// Collision detection utilities for custom strategy authors
export {
  buildEdgeObstacles,
  buildSelfNodeRects,
  polylineHitsObstacle,
  approximatePathAsPolyline,
  catmullRomThroughWaypoints,
  approximateBezierAsPolyline,
  computeOrthogonalWaypoints,
  computeReroutedBezier,
  waypointsToPath,
} from './obstacle-routing'
export type { Rect as ObstacleRect, Point as RoutePoint } from './obstacle-routing'
