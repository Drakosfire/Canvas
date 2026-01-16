/**
 * BrushCursor Component
 *
 * Displays a reticle/cursor indicator showing the brush size under the mouse.
 * Only visible when in mask mode with brush or eraser tool.
 */
import React from 'react';
import type { MaskTool } from '../types/mask.types';
export interface BrushCursorProps {
    /** Current active tool */
    activeTool: MaskTool;
    /** Brush/eraser size in pixels */
    brushSize: number;
    /** Current mouse position in image coordinates (null to hide) */
    position: {
        x: number;
        y: number;
    } | null;
}
export declare const BrushCursor: React.FC<BrushCursorProps>;
//# sourceMappingURL=BrushCursor.d.ts.map