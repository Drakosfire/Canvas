/**
 * useMaskDrawing Hook
 *
 * Manages mask drawing state for region-specific generation.
 * Implements TDD tests from T151-T155.
 */
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
import { useState, useCallback, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { DEFAULT_MASK_STATE } from '../types/mask.types';
var MIN_BRUSH_SIZE = 5;
var MAX_BRUSH_SIZE = 100;
var MAX_UNDO_STACK = 20;
export function useMaskDrawing() {
    var _a = useState(DEFAULT_MASK_STATE), state = _a[0], setState = _a[1];
    var setTool = useCallback(function (tool) {
        setState(function (prev) {
            if (prev.activeTool !== tool) {
                console.log("\uD83C\uDFA8 [MaskDrawing] Tool changed: ".concat(prev.activeTool, " \u2192 ").concat(tool));
            }
            return __assign(__assign({}, prev), { activeTool: tool });
        });
    }, []);
    var setBrushSize = useCallback(function (size) {
        var clampedSize = Math.max(MIN_BRUSH_SIZE, Math.min(MAX_BRUSH_SIZE, size));
        setState(function (prev) { return (__assign(__assign({}, prev), { brushSize: clampedSize })); });
    }, []);
    var startStroke = useCallback(function (x, y) {
        setState(function (prev) {
            var strokeId = uuidv4();
            console.log("\uD83C\uDFA8 [MaskDrawing] Starting stroke: tool=".concat(prev.activeTool, ", brushSize=").concat(prev.brushSize, ", pos=(").concat(x.toFixed(1), ", ").concat(y.toFixed(1), "), id=").concat(strokeId));
            return __assign(__assign({}, prev), { isDrawing: true, currentStroke: {
                    id: strokeId,
                    tool: prev.activeTool,
                    points: [x, y],
                    strokeWidth: prev.brushSize,
                } });
        });
    }, []);
    var continueStroke = useCallback(function (x, y) {
        setState(function (prev) {
            if (!prev.currentStroke) {
                console.warn('⚠️ [MaskDrawing] continueStroke called but no currentStroke');
                return prev;
            }
            var newPointCount = prev.currentStroke.points.length / 2 + 1;
            if (newPointCount % 10 === 0) {
                // Log every 10th point to avoid spam
                console.log("\uD83C\uDFA8 [MaskDrawing] Continuing stroke: ".concat(newPointCount, " points, pos=(").concat(x.toFixed(1), ", ").concat(y.toFixed(1), ")"));
            }
            return __assign(__assign({}, prev), { currentStroke: __assign(__assign({}, prev.currentStroke), { points: __spreadArray(__spreadArray([], prev.currentStroke.points, true), [x, y], false) }) });
        });
    }, []);
    var endStroke = useCallback(function () {
        setState(function (prev) {
            if (!prev.currentStroke) {
                console.warn('⚠️ [MaskDrawing] endStroke called but no currentStroke');
                return prev;
            }
            var pointCount = prev.currentStroke.points.length / 2;
            console.log("\uD83C\uDFA8 [MaskDrawing] Ending stroke: tool=".concat(prev.currentStroke.tool, ", ").concat(pointCount, " points, total strokes=").concat(prev.strokes.length + 1));
            var newStrokes = __spreadArray(__spreadArray([], prev.strokes, true), [prev.currentStroke], false);
            var newUndoStack = __spreadArray(__spreadArray([], prev.undoStack, true), [prev.strokes], false).slice(-MAX_UNDO_STACK);
            return __assign(__assign({}, prev), { strokes: newStrokes, currentStroke: null, isDrawing: false, undoStack: newUndoStack, redoStack: [] });
        });
    }, []);
    var addShape = useCallback(function (bounds) {
        setState(function (prev) {
            var shapeId = uuidv4();
            console.log("\uD83C\uDFA8 [MaskDrawing] Adding shape: tool=".concat(prev.activeTool, ", bounds=(").concat(bounds.x.toFixed(1), ", ").concat(bounds.y.toFixed(1), ", ").concat(bounds.width.toFixed(1), "x").concat(bounds.height.toFixed(1), "), id=").concat(shapeId));
            var newStroke = {
                id: shapeId,
                tool: prev.activeTool,
                points: [],
                strokeWidth: 0,
                bounds: bounds,
            };
            var newStrokes = __spreadArray(__spreadArray([], prev.strokes, true), [newStroke], false);
            var newUndoStack = __spreadArray(__spreadArray([], prev.undoStack, true), [prev.strokes], false).slice(-MAX_UNDO_STACK);
            return __assign(__assign({}, prev), { strokes: newStrokes, 
                // Also reset drawing state so endStroke doesn't add a duplicate
                currentStroke: null, isDrawing: false, undoStack: newUndoStack, redoStack: [] });
        });
    }, []);
    var undo = useCallback(function () {
        setState(function (prev) {
            if (prev.undoStack.length === 0) {
                console.warn('⚠️ [MaskDrawing] Undo called but undo stack is empty');
                return prev;
            }
            var previousStrokes = prev.undoStack[prev.undoStack.length - 1];
            console.log("\uD83C\uDFA8 [MaskDrawing] Undo: ".concat(prev.strokes.length, " strokes \u2192 ").concat(previousStrokes.length, " strokes"));
            var newUndoStack = prev.undoStack.slice(0, -1);
            var newRedoStack = __spreadArray(__spreadArray([], prev.redoStack, true), [prev.strokes], false);
            return __assign(__assign({}, prev), { strokes: previousStrokes, undoStack: newUndoStack, redoStack: newRedoStack });
        });
    }, []);
    var redo = useCallback(function () {
        setState(function (prev) {
            if (prev.redoStack.length === 0) {
                console.warn('⚠️ [MaskDrawing] Redo called but redo stack is empty');
                return prev;
            }
            var nextStrokes = prev.redoStack[prev.redoStack.length - 1];
            console.log("\uD83C\uDFA8 [MaskDrawing] Redo: ".concat(prev.strokes.length, " strokes \u2192 ").concat(nextStrokes.length, " strokes"));
            var newRedoStack = prev.redoStack.slice(0, -1);
            var newUndoStack = __spreadArray(__spreadArray([], prev.undoStack, true), [prev.strokes], false);
            return __assign(__assign({}, prev), { strokes: nextStrokes, undoStack: newUndoStack, redoStack: newRedoStack });
        });
    }, []);
    var clear = useCallback(function () {
        setState(function (prev) {
            console.log("\uD83C\uDFA8 [MaskDrawing] Clear: removing ".concat(prev.strokes.length, " strokes"));
            return __assign(__assign({}, prev), { strokes: [], currentStroke: null, isDrawing: false, undoStack: [], redoStack: [] });
        });
    }, []);
    var canUndo = state.undoStack.length > 0;
    var canRedo = state.redoStack.length > 0;
    var actions = useMemo(function () { return ({
        setTool: setTool,
        setBrushSize: setBrushSize,
        startStroke: startStroke,
        continueStroke: continueStroke,
        endStroke: endStroke,
        addShape: addShape,
        undo: undo,
        redo: redo,
        clear: clear,
        canUndo: canUndo,
        canRedo: canRedo,
    }); }, [
        setTool,
        setBrushSize,
        startStroke,
        continueStroke,
        endStroke,
        addShape,
        undo,
        redo,
        clear,
        canUndo,
        canRedo,
    ]);
    return { state: state, actions: actions };
}
