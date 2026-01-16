var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * LabelLayer Component (T063-T065)
 *
 * Renders text labels on the map with support for:
 * - Click-to-place labels (in label mode)
 * - Inline text editing (double-click)
 * - Dragging labels to reposition
 * - Selection with visual transformer
 */
import { useRef, useEffect, useState } from 'react';
import { Layer, Text, Transformer, Rect, Group, Circle } from 'react-konva';
/**
 * LabelLayer renders text labels on the map canvas.
 * Supports selection, dragging, and inline editing.
 */
export function LabelLayer(_a) {
    var labels = _a.labels, selectedLabelId = _a.selectedLabelId, onLabelSelect = _a.onLabelSelect, onLabelUpdate = _a.onLabelUpdate, onLabelDelete = _a.onLabelDelete, mode = _a.mode, onLabelPlace = _a.onLabelPlace, _b = _a.imageWidth, imageWidth = _b === void 0 ? 0 : _b, _c = _a.imageHeight, imageHeight = _c === void 0 ? 0 : _c, onStartEditing = _a.onStartEditing, editingLabelId = _a.editingLabelId;
    var transformerRef = useRef(null);
    var selectedLabelRef = useRef(null);
    var _d = useState(null), deleteButtonPos = _d[0], setDeleteButtonPos = _d[1];
    // Update transformer and delete button position when selection changes
    // Use a small delay to ensure the ref is set after render
    useEffect(function () {
        var updateTransformer = function () {
            var _a;
            if (transformerRef.current && selectedLabelRef.current) {
                transformerRef.current.nodes([selectedLabelRef.current]);
                (_a = transformerRef.current.getLayer()) === null || _a === void 0 ? void 0 : _a.batchDraw();
                // Calculate delete button position (top-right of label)
                var textNode = selectedLabelRef.current;
                var textWidth = textNode.width();
                setDeleteButtonPos({
                    x: textNode.x() + textWidth + 8,
                    y: textNode.y() - 8,
                });
            }
            else if (!selectedLabelId) {
                setDeleteButtonPos(null);
                if (transformerRef.current) {
                    transformerRef.current.nodes([]);
                }
            }
        };
        // Immediate update
        updateTransformer();
        // Also schedule a delayed update in case ref isn't ready yet
        var timeoutId = setTimeout(updateTransformer, 10);
        return function () { return clearTimeout(timeoutId); };
    }, [selectedLabelId, labels, mode]);
    // Handle delete button click
    var handleDeleteClick = function (e) {
        e.cancelBubble = true;
        if (selectedLabelId && onLabelDelete) {
            onLabelDelete(selectedLabelId);
            onLabelSelect(null);
        }
    };
    // Handle label click
    var handleLabelClick = function (e, labelId) {
        e.cancelBubble = true; // Prevent event bubbling
        onLabelSelect(labelId);
    };
    // Handle label double-click (start inline editing - only in label mode)
    var handleLabelDblClick = function (e, labelId) {
        e.cancelBubble = true;
        onLabelSelect(labelId);
        // Only start inline editing in label mode
        if (mode !== 'label') {
            return;
        }
        // Start inline editing if callback provided
        if (onStartEditing) {
            var label = labels.find(function (l) { return l.id === labelId; });
            if (label) {
                var textNode = e.target;
                var stage = textNode.getStage();
                var stageBox = stage.container().getBoundingClientRect();
                // Get the absolute position on screen
                var absolutePos = textNode.getAbsolutePosition();
                var scale = stage.scaleX();
                var editInfo = {
                    label: label,
                    screenX: stageBox.left + absolutePos.x * scale,
                    screenY: stageBox.top + absolutePos.y * scale,
                    scale: scale,
                };
                console.log('✏️ [LabelLayer] Starting inline edit:', editInfo);
                onStartEditing(editInfo);
            }
        }
    };
    // Handle label drag end
    var handleLabelDragEnd = function (e, labelId) {
        var node = e.target;
        var newX = node.x();
        var newY = node.y();
        onLabelUpdate(labelId, { x: newX, y: newY });
        console.log('🖱️ [LabelLayer] Label dragged:', labelId, { x: newX, y: newY });
    };
    // Handle transform end (scaling via transformer)
    var handleTransformEnd = function (e, labelId, currentFontSize) {
        var node = e.target;
        // Get the scale applied by transformer
        var scaleX = node.scaleX();
        var scaleY = node.scaleY();
        // Calculate new font size based on scale (use average for uniform feel)
        var scaleFactor = (scaleX + scaleY) / 2;
        var newFontSize = Math.round(Math.max(8, Math.min(200, currentFontSize * scaleFactor)));
        // Reset the node's scale back to 1 (we're storing the size change in fontSize instead)
        node.scaleX(1);
        node.scaleY(1);
        // Also capture any position/rotation changes from the transform
        var updates = {
            fontSize: newFontSize,
            x: node.x(),
            y: node.y(),
        };
        // If rotation changed during transform, capture it (round to nearest 45 degrees)
        var rotation = node.rotation();
        var roundedRotation = Math.round(rotation / 45) * 45 % 360;
        if (roundedRotation !== undefined) {
            updates.rotation = roundedRotation;
        }
        onLabelUpdate(labelId, updates);
        console.log('📐 [LabelLayer] Label transformed:', labelId, {
            scale: scaleFactor.toFixed(2),
            newFontSize: newFontSize,
            rotation: roundedRotation
        });
    };
    // Handle click on the background Rect (for placing new labels in label mode)
    var handleBackgroundClick = function (e) {
        // Only place labels if in label mode
        if (mode !== 'label' || !onLabelPlace)
            return;
        // Get click position relative to stage
        var stage = e.target.getStage();
        var pointerPos = stage.getPointerPosition();
        if (pointerPos) {
            onLabelPlace(pointerPos.x, pointerPos.y);
            console.log('📍 [LabelLayer] Label placed at:', pointerPos);
        }
    };
    // Handle click on layer (for deselecting labels)
    var handleLayerClick = function (e) {
        // If clicked on the background (not a label), deselect current label
        if (e.target.name && e.target.name() === 'label-background') {
            // Don't deselect here - the background click handler places labels
            return;
        }
    };
    // Render labels
    var labelElements = labels.map(function (label) {
        var _a, _b, _c, _d, _e;
        var isSelected = label.id === selectedLabelId;
        var isEditing = label.id === editingLabelId;
        return (_jsx(Text, { ref: isSelected ? selectedLabelRef : undefined, text: label.text, x: label.x, y: label.y, rotation: label.rotation, fontFamily: label.fontFamily, fontSize: label.fontSize, fill: label.color, 
            // Hide when being edited (HTML input shows instead)
            visible: !isEditing, draggable: mode === 'label' || mode === 'view', onClick: function (e) { return handleLabelClick(e, label.id); }, onDblClick: function (e) { return handleLabelDblClick(e, label.id); }, onDragEnd: function (e) { return handleLabelDragEnd(e, label.id); }, onTransformEnd: function (e) { return handleTransformEnd(e, label.id, label.fontSize); }, 
            // Stroke/outline
            stroke: label.strokeColor, strokeWidth: (_a = label.strokeWidth) !== null && _a !== void 0 ? _a : 0, 
            // Shadow - use label shadow if configured, otherwise selection glow
            shadowEnabled: label.shadowEnabled || isSelected, shadowColor: label.shadowEnabled ? ((_b = label.shadowColor) !== null && _b !== void 0 ? _b : '#000000') : (isSelected ? '#3b82f6' : undefined), shadowBlur: label.shadowEnabled ? ((_c = label.shadowBlur) !== null && _c !== void 0 ? _c : 4) : (isSelected ? 5 : 0), shadowOffset: label.shadowEnabled ? { x: (_d = label.shadowOffsetX) !== null && _d !== void 0 ? _d : 2, y: (_e = label.shadowOffsetY) !== null && _e !== void 0 ? _e : 2 } : undefined, shadowOpacity: label.shadowEnabled ? 0.7 : (isSelected ? 0.5 : 0) }, label.id));
    });
    return (_jsxs(Layer, __assign({ onClick: handleLayerClick }, { children: [mode === 'label' && onLabelPlace && imageWidth > 0 && imageHeight > 0 && (_jsx(Rect, { name: "label-background", x: 0, y: 0, width: imageWidth, height: imageHeight, fill: "transparent", onClick: handleBackgroundClick })), labelElements, selectedLabelId && deleteButtonPos && mode === 'label' && !editingLabelId && (_jsxs(Group, __assign({ x: deleteButtonPos.x, y: deleteButtonPos.y, onClick: handleDeleteClick, onTap: handleDeleteClick }, { children: [_jsx(Circle, { radius: 10, fill: "#ef4444", stroke: "#ffffff", strokeWidth: 1, shadowColor: "#000000", shadowBlur: 3, shadowOpacity: 0.3 }), _jsx(Text, { text: "\u00D7", fontSize: 16, fontStyle: "bold", fill: "#ffffff", x: -5, y: -9 })] }))), selectedLabelId && mode === 'label' && !editingLabelId && (_jsx(Transformer, { ref: transformerRef, boundBoxFunc: function (oldBox, newBox) {
                    // Limit minimum size
                    if (Math.abs(newBox.width) < 5 || Math.abs(newBox.height) < 5) {
                        return oldBox;
                    }
                    return newBox;
                }, 
                // Only allow rotation and resize (no skew)
                enabledAnchors: [
                    'top-left',
                    'top-right',
                    'bottom-left',
                    'bottom-right',
                ], rotateEnabled: true, rotationSnaps: [0, 45, 90, 135, 180, 225, 270, 315] }))] })));
}
