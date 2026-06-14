/**
 * MapViewport Component
 * 
 * Main Konva Stage component for map rendering.
 * Renders 3 layers in fixed z-order:
 * 1. Base Image Layer (non-interactive)
 * 2. Grid Overlay Layer (non-interactive)
 * 3. Labels Layer (interactive, draggable)
 */

import React, { useMemo, useRef, useCallback } from 'react';
import { Stage, Layer, Image } from 'react-konva';
import useImage from 'use-image';
import { GridConfig, MapLabel, MapEditMode } from '../types/map.types';
import type { MaskStroke, MaskTool } from '../types/mask.types';
import { GridOverlay } from './GridOverlay';
import { LabelLayer, LabelEditInfo } from './LabelLayer';
import { MaskDrawingLayer } from './MaskDrawingLayer';
import { MaskPreviewLayer } from './MaskPreviewLayer';

/**
 * Buffer around the Stage to allow drawing outside visible viewport.
 * Shapes can be drawn into this buffer area, but it's clipped by the container.
 * Mask export clips to image dimensions regardless.
 */
export const STAGE_BUFFER = 500;

export interface MapViewportProps {
  /** Viewport width in pixels */
  width: number;
  /** Viewport height in pixels */
  height: number;
  /** URL to base map image */
  baseImageUrl: string;
  /** Grid overlay configuration */
  gridConfig: GridConfig;
  /** Array of text labels */
  labels: MapLabel[];
  /** Currently selected label ID */
  selectedLabelId?: string | null;
  /** Callback when a label is selected */
  onLabelSelect?: (id: string | null) => void;
  /** Callback when a label is updated (dragged, edited) */
  onLabelUpdate: (id: string, updates: Partial<MapLabel>) => void;
  /** Callback when a label is deleted */
  onLabelDelete?: (id: string) => void;
  /** Callback when a new label should be placed (click-to-place in label mode) */
  onLabelPlace?: (x: number, y: number) => void;
  /** Current zoom level (1 = 100%) */
  zoom?: number;
  /** Pan offset X */
  panX?: number;
  /** Pan offset Y */
  panY?: number;
  /** Callback when view changes (pan/zoom) */
  onViewChange?: (view: { zoom: number; panX: number; panY: number }) => void;
  /** Current editing mode (for grid adjustment) */
  mode?: MapEditMode;
  /** Callback when grid offset changes (in grid-adjust mode) */
  onGridOffsetChange?: (offset: { offsetX: number; offsetY: number }) => void;
  /** Callback when inline label editing starts */
  onStartEditing?: (editInfo: LabelEditInfo) => void;
  /** Label currently being edited (hides Konva text during edit) */
  editingLabelId?: string | null;
  // ========= Mask Drawing (Optional Layer 4) =========
  /** Whether mask mode is enabled */
  maskEnabled?: boolean;
  /** Mask strokes to render */
  maskStrokes?: MaskStroke[];
  /** Current mask stroke being drawn */
  maskCurrentStroke?: MaskStroke | null;
  /** Active mask tool */
  maskActiveTool?: MaskTool;
  /** Mask brush size */
  maskBrushSize?: number;
  /** Whether currently drawing mask */
  maskIsDrawing?: boolean;
  /** Callback when mask stroke starts */
  onMaskStrokeStart?: (x: number, y: number) => void;
  /** Callback when mask stroke continues */
  onMaskStrokeContinue?: (x: number, y: number) => void;
  /** Callback when mask stroke ends */
  onMaskStrokeEnd?: () => void;
  /** Callback when mask shape is added */
  onMaskShapeAdd?: (bounds: { x: number; y: number; width: number; height: number }) => void;
}

/**
 * MapViewport renders a pannable, zoomable map canvas with:
 * - Base image layer
 * - Configurable grid overlay (square or hex)
 * - Draggable text labels
 */
