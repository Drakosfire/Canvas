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
 * MaskDrawingLayer Component
 *
 * Konva layer for rendering mask strokes (brush, eraser, shapes).
 * Implements TDD tests from T156-T161.
 */
import React, { useRef, useCallback, useEffect } from 'react';
import { Layer, Line, Rect, Ellipse } from 'react-konva';
import { BrushCursor } from './BrushCursor';
var MASK_COLOR = 'rgba(255, 0, 0, 0.5)'; // Semi-transparent red for visibility
export var MaskDrawingLayer = function (_a) {
    var strokes = _a.strokes, currentStroke = _a.currentStroke, activeTool = _a.activeTool, brushSize = _a.brushSize, isDrawing = _a.isDrawing, onStrokeStart = _a.onStrokeStart, onStrokeContinue = _a.onStrokeContinue, onStrokeEnd = _a.onStrokeEnd, onShapeAdd = _a.onShapeAdd, imageWidth = _a.imageWidth, imageHeight = _a.imageHeight, _b = _a.stageBuffer, stageBuffer = _b === void 0 ? 0 : _b;
    var isDrawingRef = useRef(false);
    var startPosRef = useRef(null);
    var _c = React.useState(null), cursorPosition = _c[0], setCursorPosition = _c[1];
    var _d = React.useState(null), previewShape = _d[0], setPreviewShape = _d[1];
    // Sync internal state when isDrawing prop changes to false
    // This handles the case where document-level listener ends a shape drawing
    useEffect(function () {
        if (!isDrawing && isDrawingRef.current) {
            console.log("\uD83C\uDFA8 [MaskLayer] Syncing internal state: isDrawing prop became false, resetting refs");
            isDrawingRef.current = false;
            startPosRef.current = null;
            setPreviewShape(null);
        }
    }, [isDrawing]);
    // Convert stage coordinates to image coordinates
    var getImageCoordinates = useCallback(function (e) {
        var stage = e.target.getStage();
        if (!stage)
            return { x: 0, y: 0 };
        var pointerPos = stage.getPointerPosition();
        if (!pointerPos)
            return { x: 0, y: 0 };
        // Adjust for stage transform (pan/zoom)
        var adjustedX = (pointerPos.x - stage.x()) / stage.scaleX();
        var adjustedY = (pointerPos.y - stage.y()) / stage.scaleY();
        return { x: adjustedX, y: adjustedY };
    }, []);
    // Handle mouse/touch start
    var handleStart = useCallback(function (e) {
        e.evt.preventDefault();
        var pos = getImageCoordinates(e);
        var screenPos = e.evt instanceof MouseEvent
            ? "(".concat(e.evt.clientX, ", ").concat(e.evt.clientY, ")")
            : e.evt instanceof TouchEvent && e.evt.touches[0]
                ? "(".concat(e.evt.touches[0].clientX, ", ").concat(e.evt.touches[0].clientY, ")")
                : 'unknown';
        console.log("\uD83C\uDFA8 [MaskLayer] Mouse/Touch start: screen=".concat(screenPos, ", image=(").concat(pos.x.toFixed(1), ", ").concat(pos.y.toFixed(1), "), tool=").concat(activeTool));
        // Handle shape tools (rect/circle)
        if (activeTool === 'rect' || activeTool === 'circle') {
            console.log("\uD83C\uDFA8 [MaskLayer] Shape START: setting isDrawingRef=true, startPos=(".concat(pos.x.toFixed(1), ", ").concat(pos.y.toFixed(1), ")"));
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
        console.log("\uD83C\uDFA8 [MaskLayer] Ignoring start event: tool=".concat(activeTool, " (unknown tool)"));
    }, [activeTool, getImageCoordinates, onStrokeStart]);
    // Handle mouse/touch move
    var handleMove = useCallback(function (e) {
        var pos = getImageCoordinates(e);
        // Always update cursor position for brush reticle (even during drawing)
        if (activeTool === 'brush' || activeTool === 'eraser') {
            // Check if within image bounds
            if (pos.x >= 0 && pos.x <= imageWidth && pos.y >= 0 && pos.y <= imageHeight) {
                setCursorPosition(pos);
            }
            else {
                setCursorPosition(null);
            }
        }
        if (!isDrawingRef.current || !startPosRef.current) {
            return; // Not drawing, ignore
        }
        e.evt.preventDefault();
        // Handle shape tools (rect/circle) - update preview
        if (activeTool === 'rect' || activeTool === 'circle') {
            var start = startPosRef.current;
            var bounds = {
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
                console.log("\uD83C\uDFA8 [MaskLayer] Mouse/Touch move: image=(".concat(pos.x.toFixed(1), ", ").concat(pos.y.toFixed(1), ")"));
            }
            onStrokeContinue(pos.x, pos.y);
            return;
        }
    }, [activeTool, getImageCoordinates, onStrokeContinue, imageWidth, imageHeight]);
    // Handle mouse/touch end
    var handleEnd = useCallback(function (e) {
        var _a;
        // Log the event type to detect if Konva is synthesizing mouseup on leave
        var eventType = ((_a = e.evt) === null || _a === void 0 ? void 0 : _a.type) || 'unknown';
        console.log("\uD83C\uDFA8 [MaskLayer] handleEnd called: eventType=".concat(eventType, ", isDrawingRef=").concat(isDrawingRef.current, ", hasStartPos=").concat(!!startPosRef.current));
        // Guard: Only accept real mouseup/touchend events, not synthetic events
        // This prevents Konva from canceling shapes when mouse leaves canvas
        var validEndEvents = ['mouseup', 'touchend'];
        if (!validEndEvents.includes(eventType)) {
            console.log("\u26A0\uFE0F [MaskLayer] handleEnd BLOCKED: unexpected event type '".concat(eventType, "' (expected mouseup or touchend)"));
            return;
        }
        if (!isDrawingRef.current || !startPosRef.current) {
            console.log("\uD83C\uDFA8 [MaskLayer] handleEnd early return: isDrawingRef=".concat(isDrawingRef.current, ", startPosRef=").concat(startPosRef.current));
            return;
        }
        e.evt.preventDefault();
        var endPos = getImageCoordinates(e);
        var start = startPosRef.current;
        console.log("\uD83C\uDFA8 [MaskLayer] Mouse/Touch end: image=(".concat(endPos.x.toFixed(1), ", ").concat(endPos.y.toFixed(1), "), tool=").concat(activeTool));
        // Shape tools (rect/circle) are handled by document-level listener in MapGenerator
        // This ensures shapes work correctly even when mouse leaves/returns to canvas
        // (Konva loses pointer tracking in that case, so Layer's onMouseUp doesn't fire reliably)
        if (activeTool === 'rect' || activeTool === 'circle') {
            console.log("\uD83C\uDFA8 [MaskLayer] handleEnd: Shape tool - deferring to document listener");
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
    }, [activeTool, getImageCoordinates, onStrokeEnd, imageWidth, imageHeight]);
    // Handle mouse leave - just hide cursor, DON'T cancel operations
    // Document-level listeners in MapGenerator handle continue/end outside canvas
    var handleMouseLeave = useCallback(function () {
        console.log("\uD83C\uDFA8 [MaskLayer] handleMouseLeave: isDrawingRef=".concat(isDrawingRef.current, ", activeTool=").concat(activeTool, ", hasPreviewShape=").concat(!!previewShape));
        setCursorPosition(null);
        // Note: We intentionally do NOT cancel drawing here.
        // This allows users to drag outside the canvas and continue drawing.
        // The document-level listener in MapGenerator handles mouseup/mousemove
        // outside the canvas bounds.
    }, [activeTool, previewShape]);
    // Render a single stroke based on its type
    // Renders in chronological order to allow repainting over erased areas
    var renderStroke = function (stroke) {
        // Rect shape
        if (stroke.tool === 'rect' && stroke.bounds) {
            return (_jsx(Rect, { x: stroke.bounds.x, y: stroke.bounds.y, width: stroke.bounds.width, height: stroke.bounds.height, fill: MASK_COLOR, globalCompositeOperation: "source-over" }, stroke.id));
        }
        // Circle shape
        if (stroke.tool === 'circle' && stroke.bounds) {
            return (_jsx(Ellipse, { x: stroke.bounds.x + stroke.bounds.width / 2, y: stroke.bounds.y + stroke.bounds.height / 2, radiusX: stroke.bounds.width / 2, radiusY: stroke.bounds.height / 2, fill: MASK_COLOR, globalCompositeOperation: "source-over" }, stroke.id));
        }
        // Brush or eraser line strokes
        if (stroke.points.length < 2) {
            return null;
        }
        if (stroke.tool === 'eraser') {
            // Eraser: subtract from what's already rendered (destination-out)
            return (_jsx(Line, { points: stroke.points, stroke: "rgba(0,0,0,1)" // Opaque black for destination-out
                , strokeWidth: stroke.strokeWidth, tension: 0.5, lineCap: "round", lineJoin: "round", globalCompositeOperation: "destination-out", perfectDrawEnabled: false }, stroke.id));
        }
        // Brush: add to mask (source-over)
        // This will add on top of erased areas if it comes after eraser strokes
        return (_jsx(Line, { points: stroke.points, stroke: MASK_COLOR, strokeWidth: stroke.strokeWidth, tension: 0.5, lineCap: "round", lineJoin: "round", globalCompositeOperation: "source-over", perfectDrawEnabled: false }, stroke.id));
    };
    return (_jsxs(Layer, __assign({ listening: true, onMouseDown: handleStart, onMouseMove: handleMove, onMouseUp: handleEnd, onMouseLeave: handleMouseLeave, onTouchStart: handleStart, onTouchMove: handleMove, onTouchEnd: handleEnd }, { children: [imageWidth > 0 && imageHeight > 0 && (_jsx(Rect, { x: -stageBuffer, y: -stageBuffer, width: imageWidth + stageBuffer * 2, height: imageHeight + stageBuffer * 2, fill: "transparent", listening: true })), strokes.map(renderStroke), currentStroke && renderStroke(currentStroke), previewShape && activeTool === 'rect' && (_jsx(Rect, { x: previewShape.x, y: previewShape.y, width: previewShape.width, height: previewShape.height, fill: MASK_COLOR, stroke: MASK_COLOR, strokeWidth: 2, dash: [5, 5], listening: false })), previewShape && activeTool === 'circle' && (_jsx(Ellipse, { x: previewShape.x + previewShape.width / 2, y: previewShape.y + previewShape.height / 2, radiusX: previewShape.width / 2, radiusY: previewShape.height / 2, fill: MASK_COLOR, stroke: MASK_COLOR, strokeWidth: 2, dash: [5, 5], listening: false })), _jsx(BrushCursor, { activeTool: activeTool, brushSize: brushSize, position: cursorPosition })] })));
};
