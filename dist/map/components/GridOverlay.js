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
import { Layer, Line, Group } from 'react-konva';
import { useGridCalculation } from '../hooks/useGridCalculation';
/**
 * GridOverlay renders grid lines using Konva Lines.
 * The layer is non-interactive (listening={false}) so it doesn't
 * interfere with map panning/zooming, except when in grid-adjust mode.
 */
export function GridOverlay(_a) {
    var width = _a.width, height = _a.height, gridConfig = _a.gridConfig, _b = _a.mode, mode = _b === void 0 ? 'view' : _b, onOffsetChange = _a.onOffsetChange;
    var isAdjustMode = mode === 'grid-adjust';
    // In adjust mode, calculate grid with offset 0 (offset applied via Group position)
    // In normal mode, use the actual offset (applied via grid math)
    var gridConfigForCalculation = isAdjustMode
        ? __assign(__assign({}, gridConfig), { offsetX: 0, offsetY: 0 }) : gridConfig;
    // Calculate grid lines using the hook
    var lines = useGridCalculation({ width: width, height: height, gridConfig: gridConfigForCalculation }).lines;
    // Don't render layer if grid is not visible
    if (!gridConfig.visible || lines.length === 0) {
        return null;
    }
    // Handle drag end to update offset
    var handleDragEnd = function (e) {
        if (!onOffsetChange || !isAdjustMode)
            return;
        var target = e.target;
        var newOffsetX = target.x();
        var newOffsetY = target.y();
        onOffsetChange({ offsetX: newOffsetX, offsetY: newOffsetY });
        console.log('🔲 [GridOverlay] Grid offset adjusted:', { offsetX: newOffsetX, offsetY: newOffsetY });
    };
    // Render grid lines
    var gridLines = lines.map(function (line, index) { return (_jsx(Line, { points: line.points, stroke: gridConfig.color, strokeWidth: 1, opacity: gridConfig.opacity }, "grid-line-".concat(index))); });
    // In adjust mode, wrap lines in a draggable Group with offset position
    if (isAdjustMode) {
        return (_jsx(Layer, __assign({ listening: false }, { children: _jsx(Group, __assign({ x: gridConfig.offsetX, y: gridConfig.offsetY, draggable: true, onDragEnd: handleDragEnd }, { children: gridLines })) })));
    }
    // In normal mode, render lines directly (offset handled by grid math)
    return (_jsx(Layer, __assign({ listening: false }, { children: gridLines })));
}
