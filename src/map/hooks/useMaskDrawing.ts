/**
 * useMaskDrawing Hook
 *
 * Manages mask drawing state for region-specific generation.
 * Implements TDD tests from T151-T155.
 */

import { useState, useCallback, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type {
  MaskTool,
  MaskStroke,
  MaskDrawingState,
  MaskDrawingActions,
} from '../types/mask.types';
import { DEFAULT_MASK_STATE } from '../types/mask.types';

const MIN_BRUSH_SIZE = 5;
const MAX_BRUSH_SIZE = 100;
const MAX_UNDO_STACK = 20;

export interface UseMaskDrawingResult {
  state: MaskDrawingState;
  actions: MaskDrawingActions;
}

export function useMaskDrawing(): UseMaskDrawingResult {
  const [state, setState] = useState<MaskDrawingState>(DEFAULT_MASK_STATE);

  const setTool = useCallback((tool: MaskTool) => {
    setState((prev) => {
      if (prev.activeTool !== tool) {
        console.log(`🎨 [MaskDrawing] Tool changed: ${prev.activeTool} → ${tool}`);
      }
      return { ...prev, activeTool: tool };
    });
  }, []);

  const setBrushSize = useCallback((size: number) => {
    const clampedSize = Math.max(MIN_BRUSH_SIZE, Math.min(MAX_BRUSH_SIZE, size));
    setState((prev) => ({ ...prev, brushSize: clampedSize }));
  }, []);

  const startStroke = useCallback((x: number, y: number) => {
    setState((prev) => {
      const strokeId = uuidv4();
      console.log(`🎨 [MaskDrawing] Starting stroke: tool=${prev.activeTool}, brushSize=${prev.brushSize}, pos=(${x.toFixed(1)}, ${y.toFixed(1)}), id=${strokeId}`);
      return {
        ...prev,
        isDrawing: true,
        currentStroke: {
          id: strokeId,
          tool: prev.activeTool,
          points: [x, y],
          strokeWidth: prev.brushSize,
        },
      };
    });
  }, []);

  const continueStroke = useCallback((x: number, y: number) => {
    setState((prev) => {
      if (!prev.currentStroke) {
        console.warn('⚠️ [MaskDrawing] continueStroke called but no currentStroke');
        return prev;
      }
      const newPointCount = prev.currentStroke.points.length / 2 + 1;
      if (newPointCount % 10 === 0) {
        // Log every 10th point to avoid spam
        console.log(`🎨 [MaskDrawing] Continuing stroke: ${newPointCount} points, pos=(${x.toFixed(1)}, ${y.toFixed(1)})`);
      }
      return {
        ...prev,
        currentStroke: {
          ...prev.currentStroke,
          points: [...prev.currentStroke.points, x, y],
        },
      };
    });
  }, []);

  const endStroke = useCallback(() => {
    setState((prev) => {
      if (!prev.currentStroke) {
        console.warn('⚠️ [MaskDrawing] endStroke called but no currentStroke');
        return prev;
      }

      const pointCount = prev.currentStroke.points.length / 2;
      console.log(`🎨 [MaskDrawing] Ending stroke: tool=${prev.currentStroke.tool}, ${pointCount} points, total strokes=${prev.strokes.length + 1}`);

      const newStrokes = [...prev.strokes, prev.currentStroke];
      const newUndoStack = [...prev.undoStack, prev.strokes].slice(-MAX_UNDO_STACK);

      return {
        ...prev,
        strokes: newStrokes,
        currentStroke: null,
        isDrawing: false,
        undoStack: newUndoStack,
        redoStack: [], // Clear redo on new action
      };
    });
  }, []);

  const addShape = useCallback(
    (bounds: { x: number; y: number; width: number; height: number }) => {
      setState((prev) => {
        const shapeId = uuidv4();
        console.log(`🎨 [MaskDrawing] Adding shape: tool=${prev.activeTool}, bounds=(${bounds.x.toFixed(1)}, ${bounds.y.toFixed(1)}, ${bounds.width.toFixed(1)}x${bounds.height.toFixed(1)}), id=${shapeId}`);
        const newStroke: MaskStroke = {
          id: shapeId,
          tool: prev.activeTool,
          points: [],
          strokeWidth: 0,
          bounds,
        };

        const newStrokes = [...prev.strokes, newStroke];
        const newUndoStack = [...prev.undoStack, prev.strokes].slice(-MAX_UNDO_STACK);

        return {
          ...prev,
          strokes: newStrokes,
          undoStack: newUndoStack,
          redoStack: [],
        };
      });
    },
    []
  );

  const undo = useCallback(() => {
    setState((prev) => {
      if (prev.undoStack.length === 0) {
        console.warn('⚠️ [MaskDrawing] Undo called but undo stack is empty');
        return prev;
      }

      const previousStrokes = prev.undoStack[prev.undoStack.length - 1];
      console.log(`🎨 [MaskDrawing] Undo: ${prev.strokes.length} strokes → ${previousStrokes.length} strokes`);
      const newUndoStack = prev.undoStack.slice(0, -1);
      const newRedoStack = [...prev.redoStack, prev.strokes];

      return {
        ...prev,
        strokes: previousStrokes,
        undoStack: newUndoStack,
        redoStack: newRedoStack,
      };
    });
  }, []);

  const redo = useCallback(() => {
    setState((prev) => {
      if (prev.redoStack.length === 0) {
        console.warn('⚠️ [MaskDrawing] Redo called but redo stack is empty');
        return prev;
      }

      const nextStrokes = prev.redoStack[prev.redoStack.length - 1];
      console.log(`🎨 [MaskDrawing] Redo: ${prev.strokes.length} strokes → ${nextStrokes.length} strokes`);
      const newRedoStack = prev.redoStack.slice(0, -1);
      const newUndoStack = [...prev.undoStack, prev.strokes];

      return {
        ...prev,
        strokes: nextStrokes,
        undoStack: newUndoStack,
        redoStack: newRedoStack,
      };
    });
  }, []);

  const clear = useCallback(() => {
    setState((prev) => {
      console.log(`🎨 [MaskDrawing] Clear: removing ${prev.strokes.length} strokes`);
      return {
        ...prev,
        strokes: [],
        currentStroke: null,
        isDrawing: false,
        undoStack: [],
        redoStack: [],
      };
    });
  }, []);

  const canUndo = state.undoStack.length > 0;
  const canRedo = state.redoStack.length > 0;

  const actions: MaskDrawingActions = useMemo(
    () => ({
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
    }),
    [
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
    ]
  );

  return { state, actions };
}
