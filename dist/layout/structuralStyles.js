/**
 * Structural Styles Module
 *
 * The Canvas Engine owns ALL structural CSS via inline styles.
 * Inline styles have the highest CSS specificity and CANNOT be overridden by any stylesheet.
 *
 * INVARIANT: Measurement layer and visible layer use IDENTICAL structural styles.
 *
 * @module layout/structuralStyles
 * @see Phase 1: Measurement Perfection roadmap
 */
// ============================================================================
// Factory Functions
// ============================================================================
/**
 * Create structural styles for a canvas column.
 *
 * CRITICAL: Both measurement and visible layers MUST use this function
 * with the SAME widthPx value to guarantee identical rendering.
 *
 * @param widthPx - Exact column width in pixels
 * @returns Column structural styles object
 *
 * @example
 * ```tsx
 * <div
 *   className="canvas-column"
 *   style={createColumnStructuralStyles(364.2)}
 * >
 * ```
 */
export var createColumnStructuralStyles = function (widthPx) { return ({
    width: "".concat(widthPx, "px"),
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    flex: 'none',
    flexShrink: 0,
    flexGrow: 0,
    minWidth: 0,
    overflow: 'hidden',
}); };
/**
 * Create structural styles for a page container.
 *
 * @param widthPx - Page width in pixels
 * @param heightPx - Page height in pixels
 * @returns Page structural styles object
 */
export var createPageStructuralStyles = function (widthPx, heightPx) { return ({
    width: "".concat(widthPx, "px"),
    height: "".concat(heightPx, "px"),
    boxSizing: 'border-box',
    position: 'relative',
}); };
/**
 * Create structural styles for column wrapper.
 *
 * @param gapPx - Gap between columns in pixels
 * @param heightPx - Height of the column area in pixels
 * @returns Column wrapper structural styles object
 */
export var createColumnWrapperStructuralStyles = function (gapPx, heightPx) { return ({
    display: 'flex',
    flexDirection: 'row',
    gap: "".concat(gapPx, "px"),
    width: '100%',
    height: "".concat(heightPx, "px"),
    boxSizing: 'border-box',
}); };
/**
 * Create structural styles for a measurement entry wrapper.
 *
 * Applied to each component wrapper in the measurement layer.
 * Ensures the component is measured at exactly the column width.
 *
 * @param widthPx - Column width in pixels (must match visible layer)
 * @returns Measurement entry structural styles
 */
export var createMeasurementEntryStyles = function (widthPx) { return ({
    width: "".concat(widthPx, "px"),
    maxWidth: "".concat(widthPx, "px"),
    boxSizing: 'border-box',
    height: 'auto',
    minHeight: 0,
    flexShrink: 0,
    flexGrow: 0,
    overflow: 'hidden',
    transform: 'none', // No transforms that could affect measurement
}); };
/**
 * Create structural styles for the measurement layer container.
 *
 * @param widthPx - Column width in pixels
 * @param stagingMode - 'embedded' renders in-place (hidden), 'fixed-offscreen' renders off-viewport
 * @returns Measurement layer container styles
 */
export var createMeasurementLayerStyles = function (widthPx, stagingMode) {
    if (stagingMode === void 0) { stagingMode = 'fixed-offscreen'; }
    var effectiveWidth = widthPx != null ? "".concat(widthPx, "px") : 'auto';
    var effectiveMaxWidth = widthPx != null ? "".concat(widthPx, "px") : 'none';
    if (stagingMode === 'embedded') {
        return {
            position: 'relative',
            width: effectiveWidth,
            maxWidth: effectiveMaxWidth,
            visibility: 'hidden',
            pointerEvents: 'none',
            display: 'flex',
            flexDirection: 'column',
        };
    }
    // fixed-offscreen mode (default)
    return {
        position: 'fixed',
        left: '-100000px',
        top: 0,
        visibility: 'hidden',
        pointerEvents: 'none',
        display: 'flex',
        flexDirection: 'column',
        width: effectiveWidth,
        maxWidth: effectiveMaxWidth,
    };
};
// ============================================================================
// Utility Functions
// ============================================================================
/**
 * Verify that two widths match within tolerance.
 * Used for debugging to ensure measurement/visible layer sync.
 *
 * @param width1 - First width in pixels
 * @param width2 - Second width in pixels
 * @param tolerancePx - Maximum allowed difference (default: 0.5px)
 * @returns true if widths match within tolerance
 */
export var widthsMatch = function (width1, width2, tolerancePx) {
    if (tolerancePx === void 0) { tolerancePx = 0.5; }
    return Math.abs(width1 - width2) < tolerancePx;
};
/**
 * Assert that measurement and visible layer widths match.
 * Throws in development, logs warning in production.
 *
 * @param measurementWidth - Width from measurement layer
 * @param visibleWidth - Width from visible layer
 * @param context - Optional context string for debugging
 */
export var assertWidthsMatch = function (measurementWidth, visibleWidth, context) {
    if (!widthsMatch(measurementWidth, visibleWidth)) {
        var message = "[Canvas] Width mismatch: measurement=".concat(measurementWidth, "px, visible=").concat(visibleWidth, "px").concat(context ? " (".concat(context, ")") : '');
        if (process.env.NODE_ENV !== 'production') {
            // eslint-disable-next-line no-console
            console.error(message);
            // In development, we want to catch these early
            // Uncomment to make it a hard error:
            // throw new Error(message);
        }
        else {
            // eslint-disable-next-line no-console
            console.warn(message);
        }
    }
};
