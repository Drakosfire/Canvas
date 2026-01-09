/**
 * useMaskDrawing Hook Tests (TDD - T151-T155)
 *
 * Tests for the hook that manages mask drawing state and operations.
 * Written BEFORE implementation - these tests MUST FAIL initially.
 */

import { renderHook, act } from '@testing-library/react';
import { useMaskDrawing } from '../useMaskDrawing';
import type { MaskTool } from '../../types/mask.types';

describe('useMaskDrawing', () => {
  // =========================================================================
  // T151: Brush State Management
  // =========================================================================
  describe('brush state management (T151)', () => {
    it('should initialize with default state', () => {
      const { result } = renderHook(() => useMaskDrawing());

      expect(result.current.state.activeTool).toBe('brush');
      expect(result.current.state.brushSize).toBe(30);
      expect(result.current.state.strokes).toEqual([]);
      expect(result.current.state.isDrawing).toBe(false);
    });

    it('should update brush size within valid range', () => {
      const { result } = renderHook(() => useMaskDrawing());

      act(() => {
        result.current.actions.setBrushSize(50);
      });

      expect(result.current.state.brushSize).toBe(50);
    });

    it('should clamp brush size to minimum (5px)', () => {
      const { result } = renderHook(() => useMaskDrawing());

      act(() => {
        result.current.actions.setBrushSize(2);
      });

      expect(result.current.state.brushSize).toBe(5);
    });

    it('should clamp brush size to maximum (100px)', () => {
      const { result } = renderHook(() => useMaskDrawing());

      act(() => {
        result.current.actions.setBrushSize(150);
      });

      expect(result.current.state.brushSize).toBe(100);
    });

    it('should track drawing state during stroke', () => {
      const { result } = renderHook(() => useMaskDrawing());

      expect(result.current.state.isDrawing).toBe(false);

      act(() => {
        result.current.actions.startStroke(100, 100);
      });

      expect(result.current.state.isDrawing).toBe(true);
      expect(result.current.state.currentStroke).not.toBeNull();

      act(() => {
        result.current.actions.endStroke();
      });

      expect(result.current.state.isDrawing).toBe(false);
      expect(result.current.state.currentStroke).toBeNull();
    });
  });

  // =========================================================================
  // T152: Eraser Mode Toggle
  // =========================================================================
  describe('eraser mode toggle (T152)', () => {
    it('should switch to eraser tool', () => {
      const { result } = renderHook(() => useMaskDrawing());

      act(() => {
        result.current.actions.setTool('eraser');
      });

      expect(result.current.state.activeTool).toBe('eraser');
    });

    it('should switch back to brush from eraser', () => {
      const { result } = renderHook(() => useMaskDrawing());

      act(() => {
        result.current.actions.setTool('eraser');
      });

      act(() => {
        result.current.actions.setTool('brush');
      });

      expect(result.current.state.activeTool).toBe('brush');
    });

    it('should preserve brush size when switching tools', () => {
      const { result } = renderHook(() => useMaskDrawing());

      act(() => {
        result.current.actions.setBrushSize(75);
      });

      act(() => {
        result.current.actions.setTool('eraser');
      });

      expect(result.current.state.brushSize).toBe(75);
    });
  });

  // =========================================================================
  // T153: Undo/Redo Stack (Max 20 Operations)
  // =========================================================================
  describe('undo/redo stack (T153)', () => {
    it('should start with empty undo/redo stacks', () => {
      const { result } = renderHook(() => useMaskDrawing());

      expect(result.current.actions.canUndo).toBe(false);
      expect(result.current.actions.canRedo).toBe(false);
    });

    it('should enable undo after adding a stroke', () => {
      const { result } = renderHook(() => useMaskDrawing());

      act(() => {
        result.current.actions.startStroke(100, 100);
        result.current.actions.continueStroke(150, 150);
        result.current.actions.endStroke();
      });

      expect(result.current.actions.canUndo).toBe(true);
      expect(result.current.state.strokes.length).toBe(1);
    });

    it('should remove stroke on undo', () => {
      const { result } = renderHook(() => useMaskDrawing());

      act(() => {
        result.current.actions.startStroke(100, 100);
        result.current.actions.endStroke();
      });

      expect(result.current.state.strokes.length).toBe(1);

      act(() => {
        result.current.actions.undo();
      });

      expect(result.current.state.strokes.length).toBe(0);
      expect(result.current.actions.canRedo).toBe(true);
    });

    it('should restore stroke on redo', () => {
      const { result } = renderHook(() => useMaskDrawing());

      act(() => {
        result.current.actions.startStroke(100, 100);
        result.current.actions.endStroke();
      });

      act(() => {
        result.current.actions.undo();
      });

      act(() => {
        result.current.actions.redo();
      });

      expect(result.current.state.strokes.length).toBe(1);
    });

    it('should cap undo stack at 20 operations', () => {
      const { result } = renderHook(() => useMaskDrawing());

      // Add 25 strokes
      for (let i = 0; i < 25; i++) {
        act(() => {
          result.current.actions.startStroke(i * 10, i * 10);
          result.current.actions.endStroke();
        });
      }

      // Should have 25 strokes
      expect(result.current.state.strokes.length).toBe(25);

      // But undo stack should be capped at 20
      let undoCount = 0;
      while (result.current.actions.canUndo) {
        act(() => {
          result.current.actions.undo();
        });
        undoCount++;
        if (undoCount > 25) break; // Safety
      }

      expect(undoCount).toBeLessThanOrEqual(20);
    });

    it('should clear redo stack when new stroke added after undo', () => {
      const { result } = renderHook(() => useMaskDrawing());

      // Add two strokes
      act(() => {
        result.current.actions.startStroke(100, 100);
        result.current.actions.endStroke();
      });

      act(() => {
        result.current.actions.startStroke(200, 200);
        result.current.actions.endStroke();
      });

      // Undo one
      act(() => {
        result.current.actions.undo();
      });

      expect(result.current.actions.canRedo).toBe(true);

      // Add new stroke (should clear redo)
      act(() => {
        result.current.actions.startStroke(300, 300);
        result.current.actions.endStroke();
      });

      expect(result.current.actions.canRedo).toBe(false);
    });
  });

  // =========================================================================
  // T154: Clear Mask Action
  // =========================================================================
  describe('clear mask action (T154)', () => {
    it('should clear all strokes', () => {
      const { result } = renderHook(() => useMaskDrawing());

      // Add multiple strokes
      act(() => {
        result.current.actions.startStroke(100, 100);
        result.current.actions.endStroke();
      });

      act(() => {
        result.current.actions.startStroke(200, 200);
        result.current.actions.endStroke();
      });

      expect(result.current.state.strokes.length).toBe(2);

      act(() => {
        result.current.actions.clear();
      });

      expect(result.current.state.strokes.length).toBe(0);
    });

    it('should reset undo/redo stacks on clear', () => {
      const { result } = renderHook(() => useMaskDrawing());

      act(() => {
        result.current.actions.startStroke(100, 100);
        result.current.actions.endStroke();
      });

      expect(result.current.actions.canUndo).toBe(true);

      act(() => {
        result.current.actions.clear();
      });

      expect(result.current.actions.canUndo).toBe(false);
      expect(result.current.actions.canRedo).toBe(false);
    });

    it('should reset to default tool state on clear', () => {
      const { result } = renderHook(() => useMaskDrawing());

      act(() => {
        result.current.actions.setTool('eraser');
        result.current.actions.setBrushSize(80);
      });

      act(() => {
        result.current.actions.clear();
      });

      // Tool and brush size should persist (only strokes cleared)
      expect(result.current.state.activeTool).toBe('eraser');
      expect(result.current.state.brushSize).toBe(80);
    });
  });

  // =========================================================================
  // T155: Shape Tool State (Rect, Circle)
  // =========================================================================
  describe('shape tool state (T155)', () => {
    it('should switch to rect tool', () => {
      const { result } = renderHook(() => useMaskDrawing());

      act(() => {
        result.current.actions.setTool('rect');
      });

      expect(result.current.state.activeTool).toBe('rect');
    });

    it('should switch to circle tool', () => {
      const { result } = renderHook(() => useMaskDrawing());

      act(() => {
        result.current.actions.setTool('circle');
      });

      expect(result.current.state.activeTool).toBe('circle');
    });

    it('should add rectangle shape with bounds', () => {
      const { result } = renderHook(() => useMaskDrawing());

      act(() => {
        result.current.actions.setTool('rect');
      });

      act(() => {
        result.current.actions.addShape({
          x: 50,
          y: 50,
          width: 100,
          height: 80,
        });
      });

      expect(result.current.state.strokes.length).toBe(1);
      expect(result.current.state.strokes[0].tool).toBe('rect');
      expect(result.current.state.strokes[0].bounds).toEqual({
        x: 50,
        y: 50,
        width: 100,
        height: 80,
      });
    });

    it('should add circle shape with bounds', () => {
      const { result } = renderHook(() => useMaskDrawing());

      act(() => {
        result.current.actions.setTool('circle');
      });

      act(() => {
        result.current.actions.addShape({
          x: 100,
          y: 100,
          width: 60,
          height: 60,
        });
      });

      expect(result.current.state.strokes.length).toBe(1);
      expect(result.current.state.strokes[0].tool).toBe('circle');
    });
  });

  // =========================================================================
  // Additional Branch Coverage Tests
  // =========================================================================
  describe('branch coverage (edge cases)', () => {
    it('should handle continueStroke when no currentStroke exists', () => {
      const { result } = renderHook(() => useMaskDrawing());

      // Try to continue stroke without starting one
      act(() => {
        result.current.actions.continueStroke(100, 100);
      });

      // Should not crash, state should remain unchanged
      expect(result.current.state.currentStroke).toBeNull();
      expect(result.current.state.strokes.length).toBe(0);
    });

    it('should handle endStroke when no currentStroke exists', () => {
      const { result } = renderHook(() => useMaskDrawing());

      // Try to end stroke without starting one
      act(() => {
        result.current.actions.endStroke();
      });

      // Should not crash, state should remain unchanged
      expect(result.current.state.currentStroke).toBeNull();
      expect(result.current.state.strokes.length).toBe(0);
    });

    it('should handle undo when undoStack is empty', () => {
      const { result } = renderHook(() => useMaskDrawing());

      // Try to undo with empty stack
      act(() => {
        result.current.actions.undo();
      });

      // Should not crash, state should remain unchanged
      expect(result.current.state.strokes.length).toBe(0);
      expect(result.current.actions.canUndo).toBe(false);
    });

    it('should handle redo when redoStack is empty', () => {
      const { result } = renderHook(() => useMaskDrawing());

      // Try to redo with empty stack
      act(() => {
        result.current.actions.redo();
      });

      // Should not crash, state should remain unchanged
      expect(result.current.state.strokes.length).toBe(0);
      expect(result.current.actions.canRedo).toBe(false);
    });

    it('should handle continueStroke with multiple points', () => {
      const { result } = renderHook(() => useMaskDrawing());

      act(() => {
        result.current.actions.startStroke(100, 100);
        result.current.actions.continueStroke(150, 150);
        result.current.actions.continueStroke(200, 200);
        result.current.actions.continueStroke(250, 250);
      });

      expect(result.current.state.currentStroke).not.toBeNull();
      expect(result.current.state.currentStroke?.points.length).toBe(8); // 4 points * 2 coords
    });
  });
});
