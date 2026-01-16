/**
 * useGridCalculation Hook
 *
 * Calculates grid lines based on grid configuration.
 * Uses the grid math utilities to compute line segments.
 */
import { GridConfig } from '../types/map.types';
import { Line } from '../utils/gridMath';
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
export declare function useGridCalculation(params: UseGridCalculationParams): UseGridCalculationResult;
//# sourceMappingURL=useGridCalculation.d.ts.map