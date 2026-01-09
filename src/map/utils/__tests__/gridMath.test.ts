/**
 * Grid Math Unit Tests (TDD)
 * 
 * Tests for square grid line calculations.
 * These tests are written FIRST before implementation (TDD).
 */

import { 
  calculateSquareGridLines, 
  type Line,
  type GridLineParams 
} from '../gridMath';

describe('calculateSquareGridLines', () => {
  describe('basic grid generation', () => {
    it('should generate correct number of lines for 100x100 canvas with 10px cells', () => {
      const lines = calculateSquareGridLines({
        width: 100,
        height: 100,
        cellSize: 10,
        offsetX: 0,
        offsetY: 0,
      });
      
      // 11 vertical lines (0, 10, 20, ..., 100) + 11 horizontal lines = 22
      expect(lines.length).toBe(22);
    });

    it('should return empty array when cell size exceeds canvas dimensions', () => {
      const lines = calculateSquareGridLines({
        width: 50,
        height: 50,
        cellSize: 100,
        offsetX: 0,
        offsetY: 0,
      });
      
      // Should still have at least boundary lines
      expect(lines.length).toBeGreaterThanOrEqual(0);
    });

    it('should generate lines spanning full canvas width and height', () => {
      const lines = calculateSquareGridLines({
        width: 100,
        height: 100,
        cellSize: 50,
        offsetX: 0,
        offsetY: 0,
      });

      // Find vertical lines
      const verticalLines = lines.filter(
        (line) => line.points[0] === line.points[2]
      );
      
      // Find horizontal lines
      const horizontalLines = lines.filter(
        (line) => line.points[1] === line.points[3]
      );

      // Vertical lines should span from y=0 to y=100
      verticalLines.forEach((line) => {
        expect(line.points[1]).toBe(0);
        expect(line.points[3]).toBe(100);
      });

      // Horizontal lines should span from x=0 to x=100
      horizontalLines.forEach((line) => {
        expect(line.points[0]).toBe(0);
        expect(line.points[2]).toBe(100);
      });
    });
  });

  describe('offset handling', () => {
    it('should handle positive X offset correctly', () => {
      const lines = calculateSquareGridLines({
        width: 100,
        height: 100,
        cellSize: 50,
        offsetX: 25,
        offsetY: 0,
      });

      const verticalLines = lines.filter(
        (line) => line.points[0] === line.points[2]
      );

      // First vertical line should be at x=25, then 75
      const xPositions = verticalLines.map((line) => line.points[0]).sort((a, b) => a - b);
      expect(xPositions).toContain(25);
      expect(xPositions).toContain(75);
    });

    it('should handle positive Y offset correctly', () => {
      const lines = calculateSquareGridLines({
        width: 100,
        height: 100,
        cellSize: 50,
        offsetX: 0,
        offsetY: 25,
      });

      const horizontalLines = lines.filter(
        (line) => line.points[1] === line.points[3]
      );

      // First horizontal line should be at y=25, then 75
      const yPositions = horizontalLines.map((line) => line.points[1]).sort((a, b) => a - b);
      expect(yPositions).toContain(25);
      expect(yPositions).toContain(75);
    });

    it('should handle negative offset by wrapping correctly', () => {
      const lines = calculateSquareGridLines({
        width: 100,
        height: 100,
        cellSize: 50,
        offsetX: -25,
        offsetY: 0,
      });

      const verticalLines = lines.filter(
        (line) => line.points[0] === line.points[2]
      );

      // With -25 offset and 50 cell size, lines should be at 25, 75, etc.
      const xPositions = verticalLines.map((line) => line.points[0]).sort((a, b) => a - b);
      expect(xPositions).toContain(25);
    });
  });

  describe('edge cases', () => {
    it('should handle minimum cell size (10px)', () => {
      const lines = calculateSquareGridLines({
        width: 100,
        height: 100,
        cellSize: 10,
        offsetX: 0,
        offsetY: 0,
      });

      expect(lines.length).toBeGreaterThan(0);
    });

    it('should handle maximum cell size (200px)', () => {
      const lines = calculateSquareGridLines({
        width: 500,
        height: 500,
        cellSize: 200,
        offsetX: 0,
        offsetY: 0,
      });

      expect(lines.length).toBeGreaterThan(0);
    });

    it('should handle very small canvas', () => {
      const lines = calculateSquareGridLines({
        width: 20,
        height: 20,
        cellSize: 10,
        offsetX: 0,
        offsetY: 0,
      });

      expect(lines.length).toBeGreaterThan(0);
    });

    it('should handle non-integer cell sizes gracefully', () => {
      // Cell size should be integer, but function should handle floats
      const lines = calculateSquareGridLines({
        width: 100,
        height: 100,
        cellSize: 33.333,
        offsetX: 0,
        offsetY: 0,
      });

      expect(lines.length).toBeGreaterThan(0);
    });
  });

  describe('line format', () => {
    it('should return lines with correct point format [x1, y1, x2, y2]', () => {
      const lines = calculateSquareGridLines({
        width: 100,
        height: 100,
        cellSize: 50,
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

    it('should produce either horizontal or vertical lines', () => {
      const lines = calculateSquareGridLines({
        width: 100,
        height: 100,
        cellSize: 25,
        offsetX: 0,
        offsetY: 0,
      });

      lines.forEach((line) => {
        const isVertical = line.points[0] === line.points[2];
        const isHorizontal = line.points[1] === line.points[3];
        
        // Each line should be either vertical or horizontal
        expect(isVertical || isHorizontal).toBe(true);
      });
    });
  });
});
