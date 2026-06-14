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
 * MapViewport Component
 *
 * Main Konva Stage component for map rendering.
 * Renders 3 layers in fixed z-order:
 * 1. Base Image Layer (non-interactive)
 * 2. Grid Overlay Layer (non-interactive)
 * 3. Labels Layer (interactive, draggable)
 */
import { useMemo, useRef, useCallback } from 'react';
import { Stage, Layer, Image } from 'react-konva';
import useImage from 'use-image';
import { GridOverlay } from './GridOverlay';
import { LabelLayer } from './LabelLayer';
import { MaskDrawingLayer } from './MaskDrawingLayer';
import { MaskPreviewLayer } from './MaskPreviewLayer';
/**
 * Buffer around the Stage to allow drawing outside visible viewport.
 * Shapes can be drawn into this buffer area, but it's clipped by the container.
 * Mask export clips to image dimensions regardless.
 */
export var STAGE_BUFFER = 500;
/**
 * MapViewport renders a pannable, zoomable map canvas with:
 * - Base image layer
 * - Configurable grid overlay (square or hex)
 * - Draggable text labels
 */
export function MapViewport(_a) {
    var width = _a.width, height = _a.height, baseImageUrl = _a.baseImageUrl, gridConfig = _a.gridConfig, labels = _a.labels, _b = _a.selectedLabelId, selectedLabelId = _b === void 0 ? null : _b, onLabelSelect = _a.onLabelSelect, onLabelUpdate = _a.onLabelUpdate, onLabelDelete = _a.onLabelDelete, onLabelPlace = _a.onLabelPlace, _c = _a.zoom, zoom = _c === void 0 ? 1 : _c, _d = _a.panX, panX = _d === void 0 ? 0 : _d, _e = _a.panY, panY = _e === void 0 ? 0 : _e, onViewChange = _a.onViewChange, _f = _a.mode, mode = _f === void 0 ? 'view' : _f, onGridOffsetChange = _a.onGridOffsetChange, onStartEditing = _a.onStartEditing, editingLabelId = _a.editingLabelId, 
    // Mask props
    _g = _a.maskEnabled, 
    // Mask props
    maskEnabled = _g === void 0 ? false : _g, _h = _a.maskStrokes, maskStrokes = _h === void 0 ? [] : _h, _j = _a.maskCurrentStroke, maskCurrentStroke = _j === void 0 ? null : _j, _k = _a.maskActiveTool, maskActiveTool = _k === void 0 ? 'brush' : _k, _l = _a.maskBrushSize, maskBrushSize = _l === void 0 ? 30 : _l, _m = _a.maskIsDrawing, maskIsDrawing = _m === void 0 ? false : _m, onMaskStrokeStart = _a.onMaskStrokeStart, onMaskStrokeContinue = _a.onMaskStrokeContinue, onMaskStrokeEnd = _a.onMaskStrokeEnd, onMaskShapeAdd = _a.onMaskShapeAdd;
    // Load base image
    var image = useImage(baseImageUrl)[0];
    // Get image dimensions (natural size of loaded image)
    var imageDimensions = useMemo(function () {
        if (!image) {
            return { width: 0, height: 0 };
        }
        return {
            width: image.width,
            height: image.height,
        };
    }, [image]);
    // Handle label placement (click-to-place in label mode)
    var handleLabelPlace = function (x, y) {
        if (!onLabelPlace)
            return;
        // Adjust for stage transform (pan/zoom) - account for STAGE_BUFFER offset
        // The stage has x={panX + STAGE_BUFFER}, so we need to subtract STAGE_BUFFER
        var adjustedX = (x - panX - STAGE_BUFFER) / zoom;
        var adjustedY = (y - panY - STAGE_BUFFER) / zoom;
        onLabelPlace(adjustedX, adjustedY);
    };
    // ========== Middle Mouse Button Panning ==========
    // Panning is locked to middle mouse button to avoid conflicts with label dragging
    var isPanningRef = useRef(false);
    var panStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
    var handleMouseDown = useCallback(function (e) {
        var _a;
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
            var container = (_a = e.target.getStage()) === null || _a === void 0 ? void 0 : _a.container();
            if (container) {
                container.style.cursor = 'grabbing';
            }
        }
    }, [panX, panY]);
    var handleMouseMove = useCallback(function (e) {
        if (!isPanningRef.current || !onViewChange)
            return;
        var dx = e.evt.clientX - panStartRef.current.x;
        var dy = e.evt.clientY - panStartRef.current.y;
        onViewChange({
            zoom: zoom,
            panX: panStartRef.current.panX + dx,
            panY: panStartRef.current.panY + dy,
        });
    }, [zoom, onViewChange]);
    var handleMouseUp = useCallback(function (e) {
        var _a;
        if (isPanningRef.current) {
            isPanningRef.current = false;
            // Reset cursor
            var container = (_a = e.target.getStage()) === null || _a === void 0 ? void 0 : _a.container();
            if (container) {
                container.style.cursor = 'default';
            }
        }
    }, []);
    // Handle mouse leaving the stage while panning
    var handleMouseLeave = useCallback(function (e) {
        var _a;
        console.log("\uD83C\uDFAD [MapViewport] Stage handleMouseLeave: isPanning=".concat(isPanningRef.current, ", maskEnabled=").concat(maskEnabled));
        if (isPanningRef.current) {
            isPanningRef.current = false;
            var container = (_a = e.target.getStage()) === null || _a === void 0 ? void 0 : _a.container();
            if (container) {
                container.style.cursor = 'default';
            }
        }
    }, [maskEnabled]);
    // Expanded stage dimensions to allow drawing outside visible viewport
    // The container clips the overflow, but Konva can still track/render in this area
    var expandedWidth = width + STAGE_BUFFER * 2;
    var expandedHeight = height + STAGE_BUFFER * 2;
    return (_jsxs(Stage, __assign({ width: expandedWidth, height: expandedHeight, draggable: false, scaleX: zoom, scaleY: zoom, x: panX + STAGE_BUFFER, y: panY + STAGE_BUFFER, onMouseDown: handleMouseDown, onMouseMove: handleMouseMove, onMouseUp: handleMouseUp, onMouseLeave: handleMouseLeave, style: {
            // Offset the Stage so the visible content aligns with the container
            position: 'absolute',
            left: -STAGE_BUFFER,
            top: -STAGE_BUFFER,
        } }, { children: [_jsx(Layer, __assign({ listening: false }, { children: image && _jsx(Image, { image: image }) })), imageDimensions.width > 0 && (_jsx(GridOverlay, { width: imageDimensions.width, height: imageDimensions.height, gridConfig: gridConfig, mode: mode, onOffsetChange: onGridOffsetChange })), _jsx(LabelLayer, { labels: labels, selectedLabelId: selectedLabelId, onLabelSelect: onLabelSelect || (function () { }), onLabelUpdate: onLabelUpdate, onLabelDelete: onLabelDelete, mode: mode, onLabelPlace: mode === 'label' && onLabelPlace ? handleLabelPlace : undefined, imageWidth: imageDimensions.width, imageHeight: imageDimensions.height, onStartEditing: onStartEditing, editingLabelId: editingLabelId }), maskEnabled && imageDimensions.width > 0 && (_jsx(MaskDrawingLayer, { strokes: maskStrokes, currentStroke: maskCurrentStroke, activeTool: maskActiveTool, brushSize: maskBrushSize, isDrawing: maskIsDrawing, onStrokeStart: onMaskStrokeStart || (function () { }), onStrokeContinue: onMaskStrokeContinue || (function () { }), onStrokeEnd: onMaskStrokeEnd || (function () { }), onShapeAdd: onMaskShapeAdd || (function () { }), imageWidth: imageDimensions.width, imageHeight: imageDimensions.height, stageBuffer: STAGE_BUFFER })), !maskEnabled && maskStrokes.length > 0 && (_jsx(MaskPreviewLayer, { strokes: maskStrokes, opacity: 0.3, color: "rgba(59, 130, 246, 0.3)" }))] })));
}
