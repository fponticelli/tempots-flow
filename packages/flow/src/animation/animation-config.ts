import type { EasingFunction } from './easing'
import { easing } from './easing'

// --- Layout transitions ---

export interface LayoutTransitionConfig {
  readonly enabled: boolean
  readonly duration: number
  readonly easing: EasingFunction
  readonly stagger: number
  readonly staggerOrder: 'distance' | 'index' | 'radial'
}

// --- Viewport transitions ---

export interface ViewportTransitionConfig {
  readonly enabled: boolean
  readonly duration: number
  readonly easing: EasingFunction
}

// --- Enter/exit animations ---

export type EnterAnimation = 'fade' | 'scale' | 'fade-scale' | 'slide-down' | 'none'
export type ExitAnimation = 'fade' | 'scale' | 'fade-scale' | 'collapse' | 'none'

export interface EnterExitConfig {
  readonly enabled: boolean
  readonly duration: number
  readonly enter: EnterAnimation
  readonly exit: ExitAnimation
}

// --- Edge flow ---

export interface EdgeFlowConfig {
  readonly enabled: boolean
  readonly speed: number
  readonly dashArray: string
}

// --- Top-level config ---

export interface AnimationConfig {
  readonly enabled: boolean
  readonly respectReducedMotion: boolean
  readonly layout: LayoutTransitionConfig
  readonly viewport: ViewportTransitionConfig
  readonly enterExit: EnterExitConfig
  readonly edgeFlow: EdgeFlowConfig
}

// --- Defaults ---

const DEFAULT_LAYOUT: LayoutTransitionConfig = {
  enabled: true,
  duration: 300,
  easing: easing.easeInOut,
  stagger: 0,
  staggerOrder: 'distance',
}

const DEFAULT_VIEWPORT: ViewportTransitionConfig = {
  enabled: true,
  duration: 200,
  easing: easing.easeOut,
}

const DEFAULT_ENTER_EXIT: EnterExitConfig = {
  enabled: true,
  duration: 200,
  enter: 'fade-scale',
  exit: 'fade',
}

const DEFAULT_EDGE_FLOW: EdgeFlowConfig = {
  enabled: false,
  speed: 1,
  dashArray: '8 4',
}

const DEFAULT_ANIMATION: AnimationConfig = {
  enabled: true,
  respectReducedMotion: true,
  layout: DEFAULT_LAYOUT,
  viewport: DEFAULT_VIEWPORT,
  enterExit: DEFAULT_ENTER_EXIT,
  edgeFlow: DEFAULT_EDGE_FLOW,
}

// --- Resolver ---

export type PartialAnimationConfig = {
  readonly enabled?: boolean
  readonly respectReducedMotion?: boolean
  readonly layout?: Partial<LayoutTransitionConfig>
  readonly viewport?: Partial<ViewportTransitionConfig>
  readonly enterExit?: Partial<EnterExitConfig>
  readonly edgeFlow?: Partial<EdgeFlowConfig>
}

export function resolveAnimationConfig(
  partial?: PartialAnimationConfig,
  layoutTransitionDuration?: number,
): AnimationConfig {
  if (!partial && layoutTransitionDuration === undefined) return DEFAULT_ANIMATION

  const layoutDuration = partial?.layout?.duration ?? layoutTransitionDuration

  return {
    enabled: partial?.enabled ?? DEFAULT_ANIMATION.enabled,
    respectReducedMotion: partial?.respectReducedMotion ?? DEFAULT_ANIMATION.respectReducedMotion,
    layout: {
      ...DEFAULT_LAYOUT,
      ...partial?.layout,
      ...(layoutDuration !== undefined ? { duration: layoutDuration } : {}),
    },
    viewport: { ...DEFAULT_VIEWPORT, ...partial?.viewport },
    enterExit: { ...DEFAULT_ENTER_EXIT, ...partial?.enterExit },
    edgeFlow: { ...DEFAULT_EDGE_FLOW, ...partial?.edgeFlow },
  }
}
