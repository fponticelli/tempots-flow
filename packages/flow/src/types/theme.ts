export interface PortTypeStyle {
  readonly color: string
  readonly borderColor?: string
}

export interface FlowTheme {
  /** Custom CSS properties to apply on the viewport container */
  readonly customProperties?: Readonly<Record<string, string>>
  /** Additional CSS class(es) on the viewport container */
  readonly containerClass?: string
  /** Per-port-type styling, keyed by port type string */
  readonly portTypeStyles?: Readonly<Record<string, PortTypeStyle>>
}
