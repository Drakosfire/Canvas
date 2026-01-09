/**
 * Hexagonal Grid Math Utilities
 * 
 * Pure functions for calculating hex grid lines and coordinate conversions.
 * Uses cube coordinates with pointy-top orientation.
 * 
 * Reference: https://www.redblobgames.com/grids/hexagons/
 */

import { Line } from './gridMath';

export type { Line };

/**
 * Cube coordinate for hexagonal grids.
 * Constraint: x + y + z = 0
 */
export interface CubeCoord {
  x: number;
  y: number;
  z: number;
}

/**
 * Fractional cube coordinate (before rounding)
 */
export interface FractionalCube {
  x: number;
  y: number;
  z: number;
}

/**
 * Parameters for hex grid line calculation
 */
export interface HexGridParams {
  /** Canvas width in pixels */
  width: number;
  /** Canvas height in pixels */
  height: number;
  /** Hex size (distance from center to corner) in pixels */
  cellSize: number;
  /** Horizontal offset in pixels */
  offsetX: number;
  /** Vertical offset in pixels */
  offsetY: number;
}

/**
 * Round fractional cube coordinates to the nearest valid hex.
 * Uses the cube coordinate rounding algorithm from Red Blob Games.
 * 
 * @param cube - Fractional cube coordinate
 * @returns Rounded cube coordinate satisfying x + y + z = 0
 */
export function cubeRound(cube: FractionalCube): CubeCoord {
  let rx = Math.round(cube.x);
  let ry = Math.round(cube.y);
  let rz = Math.round(cube.z);

  const dx = Math.abs(rx - cube.x);
  const dy = Math.abs(ry - cube.y);
  const dz = Math.abs(rz - cube.z);

  // Reset the component with largest rounding error
  if (dx > dy && dx > dz) {
    rx = -ry - rz;
  } else if (dy > dz) {
    ry = -rx - rz;
  } else {
    rz = -rx - ry;
  }

  return { x: rx, y: ry, z: rz };
}

/**
 * Convert pixel coordinates to cube coordinates.
 * Uses pointy-top orientation.
 * 
 * @param px - Pixel X position
 * @param py - Pixel Y position
 * @param size - Hex size (center to corner distance)
 * @returns Cube coordinate
 */
export function pixelToCube(px: number, py: number, size: number): CubeCoord {
  // Pointy-top orientation conversion
  const q = ((Math.sqrt(3) / 3) * px - (1 / 3) * py) / size;
  const r = ((2 / 3) * py) / size;
  
  // In cube coordinates: x = q, z = r, y = -x - z
  return cubeRound({
    x: q,
    y: -q - r,
    z: r,
  });
}

/**
 * Convert cube coordinates to pixel coordinates.
 * Uses pointy-top orientation.
 * 
 * @param cube - Cube coordinate
 * @param size - Hex size (center to corner distance)
 * @returns Pixel position { px, py }
 */
export function cubeToPixel(
  cube: CubeCoord,
  size: number
): { px: number; py: number } {
  // Pointy-top orientation: use x (q) and z (r)
  const px = size * Math.sqrt(3) * (cube.x + cube.z / 2);
  const py = size * (3 / 2) * cube.z;
  
  return { px, py };
}

/**
 * Get the 6 corners of a hex in pixel coordinates.
 * 
 * @param centerX - Center X position
 * @param centerY - Center Y position
 * @param size - Hex size
 * @returns Array of 6 corner points
 */
export function getHexCorners(
  centerX: number,
  centerY: number,
  size: number
): Array<{ x: number; y: number }> {
  const corners: Array<{ x: number; y: number }> = [];
  
  // Pointy-top hex: starts at 30 degrees
  for (let i = 0; i < 6; i++) {
    const angleDeg = 60 * i - 30;
    const angleRad = (Math.PI / 180) * angleDeg;
    corners.push({
      x: centerX + size * Math.cos(angleRad),
      y: centerY + size * Math.sin(angleRad),
    });
  }
  
  return corners;
}

/**
 * Calculate all line segments for a hex grid overlay.
 * Uses pointy-top hexagons.
 * 
 * @param params - Hex grid parameters
 * @returns Array of line segments
 */
export function calculateHexGridLines(params: HexGridParams): Line[] {
  const { width, height, cellSize: size, offsetX, offsetY } = params;
  const lines: Line[] = [];
  
  // Guard against invalid size
  if (size <= 0) {
    return lines;
  }

  // Set to track drawn edges (avoid duplicates)
  const drawnEdges = new Set<string>();

  // Pointy-top hex dimensions
  const hexWidth = Math.sqrt(3) * size;
  const hexHeight = 2 * size;
  const vertDist = hexHeight * 0.75;

  // Calculate how many hexes we need to cover the viewport (with buffer)
  const cols = Math.ceil(width / hexWidth) + 2;
  const rows = Math.ceil(height / vertDist) + 2;

  // Starting offsets
  const startCol = Math.floor(-offsetX / hexWidth) - 1;
  const startRow = Math.floor(-offsetY / vertDist) - 1;

  for (let row = startRow; row < startRow + rows; row++) {
    for (let col = startCol; col < startCol + cols; col++) {
      // Calculate center position
      let centerX = col * hexWidth + offsetX;
      let centerY = row * vertDist + offsetY;
      
      // Offset odd rows for pointy-top
      if (row % 2 !== 0) {
        centerX += hexWidth / 2;
      }

      // Get hex corners
      const corners = getHexCorners(centerX, centerY, size);

      // Add edges (6 edges per hex)
      for (let i = 0; i < 6; i++) {
        const start = corners[i];
        const end = corners[(i + 1) % 6];
        
        // Create a unique key for this edge (order-independent)
        const x1 = Math.round(start.x * 100) / 100;
        const y1 = Math.round(start.y * 100) / 100;
        const x2 = Math.round(end.x * 100) / 100;
        const y2 = Math.round(end.y * 100) / 100;
        
        const edgeKey = [
          `${Math.min(x1, x2)},${Math.min(y1, y2)}`,
          `${Math.max(x1, x2)},${Math.max(y1, y2)}`,
        ].join('-');

        // Skip if edge already drawn
        if (drawnEdges.has(edgeKey)) {
          continue;
        }
        drawnEdges.add(edgeKey);

        // Only add lines that are at least partially visible
        const minX = Math.min(start.x, end.x);
        const maxX = Math.max(start.x, end.x);
        const minY = Math.min(start.y, end.y);
        const maxY = Math.max(start.y, end.y);

        if (maxX >= 0 && minX <= width && maxY >= 0 && minY <= height) {
          lines.push({
            points: [start.x, start.y, end.x, end.y],
          });
        }
      }
    }
  }

  return lines;
}

/**
 * Get neighbors of a hex in cube coordinates
 */
export function getCubeNeighbors(cube: CubeCoord): CubeCoord[] {
  const directions: CubeCoord[] = [
    { x: 1, y: -1, z: 0 },
    { x: 1, y: 0, z: -1 },
    { x: 0, y: 1, z: -1 },
    { x: -1, y: 1, z: 0 },
    { x: -1, y: 0, z: 1 },
    { x: 0, y: -1, z: 1 },
  ];

  return directions.map((dir) => ({
    x: cube.x + dir.x,
    y: cube.y + dir.y,
    z: cube.z + dir.z,
  }));
}

/**
 * Calculate distance between two hexes in cube coordinates
 */
export function cubeDistance(a: CubeCoord, b: CubeCoord): number {
  return (Math.abs(a.x - b.x) + Math.abs(a.y - b.y) + Math.abs(a.z - b.z)) / 2;
}
