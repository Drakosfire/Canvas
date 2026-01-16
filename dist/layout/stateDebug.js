/**
 * State debugging utilities for Canvas layout.
 * Exposes debugging API via window.__CANVAS_STATE__ in development.
 *
 * Phase 3: State Simplification - Added for observability
 */
import { verifySelectorsMatchState, selectMeasurementStats, selectMissingMeasurementKeys, } from './selectors';
/**
 * Create a state debugger for the given canvas state.
 *
 * Phase 3.3b: Uses selectors for derived values instead of stored state fields.
 */
export var createStateDebugger = function (state) { return ({
    summary: function () {
        var _a, _b, _c;
        // Use selectors for derived values (Phase 3.3b)
        var stats = selectMeasurementStats(state);
        return {
            // Core counts
            componentCount: state.components.length,
            dataSourceCount: state.dataSources.length,
            pageCount: (_b = (_a = state.layoutPlan) === null || _a === void 0 ? void 0 : _a.pages.length) !== null && _b !== void 0 ? _b : 0,
            // Measurement status - using selectors
            measurementStatus: (_c = state.measurementStatus) !== null && _c !== void 0 ? _c : 'unknown',
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
    warnings: function () {
        var _a, _b, _c, _d, _e, _f;
        var warnings = [];
        // Check for high page count (potential pagination issue)
        var pageCount = (_b = (_a = state.layoutPlan) === null || _a === void 0 ? void 0 : _a.pages.length) !== null && _b !== void 0 ? _b : 0;
        if (pageCount > 10) {
            warnings.push({
                level: 'warn',
                message: 'High page count detected',
                details: { pageCount: pageCount, threshold: 10 },
            });
        }
        // Check for missing measurements when should be complete (using selectors)
        var missingKeys = selectMissingMeasurementKeys(state);
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
            var lastPage = state.layoutPlan.pages[state.layoutPlan.pages.length - 1];
            var col1Entries = (_d = (_c = lastPage.columns[0]) === null || _c === void 0 ? void 0 : _c.entries.length) !== null && _d !== void 0 ? _d : 0;
            var col2Entries = (_f = (_e = lastPage.columns[1]) === null || _e === void 0 ? void 0 : _e.entries.length) !== null && _f !== void 0 ? _f : 0;
            if (col1Entries < 3 && col2Entries < 3) {
                warnings.push({
                    level: 'info',
                    message: 'Last page has low column utilization',
                    details: { col1Entries: col1Entries, col2Entries: col2Entries },
                });
            }
        }
        // Phase 3.3: Verify selectors match state (detect sync bugs)
        var selectorVerification = verifySelectorsMatchState(state);
        if (selectorVerification.issues.length > 0) {
            warnings.push({
                level: 'error',
                message: 'Selector/state mismatch detected',
                details: { issues: selectorVerification.issues },
            });
        }
        return warnings;
    },
    getMeasurement: function (key) {
        var record = state.measurements.get(key);
        return record ? record.height : null;
    },
    listMeasurements: function () {
        var result = [];
        state.measurements.forEach(function (record, key) {
            result.push({ key: key, height: record.height });
        });
        return result.sort(function (a, b) { return a.key.localeCompare(b.key); });
    },
    getState: function () { return state; },
    verifySelectors: function () { return verifySelectorsMatchState(state); },
    measurementStats: function () { return selectMeasurementStats(state); },
}); };
/**
 * Expose state debugger on window in development.
 * Usage: window.__CANVAS_STATE__.summary()
 */
export var exposeStateDebugger = function (state) {
    if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
        window.__CANVAS_STATE__ = createStateDebugger(state);
    }
};
