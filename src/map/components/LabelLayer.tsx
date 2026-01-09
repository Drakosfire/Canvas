/**
 * LabelLayer Component (T063-T065)
 * 
 * Renders text labels on the map with support for:
 * - Click-to-place labels (in label mode)
 * - Inline text editing (double-click)
 * - Dragging labels to reposition
 * - Selection with visual transformer
 */

import React, { useRef, useEffect, useState } from 'react';
import { Layer, Text, Transformer, Rect, Group, Circle } from 'react-konva';
import { MapLabel, MapEditMode } from '../types/map.types';

export interface LabelEditInfo {
  /** Label being edited */
  label: MapLabel;
  /** Absolute position on screen for HTML overlay */
  screenX: number;
  screenY: number;
  /** Current scale factor for sizing the input */
  scale: number;
}

export interface LabelLayerProps {
  /** Array of labels to render */
  labels: MapLabel[];
  /** Currently selected label ID */
  selectedLabelId: string | null;
  /** Callback when label is selected */
  onLabelSelect: (id: string | null) => void;
  /** Callback when label is updated (position, text, etc.) */
  onLabelUpdate: (id: string, updates: Partial<MapLabel>) => void;
  /** Callback when label is deleted */
  onLabelDelete?: (id: string) => void;
  /** Current editing mode */
  mode: MapEditMode;
  /** Callback when user clicks to place a new label (in label mode) */
  onLabelPlace?: (x: number, y: number) => void;
  /** Image width (for click-to-place hit area) */
  imageWidth?: number;
  /** Image height (for click-to-place hit area) */
  imageHeight?: number;
  /** Callback when inline editing starts (provides position for HTML overlay) */
  onStartEditing?: (editInfo: LabelEditInfo) => void;
  /** Label currently being edited (hide the Konva text while editing) */
  editingLabelId?: string | null;
}

/**
 * LabelLayer renders text labels on the map canvas.
 * Supports selection, dragging, and inline editing.
 */
