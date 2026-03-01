// Validation types (stubs for Phase 1, full implementation in Phase 2)

export type DiagnosticSeverity = 'error' | 'warning' | 'info'

export type DiagnosticTarget =
  | { readonly kind: 'node'; readonly nodeId: string }
  | { readonly kind: 'edge'; readonly edgeId: string }
  | { readonly kind: 'port'; readonly nodeId: string; readonly portId: string }
  | { readonly kind: 'graph' }

export interface Diagnostic {
  readonly severity: DiagnosticSeverity
  readonly message: string
  readonly target: DiagnosticTarget
}
