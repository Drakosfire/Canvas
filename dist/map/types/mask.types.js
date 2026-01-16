/**
 * Mask Drawing Types
 *
 * Types for the mask drawing feature that enables region-specific generation.
 */
/**
 * Default mask drawing state
 */
export var DEFAULT_MASK_STATE = {
    activeTool: 'brush',
    brushSize: 30,
    strokes: [],
    currentStroke: null,
    isDrawing: false,
    undoStack: [],
    redoStack: [],
};
