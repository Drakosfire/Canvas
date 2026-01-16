/**
 * Pagination Diagnostics
 *
 * Scripts to observe and document pagination issues.
 * Run these in browser console to diagnose overflow and utilization problems.
 *
 * Phase 4: Pagination Polish - Issue tracking & utilization metrics
 */
export interface ColumnOverflowReport {
    columnIndex: number;
    pageIndex: number;
    scrollHeight: number;
    clientHeight: number;
    overflow: number;
    entries: Array<{
        id: string;
        measuredHeight: number;
        actualHeight: number;
        heightDiff: number;
        spanTop: number;
        spanBottom: number;
    }>;
    totalMeasuredHeight: number;
    totalActualHeight: number;
}
/**
 * Column utilization report - Phase 4 A4
 */
export interface ColumnUtilizationReport {
    columnIndex: number;
    pageIndex: number;
    capacity: number;
    used: number;
    utilization: number;
    componentCount: number;
    continuationCount: number;
    isBelowThreshold: boolean;
}
/**
 * Overall utilization summary - Phase 4 A4
 */
export interface UtilizationSummary {
    timestamp: string;
    pageCount: number;
    columnCount: number;
    averageUtilization: number;
    minUtilization: number;
    maxUtilization: number;
    variance: number;
    lowUtilizationColumns: number;
    columns: ColumnUtilizationReport[];
    warnings: string[];
}
export interface PaginationDiagnosticReport {
    timestamp: string;
    pageCount: number;
    totalComponents: number;
    columnsWithOverflow: number;
    overflowDetails: ColumnOverflowReport[];
    recommendations: string[];
}
/**
 * Diagnose all columns for overflow issues.
 * Run in browser console: window.__CANVAS_PAGINATION__.diagnose()
 */
export declare const diagnosePagination: () => PaginationDiagnosticReport;
/**
 * Quick check - just log overflow status to console.
 * Run: window.__CANVAS_PAGINATION__.quickCheck()
 */
export declare const quickCheck: () => void;
/**
 * Watch for overflow changes over time.
 * Useful for catching timing-related issues.
 * Run: window.__CANVAS_PAGINATION__.watch(5000) // Watch for 5 seconds
 */
export declare const watchOverflow: (durationMs?: number) => void;
/**
 * Get column utilization report - Phase 4 A4
 * Run: window.__CANVAS_PAGINATION__.utilization()
 */
export declare const getUtilizationReport: () => UtilizationSummary;
/**
 * Print utilization summary to console - Phase 4 A4
 * Run: window.__CANVAS_PAGINATION__.printUtilization()
 */
export declare const printUtilizationReport: () => void;
/**
 * Component snapshot for before/after comparison
 */
export interface ComponentSnapshot {
    id: string;
    measurementKey: string;
    pageIndex: number;
    columnIndex: number;
    regionKey: string;
    startIndex: number;
    isContinuation: boolean;
    spanTop: number;
    spanBottom: number;
    measuredHeight: number;
    actualHeight: number;
    heightDiff: number;
}
/**
 * Full layout snapshot for comparison
 */
export interface LayoutSnapshot {
    timestamp: string;
    label: string;
    pageCount: number;
    totalComponents: number;
    components: ComponentSnapshot[];
    columnUtilizations: Array<{
        pageIndex: number;
        columnIndex: number;
        utilization: number;
        componentCount: number;
    }>;
    hasOverflow: boolean;
    overflowColumns: number[];
}
/**
 * Take a complete layout snapshot.
 * Run: window.__CANVAS_PAGINATION__.snapshot('before') or snapshot('after')
 */
export declare const takeSnapshot: (label?: string) => LayoutSnapshot;
/**
 * Get a stored snapshot.
 * Run: window.__CANVAS_PAGINATION__.getSnapshot('before')
 */
export declare const getSnapshot: (label: string) => LayoutSnapshot | undefined;
/**
 * List all stored snapshots.
 */
export declare const listSnapshots: () => string[];
/**
 * Clear all stored snapshots.
 */
export declare const clearSnapshots: () => void;
/**
 * Compare two snapshots and show differences.
 * Run: window.__CANVAS_PAGINATION__.compare('before', 'after')
 */
export declare const compareSnapshots: (label1: string, label2: string) => void;
/**
 * Get detailed info about a specific component.
 * Run: window.__CANVAS_PAGINATION__.inspectComponent('component-11')
 */
export declare const inspectComponent: (componentId: string) => void;
/**
 * Expose diagnostics API on window.
 */
export declare const exposePaginationDiagnostics: () => void;
export interface PaginationDiagnosticsAPI {
    diagnose: typeof diagnosePagination;
    quickCheck: typeof quickCheck;
    watch: typeof watchOverflow;
    inspectComponent: typeof inspectComponent;
    utilization: typeof getUtilizationReport;
    printUtilization: typeof printUtilizationReport;
    snapshot: typeof takeSnapshot;
    getSnapshot: typeof getSnapshot;
    listSnapshots: typeof listSnapshots;
    clearSnapshots: typeof clearSnapshots;
    compare: typeof compareSnapshots;
}
declare global {
    interface Window {
        __CANVAS_PAGINATION__?: PaginationDiagnosticsAPI;
    }
}
//# sourceMappingURL=paginationDiagnostics.d.ts.map