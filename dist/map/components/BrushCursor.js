import { jsx as _jsx } from "react/jsx-runtime";
import { Circle } from 'react-konva';
export var BrushCursor = function (_a) {
    var activeTool = _a.activeTool, brushSize = _a.brushSize, position = _a.position;
    // Only show for brush and eraser tools
    var shouldShow = position && (activeTool === 'brush' || activeTool === 'eraser');
    if (!shouldShow || !position) {
        return null;
    }
    var radius = brushSize / 2;
    var isEraser = activeTool === 'eraser';
    return (_jsx(Circle, { x: position.x, y: position.y, radius: radius, stroke: isEraser ? 'rgba(255, 100, 100, 0.8)' : 'rgba(100, 150, 255, 0.8)', strokeWidth: 2, fill: "transparent", dash: [5, 5], listening: false, perfectDrawEnabled: false }));
};
