/**
 * Square Grid Math Utilities
 *
 * Pure functions for calculating square grid lines.
 * No DOM dependencies - fully testable in isolation.
 */
/**
 * A line segment defined by two points
 */
export interface Line {
    /** [x1, y1, x2, y2] coordinates */
    points: [number, number, number, number];
}
/**
 * Parameters for square grid line calculation
 */
export interface GridLineParams {
    /** Canvas width in pixels */
    width: number;
    /** Canvas height in pixels */
    height: number;
    /** Cell size in pixels (10-200) */
    cellSize: number;
    /** Horizontal offset in pixels */
    offsetX: number;
    /** Vertical offset in pixels */
    offsetY: number;
}
/**
 * Calculate all line segments for a square grid overlay.
 *
 * @param params - Grid parameters
 * @returns Array of line segments covering the canvas
 *
 * @example
 * const lines = calculateSquareGridLines({
 *   width: 100,
 *   height: 100,
 *   cellSize: 10,
 *   offsetX: 0,
 *   offsetY: 0,
 * });
 * // Returns 22 lines (11 vertical + 11 horizontal)
 */
export declare function calculateSquareGridLines(params: GridLineParams): Line[];
/**
 * Calculate visible grid cell count
 */
export declare function calculateGridCellCount(width: number, height: number, cellSize: number): {
    columns: number;
    rows: number;
};
/**
 * Convert pixel position to grid cell coordinates
 */
export declare function pixelToGridCell(px: number, py: number, cellSize: number, offsetX?: number, offsetY?: number): {
    col: number;
    row: number;
};
/**
 * Convert grid cell coordinates to pixel position (top-left of cell)
 */
export declare function gridCellToPixel(col: number, row: number, cellSize: number, offsetX?: number, offsetY?: number): {
    px: number;
    py: number;
};
//# sourceMappingURL=gridMath.d.ts.map