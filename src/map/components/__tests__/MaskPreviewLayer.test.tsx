/**
 * MaskPreviewLayer Component Tests
 *
 * Tests for the semi-transparent mask preview overlay.
 */

import React from 'react';
import { render } from '@testing-library/react';
import { Stage } from 'react-konva';
import { MaskPreviewLayer } from '../MaskPreviewLayer';
import type { MaskStroke } from '../../types/mask.types';

// Mock react-konva
jest.mock('react-konva', () => ({
  Stage: ({ children, width, height }: any) => (
    <div data-testid="konva-stage" style={{ width, height }}>
      {children}
    </div>
  ),
  Layer: ({ children }: any) => <div data-testid="konva-layer">{children}</div>,
  Line: ({ points, stroke, strokeWidth, opacity }: any) => (
    <div
      data-testid="konva-line"
      data-points={JSON.stringify(points)}
      data-stroke={stroke}
      data-stroke-width={strokeWidth}
      data-opacity={opacity}
    />
  ),
  Rect: ({ x, y, width, height, fill, opacity }: any) => (
    <div
      data-testid="konva-rect"
      style={{ position: 'absolute', left: x, top: y, width, height }}
      data-fill={fill}
      data-opacity={opacity}
    />
  ),
  Ellipse: ({ x, y, radiusX, radiusY, fill, opacity }: any) => (
    <div
      data-testid="konva-ellipse"
      style={{ position: 'absolute', left: x, top: y }}
      data-radius-x={radiusX}
      data-radius-y={radiusY}
      data-fill={fill}
      data-opacity={opacity}
    />
  ),
}));

const renderInStage = (component: React.ReactNode) => {
  return render(<Stage width={500} height={500}>{component}</Stage>);
};

describe('MaskPreviewLayer', () => {
  const defaultProps = {
    strokes: [] as MaskStroke[],
  };

  it('should render nothing when strokes array is empty', () => {
    const { container } = renderInStage(<MaskPreviewLayer {...defaultProps} />);
    expect(container.querySelector('[data-testid="konva-layer"]')).not.toBeInTheDocument();
  });

  it('should render brush strokes with semi-transparent overlay', () => {
    const strokes: MaskStroke[] = [
      {
        id: 'stroke-1',
        tool: 'brush',
        points: [100, 100, 150, 150, 200, 120],
        strokeWidth: 30,
      },
    ];

    const { getByTestId } = renderInStage(
      <MaskPreviewLayer {...defaultProps} strokes={strokes} />
    );

    const layer = getByTestId('konva-layer');
    expect(layer).toBeInTheDocument();
  });

  it('should render rectangle shapes with preview overlay', () => {
    const strokes: MaskStroke[] = [
      {
        id: 'rect-1',
        tool: 'rect',
        points: [],
        strokeWidth: 0,
        bounds: { x: 50, y: 50, width: 100, height: 80 },
      },
    ];

    const { getByTestId } = renderInStage(
      <MaskPreviewLayer {...defaultProps} strokes={strokes} />
    );

    expect(getByTestId('konva-rect')).toBeInTheDocument();
  });

  it('should render circle shapes with preview overlay', () => {
    const strokes: MaskStroke[] = [
      {
        id: 'circle-1',
        tool: 'circle',
        points: [],
        strokeWidth: 0,
        bounds: { x: 100, y: 100, width: 60, height: 60 },
      },
    ];

    const { getByTestId } = renderInStage(
      <MaskPreviewLayer {...defaultProps} strokes={strokes} />
    );

    expect(getByTestId('konva-ellipse')).toBeInTheDocument();
  });

  it('should use custom opacity when provided', () => {
    const strokes: MaskStroke[] = [
      {
        id: 'stroke-1',
        tool: 'brush',
        points: [100, 100, 200, 200],
        strokeWidth: 30,
      },
    ];

    const { getByTestId } = renderInStage(
      <MaskPreviewLayer {...defaultProps} strokes={strokes} opacity={0.5} />
    );

    const line = getByTestId('konva-line');
    expect(line).toHaveAttribute('data-opacity', '0.5');
  });

  it('should use custom color when provided', () => {
    const strokes: MaskStroke[] = [
      {
        id: 'stroke-1',
        tool: 'brush',
        points: [100, 100, 200, 200],
        strokeWidth: 30,
      },
    ];

    const { getByTestId } = renderInStage(
      <MaskPreviewLayer {...defaultProps} strokes={strokes} color="rgba(255, 0, 0, 0.3)" />
    );

    const line = getByTestId('konva-line');
    expect(line).toHaveAttribute('data-stroke', 'rgba(255, 0, 0, 0.3)');
  });

  it('should render multiple strokes', () => {
    const strokes: MaskStroke[] = [
      {
        id: 'stroke-1',
        tool: 'brush',
        points: [100, 100, 150, 150],
        strokeWidth: 30,
      },
      {
        id: 'rect-1',
        tool: 'rect',
        points: [],
        strokeWidth: 0,
        bounds: { x: 200, y: 200, width: 50, height: 50 },
      },
    ];

    const { getByTestId, getAllByTestId } = renderInStage(
      <MaskPreviewLayer {...defaultProps} strokes={strokes} />
    );

    expect(getByTestId('konva-layer')).toBeInTheDocument();
    expect(getByTestId('konva-line')).toBeInTheDocument();
    expect(getByTestId('konva-rect')).toBeInTheDocument();
  });
});
