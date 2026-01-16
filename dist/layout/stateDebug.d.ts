/**
 * State debugging utilities for Canvas layout.
 * Exposes debugging API via window.__CANVAS_STATE__ in development.
 *
 * Phase 3: State Simplification - Added for observability
 */
import type { CanvasLayoutState, MeasurementKey } from './types';
import { selectMeasurementStats } from './selectors';
export interface StateSummary {
    componentCount: number;
    dataSourceCount: number;
    pageCount: number;
    measurementStatus: string;
    measurementCount: number;
    requiredMeasurementCount: number;
    missingMeasurementCount: number;
    isLayoutDirty: boolean;
    hasPendingLayout: boolean;
    bucketCount: number;
    allComponentsMeasured: boolean;
    waitingForInitialMeasurements: boolean;
}
export interface StateWarning {
    level: 'info' | 'warn' | 'error';
    message: string;
    details?: Record<string, unknown>;
}
export interface SelectorVerification {
    requiredKeysMatch: boolean;
    missingKeysMatch: boolean;
    allMeasuredMatch: boolean;
    issues: string[];
}
export interface StateDebugger {
    summary: () => StateSummary;
    warnings: () => StateWarning[];
    getMeasurement: (key: MeasurementKey) => number | null;
    listMeasurements: () => Array<{
        key: string;
        height: number;
    }>;
    getState: () => CanvasLayoutState;
    /** Phase 3.3: Verify selectors match stored state */
    verifySelectors: () => SelectorVerification;
    /** Phase 3.3: Get measurement stats from selectors */
    measurementStats: () => ReturnType<typeof selectMeasurementStats>;
}
/**
 * Create a state debugger for the given canvas state.
 *
 * Phase 3.3b: Uses selectors for derived values instead of stored state fields.
 */
export declare const createStateDebugger: (state: CanvasLayoutState) => StateDebugger;
/**
 * Expose state debugger on window in development.
 * Usage: window.__CANVAS_STATE__.summary()
 */
export declare const exposeStateDebugger: (state: CanvasLayoutState) => void;
declare global {
    interface Window {
        __CANVAS_STATE__?: StateDebugger;
    }
}
//# sourceMappingURL=stateDebug.d.ts.map