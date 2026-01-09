/**
 * GridOverlay Component
 * 
 * Renders a grid overlay on top of the base map image.
 * Supports both square and hexagonal grid patterns.
 * Uses the useGridCalculation hook to compute grid lines.
 * When in 'grid-adjust' mode, the grid can be dragged to adjust offset.
 */

import React from 'react';
import { Layer, Line, Group } from 'react-konva';
import { GridConfig, MapEditMode } from '../types/map.types';
import { useGridCalculation } from '../hooks/useGridCalculation';

export interface GridOverlayProps {
  /** Viewport width in pixels */
  width: number;
  /** Viewport height in pixels */
  height: number;
  /** Grid configuration */
  gridConfig: GridConfig;
  /** Current editing mode (defaults to 'view') */
  mode?: MapEditMode;
  /** Callback when grid offset changes (only used in grid-adjust mode) */
  onOffsetChange?: (offset: { offsetX: number; offsetY: number }) => void;
}

/**
 * GridOverlay renders grid lines using Konva Lines.
 * The layer is non-interactive (listening={false}) so it doesn't
 * interfere with map panning/zooming, except when in grid-adjust mode.
 */
export function GridOverlay({
  width,
  height,
  gridConfig,
  mode = 'view',
  onOffsetChange,
}: GridOverlayProps) {
  const isAdjustMode = mode === 'grid-adjust';

  // In adjust mode, calculate grid with offset 0 (offset applied via Group position)
  // In normal mode, use the actual offset (applied via grid math)
  const gridConfigForCalculation = isAdjustMode
    ? { ...gridConfig, offsetX: 0, offsetY: 0 }
    : gridConfig;

  // Calculate grid lines using the hook
  const { lines } = useGridCalculation({ width, height, gridConfig: gridConfigForCalculation });

  // Don't render layer if grid is not visible
  if (!gridConfig.visible || lines.length === 0) {
    return null;
  }

  // Handle drag end to update offset
  const handleDragEnd = (e: any) => {
    if (!onOffsetChange || !isAdjustMode) return;
    
    const target = e.target;
    const newOffsetX = target.x();
    const newOffsetY = target.y();
    
    onOffsetChange({ offsetX: newOffsetX, offsetY: newOffsetY });
    console.log('🔲 [GridOverlay] Grid offset adjusted:', { offsetX: newOffsetX, offsetY: newOffsetY });
  };

  // Render grid lines
  const gridLines = lines.map((line, index) => (
    <Line
      key={`grid-line-${index}`}
      points={line.points}
      stroke={gridConfig.color}
      strokeWidth={1}
      opacity={gridConfig.opacity}
    />
  ));

  // In adjust mode, wrap lines in a draggable Group with offset position
  if (isAdjustMode) {
    return (
      <Layer listening={false}>
        <Group
          x={gridConfig.offsetX}
          y={gridConfig.offsetY}
          draggable={true}
          onDragEnd={handleDragEnd}
        >
          {gridLines}
        </Group>
      </Layer>
    );
  }

  // In normal mode, render lines directly (offset handled by grid math)
  return (
    <Layer listening={false}>
      {gridLines}
    </Layer>
  );
}
