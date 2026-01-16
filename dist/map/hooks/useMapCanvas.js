/**
 * useMapCanvas Hook
 *
 * Main orchestration hook for map canvas state management.
 * Manages grid config, labels, view state, and dirty tracking.
 */
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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
import { useState, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { DEFAULT_GRID_CONFIG, } from '../types/map.types';
var DEFAULT_VIEW = {
    zoom: 1,
    panX: 0,
    panY: 0,
};
/**
 * Hook for managing map canvas state
 */
export function useMapCanvas(config) {
    if (config === void 0) { config = {}; }
    var _a = config.initialGridConfig, initialGridConfig = _a === void 0 ? DEFAULT_GRID_CONFIG : _a, _b = config.initialLabels, initialLabels = _b === void 0 ? [] : _b, _c = config.initialView, initialView = _c === void 0 ? DEFAULT_VIEW : _c;
    // State
    var _d = useState(initialGridConfig), gridConfig = _d[0], setGridConfigState = _d[1];
    var _e = useState(initialLabels), labels = _e[0], setLabelsState = _e[1];
    var _f = useState(initialView), view = _f[0], setViewState = _f[1];
    var _g = useState('view'), mode = _g[0], setModeState = _g[1];
    var _h = useState(false), isDirty = _h[0], setIsDirty = _h[1];
    var _j = useState(null), selectedLabelId = _j[0], setSelectedLabelId = _j[1];
    // Grid config actions
    var setGridConfig = useCallback(function (updates) {
        setGridConfigState(function (prev) { return (__assign(__assign({}, prev), updates)); });
        setIsDirty(true);
        console.log('🔲 [MapCanvas] Grid config updated:', updates);
    }, []);
    // Label actions
    var addLabel = useCallback(function (label) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
        var newLabel = {
            id: uuidv4(),
            text: label.text,
            x: label.x,
            y: label.y,
            rotation: (_a = label.rotation) !== null && _a !== void 0 ? _a : 0,
            fontFamily: (_b = label.fontFamily) !== null && _b !== void 0 ? _b : 'MedievalSharp',
            fontSize: (_c = label.fontSize) !== null && _c !== void 0 ? _c : 24,
            color: (_d = label.color) !== null && _d !== void 0 ? _d : '#000000',
            // Default stroke for visibility on any background
            strokeColor: (_e = label.strokeColor) !== null && _e !== void 0 ? _e : '#ffffff',
            strokeWidth: (_f = label.strokeWidth) !== null && _f !== void 0 ? _f : 1,
            shadowEnabled: (_g = label.shadowEnabled) !== null && _g !== void 0 ? _g : false,
            shadowColor: (_h = label.shadowColor) !== null && _h !== void 0 ? _h : '#000000',
            shadowBlur: (_j = label.shadowBlur) !== null && _j !== void 0 ? _j : 4,
            shadowOffsetX: (_k = label.shadowOffsetX) !== null && _k !== void 0 ? _k : 2,
            shadowOffsetY: (_l = label.shadowOffsetY) !== null && _l !== void 0 ? _l : 2,
        };
        setLabelsState(function (prev) { return __spreadArray(__spreadArray([], prev, true), [newLabel], false); });
        setSelectedLabelId(newLabel.id); // Auto-select newly placed label
        setIsDirty(true);
        console.log('🏷️ [MapCanvas] Label added:', newLabel.id);
    }, []);
    var updateLabel = useCallback(function (id, updates) {
        setLabelsState(function (prev) {
            return prev.map(function (label) { return (label.id === id ? __assign(__assign({}, label), updates) : label); });
        });
        setIsDirty(true);
        console.log('✏️ [MapCanvas] Label updated:', id);
    }, []);
    var removeLabel = useCallback(function (id) {
        setLabelsState(function (prev) { return prev.filter(function (label) { return label.id !== id; }); });
        setSelectedLabelId(function (prev) { return (prev === id ? null : prev); });
        setIsDirty(true);
        console.log('🗑️ [MapCanvas] Label removed:', id);
    }, []);
    var setLabels = useCallback(function (newLabels) {
        setLabelsState(newLabels);
        setIsDirty(true);
        console.log('📝 [MapCanvas] Labels set:', newLabels.length);
    }, []);
    var selectLabel = useCallback(function (id) {
        setSelectedLabelId(id);
        console.log('🎯 [MapCanvas] Label selected:', id);
    }, []);
    // View actions
    var setView = useCallback(function (updates) {
        setViewState(function (prev) { return (__assign(__assign({}, prev), updates)); });
    }, []);
    var resetView = useCallback(function () {
        setViewState(DEFAULT_VIEW);
        console.log('🔄 [MapCanvas] View reset');
    }, []);
    /**
     * Fit image to viewport, centering and scaling to fit without upscaling.
     * Never scales above 1.0 (100%) to avoid pixelation.
     */
    var fitToViewport = useCallback(function (imageWidth, imageHeight, viewportWidth, viewportHeight) {
        // Calculate scale to fit image in viewport (never upscale)
        var scaleX = viewportWidth / imageWidth;
        var scaleY = viewportHeight / imageHeight;
        var scale = Math.min(scaleX, scaleY, 1); // Never upscale above 100%
        // Center the image
        var scaledWidth = imageWidth * scale;
        var scaledHeight = imageHeight * scale;
        var panX = (viewportWidth - scaledWidth) / 2;
        var panY = (viewportHeight - scaledHeight) / 2;
        setViewState({
            zoom: scale,
            panX: panX,
            panY: panY,
        });
        console.log('📐 [MapCanvas] Fit to viewport:', {
            imageSize: "".concat(imageWidth, "x").concat(imageHeight),
            viewportSize: "".concat(viewportWidth, "x").concat(viewportHeight),
            scale: scale.toFixed(2),
            pan: "(".concat(panX.toFixed(0), ", ").concat(panY.toFixed(0), ")"),
        });
    }, []);
    // Mode actions
    var setMode = useCallback(function (newMode) {
        setModeState(newMode);
        console.log('🎨 [MapCanvas] Mode changed:', newMode);
    }, []);
    // State management
    var clearDirty = useCallback(function () {
        setIsDirty(false);
        console.log('✅ [MapCanvas] Dirty state cleared');
    }, []);
    return {
        // State
        gridConfig: gridConfig,
        labels: labels,
        view: view,
        mode: mode,
        isDirty: isDirty,
        selectedLabelId: selectedLabelId,
        // Grid actions
        setGridConfig: setGridConfig,
        // Label actions
        addLabel: addLabel,
        updateLabel: updateLabel,
        removeLabel: removeLabel,
        setLabels: setLabels,
        selectLabel: selectLabel,
        // View actions
        setView: setView,
        resetView: resetView,
        fitToViewport: fitToViewport,
        // Mode actions
        setMode: setMode,
        // State management
        clearDirty: clearDirty,
    };
}
