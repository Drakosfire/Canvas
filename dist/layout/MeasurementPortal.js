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
/**
 * MeasurementPortal - Canvas-owned measurement portal component
 *
 * Phase 5 Architecture: Canvas owns the entire measurement portal DOM structure.
 * Consumer just renders <MeasurementPortal /> - that's it.
 *
 * This component:
 * 1. Creates a portal to document.body
 * 2. Sets up the correct CSS context (font-size, classes) from frameConfig
 * 3. Renders MeasurementLayer with correct dimensions
 * 4. Handles all timing/gating internally
 */
import { useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { MeasurementLayer } from './measurement';
/**
 * Hook to create and manage the measurement portal DOM node.
 */
var useMeasurementPortalNode = function () {
    var portalRef = useRef(null);
    useEffect(function () {
        // Create portal container
        var portalNode = document.createElement('div');
        portalNode.className = 'dm-canvas-measurement-portal';
        portalNode.setAttribute('data-canvas-portal', 'measurement');
        document.body.appendChild(portalNode);
        portalRef.current = portalNode;
        return function () {
            // Cleanup on unmount
            if (portalRef.current && document.body.contains(portalRef.current)) {
                document.body.removeChild(portalRef.current);
            }
            portalRef.current = null;
        };
    }, []);
    return portalRef.current;
};
/**
 * Get CSS class names from frameConfig or use defaults.
 */
var getPortalClassNames = function (frameConfig) {
    var _a, _b, _c, _d, _e, _f;
    return {
        page: (_b = (_a = frameConfig === null || frameConfig === void 0 ? void 0 : frameConfig.portalClassNames) === null || _a === void 0 ? void 0 : _a.page) !== null && _b !== void 0 ? _b : 'page phb',
        frame: (_d = (_c = frameConfig === null || frameConfig === void 0 ? void 0 : frameConfig.portalClassNames) === null || _c === void 0 ? void 0 : _c.frame) !== null && _d !== void 0 ? _d : 'monster frame wide',
        column: (_f = (_e = frameConfig === null || frameConfig === void 0 ? void 0 : frameConfig.portalClassNames) === null || _e === void 0 ? void 0 : _e.column) !== null && _f !== void 0 ? _f : 'canvas-column',
    };
};
/**
 * MeasurementPortal - Renders measurement layer in a portal with correct CSS context.
 *
 * Usage:
 * ```tsx
 * <MeasurementPortal
 *     config={config}
 *     dimensions={layout.dimensions}
 *     entries={layout.measurementEntries}
 *     renderComponent={renderComponent}
 *     onMeasurements={layout.onMeasurements}
 *     onMeasurementComplete={layout.onMeasurementComplete}
 * />
 * ```
 */
export var MeasurementPortal = function (_a) {
    var config = _a.config, dimensions = _a.dimensions, entries = _a.entries, renderComponent = _a.renderComponent, onMeasurements = _a.onMeasurements, onMeasurementComplete = _a.onMeasurementComplete;
    var portalNode = useMeasurementPortalNode();
    var frameConfig = config.frameConfig;
    var classNames = getPortalClassNames(frameConfig);
    // Container styles - offscreen, invisible
    var containerStyle = useMemo(function () { return ({
        position: 'absolute',
        left: '-9999px',
        top: '0px',
        width: '0px',
        height: '0px',
        overflow: 'hidden',
        visibility: 'hidden',
        pointerEvents: 'none',
    }); }, []);
    // Page container styles
    var pageStyle = useMemo(function () { return ({
        width: "".concat(dimensions.pageWidthPx, "px"),
        // Apply font-size from frameConfig if provided
        fontSize: (frameConfig === null || frameConfig === void 0 ? void 0 : frameConfig.pageFontSizePx) ? "".concat(frameConfig.pageFontSizePx, "px") : undefined,
    }); }, [dimensions.pageWidthPx, frameConfig === null || frameConfig === void 0 ? void 0 : frameConfig.pageFontSizePx]);
    // Frame container styles
    var frameStyle = useMemo(function () { return ({
        // Apply font-size from frameConfig if provided
        fontSize: (frameConfig === null || frameConfig === void 0 ? void 0 : frameConfig.frameFontSizePx) ? "".concat(frameConfig.frameFontSizePx, "px") : undefined,
    }); }, [frameConfig === null || frameConfig === void 0 ? void 0 : frameConfig.frameFontSizePx]);
    // Column container styles
    var columnStyle = useMemo(function () {
        var _a, _b, _c;
        var columnPadding = (_a = frameConfig === null || frameConfig === void 0 ? void 0 : frameConfig.columnPaddingPx) !== null && _a !== void 0 ? _a : 0;
        var verticalPadding = (_b = frameConfig === null || frameConfig === void 0 ? void 0 : frameConfig.columnVerticalPaddingPx) !== null && _b !== void 0 ? _b : 0;
        var componentGap = (_c = frameConfig === null || frameConfig === void 0 ? void 0 : frameConfig.componentGapPx) !== null && _c !== void 0 ? _c : 12;
        return {
            width: "".concat(dimensions.columnWidthPx, "px"),
            padding: "".concat(verticalPadding / 2, "px ").concat(columnPadding / 2, "px"),
            gap: "".concat(componentGap, "px"),
            display: 'flex',
            flexDirection: 'column',
            boxSizing: 'border-box',
        };
    }, [
        dimensions.columnWidthPx,
        frameConfig === null || frameConfig === void 0 ? void 0 : frameConfig.columnPaddingPx,
        frameConfig === null || frameConfig === void 0 ? void 0 : frameConfig.columnVerticalPaddingPx,
        frameConfig === null || frameConfig === void 0 ? void 0 : frameConfig.componentGapPx,
    ]);
    // Don't render if not ready or no portal node
    if (!config.ready || !portalNode) {
        return null;
    }
    // Don't render if no entries
    if (entries.length === 0) {
        return null;
    }
    return createPortal(_jsx("div", __assign({ className: "dm-canvas-measurement-layer", style: containerStyle }, { children: _jsx("div", __assign({ className: classNames.page, style: pageStyle }, { children: _jsx("div", __assign({ className: classNames.frame, style: frameStyle }, { children: _jsx("div", __assign({ className: classNames.column, style: columnStyle }, { children: _jsx(MeasurementLayer, { entries: entries, renderComponent: renderComponent, onMeasurements: onMeasurements, onMeasurementComplete: onMeasurementComplete, measuredColumnWidth: dimensions.entryWidthPx, ready: config.ready }) })) })) })) })), portalNode);
};
export default MeasurementPortal;
