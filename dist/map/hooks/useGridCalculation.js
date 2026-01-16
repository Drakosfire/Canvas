/**
 * useGridCalculation Hook
 *
 * Calculates grid lines based on grid configuration.
 * Uses the grid math utilities to compute line segments.
 */
import { useMemo } from 'react';
import { calculateSquareGridLines } from '../utils/gridMath';
import { calculateHexGridLines } from '../utils/hexMath';
/**
 * Hook that calculates grid lines based on configuration.
 * Returns an empty array if grid is not visible.
 *
 * @param params - Grid calculation parameters
 * @returns Grid lines array
 */
export function useGridCalculation(params) {
    var width = params.width, height = params.height, gridConfig = params.gridConfig;
    var lines = useMemo(function () {
        // Return empty array if grid is not visible
        if (!gridConfig.visible) {
            return [];
        }
        // Prepare parameters for grid math functions
        var gridParams = {
            width: width,
            height: height,
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
    return { lines: lines };
}
