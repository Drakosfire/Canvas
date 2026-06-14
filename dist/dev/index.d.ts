/**
 * Development-only diagnostics and debugging utilities.
 * Import from `dungeonmind-canvas/dev` — not included in the default public API.
 */
export { createStateDebugger, exposeStateDebugger } from '../layout/stateDebug';
export type { StateSummary, StateWarning, StateDebugger } from '../layout/stateDebug';
export { diagnosePagination, quickCheck, watchOverflow, inspectComponent, exposePaginationDiagnostics, } from '../layout/paginationDiagnostics';
export type { ColumnOverflowReport, PaginationDiagnosticReport, PaginationDiagnosticsAPI, } from '../layout/paginationDiagnostics';
export { compareLayers, getAllColumnWidths, verifyComponent, checkOverflow, } from '../layout/diagnostics';
export type { LayerComparison, ColumnInfo, MeasurementDiagnostic, CanvasDebugAPI, } from '../layout/diagnostics';
//# sourceMappingURL=index.d.ts.map