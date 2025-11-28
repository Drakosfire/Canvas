/**
 * State debugging utilities for Canvas layout.
 * Exposes debugging API via window.__CANVAS_STATE__ in development.
 * 
 * Phase 3: State Simplification - Added for observability
 */

import type { CanvasLayoutState, MeasurementKey } from './types';
import {
    verifySelectorsMatchState,
    selectMeasurementStats,
    selectRequiredMeasurementKeys,
    selectMissingMeasurementKeys,
    selectAllComponentsMeasured,
} from './selectors';

export interface StateSummary {
    // Core counts
    componentCount: number;
    dataSourceCount: number;
    pageCount: number;
    
    // Measurement status
    measurementStatus: string;
    measurementCount: number;
    requiredMeasurementCount: number;
    missingMeasurementCount: number;
    
    // Layout status
    isLayoutDirty: boolean;
    hasPendingLayout: boolean;
    bucketCount: number;
    
    // Flags
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
    listMeasurements: () => Array<{ key: string; height: number }>;
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
export const createStateDebugger = (state: CanvasLayoutState): StateDebugger => ({
    summary: () => {
        // Use selectors for derived values (Phase 3.3b)
        const stats = selectMeasurementStats(state);
        
        return {
            // Core counts
            componentCount: state.components.length,
            dataSourceCount: state.dataSources.length,
            pageCount: state.layoutPlan?.pages.length ?? 0,
            
            // Measurement status - using selectors
            measurementStatus: state.measurementStatus ?? 'unknown',
            measurementCount: state.measurements.size,
            requiredMeasurementCount: stats.required,
            missingMeasurementCount: stats.missing,
            
            // Layout status
            isLayoutDirty: state.isLayoutDirty,
            hasPendingLayout: state.pendingLayout !== null,
            bucketCount: state.buckets.size,
            
            // Flags - using selector
            allComponentsMeasured: stats.complete,
            waitingForInitialMeasurements: state.waitingForInitialMeasurements,
        };
    },
    
    warnings: () => {
        const warnings: StateWarning[] = [];
        
        // Check for high page count (potential pagination issue)
        const pageCount = state.layoutPlan?.pages.length ?? 0;
        if (pageCount > 10) {
            warnings.push({
                level: 'warn',
                message: 'High page count detected',
                details: { pageCount, threshold: 10 },
            });
        }
        
        // Check for missing measurements when should be complete (using selectors)
        const missingKeys = selectMissingMeasurementKeys(state);
        if (state.measurementStatus === 'complete' && missingKeys.size > 0) {
            warnings.push({
                level: 'error',
                message: 'Status is complete but measurements are missing',
                details: {
                    missingCount: missingKeys.size,
                    sampleMissing: Array.from(missingKeys).slice(0, 5),
                },
            });
        }
        
        // Check for empty buckets when components exist
        if (state.components.length > 0 && state.buckets.size === 0 && state.measurementStatus === 'complete') {
            warnings.push({
                level: 'warn',
                message: 'Components exist but no buckets built',
                details: { componentCount: state.components.length },
            });
        }
        
        // Check for stuck dirty flag
        if (state.isLayoutDirty && state.pendingLayout !== null) {
            warnings.push({
                level: 'info',
                message: 'Layout dirty with pending layout (pagination in progress)',
            });
        }
        
        // Check for low column utilization (Phase 4 will address)
        if (state.layoutPlan && state.layoutPlan.pages.length > 1) {
            const lastPage = state.layoutPlan.pages[state.layoutPlan.pages.length - 1];
            const col1Entries = lastPage.columns[0]?.entries.length ?? 0;
            const col2Entries = lastPage.columns[1]?.entries.length ?? 0;
            if (col1Entries < 3 && col2Entries < 3) {
                warnings.push({
                    level: 'info',
                    message: 'Last page has low column utilization',
                    details: { col1Entries, col2Entries },
                });
            }
        }
        
        // Phase 3.3: Verify selectors match state (detect sync bugs)
        const selectorVerification = verifySelectorsMatchState(state);
        if (selectorVerification.issues.length > 0) {
            warnings.push({
                level: 'error',
                message: 'Selector/state mismatch detected',
                details: { issues: selectorVerification.issues },
            });
        }
        
        return warnings;
    },
    
    getMeasurement: (key: MeasurementKey) => {
        const record = state.measurements.get(key);
        return record ? record.height : null;
    },
    
    listMeasurements: () => {
        const result: Array<{ key: string; height: number }> = [];
        state.measurements.forEach((record, key) => {
            result.push({ key, height: record.height });
        });
        return result.sort((a, b) => a.key.localeCompare(b.key));
    },
    
    getState: () => state,
    
    verifySelectors: () => verifySelectorsMatchState(state),
    
    measurementStats: () => selectMeasurementStats(state),
});

/**
 * Expose state debugger on window in development.
 * Usage: window.__CANVAS_STATE__.summary()
 */
export const exposeStateDebugger = (state: CanvasLayoutState): void => {
    if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
        (window as unknown as { __CANVAS_STATE__: StateDebugger }).__CANVAS_STATE__ = createStateDebugger(state);
    }
};

// Type declaration for window augmentation
declare global {
    interface Window {
        __CANVAS_STATE__?: StateDebugger;
    }
}

