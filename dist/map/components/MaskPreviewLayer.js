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
import { jsx as _jsx } from "react/jsx-runtime";
import { Layer, Line, Rect, Ellipse } from 'react-konva';
/**
 * MaskPreviewLayer renders mask strokes as a semi-transparent overlay.
 * Used when mask mode is disabled but mask data exists (T208).
 */
export var MaskPreviewLayer = function (_a) {
    var strokes = _a.strokes, _b = _a.opacity, opacity = _b === void 0 ? 0.3 : _b, _c = _a.color, color = _c === void 0 ? 'rgba(59, 130, 246, 0.3)' : _c;
    var renderStroke = function (stroke) {
        if (stroke.tool === 'rect' && stroke.bounds) {
            return (_jsx(Rect, { x: stroke.bounds.x, y: stroke.bounds.y, width: stroke.bounds.width, height: stroke.bounds.height, fill: color, opacity: opacity, listening: false }, stroke.id));
        }
        if (stroke.tool === 'circle' && stroke.bounds) {
            var cx = stroke.bounds.x + stroke.bounds.width / 2;
            var cy = stroke.bounds.y + stroke.bounds.height / 2;
            var rx = stroke.bounds.width / 2;
            var ry = stroke.bounds.height / 2;
            return (_jsx(Ellipse, { x: cx, y: cy, radiusX: rx, radiusY: ry, fill: color, opacity: opacity, listening: false }, stroke.id));
        }
        if (stroke.points.length >= 2) {
            return (_jsx(Line, { points: stroke.points, stroke: color, strokeWidth: stroke.strokeWidth, opacity: opacity, lineCap: "round", lineJoin: "round", listening: false }, stroke.id));
        }
        return null;
    };
    if (strokes.length === 0) {
        return null;
    }
    return (_jsx(Layer, __assign({ listening: false }, { children: strokes.map(renderStroke) })));
};
