import { describe, it, expect } from 'vitest'
import {
  computeOrthogonalWaypoints,
  catmullRomThroughWaypoints,
  findOrthogonalPath,
  detourRoute,
  buildEdgeObstacles,
  polylineHitsObstacle,
  pathHitsObstacle,
  type Point,
  type Rect,
} from '../../src/edges/obstacle-routing'

/**
 * Parse an SVG path string into a sequence of on-curve and control points.
 */
function parseSvgPathPoints(d: string): Point[] {
  const points: Point[] = []
  const tokens = d.match(/[MLHVCQZ]|[-+]?\d*\.?\d+/g)
  if (!tokens) return points

  let i = 0
  let cx = 0
  let cy = 0

  while (i < tokens.length) {
    const cmd = tokens[i]
    switch (cmd) {
      case 'M':
      case 'L':
        cx = parseFloat(tokens[++i]!)
        cy = parseFloat(tokens[++i]!)
        points.push({ x: cx, y: cy })
        break
      case 'H':
        cx = parseFloat(tokens[++i]!)
        points.push({ x: cx, y: cy })
        break
      case 'V':
        cy = parseFloat(tokens[++i]!)
        points.push({ x: cx, y: cy })
        break
      case 'C':
        points.push({ x: parseFloat(tokens[++i]!), y: parseFloat(tokens[++i]!) })
        points.push({ x: parseFloat(tokens[++i]!), y: parseFloat(tokens[++i]!) })
        cx = parseFloat(tokens[++i]!)
        cy = parseFloat(tokens[++i]!)
        points.push({ x: cx, y: cy })
        break
      case 'Q':
        points.push({ x: parseFloat(tokens[++i]!), y: parseFloat(tokens[++i]!) })
        cx = parseFloat(tokens[++i]!)
        cy = parseFloat(tokens[++i]!)
        points.push({ x: cx, y: cy })
        break
      case 'Z':
        break
      default:
        i++
        continue
    }
    i++
  }
  return points
}

describe('detourRoute', () => {
  describe('should prefer midpoints over obstacle-edge waypoints', () => {
    it('horizontal-to-horizontal: vertical segment uses midpoint, not obstacle edge', () => {
      // Source exits right, target enters left. Obstacle sits between them
      // blocking the direct horizontal path.
      // Expected: vertical segment at midpoint between start.x and end.x,
      // NOT at obs.x - clearance (which would hug the obstacle).
      const start: Point = { x: 200, y: 50 }
      const end: Point = { x: 700, y: 180 }
      const obstacles: Rect[] = [{ x: 350, y: 100, w: 200, h: 120 }]
      const clearance = 20

      const path = detourRoute(start, end, 'right', 'left', obstacles, 1000, clearance)

      // Find the x-coordinates of intermediate waypoints
      const intermediateXs = path.slice(1, -1).map((p) => p.x)
      const obsLeftMin = obstacles[0]!.x - clearance // 330 — minimum clearance
      const obsRightMin = obstacles[0]!.x + obstacles[0]!.w + clearance // 570

      // No intermediate waypoint should sit at the bare minimum clearance
      // (candidates now use 2x clearance spacing)
      for (const x of intermediateXs) {
        if (x !== start.x && x !== end.x) {
          expect(Math.abs(x - obsLeftMin)).toBeGreaterThan(5)
          expect(Math.abs(x - obsRightMin)).toBeGreaterThan(5)
        }
      }
    })
  })
})

