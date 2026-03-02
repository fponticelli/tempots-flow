import type { LayoutAlgorithm } from '../types/config'
import type { Graph } from '../types/graph'
import type { Position, Dimensions } from '../types/layout'

// --- Public types ---

export interface ForceDirectedLayoutOptions {
  readonly repulsion?: number
  readonly attraction?: number
  readonly gravity?: number
  readonly maxIterations?: number
  readonly convergenceThreshold?: number
  readonly pinned?: ReadonlySet<string>
}

// --- Defaults ---

const DEFAULT_REPULSION = 8000
const DEFAULT_ATTRACTION = 0.08
const DEFAULT_GRAVITY = 0.02
const DEFAULT_MAX_ITERATIONS = 300
const DEFAULT_CONVERGENCE_THRESHOLD = 0.5
const DAMPING = 0.85
const DT = 1.0
const DEFAULT_NODE_WIDTH = 180
const DEFAULT_NODE_HEIGHT = 80
const MIN_SEPARATION_PADDING = 40

// --- Internal types ---

interface NodeState {
  x: number
  y: number
  vx: number
  vy: number
  readonly width: number
  readonly height: number
}

interface EdgePair {
  readonly source: string
  readonly target: string
}

// --- Internal helpers ---

/**
 * Seed initial positions for nodes. Nodes present in `currentPositions` keep
 * their coordinates with zero velocity. Remaining nodes are placed in a circle
 * of radius proportional to the total node count and average node size.
 */
function initializeNodeStates(
  nodeIds: readonly string[],
  currentPositions: ReadonlyMap<string, Position>,
  dimensions: ReadonlyMap<string, Dimensions>,
): Map<string, NodeState> {
  const states = new Map<string, NodeState>()

  // Compute average node size for seeding radius
  let totalWidth = 0
  let totalHeight = 0
  for (const id of nodeIds) {
    const dims = dimensions.get(id)
    totalWidth += dims?.width ?? DEFAULT_NODE_WIDTH
    totalHeight += dims?.height ?? DEFAULT_NODE_HEIGHT
  }
  const avgWidth = nodeIds.length > 0 ? totalWidth / nodeIds.length : DEFAULT_NODE_WIDTH
  const avgHeight = nodeIds.length > 0 ? totalHeight / nodeIds.length : DEFAULT_NODE_HEIGHT
  const avgSize = (avgWidth + avgHeight) / 2

  // Circle radius based on node count and size
  const radius = Math.sqrt(nodeIds.length) * avgSize * 1.5

  const unseeded: string[] = []
  for (const id of nodeIds) {
    const pos = currentPositions.get(id)
    const dims = dimensions.get(id)
    const w = dims?.width ?? DEFAULT_NODE_WIDTH
    const h = dims?.height ?? DEFAULT_NODE_HEIGHT
    if (pos) {
      states.set(id, { x: pos.x, y: pos.y, vx: 0, vy: 0, width: w, height: h })
    } else {
      unseeded.push(id)
    }
  }

  for (let i = 0; i < unseeded.length; i++) {
    const id = unseeded[i]!
    const dims = dimensions.get(id)
    const w = dims?.width ?? DEFAULT_NODE_WIDTH
    const h = dims?.height ?? DEFAULT_NODE_HEIGHT
    const angle = (2 * Math.PI * i) / unseeded.length
    states.set(id, {
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
      vx: 0,
      vy: 0,
      width: w,
      height: h,
    })
  }

  return states
}

/** Extract unique edge pairs (source → target node ids) from graph edges. */
function buildEdgePairs(graph: Graph<unknown, unknown>): readonly EdgePair[] {
  return graph.edges.map((e) => ({
    source: e.source.nodeId,
    target: e.target.nodeId,
  }))
}

/**
 * Compute minimum separation between two nodes based on their dimensions.
 * Uses rectangle overlap logic: the ideal center-to-center distance depends
 * on the axis of the delta vector.
 */
function idealSeparation(a: NodeState, b: NodeState): number {
  const dx = Math.abs(a.x - b.x)
  const dy = Math.abs(a.y - b.y)

  // Half-widths and half-heights
  const hw = (a.width + b.width) / 2 + MIN_SEPARATION_PADDING
  const hh = (a.height + b.height) / 2 + MIN_SEPARATION_PADDING

  // Distance ratio — determines how much of the separation is horizontal vs vertical
  const dTotal = dx + dy
  if (dTotal < 1) return Math.max(hw, hh)

  const rx = dx / dTotal
  const ry = dy / dTotal

  return rx * hw + ry * hh
}

