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
export declare function cubeRound(cube: FractionalCube): CubeCoord;
/**
 * Convert pixel coordinates to cube coordinates.
 * Uses pointy-top orientation.
 *
 * @param px - Pixel X position
 * @param py - Pixel Y position
 * @param size - Hex size (center to corner distance)
 * @returns Cube coordinate
 */
export declare function pixelToCube(px: number, py: number, size: number): CubeCoord;
/**
 * Convert cube coordinates to pixel coordinates.
 * Uses pointy-top orientation.
 *
 * @param cube - Cube coordinate
 * @param size - Hex size (center to corner distance)
 * @returns Pixel position { px, py }
 */
export declare function cubeToPixel(cube: CubeCoord, size: number): {
    px: number;
    py: number;
};
/**
 * Get the 6 corners of a hex in pixel coordinates.
 *
 * @param centerX - Center X position
 * @param centerY - Center Y position
 * @param size - Hex size
 * @returns Array of 6 corner points
 */
export declare function getHexCorners(centerX: number, centerY: number, size: number): Array<{
    x: number;
    y: number;
}>;
/**
 * Calculate all line segments for a hex grid overlay.
 * Uses pointy-top hexagons.
 *
 * @param params - Hex grid parameters
 * @returns Array of line segments
 */
export declare function calculateHexGridLines(params: HexGridParams): Line[];
/**
 * Get neighbors of a hex in cube coordinates
 */
export declare function getCubeNeighbors(cube: CubeCoord): CubeCoord[];
/**
 * Calculate distance between two hexes in cube coordinates
 */
export declare function cubeDistance(a: CubeCoord, b: CubeCoord): number;
//# sourceMappingURL=hexMath.d.ts.map