/**
 * Measurement Diagnostics
 *
 * Debugging and verification utilities for Canvas measurement system.
 * Exposed via window.__CANVAS_DEBUG__ in development.
 *
 * @module layout/diagnostics
 * @see Phase 1: Measurement Perfection roadmap
 */
// ============================================================================
// Diagnostic Functions
// ============================================================================
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
export var compareLayers = function () {
    var _a, _b, _c;
    var measurementColumn = document.querySelector('.dm-canvas-measurement-layer .dm-measurement-entry');
    var visibleColumn = document.querySelector('.dm-canvas-responsive .canvas-column');
    // Fallback: try alternative selectors
    var measurementAlt = document.querySelector('.dm-canvas-measurement-layer');
    var measurementWidth = (_b = (_a = measurementColumn === null || measurementColumn === void 0 ? void 0 : measurementColumn.getBoundingClientRect().width) !== null && _a !== void 0 ? _a : measurementAlt === null || measurementAlt === void 0 ? void 0 : measurementAlt.getBoundingClientRect().width) !== null && _b !== void 0 ? _b : 0;
    var visibleWidth = (_c = visibleColumn === null || visibleColumn === void 0 ? void 0 : visibleColumn.getBoundingClientRect().width) !== null && _c !== void 0 ? _c : 0;
    if (measurementWidth === 0 && visibleWidth === 0) {
        return {
            measurementLayerWidth: 0,
            visibleLayerWidth: 0,
            difference: 0,
            status: 'MISMATCH',
            recommendation: 'Could not find layer columns in DOM. Is the canvas rendered?',
        };
    }
    if (measurementWidth === 0) {
        return {
            measurementLayerWidth: 0,
            visibleLayerWidth: visibleWidth,
            difference: visibleWidth,
            status: 'MISMATCH',
            recommendation: 'Measurement layer not found. Check .dm-canvas-measurement-layer selector.',
        };
    }
    if (visibleWidth === 0) {
        return {
            measurementLayerWidth: measurementWidth,
            visibleLayerWidth: 0,
            difference: measurementWidth,
            status: 'MISMATCH',
            recommendation: 'Visible layer not found. Check .dm-canvas-responsive selector.',
        };
    }
    var difference = Math.abs(measurementWidth - visibleWidth);
    return {
        measurementLayerWidth: measurementWidth,
        visibleLayerWidth: visibleWidth,
        difference: difference,
        status: difference < 0.5 ? 'MATCH' : 'MISMATCH',
        recommendation: difference < 0.5
            ? null
            : "Width mismatch of ".concat(difference.toFixed(2), "px. Check structural styles are applied via inline."),
    };
};
/**
 * Get width information for all columns in both layers.
 *
 * @returns Array of ColumnInfo objects
 */
export var getAllColumnWidths = function () {
    var results = [];
    // Measurement layer entries
    var measurementEntries = document.querySelectorAll('.dm-measurement-entry');
    measurementEntries.forEach(function (col, i) {
        var element = col;
        var computed = getComputedStyle(element);
        results.push({
            index: i,
            layer: 'measurement',
            inlineWidth: element.style.width || '(none)',
            computedWidth: computed.width,
            rectWidth: element.getBoundingClientRect().width,
            hasInlineWidth: !!element.style.width,
        });
    });
    // Visible layer columns
    var visibleColumns = document.querySelectorAll('.dm-canvas-responsive .canvas-column');
    visibleColumns.forEach(function (col, i) {
        var element = col;
        var computed = getComputedStyle(element);
        results.push({
            index: i,
            layer: 'visible',
            inlineWidth: element.style.width || '(none)',
            computedWidth: computed.width,
            rectWidth: element.getBoundingClientRect().width,
            hasInlineWidth: !!element.style.width,
        });
    });
    return results;
};
/**
 * Verify a specific component's measurement matches visible rendering.
 *
 * @param componentId - The component ID to check
 * @returns MeasurementDiagnostic or null if not found
 */