/**
 * Apply repulsive forces between all node pairs.
 * Uses dimension-aware repulsion: stronger push when nodes are closer than
 * their ideal separation distance.
 */
function applyRepulsion(
  nodeIds: readonly string[],
  states: Map<string, NodeState>,
  forces: Map<string, { fx: number; fy: number }>,
  repulsion: number,
): void {
  for (let i = 0; i < nodeIds.length; i++) {
    const idA = nodeIds[i]!
    const stateA = states.get(idA)!

    for (let j = i + 1; j < nodeIds.length; j++) {
      const idB = nodeIds[j]!
      const stateB = states.get(idB)!

      let dx = stateA.x - stateB.x
      let dy = stateA.y - stateB.y
      let distSq = dx * dx + dy * dy

      // Guard against singularity
      if (distSq < 1) {
        dx = (Math.random() - 0.5) * 2
        dy = (Math.random() - 0.5) * 2
        distSq = dx * dx + dy * dy
      }

      const dist = Math.sqrt(distSq)
      const minDist = idealSeparation(stateA, stateB)

      // Scale repulsion: stronger when overlapping, weaker when far apart
      let force: number
      if (dist < minDist) {
        // Strong overlap repulsion: linear push proportional to overlap
        const overlap = minDist - dist
        force = repulsion / distSq + overlap * 2
      } else {
        force = repulsion / distSq
      }

      const fx = (dx / dist) * force
      const fy = (dy / dist) * force

      const forceA = forces.get(idA)!
      forceA.fx += fx
      forceA.fy += fy

      const forceB = forces.get(idB)!
      forceB.fx -= fx
      forceB.fy -= fy
    }
  }
}

/**
 * Apply attractive (Hooke spring) forces along edges.
 * Uses a rest length based on node dimensions so connected nodes don't
 * collapse on top of each other.
 */
function applyAttraction(
  edgePairs: readonly EdgePair[],
  states: Map<string, NodeState>,
  forces: Map<string, { fx: number; fy: number }>,
  attraction: number,
): void {
  for (const { source, target } of edgePairs) {
    const stateS = states.get(source)
    const stateT = states.get(target)
    if (!stateS || !stateT) continue

    const dx = stateT.x - stateS.x
    const dy = stateT.y - stateS.y
    const dist = Math.sqrt(dx * dx + dy * dy)

    if (dist < 0.001) continue

    // Rest length: ideal separation between connected nodes
    const restLength = idealSeparation(stateS, stateT)

    // Spring force: pull toward rest length (no force at rest)
    const displacement = dist - restLength
    const force = attraction * displacement

    const fx = (dx / dist) * force
    const fy = (dy / dist) * force

    const forceS = forces.get(source)
    if (forceS) {
      forceS.fx += fx
      forceS.fy += fy
    }

    const forceT = forces.get(target)
    if (forceT) {
      forceT.fx -= fx
      forceT.fy -= fy
    }
  }
}

/**
 * Apply gravitational pull toward the origin (0, 0).
 */
function applyGravity(
  nodeIds: readonly string[],
  states: Map<string, NodeState>,
  forces: Map<string, { fx: number; fy: number }>,
  gravity: number,
): void {
  for (const id of nodeIds) {
    const state = states.get(id)!
    const dist = Math.sqrt(state.x * state.x + state.y * state.y)

    if (dist < 0.001) continue

    const force = gravity * dist
    const fx = (-state.x / dist) * force
    const fy = (-state.y / dist) * force

    const f = forces.get(id)!
    f.fx += fx
    f.fy += fy
  }
}

/**
 * Integrate forces using Velocity Verlet: update velocity with damping, then
 * update position. Pinned nodes are skipped entirely.
 *
 * @returns The maximum position delta across all moved nodes (for convergence check).
 */
function integrate(
  nodeIds: readonly string[],
  states: Map<string, NodeState>,
  forces: Map<string, { fx: number; fy: number }>,
  pinned: ReadonlySet<string>,
): number {
  let maxDelta = 0

  for (const id of nodeIds) {
    if (pinned.has(id)) continue

    const state = states.get(id)!
    const f = forces.get(id)!

    // Update velocity
    state.vx += f.fx * DT
    state.vy += f.fy * DT

    // Apply damping
    state.vx *= DAMPING
    state.vy *= DAMPING

    // Clamp velocity to prevent explosions
    const maxV = 50
    const speed = Math.sqrt(state.vx * state.vx + state.vy * state.vy)
    if (speed > maxV) {
      state.vx = (state.vx / speed) * maxV
      state.vy = (state.vy / speed) * maxV
    }

    // Update position
    const dx = state.vx * DT
    const dy = state.vy * DT
    state.x += dx
    state.y += dy

    const delta = Math.sqrt(dx * dx + dy * dy)
    if (delta > maxDelta) {
      maxDelta = delta
    }
  }

  return maxDelta
}

