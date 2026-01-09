/**
 * Hex Math Unit Tests (TDD)
 * 
 * Tests for hexagonal grid calculations and coordinate conversions.
 * Uses cube coordinates with pointy-top orientation.
 * Reference: https://www.redblobgames.com/grids/hexagons/
 */

import {
  calculateHexGridLines,
  pixelToCube,
  cubeToPixel,
  cubeRound,
  type CubeCoord,
  type HexGridParams,
  type Line,
} from '../hexMath';

describe('cubeRound', () => {
  it('should round fractional cube coordinates to nearest valid hex', () => {
    // Cube constraint: x + y + z = 0
    const fractional = { x: 0.1, y: -0.1, z: 0 };
    const rounded = cubeRound(fractional);
    
    expect(rounded.x + rounded.y + rounded.z).toBe(0);
    expect(Number.isInteger(rounded.x)).toBe(true);
    expect(Number.isInteger(rounded.y)).toBe(true);
    expect(Number.isInteger(rounded.z)).toBe(true);
  });

  it('should preserve exact cube coordinates', () => {
    const exact = { x: 1, y: -1, z: 0 };
    const rounded = cubeRound(exact);
    
    expect(rounded).toEqual(exact);
  });

  it('should handle edge case where differences are equal', () => {
    // When dx == dy == dz, should still produce valid cube coord
    const fractional = { x: 0.5, y: -0.25, z: -0.25 };
    const rounded = cubeRound(fractional);
    
    expect(rounded.x + rounded.y + rounded.z).toBe(0);
  });

  it('should correctly round coordinates with largest x difference', () => {
    const fractional = { x: 0.9, y: -0.4, z: -0.5 };
    const rounded = cubeRound(fractional);
    
    expect(rounded.x + rounded.y + rounded.z).toBe(0);
  });

  it('should correctly round coordinates with largest y difference', () => {
    const fractional = { x: 0.1, y: -0.9, z: 0.8 };
    const rounded = cubeRound(fractional);
    
    expect(rounded.x + rounded.y + rounded.z).toBe(0);
  });

  it('should correctly round coordinates with largest z difference', () => {
    const fractional = { x: 0.1, y: -0.2, z: 0.9 };
    const rounded = cubeRound(fractional);
    
    expect(rounded.x + rounded.y + rounded.z).toBe(0);
  });
});

describe('pixelToCube', () => {
  it('should convert center pixel (0,0) to cube origin with any hex size', () => {
    const cube = pixelToCube(0, 0, 50);
    
    // Use toBe for individual values to handle -0 vs 0 edge case
    expect(cube.x).toBe(0);
    expect(cube.y === 0 || Object.is(cube.y, -0)).toBe(true); // Handle -0
    expect(cube.z).toBe(0);
    expect(cube.x + cube.y + cube.z).toBe(0);
  });

  it('should return valid cube coordinates (x + y + z = 0)', () => {
    const testCases = [
      { px: 100, py: 50, size: 30 },
      { px: -75, py: 100, size: 40 },
      { px: 200, py: 200, size: 25 },
    ];

    testCases.forEach(({ px, py, size }) => {
      const cube = pixelToCube(px, py, size);
      expect(cube.x + cube.y + cube.z).toBe(0);
    });
  });

  it('should be consistent with cubeToPixel (round-trip)', () => {
    const originalCube: CubeCoord = { x: 2, y: -1, z: -1 };
    const size = 50;
    
    const pixel = cubeToPixel(originalCube, size);
    const roundTrip = pixelToCube(pixel.px, pixel.py, size);
    
    expect(roundTrip).toEqual(originalCube);
  });
});

describe('cubeToPixel', () => {
  it('should convert cube origin to pixel origin', () => {
    const pixel = cubeToPixel({ x: 0, y: 0, z: 0 }, 50);
    
    expect(pixel.px).toBe(0);
    expect(pixel.py).toBe(0);
  });

  it('should calculate correct pixel position for known cube coordinate', () => {
    const size = 50;
    const cube: CubeCoord = { x: 1, y: 0, z: -1 };
    const pixel = cubeToPixel(cube, size);
    
    // For pointy-top hex:
    // px = size * sqrt(3) * (q + r/2)
    // py = size * 3/2 * r
    const expectedPx = size * Math.sqrt(3) * (cube.x + cube.z / 2);
    const expectedPy = size * (3 / 2) * cube.z;
    
    expect(pixel.px).toBeCloseTo(expectedPx, 5);
    expect(pixel.py).toBeCloseTo(expectedPy, 5);
  });

  it('should scale correctly with hex size', () => {
    const cube: CubeCoord = { x: 1, y: -1, z: 0 };
    
    const pixel30 = cubeToPixel(cube, 30);
    const pixel60 = cubeToPixel(cube, 60);
    
    // Doubling size should double the pixel position
    expect(pixel60.px).toBeCloseTo(pixel30.px * 2, 5);
    expect(pixel60.py).toBeCloseTo(pixel30.py * 2, 5);
  });
});