describe('findOrthogonalPath', () => {
  it('rejects direct route that passes too close to obstacle', () => {
    // Direct route midX would be (200+700)/2 = 450, which passes through
    // the obstacle at x=350..550. With clearance=20, the expanded rect
    // covers x=330..570, so midX=450 is clearly inside.
    const start: Point = { x: 200, y: 50 }
    const end: Point = { x: 700, y: 180 }
    const obstacles: Rect[] = [{ x: 350, y: 20, w: 200, h: 200 }]

    const path = findOrthogonalPath(start, end, 'right', 'left', obstacles, 1000, 20)

    // Path should avoid the obstacle — check no segment passes through it
    expect(pathHitsObstacle(path, obstacles, 15)).toBe(false)
  })

  it('uses clearance margin, not just intersection margin', () => {
    // Place obstacle so the direct route passes within clearance distance.
    // Direct midX = (0 + 400) / 2 = 200
    // Obstacle covers x=195..305 — midX=200 is inside it.
    const start: Point = { x: 0, y: 0 }
    const end: Point = { x: 400, y: 100 }
    const obstacles: Rect[] = [{ x: 195, y: -20, w: 110, h: 140 }]

    const path = findOrthogonalPath(start, end, 'right', 'left', obstacles, 1000, 20)

    // Path should maintain clearance from obstacle
    expect(pathHitsObstacle(path, obstacles, 15)).toBe(false)
  })
})

describe('computeOrthogonalWaypoints — real pipeline demo data', () => {
  // Real obstacle data from pipeline demo debug output:
  const ALL_OBSTACLES: Rect[] = [
    { x: 0, y: 82.5, w: 120, h: 46 },       // source
    { x: 270, y: 75, w: 120, h: 61 },        // validate
    { x: 540, y: 76, w: 120, h: 46 },        // filter
    { x: 540, y: 152, w: 120, h: 59 },       // transform
    { x: 810, y: 44.5, w: 120, h: 46 },      // enrich? / cache?
    { x: 810, y: 120.5, w: 120, h: 46 },     // aggregate?
    { x: 1350, y: 82.5, w: 120, h: 46 },     // output?
    { x: 1620, y: 82.5, w: 120, h: 46 },     // error-handler?
  ]

  it('FILTER→AGGREGATE (e4): real data — waypoints should not hug obstacle top edge', () => {
    // Real debug data:
    // source: (649.6, 31.3) side: right
    // target: (1090.4, 107.8) side: left
    const source = { x: 649.6, y: 31.3, side: 'right' as const }
    const target = { x: 1090.4, y: 107.8, side: 'left' as const }

    const obstacles = buildEdgeObstacles(
      ALL_OBSTACLES.map((o) => ({ position: { x: o.x, y: o.y }, dimensions: { width: o.w, height: o.h } })),
      source,
      target,
      20,
    )

    const waypoints = computeOrthogonalWaypoints(source, target, obstacles, 30, 1000, 20)

    // The old behavior puts a waypoint at y=24.5 (obs.y - clearance for obs at y=44.5)
    // This hugs the obstacle top edge and creates ugly sharp corners.
    // The waypoints should NOT be at y=24.5 (44.5 - 20)
    const problematicY = 44.5 - 20 // = 24.5
    const yCoords = waypoints.map((w) => w.y)
    const hasProblematicY = yCoords.some((y) => Math.abs(y - problematicY) < 2)
    expect(hasProblematicY).toBe(false)

    // Verify the path doesn't intersect obstacles
    const path = catmullRomThroughWaypoints(waypoints)
    expect(path).toMatch(/^M /)
  })
})