export var verifyComponent = function (componentId) {
    var _a, _b, _c, _d;
    // Find in measurement layer
    var measurementEntry = document.querySelector(".dm-measurement-entry[data-measurement-key*=\"".concat(componentId, "\"]"));
    // Find in visible layer
    var visibleEntry = document.querySelector(".canvas-entry[data-entry-id=\"".concat(componentId, "\"]"));
    if (!measurementEntry && !visibleEntry) {
        // eslint-disable-next-line no-console
        console.warn("[Canvas Diagnostics] Component ".concat(componentId, " not found in either layer"));
        return null;
    }
    var measurementWidth = (_a = measurementEntry === null || measurementEntry === void 0 ? void 0 : measurementEntry.getBoundingClientRect().width) !== null && _a !== void 0 ? _a : 0;
    var visibleWidth = (_b = visibleEntry === null || visibleEntry === void 0 ? void 0 : visibleEntry.getBoundingClientRect().width) !== null && _b !== void 0 ? _b : 0;
    var measurementHeight = (_c = measurementEntry === null || measurementEntry === void 0 ? void 0 : measurementEntry.getBoundingClientRect().height) !== null && _c !== void 0 ? _c : 0;
    return {
        componentId: componentId,
        measurementKey: (_d = measurementEntry === null || measurementEntry === void 0 ? void 0 : measurementEntry.dataset.measurementKey) !== null && _d !== void 0 ? _d : 'unknown',
        expectedColumnWidth: measurementWidth,
        actualColumnWidth: visibleWidth,
        measuredHeight: measurementHeight,
        widthMatch: Math.abs(measurementWidth - visibleWidth) < 0.5,
        timestamp: Date.now(),
    };
};
/**
 * Check for overflow in visible layer columns.
 * Logs warnings for any columns with overflow.
 */
export var checkOverflow = function () {
    var columns = document.querySelectorAll('.dm-canvas-responsive .canvas-column');
    var overflowCount = 0;
    columns.forEach(function (col, i) {
        var element = col;
        var isOverflowing = element.scrollHeight > element.clientHeight;
        if (isOverflowing) {
            overflowCount++;
            // eslint-disable-next-line no-console
            console.warn("\u26A0\uFE0F [Canvas] Column ".concat(i, " is overflowing!"), {
                scrollHeight: element.scrollHeight,
                clientHeight: element.clientHeight,
                overflow: element.scrollHeight - element.clientHeight,
            });
        }
    });
    if (overflowCount === 0) {
        // eslint-disable-next-line no-console
        console.log('✅ [Canvas] No overflow detected in any column');
    }
    else {
        // eslint-disable-next-line no-console
        console.warn("\u274C [Canvas] ".concat(overflowCount, " column(s) have overflow"));
    }
};
// ============================================================================
// Global Debug API (Development Only)
// ============================================================================
// Store for measurement data (populated by MeasurementLayer)
var measurementStore = null;
/**
 * Register measurements for diagnostic access.
 * Called by MeasurementLayer when measurements are collected.
 */
export var registerMeasurements = function (measurements) {
    measurementStore = measurements;
};
/**
 * Get the current measurement store.
 */
export var getMeasurements = function () {
    return measurementStore;
};
// Expose debug API on window in development
if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
    var debugAPI = {
        compareLayers: compareLayers,
        getAllColumnWidths: getAllColumnWidths,
        getMeasurements: getMeasurements,
        verifyComponent: verifyComponent,
        checkOverflow: checkOverflow,
    };
    window.__CANVAS_DEBUG__ = debugAPI;
    // Log availability
    // eslint-disable-next-line no-console
    console.log('🔧 [Canvas] Debug API available: window.__CANVAS_DEBUG__');
    // eslint-disable-next-line no-console
    console.log('   Methods: compareLayers(), getAllColumnWidths(), verifyComponent(id), checkOverflow()');
}