export function MapViewport({
  width,
  height,
  baseImageUrl,
  gridConfig,
  labels,
  selectedLabelId = null,
  onLabelSelect,
  onLabelUpdate,
  onLabelDelete,
  onLabelPlace,
  zoom = 1,
  panX = 0,
  panY = 0,
  onViewChange,
  mode = 'view',
  onGridOffsetChange,
  onStartEditing,
  editingLabelId,
  // Mask props
  maskEnabled = false,
  maskStrokes = [],
  maskCurrentStroke = null,
  maskActiveTool = 'brush',
  maskBrushSize = 30,
  maskIsDrawing = false,
  onMaskStrokeStart,
  onMaskStrokeContinue,
  onMaskStrokeEnd,
  onMaskShapeAdd,
}: MapViewportProps) {
  // Load base image
  const [image] = useImage(baseImageUrl);

  // Get image dimensions (natural size of loaded image)
  const imageDimensions = useMemo(() => {
    if (!image) {
      return { width: 0, height: 0 };
    }
    return {
      width: image.width,
      height: image.height,
    };
  }, [image]);

  // Handle label placement (click-to-place in label mode)
  const handleLabelPlace = (x: number, y: number) => {
    if (!onLabelPlace) return;
    
    // Adjust for stage transform (pan/zoom) - account for STAGE_BUFFER offset
    // The stage has x={panX + STAGE_BUFFER}, so we need to subtract STAGE_BUFFER
    const adjustedX = (x - panX - STAGE_BUFFER) / zoom;
    const adjustedY = (y - panY - STAGE_BUFFER) / zoom;
    
    onLabelPlace(adjustedX, adjustedY);
  };

  // ========== Middle Mouse Button Panning ==========
  // Panning is locked to middle mouse button to avoid conflicts with label dragging
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  const handleMouseDown = useCallback((e: any) => {
    // Middle mouse button = button 1
    if (e.evt.button === 1) {
      e.evt.preventDefault();
      isPanningRef.current = true;
      panStartRef.current = {
        x: e.evt.clientX,
        y: e.evt.clientY,
        panX: panX,
        panY: panY,
      };
      // Change cursor to grabbing
      const container = e.target.getStage()?.container();
      if (container) {
        container.style.cursor = 'grabbing';
      }
    }
  }, [panX, panY]);

  const handleMouseMove = useCallback((e: any) => {
    if (!isPanningRef.current || !onViewChange) return;
    
    const dx = e.evt.clientX - panStartRef.current.x;
    const dy = e.evt.clientY - panStartRef.current.y;
    
    onViewChange({
      zoom,
      panX: panStartRef.current.panX + dx,
      panY: panStartRef.current.panY + dy,
    });
  }, [zoom, onViewChange]);

  const handleMouseUp = useCallback((e: any) => {
    if (isPanningRef.current) {
      isPanningRef.current = false;
      // Reset cursor
      const container = e.target.getStage()?.container();
      if (container) {
        container.style.cursor = 'default';
      }
    }
  }, []);

  // Handle mouse leaving the stage while panning
  const handleMouseLeave = useCallback((e: any) => {
    console.log(`🎭 [MapViewport] Stage handleMouseLeave: isPanning=${isPanningRef.current}, maskEnabled=${maskEnabled}`);
    if (isPanningRef.current) {
      isPanningRef.current = false;
      const container = e.target.getStage()?.container();
      if (container) {
        container.style.cursor = 'default';
      }
    }
  }, [maskEnabled]);

  // Expanded stage dimensions to allow drawing outside visible viewport
  // The container clips the overflow, but Konva can still track/render in this area
  const expandedWidth = width + STAGE_BUFFER * 2;
  const expandedHeight = height + STAGE_BUFFER * 2;

  return (
    <Stage
      width={expandedWidth}
      height={expandedHeight}
      draggable={false}
      scaleX={zoom}
      scaleY={zoom}
      x={panX + STAGE_BUFFER}
      y={panY + STAGE_BUFFER}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      style={{
        // Offset the Stage so the visible content aligns with the container
        position: 'absolute',
        left: -STAGE_BUFFER,
        top: -STAGE_BUFFER,
      }}
    >
      {/* Layer 1: Base Image (non-interactive) */}
      <Layer listening={false}>
        {image && <Image image={image} />}
      </Layer>

      {/* Layer 2: Grid Overlay - sized to IMAGE dimensions, not viewport */}
      {imageDimensions.width > 0 && (
        <GridOverlay
          width={imageDimensions.width}
          height={imageDimensions.height}
          gridConfig={gridConfig}
          mode={mode}
          onOffsetChange={onGridOffsetChange}
        />
      )}

      {/* Layer 3: Labels (interactive) */}
      <LabelLayer
        labels={labels}
        selectedLabelId={selectedLabelId}
        onLabelSelect={onLabelSelect || (() => {})}
        onLabelUpdate={onLabelUpdate}
        onLabelDelete={onLabelDelete}
        mode={mode}
        onLabelPlace={mode === 'label' && onLabelPlace ? handleLabelPlace : undefined}
        imageWidth={imageDimensions.width}
        imageHeight={imageDimensions.height}
        onStartEditing={onStartEditing}
        editingLabelId={editingLabelId}
      />

      {/* Layer 4: Mask Drawing (when mask mode is enabled) */}
      {maskEnabled && imageDimensions.width > 0 && (
        <MaskDrawingLayer
          strokes={maskStrokes}
          currentStroke={maskCurrentStroke}
          activeTool={maskActiveTool}
          brushSize={maskBrushSize}
          isDrawing={maskIsDrawing}
          onStrokeStart={onMaskStrokeStart || (() => {})}
          onStrokeContinue={onMaskStrokeContinue || (() => {})}
          onStrokeEnd={onMaskStrokeEnd || (() => {})}
          onShapeAdd={onMaskShapeAdd || (() => {})}
          imageWidth={imageDimensions.width}
          imageHeight={imageDimensions.height}
          stageBuffer={STAGE_BUFFER}
        />
      )}

      {/* Layer 5: Mask Preview Overlay (when mask mode is disabled but mask exists) - T208 */}
      {!maskEnabled && maskStrokes.length > 0 && (
        <MaskPreviewLayer
          strokes={maskStrokes}
          opacity={0.3}
          color="rgba(59, 130, 246, 0.3)"
        />
      )}
    </Stage>
  );
}
