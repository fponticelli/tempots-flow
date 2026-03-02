// Layout state types — Layer 2 (library-managed, per-view)

export interface Position {
  readonly x: number
  readonly y: number
}

export interface Dimensions {
  readonly width: number
  readonly height: number
}

export interface Viewport {
  readonly x: number
  readonly y: number
  readonly zoom: number
}

export type PortSide = 'top' | 'right' | 'bottom' | 'left'

export type PortPlacement = 'horizontal' | 'vertical'

export interface ComputedPortPosition {
  readonly x: number
  readonly y: number
  readonly side: PortSide
}

export interface ComputedEdgePath {
  readonly edgeId: string
  readonly d: string
  readonly sourcePoint: ComputedPortPosition
  readonly targetPoint: ComputedPortPosition
  readonly labelPosition: Position
}

export interface LayoutState {
  readonly positions: ReadonlyMap<string, Position>
  readonly dimensions: ReadonlyMap<string, Dimensions>
}
