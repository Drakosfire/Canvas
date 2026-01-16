/**
 * Square Grid Math Utilities
 *
 * Pure functions for calculating square grid lines.
 * No DOM dependencies - fully testable in isolation.
 */
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
export function calculateSquareGridLines(params) {
    var width = params.width, height = params.height, cellSize = params.cellSize, offsetX = params.offsetX, offsetY = params.offsetY;
    var lines = [];
    // Guard against invalid cell size
    if (cellSize <= 0) {
        return lines;
    }
    // Calculate the starting position for vertical lines
    // Use modulo to handle negative offsets correctly
    var startX = ((offsetX % cellSize) + cellSize) % cellSize;
    // Calculate the starting position for horizontal lines
    var startY = ((offsetY % cellSize) + cellSize) % cellSize;
    // Generate vertical lines
    for (var x = startX; x <= width; x += cellSize) {
        lines.push({
            points: [x, 0, x, height],
        });
    }
    // Generate horizontal lines
    for (var y = startY; y <= height; y += cellSize) {
        lines.push({
            points: [0, y, width, y],
        });
    }
    return lines;
}
/**
 * Calculate visible grid cell count
 */
export function calculateGridCellCount(width, height, cellSize) {
    return {
        columns: Math.ceil(width / cellSize),
        rows: Math.ceil(height / cellSize),
    };
}
/**
 * Convert pixel position to grid cell coordinates
 */
export function pixelToGridCell(px, py, cellSize, offsetX, offsetY) {
    if (offsetX === void 0) { offsetX = 0; }
    if (offsetY === void 0) { offsetY = 0; }
    return {
        col: Math.floor((px - offsetX) / cellSize),
        row: Math.floor((py - offsetY) / cellSize),
    };
}
/**
 * Convert grid cell coordinates to pixel position (top-left of cell)
 */
export function gridCellToPixel(col, row, cellSize, offsetX, offsetY) {
    if (offsetX === void 0) { offsetX = 0; }
    if (offsetY === void 0) { offsetY = 0; }
    return {
        px: col * cellSize + offsetX,
        py: row * cellSize + offsetY,
    };
}