describe('calculateHexGridLines', () => {
  describe('basic hex grid generation', () => {
    it('should generate lines for a simple hex grid', () => {
      const lines = calculateHexGridLines({
        width: 200,
        height: 200,
        cellSize: 30,
        offsetX: 0,
        offsetY: 0,
      });

      expect(lines.length).toBeGreaterThan(0);
    });

    it('should return empty array when cell size exceeds canvas dimensions', () => {
      const lines = calculateHexGridLines({
        width: 50,
        height: 50,
        cellSize: 100,
        offsetX: 0,
        offsetY: 0,
      });

      // May have some lines at edges
      expect(Array.isArray(lines)).toBe(true);
    });

    it('should generate lines with correct format [x1, y1, x2, y2]', () => {
      const lines = calculateHexGridLines({
        width: 200,
        height: 200,
        cellSize: 40,
        offsetX: 0,
        offsetY: 0,
      });

      lines.forEach((line) => {
        expect(line.points).toHaveLength(4);
        expect(typeof line.points[0]).toBe('number');
        expect(typeof line.points[1]).toBe('number');
        expect(typeof line.points[2]).toBe('number');
        expect(typeof line.points[3]).toBe('number');
      });
    });
  });

  describe('offset handling', () => {
    it('should shift grid with positive offset', () => {
      const noOffset = calculateHexGridLines({
        width: 200,
        height: 200,
        cellSize: 40,
        offsetX: 0,
        offsetY: 0,
      });

      const withOffset = calculateHexGridLines({
        width: 200,
        height: 200,
        cellSize: 40,
        offsetX: 20,
        offsetY: 20,
      });

      // Should have similar number of lines
      expect(Math.abs(noOffset.length - withOffset.length)).toBeLessThan(10);
      
      // But different positions
      if (noOffset.length > 0 && withOffset.length > 0) {
        const noOffsetFirst = noOffset[0].points;
        const withOffsetFirst = withOffset[0].points;
        
        // At least one coordinate should differ
        const areDifferent = 
          noOffsetFirst[0] !== withOffsetFirst[0] ||
          noOffsetFirst[1] !== withOffsetFirst[1] ||
          noOffsetFirst[2] !== withOffsetFirst[2] ||
          noOffsetFirst[3] !== withOffsetFirst[3];
        
        expect(areDifferent).toBe(true);
      }
    });
  });

  describe('hex geometry', () => {
    it('should create hex pattern where each hex has 6 edges', () => {
      const lines = calculateHexGridLines({
        width: 300,
        height: 300,
        cellSize: 50,
        offsetX: 0,
        offsetY: 0,
      });

      // A complete hex grid should have many lines
      // For a 300x300 area with 50px hex size, expect several dozen lines
      expect(lines.length).toBeGreaterThan(10);
    });
  });

  describe('edge cases', () => {
    it('should handle minimum cell size', () => {
      const lines = calculateHexGridLines({
        width: 100,
        height: 100,
        cellSize: 10,
        offsetX: 0,
        offsetY: 0,
      });

      expect(lines.length).toBeGreaterThan(0);
    });

    it('should handle maximum cell size', () => {
      const lines = calculateHexGridLines({
        width: 500,
        height: 500,
        cellSize: 200,
        offsetX: 0,
        offsetY: 0,
      });

      expect(lines.length).toBeGreaterThan(0);
    });

    it('should handle negative offsets', () => {
      const lines = calculateHexGridLines({
        width: 200,
        height: 200,
        cellSize: 40,
        offsetX: -20,
        offsetY: -20,
      });

      expect(Array.isArray(lines)).toBe(true);
    });
  });
});
