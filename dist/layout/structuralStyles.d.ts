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
import type { CSSProperties } from 'react';
/**
 * Structural styles for a canvas column.
 * Applied to both measurement and visible layer columns.
 */
export interface ColumnStructuralStyles {
    width: string;
    boxSizing: 'border-box';
    display: 'flex';
    flexDirection: 'column';
    flex: 'none';
    flexShrink: 0;
    flexGrow: 0;
    minWidth: 0;
    overflow: 'hidden';
}
/**
 * Structural styles for a page container.
 */
export interface PageStructuralStyles {
    width: string;
    height: string;
    boxSizing: 'border-box';
    position: 'relative';
}
/**
 * Structural styles for the column wrapper (flexbox row).
 */
export interface ColumnWrapperStructuralStyles {
    display: 'flex';
    flexDirection: 'row';
    gap: string;
    width: '100%';
    height: string;
    boxSizing: 'border-box';
}
/**
 * Structural styles for a measurement entry wrapper.
 */
export interface MeasurementEntryStructuralStyles {
    width: string;
    maxWidth: string;
    boxSizing: 'border-box';
    height: 'auto';
    minHeight: 0;
    flexShrink: 0;
    flexGrow: 0;
    overflow: 'hidden';
    transform: 'none';
}
/**
 * Structural styles for the measurement layer container.
 */
export interface MeasurementLayerStructuralStyles {
    position: 'fixed' | 'relative';
    left?: string;
    top?: number;
    width: string;
    maxWidth: string;
    visibility: 'hidden';
    pointerEvents: 'none';
    display: 'flex';
    flexDirection: 'column';
}
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
export declare const createColumnStructuralStyles: (widthPx: number) => ColumnStructuralStyles;
/**
 * Create structural styles for a page container.
 *
 * @param widthPx - Page width in pixels
 * @param heightPx - Page height in pixels
 * @returns Page structural styles object
 */
export declare const createPageStructuralStyles: (widthPx: number, heightPx: number) => PageStructuralStyles;
/**
 * Create structural styles for column wrapper.
 *
 * @param gapPx - Gap between columns in pixels
 * @param heightPx - Height of the column area in pixels
 * @returns Column wrapper structural styles object
 */
export declare const createColumnWrapperStructuralStyles: (gapPx: number, heightPx: number) => ColumnWrapperStructuralStyles;
/**
 * Create structural styles for a measurement entry wrapper.
 *
 * Applied to each component wrapper in the measurement layer.
 * Ensures the component is measured at exactly the column width.
 *
 * @param widthPx - Column width in pixels (must match visible layer)
 * @returns Measurement entry structural styles
 */
export declare const createMeasurementEntryStyles: (widthPx: number) => MeasurementEntryStructuralStyles;
/**
 * Staging mode for measurement layer.
 * Matches MeasurementStagingMode from measurement.tsx
 */
export type MeasurementStagingMode = 'fixed-offscreen' | 'embedded';
/**
 * Create structural styles for the measurement layer container.
 *
 * @param widthPx - Column width in pixels
 * @param stagingMode - 'embedded' renders in-place (hidden), 'fixed-offscreen' renders off-viewport
 * @returns Measurement layer container styles
 */
export declare const createMeasurementLayerStyles: (widthPx: number | null, stagingMode?: MeasurementStagingMode) => CSSProperties;
/**
 * Verify that two widths match within tolerance.
 * Used for debugging to ensure measurement/visible layer sync.
 *
 * @param width1 - First width in pixels
 * @param width2 - Second width in pixels
 * @param tolerancePx - Maximum allowed difference (default: 0.5px)
 * @returns true if widths match within tolerance
 */
export declare const widthsMatch: (width1: number, width2: number, tolerancePx?: number) => boolean;
/**
 * Assert that measurement and visible layer widths match.
 * Throws in development, logs warning in production.
 *
 * @param measurementWidth - Width from measurement layer
 * @param visibleWidth - Width from visible layer
 * @param context - Optional context string for debugging
 */
export declare const assertWidthsMatch: (measurementWidth: number, visibleWidth: number, context?: string) => void;
//# sourceMappingURL=structuralStyles.d.ts.map