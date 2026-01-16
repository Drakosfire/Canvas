/**
 * useLabelManagement Hook (T062)
 *
 * Manages label CRUD operations for map labels.
 * Provides functions to add, update, remove, and select labels.
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
/**
 * Hook for managing map label CRUD operations.
 *
 * @param config - Configuration options
 * @returns Label management functions and state
 */
export function useLabelManagement(config) {
    if (config === void 0) { config = {}; }
    var _a = config.initialLabels, initialLabels = _a === void 0 ? [] : _a;
    var _b = useState(initialLabels), labels = _b[0], setLabelsState = _b[1];
    var _c = useState(null), selectedLabelId = _c[0], setSelectedLabelId = _c[1];
    // Add a new label with defaults
    var addLabel = useCallback(function (label) {
        var _a, _b, _c, _d;
        // Enforce maximum label limit (100)
        if (labels.length >= 100) {
            console.warn('⚠️ [LabelManagement] Maximum label limit (100) reached');
            return;
        }
        var newLabel = {
            id: uuidv4(),
            text: label.text,
            x: label.x,
            y: label.y,
            rotation: (_a = label.rotation) !== null && _a !== void 0 ? _a : 0,
            fontFamily: (_b = label.fontFamily) !== null && _b !== void 0 ? _b : 'MedievalSharp',
            fontSize: (_c = label.fontSize) !== null && _c !== void 0 ? _c : 24,
            color: (_d = label.color) !== null && _d !== void 0 ? _d : '#000000',
        };
        setLabelsState(function (prev) { return __spreadArray(__spreadArray([], prev, true), [newLabel], false); });
        setSelectedLabelId(newLabel.id);
        console.log('🏷️ [LabelManagement] Label added:', newLabel.id);
    }, [labels.length]);
    // Update an existing label
    var updateLabel = useCallback(function (id, updates) {
        setLabelsState(function (prev) {
            return prev.map(function (label) { return (label.id === id ? __assign(__assign({}, label), updates) : label); });
        });
        console.log('✏️ [LabelManagement] Label updated:', id);
    }, []);
    // Remove a label
    var removeLabel = useCallback(function (id) {
        setLabelsState(function (prev) { return prev.filter(function (label) { return label.id !== id; }); });
        setSelectedLabelId(function (prev) { return (prev === id ? null : prev); });
        console.log('🗑️ [LabelManagement] Label removed:', id);
    }, []);
    // Replace all labels
    var setLabels = useCallback(function (newLabels) {
        setLabelsState(newLabels);
        console.log('📝 [LabelManagement] Labels set:', newLabels.length);
    }, []);
    // Select a label
    var selectLabel = useCallback(function (id) {
        setSelectedLabelId(id);
        console.log('🎯 [LabelManagement] Label selected:', id);
    }, []);
    // Get a label by ID
    var getLabel = useCallback(function (id) {
        var _a;
        return (_a = labels.find(function (label) { return label.id === id; })) !== null && _a !== void 0 ? _a : null;
    }, [labels]);
    return {
        labels: labels,
        selectedLabelId: selectedLabelId,
        addLabel: addLabel,
        updateLabel: updateLabel,
        removeLabel: removeLabel,
        setLabels: setLabels,
        selectLabel: selectLabel,
        getLabel: getLabel,
    };
}