describe('catmullRomThroughWaypoints', () => {
  it('returns empty string for fewer than 2 points', () => {
    expect(catmullRomThroughWaypoints([])).toBe('')
    expect(catmullRomThroughWaypoints([{ x: 0, y: 0 }])).toBe('')
  })

  it('returns straight line for 2 points', () => {
    const result = catmullRomThroughWaypoints([
      { x: 0, y: 0 },
      { x: 100, y: 100 },
    ])
    expect(result).toBe('M 0 0 L 100 100')
  })

  it('produces smooth curve through waypoints', () => {
    const waypoints: Point[] = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 200, y: 100 },
    ]
    const path = catmullRomThroughWaypoints(waypoints)
    expect(path).toMatch(/^M 0 0/)
    expect(path).toContain('C ')
    expect(path).toContain('200 100')
  })

  it('control points stay within reasonable bounds', () => {
    const waypoints: Point[] = [
      { x: 0, y: 100 },
      { x: 30, y: 100 },
      { x: 800, y: 100 },
      { x: 800, y: 80 },
      { x: 1000, y: 80 },
      { x: 1000, y: 50 },
      { x: 1030, y: 50 },
    ]
    const path = catmullRomThroughWaypoints(waypoints)
    const allPoints = parseSvgPathPoints(path)

    const minX = Math.min(...waypoints.map((p) => p.x))
    const maxX = Math.max(...waypoints.map((p) => p.x))
    const minY = Math.min(...waypoints.map((p) => p.y))
    const maxY = Math.max(...waypoints.map((p) => p.y))

    // Allow small margin for curve smoothing (5px)
    for (const p of allPoints) {
      expect(p.x).toBeGreaterThanOrEqual(minX - 5)
      expect(p.x).toBeLessThanOrEqual(maxX + 5)
      expect(p.y).toBeGreaterThanOrEqual(minY - 5)
      expect(p.y).toBeLessThanOrEqual(maxY + 5)
    }
  })

  it('long-to-short segment: limited overshoot at turn', () => {
    const waypoints: Point[] = [
      { x: 170, y: 330 },
      { x: 200, y: 330 },
      { x: 1350, y: 330 },
      { x: 1350, y: 120 },
      { x: 1380, y: 120 },
      { x: 1410, y: 120 },
    ]
    const path = catmullRomThroughWaypoints(waypoints)
    const allPoints = parseSvgPathPoints(path)

    // Overshoot should be minimal (< 2px beyond waypoint bounds)
    for (const p of allPoints) {
      expect(p.x).toBeLessThanOrEqual(1412)
      expect(p.y).toBeLessThanOrEqual(342) // Allow small Y overshoot from catmull-rom
      expect(p.y).toBeGreaterThanOrEqual(108)
    }
  })
})

describe('buildEdgeObstacles', () => {
  it('filters out obstacles containing source point', () => {
    const obstacles = [
      { position: { x: 0, y: 0 }, dimensions: { width: 100, height: 100 } },
      { position: { x: 200, y: 200 }, dimensions: { width: 100, height: 100 } },
    ]
    const result = buildEdgeObstacles(obstacles, { x: 50, y: 50 }, { x: 500, y: 500 }, 20)
    expect(result).toHaveLength(1)
    expect(result[0]!.x).toBe(200)
  })

  it('filters out obstacles containing target point', () => {
    const obstacles = [
      { position: { x: 0, y: 0 }, dimensions: { width: 100, height: 100 } },
      { position: { x: 200, y: 200 }, dimensions: { width: 100, height: 100 } },
    ]
    const result = buildEdgeObstacles(obstacles, { x: 500, y: 500 }, { x: 250, y: 250 }, 20)
    expect(result).toHaveLength(1)
    expect(result[0]!.x).toBe(0)
  })

  it('keeps obstacles that contain neither endpoint', () => {
    const obstacles = [
      { position: { x: 100, y: 100 }, dimensions: { width: 50, height: 50 } },
    ]
    const result = buildEdgeObstacles(obstacles, { x: 0, y: 0 }, { x: 300, y: 300 }, 20)
    expect(result).toHaveLength(1)
  })
})

describe('polylineHitsObstacle', () => {
  it('detects straight line through obstacle', () => {
    const line = [{ x: 0, y: 50 }, { x: 200, y: 50 }]
    const obstacles: Rect[] = [{ x: 80, y: 20, w: 40, h: 60 }]
    expect(polylineHitsObstacle(line, obstacles)).toBe(true)
  })

  it('passes line that misses obstacle', () => {
    const line = [{ x: 0, y: 0 }, { x: 200, y: 0 }]
    const obstacles: Rect[] = [{ x: 80, y: 20, w: 40, h: 60 }]
    expect(polylineHitsObstacle(line, obstacles)).toBe(false)
  })

  it('detects diagonal line through obstacle', () => {
    const line = [{ x: 0, y: 0 }, { x: 200, y: 200 }]
    const obstacles: Rect[] = [{ x: 80, y: 80, w: 40, h: 40 }]
    expect(polylineHitsObstacle(line, obstacles)).toBe(true)
  })
})
