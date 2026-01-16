/**
 * Measurement Diagnostics
 *
 * Debugging and verification utilities for Canvas measurement system.
 * Exposed via window.__CANVAS_DEBUG__ in development.
 *
 * @module layout/diagnostics
 * @see Phase 1: Measurement Perfection roadmap
 */
/**
 * Diagnostic info for a single component measurement.
 */
export interface MeasurementDiagnostic {
    componentId: string;
    measurementKey: string;
    expectedColumnWidth: number;
    actualColumnWidth: number;
    measuredHeight: number;
    widthMatch: boolean;
    timestamp: number;
}
/**
 * Result of comparing measurement and visible layer widths.
 */
export interface LayerComparison {
    measurementLayerWidth: number;
    visibleLayerWidth: number;
    difference: number;
    status: 'MATCH' | 'MISMATCH';
    recommendation: string | null;
}
/**
 * Detailed column info from DOM inspection.
 */
export interface ColumnInfo {
    index: number;
    layer: 'measurement' | 'visible';
    inlineWidth: string;
    computedWidth: string;
    rectWidth: number;
    hasInlineWidth: boolean;
}
/**
 * Debug API exposed on window.__CANVAS_DEBUG__
 */
export interface CanvasDebugAPI {
    compareLayers: () => LayerComparison;
    getAllColumnWidths: () => ColumnInfo[];
    getMeasurements: () => Map<string, {
        height: number;
        timestamp: number;
    }> | null;
    verifyComponent: (componentId: string) => MeasurementDiagnostic | null;
    checkOverflow: () => void;
}
/**
 * Compare measurement and visible layer column widths.
 *
 * @returns LayerComparison with status and recommendation
 *
 * @example
 * ```javascript
 * // In browser console:
 * window.__CANVAS_DEBUG__.compareLayers()
 * // { measurementLayerWidth: 364.2, visibleLayerWidth: 364.2, difference: 0, status: 'MATCH' }
 * ```
 */
export declare const compareLayers: () => LayerComparison;
/**
 * Get width information for all columns in both layers.
 *
 * @returns Array of ColumnInfo objects
 */
export declare const getAllColumnWidths: () => ColumnInfo[];
/**
 * Verify a specific component's measurement matches visible rendering.
 *
 * @param componentId - The component ID to check
 * @returns MeasurementDiagnostic or null if not found
 */
export declare const verifyComponent: (componentId: string) => MeasurementDiagnostic | null;
/**
 * Check for overflow in visible layer columns.
 * Logs warnings for any columns with overflow.
 */
export declare const checkOverflow: () => void;
/**
 * Register measurements for diagnostic access.
 * Called by MeasurementLayer when measurements are collected.
 */
export declare const registerMeasurements: (measurements: Map<string, {
    height: number;
    timestamp: number;
}>) => void;
/**
 * Get the current measurement store.
 */
export declare const getMeasurements: () => Map<string, {
    height: number;
    timestamp: number;
}> | null;
//# sourceMappingURL=diagnostics.d.ts.map