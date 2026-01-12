/**
 * MaskDrawingLayer Component
 *
 * Konva layer for rendering mask strokes (brush, eraser, shapes).
 * Implements TDD tests from T156-T161.
 */

import React, { useRef, useCallback, useEffect } from 'react';
import { Layer, Line, Rect, Ellipse } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import type { MaskStroke, MaskTool } from '../types/mask.types';
import { BrushCursor } from './BrushCursor';

export interface MaskDrawingLayerProps {
  strokes: MaskStroke[];
  currentStroke: MaskStroke | null;
  activeTool: MaskTool;
  brushSize: number;
  isDrawing: boolean;
  onStrokeStart: (x: number, y: number) => void;
  onStrokeContinue: (x: number, y: number) => void;
  onStrokeEnd: () => void;
  onShapeAdd: (bounds: { x: number; y: number; width: number; height: number }) => void;
  /** Image width for hit detection area */
  imageWidth: number;
  /** Image height for hit detection area */
  imageHeight: number;
  /** Buffer around the stage for extended drawing area (default: 0) */
  stageBuffer?: number;
}

const MASK_COLOR = 'rgba(255, 0, 0, 0.5)'; // Semi-transparent red for visibility

export const MaskDrawingLayer: React.FC<MaskDrawingLayerProps> = ({
  strokes,
  currentStroke,
  activeTool,
  brushSize,
  isDrawing,
  onStrokeStart,
  onStrokeContinue,
  onStrokeEnd,
  onShapeAdd,
  imageWidth,
  imageHeight,
  stageBuffer = 0,
}) => {
  const isDrawingRef = useRef(false);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  const [cursorPosition, setCursorPosition] = React.useState<{ x: number; y: number } | null>(null);
  const [previewShape, setPreviewShape] = React.useState<{ x: number; y: number; width: number; height: number } | null>(null);

  // Sync internal state when isDrawing prop changes to false
  // This handles the case where document-level listener ends a shape drawing
  useEffect(() => {
    if (!isDrawing && isDrawingRef.current) {
      console.log(`🎨 [MaskLayer] Syncing internal state: isDrawing prop became false, resetting refs`);
      isDrawingRef.current = false;
      startPosRef.current = null;
      setPreviewShape(null);
    }
  }, [isDrawing]);

  // Convert stage coordinates to image coordinates
  const getImageCoordinates = useCallback((e: KonvaEventObject<MouseEvent | TouchEvent>) => {
    const stage = e.target.getStage();
    if (!stage) return { x: 0, y: 0 };

    const pointerPos = stage.getPointerPosition();
    if (!pointerPos) return { x: 0, y: 0 };

    // Adjust for stage transform (pan/zoom)
    const adjustedX = (pointerPos.x - stage.x()) / stage.scaleX();
    const adjustedY = (pointerPos.y - stage.y()) / stage.scaleY();

    return { x: adjustedX, y: adjustedY };
  }, []);

  // Handle mouse/touch start
  const handleStart = useCallback(
    (e: KonvaEventObject<MouseEvent | TouchEvent>) => {
      e.evt.preventDefault();
      const pos = getImageCoordinates(e);
      const screenPos = e.evt instanceof MouseEvent
        ? `(${e.evt.clientX}, ${e.evt.clientY})`
        : e.evt instanceof TouchEvent && e.evt.touches[0]
          ? `(${e.evt.touches[0].clientX}, ${e.evt.touches[0].clientY})`
          : 'unknown';
      console.log(`🎨 [MaskLayer] Mouse/Touch start: screen=${screenPos}, image=(${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}), tool=${activeTool}`);

      // Handle shape tools (rect/circle)
      if (activeTool === 'rect' || activeTool === 'circle') {
        console.log(`🎨 [MaskLayer] Shape START: setting isDrawingRef=true, startPos=(${pos.x.toFixed(1)}, ${pos.y.toFixed(1)})`);
        isDrawingRef.current = true;
        startPosRef.current = pos;
        setPreviewShape({ x: pos.x, y: pos.y, width: 0, height: 0 });
        // Call onStrokeStart to set isDrawing=true in provider, enabling document-level listeners
        onStrokeStart(pos.x, pos.y);
        return;
      }

      // Handle brush and eraser tools
      if (activeTool === 'brush' || activeTool === 'eraser') {
        isDrawingRef.current = true;
        startPosRef.current = pos;
        onStrokeStart(pos.x, pos.y);
        return;
      }

      console.log(`🎨 [MaskLayer] Ignoring start event: tool=${activeTool} (unknown tool)`);
    },
    [activeTool, getImageCoordinates, onStrokeStart]
  );

  // Handle mouse/touch move
  const handleMove = useCallback(
    (e: KonvaEventObject<MouseEvent | TouchEvent>) => {
      const pos = getImageCoordinates(e);

      // Always update cursor position for brush reticle (even during drawing)
      if (activeTool === 'brush' || activeTool === 'eraser') {
        // Check if within image bounds
        if (pos.x >= 0 && pos.x <= imageWidth && pos.y >= 0 && pos.y <= imageHeight) {
          setCursorPosition(pos);
        } else {
          setCursorPosition(null);
        }
      }

      if (!isDrawingRef.current || !startPosRef.current) {
        return; // Not drawing, ignore
      }

      e.evt.preventDefault();

      // Handle shape tools (rect/circle) - update preview
      if (activeTool === 'rect' || activeTool === 'circle') {
        const start = startPosRef.current;
        const bounds = {
          x: Math.min(start.x, pos.x),
          y: Math.min(start.y, pos.y),
          width: Math.abs(pos.x - start.x),
          height: Math.abs(pos.y - start.y),
        };
        setPreviewShape(bounds);
        return;
      }

      // Handle brush and eraser tools
      if (activeTool === 'brush' || activeTool === 'eraser') {
        // Only log occasionally to avoid spam
        if (Math.random() < 0.05) {
          console.log(`🎨 [MaskLayer] Mouse/Touch move: image=(${pos.x.toFixed(1)}, ${pos.y.toFixed(1)})`);
        }
        onStrokeContinue(pos.x, pos.y);
        return;
      }
    },
    [activeTool, getImageCoordinates, onStrokeContinue, imageWidth, imageHeight]
  );

  // Handle mouse/touch end
  const handleEnd = useCallback(
    (e: KonvaEventObject<MouseEvent | TouchEvent>) => {
      // Log the event type to detect if Konva is synthesizing mouseup on leave
      const eventType = e.evt?.type || 'unknown';
      console.log(`🎨 [MaskLayer] handleEnd called: eventType=${eventType}, isDrawingRef=${isDrawingRef.current}, hasStartPos=${!!startPosRef.current}`);
      
      // Guard: Only accept real mouseup/touchend events, not synthetic events
      // This prevents Konva from canceling shapes when mouse leaves canvas
      const validEndEvents = ['mouseup', 'touchend'];
      if (!validEndEvents.includes(eventType)) {
        console.log(`⚠️ [MaskLayer] handleEnd BLOCKED: unexpected event type '${eventType}' (expected mouseup or touchend)`);
        return;
      }
      
      if (!isDrawingRef.current || !startPosRef.current) {
        console.log(`🎨 [MaskLayer] handleEnd early return: isDrawingRef=${isDrawingRef.current}, startPosRef=${startPosRef.current}`);
        return;
      }

      e.evt.preventDefault();
      const endPos = getImageCoordinates(e);
      const start = startPosRef.current;
      console.log(`🎨 [MaskLayer] Mouse/Touch end: image=(${endPos.x.toFixed(1)}, ${endPos.y.toFixed(1)}), tool=${activeTool}`);

      // Shape tools (rect/circle) are handled by document-level listener in MapGenerator
      // This ensures shapes work correctly even when mouse leaves/returns to canvas
      // (Konva loses pointer tracking in that case, so Layer's onMouseUp doesn't fire reliably)
      if (activeTool === 'rect' || activeTool === 'circle') {
        console.log(`🎨 [MaskLayer] handleEnd: Shape tool - deferring to document listener`);
        return;
      }

      // Handle brush and eraser tools
      if (activeTool === 'brush' || activeTool === 'eraser') {
        isDrawingRef.current = false;
        startPosRef.current = null;
        onStrokeEnd();

        // Restore cursor position after drawing ends
        if (endPos.x >= 0 && endPos.x <= imageWidth && endPos.y >= 0 && endPos.y <= imageHeight) {
          setCursorPosition(endPos);
        }
        return;
      }
    },
    [activeTool, getImageCoordinates, onStrokeEnd, imageWidth, imageHeight]
  );

  // Handle mouse leave - just hide cursor, DON'T cancel operations
  // Document-level listeners in MapGenerator handle continue/end outside canvas
  const handleMouseLeave = useCallback(() => {
    console.log(`🎨 [MaskLayer] handleMouseLeave: isDrawingRef=${isDrawingRef.current}, activeTool=${activeTool}, hasPreviewShape=${!!previewShape}`);
    setCursorPosition(null);
    // Note: We intentionally do NOT cancel drawing here.
    // This allows users to drag outside the canvas and continue drawing.
    // The document-level listener in MapGenerator handles mouseup/mousemove
    // outside the canvas bounds.
  }, [activeTool, previewShape]);

  // Render a single stroke based on its type
  // Renders in chronological order to allow repainting over erased areas
  const renderStroke = (stroke: MaskStroke) => {
    // Rect shape
    if (stroke.tool === 'rect' && stroke.bounds) {
      return (
        <Rect
          key={stroke.id}
          x={stroke.bounds.x}
          y={stroke.bounds.y}
          width={stroke.bounds.width}
          height={stroke.bounds.height}
          fill={MASK_COLOR}
          globalCompositeOperation="source-over"
        />
      );
    }

    // Circle shape
    if (stroke.tool === 'circle' && stroke.bounds) {
      return (
        <Ellipse
          key={stroke.id}
          x={stroke.bounds.x + stroke.bounds.width / 2}
          y={stroke.bounds.y + stroke.bounds.height / 2}
          radiusX={stroke.bounds.width / 2}
          radiusY={stroke.bounds.height / 2}
          fill={MASK_COLOR}
          globalCompositeOperation="source-over"
        />
      );
    }

    // Brush or eraser line strokes
    if (stroke.points.length < 2) {
      return null;
    }

    if (stroke.tool === 'eraser') {
      // Eraser: subtract from what's already rendered (destination-out)
      return (
        <Line
          key={stroke.id}
          points={stroke.points}
          stroke="rgba(0,0,0,1)" // Opaque black for destination-out
          strokeWidth={stroke.strokeWidth}
          tension={0.5}
          lineCap="round"
          lineJoin="round"
          globalCompositeOperation="destination-out"
          perfectDrawEnabled={false}
        />
      );
    }

    // Brush: add to mask (source-over)
    // This will add on top of erased areas if it comes after eraser strokes
    return (
      <Line
        key={stroke.id}
        points={stroke.points}
        stroke={MASK_COLOR}
        strokeWidth={stroke.strokeWidth}
        tension={0.5}
        lineCap="round"
        lineJoin="round"
        globalCompositeOperation="source-over"
        perfectDrawEnabled={false}
      />
    );
  };

  return (
    <Layer
      listening={true}
      onMouseDown={handleStart}
      onMouseMove={handleMove}
      onMouseUp={handleEnd}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleStart}
      onTouchMove={handleMove}
      onTouchEnd={handleEnd}
    >
      {/* Invisible hitbox for event capture - CRITICAL: Layer needs a shape to receive events */}
      {/* Hitbox is expanded by stageBuffer on all sides to allow drawing outside the image */}
      {/* This enables shape preview to render when dragging outside the image bounds */}
      {imageWidth > 0 && imageHeight > 0 && (
        <Rect
          x={-stageBuffer}
          y={-stageBuffer}
          width={imageWidth + stageBuffer * 2}
          height={imageHeight + stageBuffer * 2}
          fill="transparent"
          listening={true}
        />
      )}

      {/* Render all strokes in chronological order
          This allows brush strokes added after eraser strokes to repaint erased areas */}
      {strokes.map(renderStroke)}

      {/* Render current stroke being drawn (always on top) */}
      {currentStroke && renderStroke(currentStroke)}

      {/* Render preview shape while drawing (rect/circle) */}
      {previewShape && activeTool === 'rect' && (
        <Rect
          x={previewShape.x}
          y={previewShape.y}
          width={previewShape.width}
          height={previewShape.height}
          fill={MASK_COLOR}
          stroke={MASK_COLOR}
          strokeWidth={2}
          dash={[5, 5]}
          listening={false}
        />
      )}
      {previewShape && activeTool === 'circle' && (
        <Ellipse
          x={previewShape.x + previewShape.width / 2}
          y={previewShape.y + previewShape.height / 2}
          radiusX={previewShape.width / 2}
          radiusY={previewShape.height / 2}
          fill={MASK_COLOR}
          stroke={MASK_COLOR}
          strokeWidth={2}
          dash={[5, 5]}
          listening={false}
        />
      )}

      {/* Brush cursor indicator */}
      <BrushCursor
        activeTool={activeTool}
        brushSize={brushSize}
        position={cursorPosition}
      />
    </Layer>
  );
};
