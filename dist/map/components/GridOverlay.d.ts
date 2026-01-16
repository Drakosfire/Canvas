/**
 * GridOverlay Component
 *
 * Renders a grid overlay on top of the base map image.
 * Supports both square and hexagonal grid patterns.
 * Uses the useGridCalculation hook to compute grid lines.
 * When in 'grid-adjust' mode, the grid can be dragged to adjust offset.
 */
import { GridConfig, MapEditMode } from '../types/map.types';
export interface GridOverlayProps {
    /** Viewport width in pixels */
    width: number;
    /** Viewport height in pixels */
    height: number;
    /** Grid configuration */
    gridConfig: GridConfig;
    /** Current editing mode (defaults to 'view') */
    mode?: MapEditMode;
    /** Callback when grid offset changes (only used in grid-adjust mode) */
    onOffsetChange?: (offset: {
        offsetX: number;
        offsetY: number;
    }) => void;
}
/**
 * GridOverlay renders grid lines using Konva Lines.
 * The layer is non-interactive (listening={false}) so it doesn't
 * interfere with map panning/zooming, except when in grid-adjust mode.
 */
export declare function GridOverlay({ width, height, gridConfig, mode, onOffsetChange, }: GridOverlayProps): import("react/jsx-runtime").JSX.Element | null;
//# sourceMappingURL=GridOverlay.d.ts.map