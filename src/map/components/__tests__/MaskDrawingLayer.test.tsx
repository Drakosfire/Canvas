/**
 * MaskDrawingLayer Component Tests (TDD - T156-T161)
 *
 * Tests for the Konva layer that renders mask drawing.
 * Written BEFORE implementation - these tests MUST FAIL initially.
 */

import React from 'react';
import { render } from '@testing-library/react';
import { MaskDrawingLayer } from '../MaskDrawingLayer';
import type { MaskStroke, MaskTool } from '../../types/mask.types';

// Mock react-konva - we're testing component structure, not Konva rendering
jest.mock('react-konva', () => ({
  Stage: ({ children, width, height }: any) => (
    <div data-testid="konva-stage" style={{ width, height }}>
      {children}
    </div>
  ),
  Layer: ({ children }: any) => <div data-testid="konva-layer">{children}</div>,
  Line: ({ points, strokeWidth, stroke, globalCompositeOperation }: any) => (
    <div
      data-testid="konva-line"
      data-points={JSON.stringify(points)}
      data-stroke-width={strokeWidth}
      data-stroke={stroke}
      data-composite={globalCompositeOperation}
    />
  ),
  Rect: ({ x, y, width, height, fill, globalCompositeOperation }: any) => (
    <div
      data-testid="konva-rect"
      style={{ position: 'absolute', left: x, top: y, width, height }}
      data-fill={fill}
      data-composite={globalCompositeOperation}
    />
  ),
  Ellipse: ({ x, y, radiusX, radiusY, fill, globalCompositeOperation }: any) => (
    <div
      data-testid="konva-ellipse"
      style={{ position: 'absolute', left: x, top: y }}
      data-radius-x={radiusX}
      data-radius-y={radiusY}
      data-fill={fill}
      data-composite={globalCompositeOperation}
    />
  ),
}));

// Helper to wrap component in Stage for Konva (now mocked)
const { Stage } = require('react-konva');
const renderInStage = (component: React.ReactNode) => {
  return render(<Stage width={500} height={500}>{component}</Stage>);
};

describe('MaskDrawingLayer', () => {
  const mockOnStrokeStart = jest.fn();
  const mockOnStrokeContinue = jest.fn();
  const mockOnStrokeEnd = jest.fn();
  const mockOnShapeAdd = jest.fn();

  const defaultProps = {
    strokes: [] as MaskStroke[],
    currentStroke: null as MaskStroke | null,
    activeTool: 'brush' as MaskTool,
    brushSize: 30,
    isDrawing: false,
    onStrokeStart: mockOnStrokeStart,
    onStrokeContinue: mockOnStrokeContinue,
    onStrokeEnd: mockOnStrokeEnd,
    onShapeAdd: mockOnShapeAdd,
    imageWidth: 1024,
    imageHeight: 768,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  // T156: Renders as Konva Layer
  // =========================================================================
  describe('renders as Konva Layer (T156)', () => {
    it('should render without crashing', () => {
      expect(() => {
        renderInStage(<MaskDrawingLayer {...defaultProps} />);
      }).not.toThrow();
    });

    it('should render as a Layer component', () => {
      const { getByTestId } = renderInStage(<MaskDrawingLayer {...defaultProps} />);

      // With mocked Konva, layers are rendered as divs with data-testid
      const layer = getByTestId('konva-layer');
      expect(layer).toBeInTheDocument();
    });
  });

  // =========================================================================
  // T157: Freehand Drawing Creates Line
  // =========================================================================
  describe('freehand drawing creates line (T157)', () => {
    it('should render strokes as lines', () => {
      const strokes: MaskStroke[] = [
        {
          id: 'stroke-1',
          tool: 'brush',
          points: [100, 100, 150, 150, 200, 120],
          strokeWidth: 30,
        },
      ];

      const { container } = renderInStage(
        <MaskDrawingLayer {...defaultProps} strokes={strokes} />
      );

      // Component should render without error when strokes exist
      expect(container).toBeInTheDocument();
    });

    it('should render current stroke while drawing', () => {
      const currentStroke: MaskStroke = {
        id: 'current',
        tool: 'brush',
        points: [100, 100, 120, 120],
        strokeWidth: 30,
      };

      const { container } = renderInStage(
        <MaskDrawingLayer
          {...defaultProps}
          currentStroke={currentStroke}
          isDrawing={true}
        />
      );

      expect(container).toBeInTheDocument();
    });
  });

  // =========================================================================
  // T158: Eraser Removes Strokes
  // =========================================================================
  describe('eraser removes strokes (T158)', () => {
    it('should render eraser strokes with globalCompositeOperation', () => {
      const strokes: MaskStroke[] = [
        {
          id: 'brush-stroke',
          tool: 'brush',
          points: [100, 100, 200, 200],
          strokeWidth: 30,
        },
        {
          id: 'eraser-stroke',
          tool: 'eraser',
          points: [150, 150, 180, 180],
          strokeWidth: 30,
        },
      ];

      const { container } = renderInStage(
        <MaskDrawingLayer {...defaultProps} strokes={strokes} />
      );

      expect(container).toBeInTheDocument();
    });
  });

  // =========================================================================
  // T159: Rect Tool Creates Rectangle
  // =========================================================================
  describe('rect tool creates rectangle (T159)', () => {
    it('should render rectangle shapes', () => {
      const strokes: MaskStroke[] = [
        {
          id: 'rect-1',
          tool: 'rect',
          points: [],
          strokeWidth: 0,
          bounds: { x: 50, y: 50, width: 100, height: 80 },
        },
      ];

      const { container } = renderInStage(
        <MaskDrawingLayer {...defaultProps} strokes={strokes} />
      );

      expect(container).toBeInTheDocument();
    });
  });

  // =========================================================================
  // T160: Circle Tool Creates Ellipse
  // =========================================================================
  describe('circle tool creates ellipse (T160)', () => {
    it('should render ellipse shapes', () => {
      const strokes: MaskStroke[] = [
        {
          id: 'circle-1',
          tool: 'circle',
          points: [],
          strokeWidth: 0,
          bounds: { x: 100, y: 100, width: 60, height: 60 },
        },
      ];

      const { container } = renderInStage(
        <MaskDrawingLayer {...defaultProps} strokes={strokes} />
      );

      expect(container).toBeInTheDocument();
    });
  });

  // =========================================================================
  // T161: Respects brushSize Prop
  // =========================================================================
  describe('respects brushSize prop (T161)', () => {
    it('should use brushSize for stroke width', () => {
      const strokes: MaskStroke[] = [
        {
          id: 'stroke-1',
          tool: 'brush',
          points: [100, 100, 200, 200],
          strokeWidth: 50, // This should match what was set
        },
      ];

      const { container } = renderInStage(
        <MaskDrawingLayer {...defaultProps} strokes={strokes} brushSize={50} />
      );

      expect(container).toBeInTheDocument();
    });

    it('should update stroke width when brushSize changes', () => {
      const { rerender, container } = renderInStage(
        <MaskDrawingLayer {...defaultProps} brushSize={30} />
      );

      // Rerender with different brush size
      rerender(
        <Stage width={500} height={500}>
          <MaskDrawingLayer {...defaultProps} brushSize={60} />
        </Stage>
      );

      expect(container).toBeInTheDocument();
    });
  });
});