/** Run the full force-directed simulation and return final positions. */
function simulate(
  nodeIds: readonly string[],
  edgePairs: readonly EdgePair[],
  states: Map<string, NodeState>,
  repulsion: number,
  attraction: number,
  gravity: number,
  maxIterations: number,
  convergenceThreshold: number,
  pinned: ReadonlySet<string>,
): ReadonlyMap<string, Position> {
  for (let iter = 0; iter < maxIterations; iter++) {
    // Initialize force accumulators
    const forces = new Map<string, { fx: number; fy: number }>()
    for (const id of nodeIds) {
      forces.set(id, { fx: 0, fy: 0 })
    }

    // Accumulate all three forces
    applyRepulsion(nodeIds, states, forces, repulsion)
    applyAttraction(edgePairs, states, forces, attraction)
    applyGravity(nodeIds, states, forces, gravity)

    // Integrate and check convergence
    const maxDelta = integrate(nodeIds, states, forces, pinned)
    if (maxDelta < convergenceThreshold) break
  }

  // Extract final positions
  const positions = new Map<string, Position>()
  for (const id of nodeIds) {
    const state = states.get(id)!
    positions.set(id, { x: state.x, y: state.y })
  }

  return positions
}

// --- Public factory ---

/**
 * Creates a force-directed layout algorithm using Velocity Verlet integration.
 *
 * Three forces govern node placement:
 * 1. **Repulsion** (Coulomb-like) — pushes all node pairs apart, accounting for node dimensions
 * 2. **Attraction** (Hooke spring) — pulls connected nodes toward an ideal separation distance
 * 3. **Gravity** — gently pulls all nodes toward the origin
 *
 * The simulation runs iteratively until positions converge (max position delta
 * falls below `convergenceThreshold`) or `maxIterations` is reached. Pinned
 * nodes remain fixed throughout the simulation.
 *
 * @param options - Configuration for force strengths, iteration limits, and pinned nodes
 * @returns A `LayoutAlgorithm` instance with `allowManualPositioning: true`
 *
 * @example
 * ```ts
 * const layout = forceDirectedLayout({ repulsion: 10000, gravity: 0.08 })
 * const positions = layout.layout(graph, dimensions, currentPositions)
 * ```
 */
export function forceDirectedLayout(options?: ForceDirectedLayoutOptions): LayoutAlgorithm {
  const repulsion = options?.repulsion ?? DEFAULT_REPULSION
  const attraction = options?.attraction ?? DEFAULT_ATTRACTION
  const gravity = options?.gravity ?? DEFAULT_GRAVITY
  const maxIterations = options?.maxIterations ?? DEFAULT_MAX_ITERATIONS
  const convergenceThreshold = options?.convergenceThreshold ?? DEFAULT_CONVERGENCE_THRESHOLD
  const pinned = options?.pinned ?? new Set<string>()

  // Track the node/edge signature from the last simulation run.
  // When the graph structure changes, we re-simulate. When only positions
  // change (e.g. drag), we pass through to avoid re-running the simulation.
  let lastGraphSignature = ''

  return {
    allowManualPositioning: true,

    layout(
      graph: Graph<unknown, unknown>,
      dimensions: ReadonlyMap<string, Dimensions>,
      currentPositions: ReadonlyMap<string, Position>,
    ): ReadonlyMap<string, Position> {
      if (graph.nodes.length === 0) {
        lastGraphSignature = ''
        return new Map()
      }

      const nodeIds = graph.nodes.map((n) => n.id)
      const edgeIds = graph.edges.map((e) => e.id)
      const graphSignature = nodeIds.join(',') + '|' + edgeIds.join(',')

      // If graph structure hasn't changed and all nodes have positions,
      // pass through without re-simulating. This prevents re-running the
      // simulation on every drag/position change.
      if (
        graphSignature === lastGraphSignature &&
        nodeIds.every((id) => currentPositions.has(id))
      ) {
        return currentPositions
      }

      lastGraphSignature = graphSignature

      const edgePairs = buildEdgePairs(graph)
      const states = initializeNodeStates(nodeIds, currentPositions, dimensions)

      return simulate(
        nodeIds,
        edgePairs,
        states,
        repulsion,
        attraction,
        gravity,
        maxIterations,
        convergenceThreshold,
        pinned,
      )
    },
  }
}
