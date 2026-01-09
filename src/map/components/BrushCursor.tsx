/**
 * BrushCursor Component
 *
 * Displays a reticle/cursor indicator showing the brush size under the mouse.
 * Only visible when in mask mode with brush or eraser tool.
 */

import React from 'react';
import { Circle } from 'react-konva';
import type { MaskTool } from '../types/mask.types';

export interface BrushCursorProps {
  /** Current active tool */
  activeTool: MaskTool;
  /** Brush/eraser size in pixels */
  brushSize: number;
  /** Current mouse position in image coordinates (null to hide) */
  position: { x: number; y: number } | null;
}

export const BrushCursor: React.FC<BrushCursorProps> = ({
  activeTool,
  brushSize,
  position,
}) => {
  // Only show for brush and eraser tools
  const shouldShow = position && (activeTool === 'brush' || activeTool === 'eraser');

  if (!shouldShow || !position) {
    return null;
  }

  const radius = brushSize / 2;
  const isEraser = activeTool === 'eraser';

  return (
    <Circle
      x={position.x}
      y={position.y}
      radius={radius}
      stroke={isEraser ? 'rgba(255, 100, 100, 0.8)' : 'rgba(100, 150, 255, 0.8)'}
      strokeWidth={2}
      fill="transparent"
      dash={[5, 5]}
      listening={false}
      perfectDrawEnabled={false}
    />
  );
};