export function LabelLayer({
  labels,
  selectedLabelId,
  onLabelSelect,
  onLabelUpdate,
  onLabelDelete,
  mode,
  onLabelPlace,
  imageWidth = 0,
  imageHeight = 0,
  onStartEditing,
  editingLabelId,
}: LabelLayerProps) {
  const transformerRef = useRef<any>(null);
  const selectedLabelRef = useRef<any>(null);
  const [deleteButtonPos, setDeleteButtonPos] = useState<{ x: number; y: number } | null>(null);

  // Update transformer and delete button position when selection changes
  // Use a small delay to ensure the ref is set after render
  useEffect(() => {
    const updateTransformer = () => {
      if (transformerRef.current && selectedLabelRef.current) {
        transformerRef.current.nodes([selectedLabelRef.current]);
        transformerRef.current.getLayer()?.batchDraw();
        
        // Calculate delete button position (top-right of label)
        const textNode = selectedLabelRef.current;
        const textWidth = textNode.width();
        setDeleteButtonPos({
          x: textNode.x() + textWidth + 8,
          y: textNode.y() - 8,
        });
      } else if (!selectedLabelId) {
        setDeleteButtonPos(null);
        if (transformerRef.current) {
          transformerRef.current.nodes([]);
        }
      }
    };

    // Immediate update
    updateTransformer();
    
    // Also schedule a delayed update in case ref isn't ready yet
    const timeoutId = setTimeout(updateTransformer, 10);
    return () => clearTimeout(timeoutId);
  }, [selectedLabelId, labels, mode]);

  // Handle delete button click
  const handleDeleteClick = (e: any) => {
    e.cancelBubble = true;
    if (selectedLabelId && onLabelDelete) {
      onLabelDelete(selectedLabelId);
      onLabelSelect(null);
    }
  };

  // Handle label click
  const handleLabelClick = (e: any, labelId: string) => {
    e.cancelBubble = true; // Prevent event bubbling
    onLabelSelect(labelId);
  };

  // Handle label double-click (start inline editing - only in label mode)
  const handleLabelDblClick = (e: any, labelId: string) => {
    e.cancelBubble = true;
    onLabelSelect(labelId);
    
    // Only start inline editing in label mode
    if (mode !== 'label') {
      return;
    }
    
    // Start inline editing if callback provided
    if (onStartEditing) {
      const label = labels.find(l => l.id === labelId);
      if (label) {
        const textNode = e.target;
        const stage = textNode.getStage();
        const stageBox = stage.container().getBoundingClientRect();
        
        // Get the absolute position on screen
        const absolutePos = textNode.getAbsolutePosition();
        const scale = stage.scaleX();
        
        const editInfo: LabelEditInfo = {
          label,
          screenX: stageBox.left + absolutePos.x * scale,
          screenY: stageBox.top + absolutePos.y * scale,
          scale,
        };
        
        console.log('✏️ [LabelLayer] Starting inline edit:', editInfo);
        onStartEditing(editInfo);
      }
    }
  };

  // Handle label drag end
  const handleLabelDragEnd = (e: any, labelId: string) => {
    const node = e.target;
    const newX = node.x();
    const newY = node.y();

    onLabelUpdate(labelId, { x: newX, y: newY });
    console.log('🖱️ [LabelLayer] Label dragged:', labelId, { x: newX, y: newY });
  };

  // Handle transform end (scaling via transformer)
  const handleTransformEnd = (e: any, labelId: string, currentFontSize: number) => {
    const node = e.target;
    
    // Get the scale applied by transformer
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    
    // Calculate new font size based on scale (use average for uniform feel)
    const scaleFactor = (scaleX + scaleY) / 2;
    const newFontSize = Math.round(Math.max(8, Math.min(200, currentFontSize * scaleFactor)));
    
    // Reset the node's scale back to 1 (we're storing the size change in fontSize instead)
    node.scaleX(1);
    node.scaleY(1);
    
    // Also capture any position/rotation changes from the transform
    const updates: Partial<MapLabel> = {
      fontSize: newFontSize,
      x: node.x(),
      y: node.y(),
    };
    
    // If rotation changed during transform, capture it (round to nearest 45 degrees)
    const rotation = node.rotation();
    const roundedRotation = Math.round(rotation / 45) * 45 % 360;
    if (roundedRotation !== undefined) {
      updates.rotation = roundedRotation as MapLabel['rotation'];
    }
    
    onLabelUpdate(labelId, updates);
    console.log('📐 [LabelLayer] Label transformed:', labelId, { 
      scale: scaleFactor.toFixed(2), 
      newFontSize, 
      rotation: roundedRotation 
    });
  };

  // Handle click on the background Rect (for placing new labels in label mode)
  const handleBackgroundClick = (e: any) => {
    // Only place labels if in label mode
    if (mode !== 'label' || !onLabelPlace) return;

    // Get click position relative to stage
    const stage = e.target.getStage();
    const pointerPos = stage.getPointerPosition();
    
    if (pointerPos) {
      onLabelPlace(pointerPos.x, pointerPos.y);
      console.log('📍 [LabelLayer] Label placed at:', pointerPos);
    }
  };

  // Handle click on layer (for deselecting labels)
  const handleLayerClick = (e: any) => {
    // If clicked on the background (not a label), deselect current label
    if (e.target.name && e.target.name() === 'label-background') {
      // Don't deselect here - the background click handler places labels
      return;
    }
  };

  // Render labels
  const labelElements = labels.map((label) => {
    const isSelected = label.id === selectedLabelId;
    const isEditing = label.id === editingLabelId;

    return (
      <Text
        key={label.id}
        ref={isSelected ? selectedLabelRef : undefined}
        text={label.text}
        x={label.x}
        y={label.y}
        rotation={label.rotation}
        fontFamily={label.fontFamily}
        fontSize={label.fontSize}
        fill={label.color}
        // Hide when being edited (HTML input shows instead)
        visible={!isEditing}
        draggable={mode === 'label' || mode === 'view'}
        onClick={(e) => handleLabelClick(e, label.id)}
        onDblClick={(e) => handleLabelDblClick(e, label.id)}
        onDragEnd={(e) => handleLabelDragEnd(e, label.id)}
        onTransformEnd={(e) => handleTransformEnd(e, label.id, label.fontSize)}
        // Stroke/outline
        stroke={label.strokeColor}
        strokeWidth={label.strokeWidth ?? 0}
        // Shadow - use label shadow if configured, otherwise selection glow
        shadowEnabled={label.shadowEnabled || isSelected}
        shadowColor={label.shadowEnabled ? (label.shadowColor ?? '#000000') : (isSelected ? '#3b82f6' : undefined)}
        shadowBlur={label.shadowEnabled ? (label.shadowBlur ?? 4) : (isSelected ? 5 : 0)}
        shadowOffset={label.shadowEnabled ? { x: label.shadowOffsetX ?? 2, y: label.shadowOffsetY ?? 2 } : undefined}
        shadowOpacity={label.shadowEnabled ? 0.7 : (isSelected ? 0.5 : 0)}
      />
    );
  });

  return (
    <Layer onClick={handleLayerClick}>
      {/* Transparent background rect to capture clicks for label placement - only when actively placing */}
      {mode === 'label' && onLabelPlace && imageWidth > 0 && imageHeight > 0 && (
        <Rect
          name="label-background"
          x={0}
          y={0}
          width={imageWidth}
          height={imageHeight}
          fill="transparent"
          onClick={handleBackgroundClick}
        />
      )}
      {labelElements}
      
      {/* Delete button for selected label - hide during inline editing */}
      {selectedLabelId && deleteButtonPos && mode === 'label' && !editingLabelId && (
        <Group
          x={deleteButtonPos.x}
          y={deleteButtonPos.y}
          onClick={handleDeleteClick}
          onTap={handleDeleteClick}
        >
          {/* Red circle background */}
          <Circle
            radius={10}
            fill="#ef4444"
            stroke="#ffffff"
            strokeWidth={1}
            shadowColor="#000000"
            shadowBlur={3}
            shadowOpacity={0.3}
          />
          {/* X icon using two lines */}
          <Text
            text="×"
            fontSize={16}
            fontStyle="bold"
            fill="#ffffff"
            x={-5}
            y={-9}
          />
        </Group>
      )}
      
      {/* Transformer for selected label - hide during inline editing */}
      {selectedLabelId && mode === 'label' && !editingLabelId && (
        <Transformer
          ref={transformerRef}
          boundBoxFunc={(oldBox, newBox) => {
            // Limit minimum size
            if (Math.abs(newBox.width) < 5 || Math.abs(newBox.height) < 5) {
              return oldBox;
            }
            return newBox;
          }}
          // Only allow rotation and resize (no skew)
          enabledAnchors={[
            'top-left',
            'top-right',
            'bottom-left',
            'bottom-right',
          ]}
          rotateEnabled={true}
          rotationSnaps={[0, 45, 90, 135, 180, 225, 270, 315]}
        />
      )}
    </Layer>
  );
}
