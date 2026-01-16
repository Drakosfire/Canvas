/**
 * Mask Drawing Types
 *
 * Types for the mask drawing feature that enables region-specific generation.
 */
/**
 * Drawing tool modes for mask creation
 */
export type MaskTool = 'brush' | 'eraser' | 'rect' | 'circle';
/**
 * A single stroke in the mask drawing history
 */
export interface MaskStroke {
    /** Unique identifier */
    id: string;
    /** Tool used for this stroke */
    tool: MaskTool;
    /** Points array for freehand: [x1, y1, x2, y2, ...] */
    points: number[];
    /** Stroke width in pixels */
    strokeWidth: number;
    /** For rect/circle: bounding box */
    bounds?: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
}
/**
 * Mask drawing state managed by useMaskDrawing hook
 */
export interface MaskDrawingState {
    /** Current active tool */
    activeTool: MaskTool;
    /** Brush/eraser size in pixels (5-100) */
    brushSize: number;
    /** All strokes in the mask */
    strokes: MaskStroke[];
    /** Current stroke being drawn (null when not drawing) */
    currentStroke: MaskStroke | null;
    /** Whether user is currently drawing */
    isDrawing: boolean;
    /** Undo history stack */
    undoStack: MaskStroke[][];
    /** Redo history stack */
    redoStack: MaskStroke[][];
}
/**
 * Actions returned by useMaskDrawing hook
 */
export interface MaskDrawingActions {
    /** Set the active drawing tool */
    setTool: (tool: MaskTool) => void;
    /** Set brush/eraser size */
    setBrushSize: (size: number) => void;
    /** Start a new stroke */
    startStroke: (x: number, y: number) => void;
    /** Continue current stroke */
    continueStroke: (x: number, y: number) => void;
    /** End current stroke */
    endStroke: () => void;
    /** Add a shape (rect/circle) at position */
    addShape: (bounds: {
        x: number;
        y: number;
        width: number;
        height: number;
    }) => void;
    /** Undo last stroke */
    undo: () => void;
    /** Redo undone stroke */
    redo: () => void;
    /** Clear all strokes */
    clear: () => void;
    /** Check if undo is available */
    canUndo: boolean;
    /** Check if redo is available */
    canRedo: boolean;
}
/**
 * Default mask drawing state
 */
export declare const DEFAULT_MASK_STATE: MaskDrawingState;
/**
 * Mask export result
 */
export interface MaskExportResult {
    /** Base64-encoded PNG data (with alpha channel) */
    base64: string;
    /** Width of the mask image */
    width: number;
    /** Height of the mask image */
    height: number;
}
/**
 * Options for exporting mask to base64
 */
export interface MaskExportOptions {
    /** Width of the mask image */
    width: number;
    /** Height of the mask image */
    height: number;
    /** All strokes to render */
    strokes: MaskStroke[];
}
//# sourceMappingURL=mask.types.d.ts.map