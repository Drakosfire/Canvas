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
export function calculateSquareGridLines(params: GridLineParams): Line[] {
  const { width, height, cellSize, offsetX, offsetY } = params;
  const lines: Line[] = [];

  // Guard against invalid cell size
  if (cellSize <= 0) {
    return lines;
  }

  // Calculate the starting position for vertical lines
  // Use modulo to handle negative offsets correctly
  let startX = ((offsetX % cellSize) + cellSize) % cellSize;
  
  // Calculate the starting position for horizontal lines
  let startY = ((offsetY % cellSize) + cellSize) % cellSize;

  // Generate vertical lines
  for (let x = startX; x <= width; x += cellSize) {
    lines.push({
      points: [x, 0, x, height],
    });
  }

  // Generate horizontal lines
  for (let y = startY; y <= height; y += cellSize) {
    lines.push({
      points: [0, y, width, y],
    });
  }

  return lines;
}

/**
 * Calculate visible grid cell count
 */
export function calculateGridCellCount(
  width: number,
  height: number,
  cellSize: number
): { columns: number; rows: number } {
  return {
    columns: Math.ceil(width / cellSize),
    rows: Math.ceil(height / cellSize),
  };
}

/**
 * Convert pixel position to grid cell coordinates
 */
export function pixelToGridCell(
  px: number,
  py: number,
  cellSize: number,
  offsetX: number = 0,
  offsetY: number = 0
): { col: number; row: number } {
  return {
    col: Math.floor((px - offsetX) / cellSize),
    row: Math.floor((py - offsetY) / cellSize),
  };
}

/**
 * Convert grid cell coordinates to pixel position (top-left of cell)
 */
export function gridCellToPixel(
  col: number,
  row: number,
  cellSize: number,
  offsetX: number = 0,
  offsetY: number = 0
): { px: number; py: number } {
  return {
    px: col * cellSize + offsetX,
    py: row * cellSize + offsetY,
  };
}
