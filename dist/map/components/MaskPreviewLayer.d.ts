/**
 * Mask Preview Layer
 *
 * Renders mask strokes as a semi-transparent overlay when not in mask mode.
 * Used to preview mask boundaries without being able to edit them.
 */
import React from 'react';
import type { MaskStroke } from '../types/mask.types';
export interface MaskPreviewLayerProps {
    /** Mask strokes to render */
    strokes: MaskStroke[];
    /** Opacity for preview overlay (0-1, default 0.3) */
    opacity?: number;
    /** Preview color (default: semi-transparent blue) */
    color?: string;
}
/**
 * MaskPreviewLayer renders mask strokes as a semi-transparent overlay.
 * Used when mask mode is disabled but mask data exists (T208).
 */
export declare const MaskPreviewLayer: React.FC<MaskPreviewLayerProps>;
//# sourceMappingURL=MaskPreviewLayer.d.ts.map