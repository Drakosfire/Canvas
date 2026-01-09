/**
 * Mask Preview Layer
 *
 * Renders mask strokes as a semi-transparent overlay when not in mask mode.
 * Used to preview mask boundaries without being able to edit them.
 */

import React from 'react';
import { Layer, Line, Rect, Ellipse } from 'react-konva';
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
export const MaskPreviewLayer: React.FC<MaskPreviewLayerProps> = ({
  strokes,
  opacity = 0.3,
  color = 'rgba(59, 130, 246, 0.3)', // Semi-transparent blue
}) => {
  const renderStroke = (stroke: MaskStroke) => {
    if (stroke.tool === 'rect' && stroke.bounds) {
      return (
        <Rect
          key={stroke.id}
          x={stroke.bounds.x}
          y={stroke.bounds.y}
          width={stroke.bounds.width}
          height={stroke.bounds.height}
          fill={color}
          opacity={opacity}
          listening={false}
        />
      );
    }

    if (stroke.tool === 'circle' && stroke.bounds) {
      const cx = stroke.bounds.x + stroke.bounds.width / 2;
      const cy = stroke.bounds.y + stroke.bounds.height / 2;
      const rx = stroke.bounds.width / 2;
      const ry = stroke.bounds.height / 2;
      return (
        <Ellipse
          key={stroke.id}
          x={cx}
          y={cy}
          radiusX={rx}
          radiusY={ry}
          fill={color}
          opacity={opacity}
          listening={false}
        />
      );
    }

    if (stroke.points.length >= 2) {
      return (
        <Line
          key={stroke.id}
          points={stroke.points}
          stroke={color}
          strokeWidth={stroke.strokeWidth}
          opacity={opacity}
          lineCap="round"
          lineJoin="round"
          listening={false}
        />
      );
    }

    return null;
  };

  if (strokes.length === 0) {
    return null;
  }

  return (
    <Layer listening={false}>
      {strokes.map(renderStroke)}
    </Layer>
  );
};
