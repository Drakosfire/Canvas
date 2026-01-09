/**
 * useGridCalculation Hook Tests (TDD)
 * 
 * Tests for the hook that calculates grid lines based on configuration.
 */

import { renderHook } from '@testing-library/react';
import { useGridCalculation } from '../useGridCalculation';
import { DEFAULT_GRID_CONFIG, GridConfig } from '../../types/map.types';

describe('useGridCalculation', () => {
  const defaultProps = {
    width: 800,
    height: 600,
    gridConfig: DEFAULT_GRID_CONFIG,
  };

  describe('initialization', () => {
    it('should return empty array when grid is not visible', () => {
      const config: GridConfig = {
        ...DEFAULT_GRID_CONFIG,
        visible: false,
      };

      const { result } = renderHook(() =>
        useGridCalculation({
          ...defaultProps,
          gridConfig: config,
        })
      );

      expect(result.current.lines).toEqual([]);
    });

    it('should calculate grid lines when grid is visible', () => {
      const config: GridConfig = {
        ...DEFAULT_GRID_CONFIG,
        visible: true,
        cellSizePx: 50,
      };

      const { result } = renderHook(() =>
        useGridCalculation({
          ...defaultProps,
          gridConfig: config,
        })
      );

      expect(result.current.lines.length).toBeGreaterThan(0);
    });
  });

  describe('square grid calculation', () => {
    it('should calculate square grid lines with default config', () => {
      const config: GridConfig = {
        ...DEFAULT_GRID_CONFIG,
        visible: true,
        type: 'square',
        cellSizePx: 50,
        offsetX: 0,
        offsetY: 0,
      };

      const { result } = renderHook(() =>
        useGridCalculation({
          ...defaultProps,
          gridConfig: config,
        })
      );

      expect(result.current.lines.length).toBeGreaterThan(0);
      
      // Verify line structure
      result.current.lines.forEach((line) => {
        expect(line.points).toHaveLength(4);
        expect(line.points[0]).toBeGreaterThanOrEqual(0);
        expect(line.points[1]).toBeGreaterThanOrEqual(0);
        expect(line.points[2]).toBeGreaterThanOrEqual(0);
        expect(line.points[3]).toBeGreaterThanOrEqual(0);
      });
    });

    it('should apply offsets correctly for square grid', () => {
      const config: GridConfig = {
        ...DEFAULT_GRID_CONFIG,
        visible: true,
        type: 'square',
        cellSizePx: 50,
        offsetX: 25,
        offsetY: 30,
      };

      const { result } = renderHook(() =>
        useGridCalculation({
          ...defaultProps,
          gridConfig: config,
        })
      );

      expect(result.current.lines.length).toBeGreaterThan(0);
    });

    it('should handle different cell sizes for square grid', () => {
      const config1: GridConfig = {
        ...DEFAULT_GRID_CONFIG,
        visible: true,
        type: 'square',
        cellSizePx: 50,
      };

      const { result: result1 } = renderHook(() =>
        useGridCalculation({
          ...defaultProps,
          gridConfig: config1,
        })
      );

      const config2: GridConfig = {
        ...DEFAULT_GRID_CONFIG,
        visible: true,
        type: 'square',
        cellSizePx: 100,
      };

      const { result: result2 } = renderHook(() =>
        useGridCalculation({
          ...defaultProps,
          gridConfig: config2,
        })
      );

      // Different cell sizes should produce different line counts
      expect(result2.current.lines.length).not.toBe(result1.current.lines.length);
    });
  });

  describe('hex grid calculation', () => {
    it('should calculate hex grid lines when type is hex', () => {
      const config: GridConfig = {
        ...DEFAULT_GRID_CONFIG,
        visible: true,
        type: 'hex',
        cellSizePx: 50,
        offsetX: 0,
        offsetY: 0,
      };

      const { result } = renderHook(() =>
        useGridCalculation({
          ...defaultProps,
          gridConfig: config,
        })
      );

      expect(result.current.lines.length).toBeGreaterThan(0);
      
      // Verify line structure
      result.current.lines.forEach((line) => {
        expect(line.points).toHaveLength(4);
      });
    });

    it('should apply offsets correctly for hex grid', () => {
      const config: GridConfig = {
        ...DEFAULT_GRID_CONFIG,
        visible: true,
        type: 'hex',
        cellSizePx: 50,
        offsetX: 30,
        offsetY: 40,
      };

      const { result } = renderHook(() =>
        useGridCalculation({
          ...defaultProps,
          gridConfig: config,
        })
      );

      expect(result.current.lines.length).toBeGreaterThan(0);
    });

    it('should handle different cell sizes for hex grid', () => {
      const config1: GridConfig = {
        ...DEFAULT_GRID_CONFIG,
        visible: true,
        type: 'hex',
        cellSizePx: 50,
      };

      const { result: result1 } = renderHook(() =>
        useGridCalculation({
          ...defaultProps,
          gridConfig: config1,
        })
      );

      const config2: GridConfig = {
        ...DEFAULT_GRID_CONFIG,
        visible: true,
        type: 'hex',
        cellSizePx: 100,
      };

      const { result: result2 } = renderHook(() =>
        useGridCalculation({
          ...defaultProps,
          gridConfig: config2,
        })
      );

      // Different cell sizes should produce different line counts
      expect(result2.current.lines.length).not.toBe(result1.current.lines.length);
    });
  });

  describe('dimension changes', () => {
    it('should recalculate when width changes', () => {
      const config: GridConfig = {
        ...DEFAULT_GRID_CONFIG,
        visible: true,
        cellSizePx: 50,
      };

      const { result: result1, rerender } = renderHook(
        (props) => useGridCalculation(props),
        {
          initialProps: {
            ...defaultProps,
            width: 800,
            gridConfig: config,
          },
        }
      );

      const count1 = result1.current.lines.length;

      rerender({
        ...defaultProps,
        width: 1200,
        gridConfig: config,
      });

      // Width change should produce different line counts
      // (more columns = more vertical lines)
      expect(result1.current.lines.length).not.toBe(count1);
    });

    it('should recalculate when height changes', () => {
      const config: GridConfig = {
        ...DEFAULT_GRID_CONFIG,
        visible: true,
        cellSizePx: 50,
      };

      const { result: result1, rerender } = renderHook(
        (props) => useGridCalculation(props),
        {
          initialProps: {
            ...defaultProps,
            height: 600,
            gridConfig: config,
          },
        }
      );

      const count1 = result1.current.lines.length;

      rerender({
        ...defaultProps,
        height: 900,
        gridConfig: config,
      });

      // Height change should produce different line counts
      // (more rows = more horizontal lines)
      expect(result1.current.lines.length).not.toBe(count1);
    });
  });

  describe('edge cases', () => {
    it('should handle zero cell size gracefully', () => {
      const config: GridConfig = {
        ...DEFAULT_GRID_CONFIG,
        visible: true,
        cellSizePx: 0,
      };

      const { result } = renderHook(() =>
        useGridCalculation({
          ...defaultProps,
          gridConfig: config,
        })
      );

      // Should return empty array for invalid cell size
      expect(result.current.lines).toEqual([]);
    });

    it('should handle negative cell size gracefully', () => {
      const config: GridConfig = {
        ...DEFAULT_GRID_CONFIG,
        visible: true,
        cellSizePx: -10,
      };

      const { result } = renderHook(() =>
        useGridCalculation({
          ...defaultProps,
          gridConfig: config,
        })
      );

      // Should return empty array for invalid cell size
      expect(result.current.lines).toEqual([]);
    });

    it('should handle very small viewports', () => {
      const config: GridConfig = {
        ...DEFAULT_GRID_CONFIG,
        visible: true,
        cellSizePx: 10,
      };

      const { result } = renderHook(() =>
        useGridCalculation({
          width: 50,
          height: 50,
          gridConfig: config,
        })
      );

      // Should still return valid lines array (may be empty)
      expect(Array.isArray(result.current.lines)).toBe(true);
    });
  });
});
