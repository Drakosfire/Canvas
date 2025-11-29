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
// Type Definitions
// ============================================================================

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
    getMeasurements: () => Map<string, { height: number; timestamp: number }> | null;
    verifyComponent: (componentId: string) => MeasurementDiagnostic | null;
    checkOverflow: () => void;
}

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
export const compareLayers = (): LayerComparison => {
    const measurementColumn = document.querySelector(
        '.dm-canvas-measurement-layer .dm-measurement-entry'
    ) as HTMLElement | null;

    const visibleColumn = document.querySelector(
        '.dm-canvas-responsive .canvas-column'
    ) as HTMLElement | null;

    // Fallback: try alternative selectors
    const measurementAlt = document.querySelector(
        '.dm-canvas-measurement-layer'
    ) as HTMLElement | null;

    const measurementWidth = measurementColumn?.getBoundingClientRect().width
        ?? measurementAlt?.getBoundingClientRect().width
        ?? 0;
    const visibleWidth = visibleColumn?.getBoundingClientRect().width ?? 0;

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

    const difference = Math.abs(measurementWidth - visibleWidth);

    return {
        measurementLayerWidth: measurementWidth,
        visibleLayerWidth: visibleWidth,
        difference,
        status: difference < 0.5 ? 'MATCH' : 'MISMATCH',
        recommendation: difference < 0.5
            ? null
            : `Width mismatch of ${difference.toFixed(2)}px. Check structural styles are applied via inline.`,
    };
};

/**
 * Get width information for all columns in both layers.
 * 
 * @returns Array of ColumnInfo objects
 */
export const getAllColumnWidths = (): ColumnInfo[] => {
    const results: ColumnInfo[] = [];

    // Measurement layer entries
    const measurementEntries = document.querySelectorAll('.dm-measurement-entry');
    measurementEntries.forEach((col, i) => {
        const element = col as HTMLElement;
        const computed = getComputedStyle(element);
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
    const visibleColumns = document.querySelectorAll('.dm-canvas-responsive .canvas-column');
    visibleColumns.forEach((col, i) => {
        const element = col as HTMLElement;
        const computed = getComputedStyle(element);
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
export const verifyComponent = (componentId: string): MeasurementDiagnostic | null => {
    // Find in measurement layer
    const measurementEntry = document.querySelector(
        `.dm-measurement-entry[data-measurement-key*="${componentId}"]`
    ) as HTMLElement | null;

    // Find in visible layer
    const visibleEntry = document.querySelector(
        `.canvas-entry[data-entry-id="${componentId}"]`
    ) as HTMLElement | null;

    if (!measurementEntry && !visibleEntry) {
        // eslint-disable-next-line no-console
        console.warn(`[Canvas Diagnostics] Component ${componentId} not found in either layer`);
        return null;
    }

    const measurementWidth = measurementEntry?.getBoundingClientRect().width ?? 0;
    const visibleWidth = visibleEntry?.getBoundingClientRect().width ?? 0;
    const measurementHeight = measurementEntry?.getBoundingClientRect().height ?? 0;

    return {
        componentId,
        measurementKey: measurementEntry?.dataset.measurementKey ?? 'unknown',
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
export const checkOverflow = (): void => {
    const columns = document.querySelectorAll('.dm-canvas-responsive .canvas-column');
    let overflowCount = 0;

    columns.forEach((col, i) => {
        const element = col as HTMLElement;
        const isOverflowing = element.scrollHeight > element.clientHeight;

        if (isOverflowing) {
            overflowCount++;
            // eslint-disable-next-line no-console
            console.warn(`⚠️ [Canvas] Column ${i} is overflowing!`, {
                scrollHeight: element.scrollHeight,
                clientHeight: element.clientHeight,
                overflow: element.scrollHeight - element.clientHeight,
            });
        }
    });

    if (overflowCount === 0) {
        // eslint-disable-next-line no-console
        console.log('✅ [Canvas] No overflow detected in any column');
    } else {
        // eslint-disable-next-line no-console
        console.warn(`❌ [Canvas] ${overflowCount} column(s) have overflow`);
    }
};

// ============================================================================
// Global Debug API (Development Only)
// ============================================================================

// Store for measurement data (populated by MeasurementLayer)
let measurementStore: Map<string, { height: number; timestamp: number }> | null = null;

/**
 * Register measurements for diagnostic access.
 * Called by MeasurementLayer when measurements are collected.
 */
export const registerMeasurements = (
    measurements: Map<string, { height: number; timestamp: number }>
): void => {
    measurementStore = measurements;
};

/**
 * Get the current measurement store.
 */
export const getMeasurements = (): Map<string, { height: number; timestamp: number }> | null => {
    return measurementStore;
};

// Expose debug API on window in development
if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
    const debugAPI: CanvasDebugAPI = {
        compareLayers,
        getAllColumnWidths,
        getMeasurements,
        verifyComponent,
        checkOverflow,
    };

    (window as unknown as { __CANVAS_DEBUG__: CanvasDebugAPI }).__CANVAS_DEBUG__ = debugAPI;

    // Log availability
    // eslint-disable-next-line no-console
    console.log('🔧 [Canvas] Debug API available: window.__CANVAS_DEBUG__');
    // eslint-disable-next-line no-console
    console.log('   Methods: compareLayers(), getAllColumnWidths(), verifyComponent(id), checkOverflow()');
}

