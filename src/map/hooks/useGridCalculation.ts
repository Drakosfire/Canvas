/**
 * useGridCalculation Hook
 * 
 * Calculates grid lines based on grid configuration.
 * Uses the grid math utilities to compute line segments.
 */

import { useMemo } from 'react';
import { GridConfig } from '../types/map.types';
import { Line, calculateSquareGridLines } from '../utils/gridMath';
import { calculateHexGridLines } from '../utils/hexMath';

export interface UseGridCalculationParams {
  /** Viewport width in pixels */
  width: number;
  /** Viewport height in pixels */
  height: number;
  /** Grid configuration */
  gridConfig: GridConfig;
}

export interface UseGridCalculationResult {
  /** Array of line segments to render */
  lines: Line[];
}

/**
 * Hook that calculates grid lines based on configuration.
 * Returns an empty array if grid is not visible.
 * 
 * @param params - Grid calculation parameters
 * @returns Grid lines array
 */
export function useGridCalculation(
  params: UseGridCalculationParams
): UseGridCalculationResult {
  const { width, height, gridConfig } = params;

  const lines = useMemo(() => {
    // Return empty array if grid is not visible
    if (!gridConfig.visible) {
      return [];
    }

    // Prepare parameters for grid math functions
    const gridParams = {
      width,
      height,
      cellSize: gridConfig.cellSizePx,
      offsetX: gridConfig.offsetX,
      offsetY: gridConfig.offsetY,
    };

    // Calculate lines based on grid type
    if (gridConfig.type === 'hex') {
      return calculateHexGridLines(gridParams);
    }

    // Default to square grid
    return calculateSquareGridLines(gridParams);
  }, [
    width,
    height,
    gridConfig.visible,
    gridConfig.type,
    gridConfig.cellSizePx,
    gridConfig.offsetX,
    gridConfig.offsetY,
  ]);

  return { lines };
}
