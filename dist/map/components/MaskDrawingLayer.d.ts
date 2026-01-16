/**
 * MaskDrawingLayer Component
 *
 * Konva layer for rendering mask strokes (brush, eraser, shapes).
 * Implements TDD tests from T156-T161.
 */
import React from 'react';
import type { MaskStroke, MaskTool } from '../types/mask.types';
export interface MaskDrawingLayerProps {
    strokes: MaskStroke[];
    currentStroke: MaskStroke | null;
    activeTool: MaskTool;
    brushSize: number;
    isDrawing: boolean;
    onStrokeStart: (x: number, y: number) => void;
    onStrokeContinue: (x: number, y: number) => void;
    onStrokeEnd: () => void;
    onShapeAdd: (bounds: {
        x: number;
        y: number;
        width: number;
        height: number;
    }) => void;
    /** Image width for hit detection area */
    imageWidth: number;
    /** Image height for hit detection area */
    imageHeight: number;
    /** Buffer around the stage for extended drawing area (default: 0) */
    stageBuffer?: number;
}
export declare const MaskDrawingLayer: React.FC<MaskDrawingLayerProps>;
//# sourceMappingURL=MaskDrawingLayer.d.ts.map