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
import { createContext, useCallback, useContext, useEffect, useMemo, useReducer } from 'react';
import { createDefaultAdapters } from '../types/adapters.types';
import { paginate } from './paginate';
import { SegmentRerouteCache } from './segmentTypes';
import { buildCanvasEntries, computeBasePageDimensions, computeHomeRegions, createInitialMeasurementEntries, regionKey, } from './utils';
import { isDebugEnabled } from './debugFlags';
import { logRegionHeightEvent } from './regionHeightDebug';
import { exposeStateDebugger } from './stateDebug';
import { exposePaginationDiagnostics } from './paginationDiagnostics';
import { selectRequiredMeasurementKeys } from './selectors';
var shouldLogPlanCommit = function () { return isDebugEnabled('plan-commit'); };
// Track processed measurement versions to prevent duplicate MEASUREMENT_COMPLETE dispatches
// (React StrictMode causes double dispatches before state updates)
var processedMeasurementVersions = new Set();
// Diagnostic: Log when state.tsx loads (confirms module is loading)
if (typeof window !== 'undefined') {
    // eslint-disable-next-line no-console
    console.log('🔧 [Canvas state.tsx] Module loaded, paginate imported', {
        timestamp: new Date().toISOString(),
        hasPaginate: typeof paginate === 'function',
    });
}
var shouldLogLayoutDirty = function () { return isDebugEnabled('layout-dirty'); };
var shouldLogMeasureFirst = function () { return isDebugEnabled('measure-first'); };
var shouldLogMeasurementDebug = function () { return isDebugEnabled('measurement'); };
var logLayoutDirty = function (reason, context) {
    if (context === void 0) { context = {}; }
    if (!shouldLogLayoutDirty()) {
        return;
    }
    // eslint-disable-next-line no-console
    console.debug('[layout-dirty]', reason, context);
};
// Always log when isLayoutDirty is set to true (for debugging pagination triggers)
var logIsLayoutDirtySet = function (reason, context) {
    if (context === void 0) { context = {}; }
    if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.log('[isLayoutDirty] Set to true:', reason, context);
    }
};
var round = function (value) { return Number(value.toFixed(2)); };
var summarizeEntryForDebug = function (entry) { return ({
    instanceId: entry.instance.id,
    componentType: entry.instance.type,
    slotIndex: entry.slotIndex,
    orderIndex: entry.orderIndex,
    sourceRegionKey: entry.sourceRegionKey,
    region: entry.region,
    homeRegion: entry.homeRegion,
    measurementKey: entry.measurementKey,
    estimatedHeight: round(entry.estimatedHeight),
    span: entry.span
        ? {
            top: round(entry.span.top),
            bottom: round(entry.span.bottom),
            height: round(entry.span.height),
        }
        : undefined,
    overflow: Boolean(entry.overflow),
    overflowRouted: Boolean(entry.overflowRouted),
    listContinuation: entry.listContinuation
        ? {
            isContinuation: entry.listContinuation.isContinuation,
            startIndex: entry.listContinuation.startIndex,
            totalCount: entry.listContinuation.totalCount,
        }
        : undefined,
}); };
var summarizePlanForDebug = function (plan) {
    if (!plan) {
        return null;
    }
    return {
        pageCount: plan.pages.length,
        overflowWarningCount: plan.overflowWarnings.length,
        overflowWarnings: plan.overflowWarnings,
        pages: plan.pages.map(function (page) { return ({
            pageNumber: page.pageNumber,
            columns: page.columns.map(function (column) { return ({
                columnNumber: column.columnNumber,
                entryCount: column.entries.length,
                usedHeightPx: column.usedHeightPx,
                availableHeightPx: column.availableHeightPx,
                entries: column.entries.map(summarizeEntryForDebug),
            }); }),
        }); }),
    };
};
var CanvasLayoutStateContext = createContext(undefined);
var CanvasLayoutDispatchContext = createContext(undefined);
var initialPlan = { pages: [], overflowWarnings: [] };
// Column measurement stability threshold (used by column cache)
var MEASUREMENT_STABILITY_THRESHOLD_MS = 300; // Default: 300ms
var parseBooleanFlag = function (value) {
    if (typeof value !== 'string') {
        return undefined;
    }
    var normalized = value.trim().toLowerCase();
    if (['1', 'true', 'yes', 'on', 'enable', 'enabled'].includes(normalized)) {
        return true;
    }
    if (['0', 'false', 'no', 'off', 'disable', 'disabled'].includes(normalized)) {
        return false;
    }
    return undefined;
};
var readReactAppColumnCacheFlag = function () {
    try {
        // React Scripts (and other bundlers) replace REACT_APP_* variables at build time.
        // Accessing process.env directly ensures the substitution happens even when "process"
        // is undefined at runtime in the browser.
        return process.env.REACT_APP_CANVAS_COLUMN_CACHE;
    }
    catch (_a) {
        return undefined;
    }
};
var resolveColumnCacheFlag = function () {
    var reactAppValue = readReactAppColumnCacheFlag();
    var parsedReact = parseBooleanFlag(reactAppValue);
    if (parsedReact !== undefined) {
        return parsedReact;
    }
    if (typeof process !== 'undefined' && typeof process.env !== 'undefined') {
        var nodeValue = process.env.CANVAS_COLUMN_CACHE;
        var parsedNode = parseBooleanFlag(nodeValue);
        if (parsedNode !== undefined) {
            return parsedNode;
        }
    }
    return true; // Default: enabled
};
var COLUMN_CACHE_ENABLED = resolveColumnCacheFlag();
var columnCacheFlagLogged = false;
var logColumnCacheDisabledOnce = function () {
    if (COLUMN_CACHE_ENABLED || columnCacheFlagLogged || process.env.NODE_ENV === 'production') {
        return;
    }
    columnCacheFlagLogged = true;
    // eslint-disable-next-line no-console
    console.log('[ColumnCache] Disabled via REACT_APP_CANVAS_COLUMN_CACHE flag (telemetry mode)');
};
export var createInitialState = function () {
    processedMeasurementVersions.clear();
    return {
        components: [],
        template: null,
        dataSources: [],
        componentRegistry: {},
        pageVariables: null,
        columnCount: 1,
        regionHeightPx: 0,
        pageWidthPx: 0,
        pageHeightPx: 0,
        baseDimensions: null,
        measurements: new Map(),
        measurementVersion: 0,
        lastMeasurementCompleteVersion: 0,
        layoutPlan: initialPlan,
        pendingLayout: null,
        measurementEntries: [],
        buckets: new Map(),
        isLayoutDirty: false,
        allComponentsMeasured: false,
        waitingForInitialMeasurements: false,
        requiredMeasurementKeys: new Set(),
        missingMeasurementKeys: new Set(),
        assignedRegions: new Map(),
        homeRegions: new Map(),
        adapters: createDefaultAdapters(),
        segmentRerouteCache: new SegmentRerouteCache(),
        columnMeasurementCache: new Map(),
        measurementStatus: 'idle',
    };
};
var upsertRegionAssignment = function (assignedRegions, entry, instanceId) {
    assignedRegions.set(instanceId, entry);
};
/**
 * Check if we have measurements for all components.
 * For block components: just need the component-id:block measurement.
 * For list components: need at least the full list measurement.
 */
var checkAllComponentsMeasured = function (components, measurements) {
    var measuredComponents = new Set();
    measurements.forEach(function (_, key) {
        var match = key.match(/^(component-\d+)/);
        if (match) {
            measuredComponents.add(match[1]);
        }
    });
    for (var _i = 0, components_1 = components; _i < components_1.length; _i++) {
        var component = components_1[_i];
        if (!measuredComponents.has(component.id)) {
            return false;
        }
    }
    return true;
};
var computeRequiredMeasurementKeys = function (entries) {
    var next = new Set();
    entries.forEach(function (entry) {
        next.add(entry.measurementKey);
    });
    return next;
};
var computeMissingMeasurementKeys = function (requiredKeys, measurements) {
    var missing = new Set();
    requiredKeys.forEach(function (key) {
        if (!measurements.has(key)) {
            missing.add(key);
        }
    });
    return missing;
};
/**
 * Extract component ID from measurement key
 * Format: "component-X:block" or "component-X:spell-list:..."
 */
var extractComponentId = function (key) {
    var match = key.match(/^(component-\d+):/);
    return match ? match[1] : null;
};
/**
 * Update column measurement cache with new measurements
 */
var updateColumnCache = function (currentCache, newMeasurements, homeRegions, requiredKeys, regionKeyFn, currentMeasurements) {
    var updatedCache = new Map(currentCache);
    var now = Date.now();
    // Group required keys by column based on home regions
    var keysByColumn = new Map();
    requiredKeys.forEach(function (key) {
        var componentId = extractComponentId(key);
        if (!componentId)
            return;
        var homeRegion = homeRegions.get(componentId);
        if (!homeRegion)
            return;
        var columnKey = regionKeyFn(homeRegion.homeRegion.page, homeRegion.homeRegion.column);
        if (!keysByColumn.has(columnKey)) {
            keysByColumn.set(columnKey, new Set());
        }
        keysByColumn.get(columnKey).add(key);
    });
    // Create a set of measured keys from new measurements
    var newMeasuredKeysSet = new Set();
    newMeasurements.forEach(function (m) {
        if (m.height > 0) {
            newMeasuredKeysSet.add(m.key);
        }
    });
    // Update cache for each column
    keysByColumn.forEach(function (requiredKeysForColumn, columnKey) {
        var existing = updatedCache.get(columnKey);
        var measuredKeys = new Set();
        // Check which required keys we now have measurements for
        // Include both new measurements and existing measurements from state
        requiredKeysForColumn.forEach(function (key) {
            if (newMeasuredKeysSet.has(key)) {
                measuredKeys.add(key);
            }
            else if (currentMeasurements && currentMeasurements.has(key)) {
                // Also include existing measurements from state
                measuredKeys.add(key);
            }
            else if (existing && existing.measuredKeys.has(key)) {
                // Preserve existing measured keys if they're still valid
                measuredKeys.add(key);
            }
        });
        // Check if measurements are stable (haven't changed recently)
        var keysChanged = existing ? (existing.measuredKeys.size !== measuredKeys.size ||
            Array.from(existing.measuredKeys).some(function (key) { return !measuredKeys.has(key); }) ||
            Array.from(measuredKeys).some(function (key) { return !existing.measuredKeys.has(key); })) : true;
        var isStable = !keysChanged && existing
            ? (now - existing.lastUpdateTime) >= MEASUREMENT_STABILITY_THRESHOLD_MS
            : false;
        var columnState = {
            columnKey: columnKey,
            requiredKeys: requiredKeysForColumn,
            measuredKeys: measuredKeys,
            lastUpdateTime: now,
            isStable: isStable,
        };
        updatedCache.set(columnKey, columnState);
    });
    return updatedCache;
};
/**
 * Get columns that meet threshold for pagination
 * Returns set of column keys that are ready
 */
var getReadyColumns = function (cache, stabilityThreshold, currentMeasurements) {
    var readyColumns = new Set();
    var now = Date.now();
    // If cache is empty, return empty set (no columns ready yet)
    if (cache.size === 0) {
        return readyColumns;
    }
    cache.forEach(function (columnState, columnKey) {
        // Update measuredKeys from current measurements
        var measuredKeys = new Set();
        columnState.requiredKeys.forEach(function (key) {
            if (currentMeasurements.has(key)) {
                measuredKeys.add(key);
            }
        });
        // Option A: All measurements present
        var allPresent = columnState.requiredKeys.size > 0 &&
            measuredKeys.size === columnState.requiredKeys.size;
        // Option B: Stability threshold met (measurements haven't changed for threshold ms)
        var timeSinceUpdate = now - columnState.lastUpdateTime;
        var isStable = measuredKeys.size > 0 &&
            timeSinceUpdate >= stabilityThreshold;
        // Option C: Hybrid (recommended) - all present OR stable
        if (allPresent || isStable) {
            readyColumns.add(columnKey);
        }
    });
    return readyColumns;
};
export var layoutReducer = function (state, action) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1, _2, _3, _4, _5, _6, _7, _8;
    var recomputeEntries = function (base) {
        var _a, _b;
        if (!base.template) {
            return __assign(__assign({}, base), { buckets: new Map(), measurementEntries: [], waitingForInitialMeasurements: false, allComponentsMeasured: false, requiredMeasurementKeys: new Set(), missingMeasurementKeys: new Set() });
        }
        var hasRenderableComponents = base.components.length > 0;
        var hasRenderableDataSources = base.dataSources.length > 0;
        if (shouldLogMeasurementDebug()) {
            console.log('[measurement-debug] recomputeEntries', {
                componentCount: base.components.length,
                dataSourceCount: base.dataSources.length,
                measurementEntryCount: base.measurementEntries.length,
                measurementStoreSize: base.measurements.size,
                waitingForInitialMeasurements: base.waitingForInitialMeasurements,
                measurementStatus: (_a = base.measurementStatus) !== null && _a !== void 0 ? _a : 'unknown',
                hasRenderableComponents: hasRenderableComponents,
                hasRenderableDataSources: hasRenderableDataSources,
            });
        }
        // REFRESH FIX: Detect and flush stale measurement state on refresh
        // CRITICAL: Only flush when measurements exist WITHOUT components (true stale state)
        // Do NOT flush when cache exists but plan is empty - that's normal during measure-first flow
        var hasStaleMeasurements = base.measurements.size > 0 && !hasRenderableComponents;
        if (hasStaleMeasurements) {
            if (process.env.NODE_ENV !== 'production') {
                // eslint-disable-next-line no-console
                console.log('🔄 [CanvasLayout] Flushing stale measurement state detected on refresh', {
                    measurementCount: base.measurements.size,
                    componentCount: base.components.length,
                    dataSourceCount: base.dataSources.length,
                });
            }
            return __assign(__assign({}, base), { measurements: new Map(), measurementVersion: 0, lastMeasurementCompleteVersion: 0, columnMeasurementCache: new Map(), measurementStatus: 'idle', waitingForInitialMeasurements: false, allComponentsMeasured: false, requiredMeasurementKeys: new Set(), missingMeasurementKeys: new Set(), buckets: new Map(), measurementEntries: [] });
        }
        if (!hasRenderableComponents || !hasRenderableDataSources) {
            if (process.env.NODE_ENV !== 'production') {
                // eslint-disable-next-line no-console
                console.log('⏸️ [CanvasLayout] Holding recompute until renderable data is ready', {
                    componentCount: base.components.length,
                    dataSourceCount: base.dataSources.length,
                });
            }
            return __assign(__assign({}, base), { buckets: new Map(), measurementEntries: [], waitingForInitialMeasurements: false, allComponentsMeasured: false, requiredMeasurementKeys: new Set(), missingMeasurementKeys: new Set(), measurements: new Map(), measurementVersion: 0, lastMeasurementCompleteVersion: 0, columnMeasurementCache: new Map(), measurementStatus: 'idle', layoutPlan: initialPlan, pendingLayout: null, isLayoutDirty: false });
        }
        // If we have no measurements yet AND we have components, start measure-first flow
        var hasNoMeasurements = base.measurements.size === 0;
        var hasComponents = base.components.length > 0;
        var shouldWaitForMeasurements = hasNoMeasurements && hasComponents;
        if (shouldLogMeasureFirst()) {
            console.log('[measure-first] Check:', {
                hasNoMeasurements: hasNoMeasurements,
                measurementCount: base.measurements.size,
                hasComponents: hasComponents,
                componentCount: base.components.length,
                shouldWaitForMeasurements: shouldWaitForMeasurements,
            });
        }
        if (shouldWaitForMeasurements) {
            // Create measurement entries from RAW components (no buckets yet)
            var measurementEntries_1 = createInitialMeasurementEntries({
                instances: base.components,
                template: base.template,
                columnCount: base.columnCount,
                pageWidthPx: base.pageWidthPx,
                dataSources: base.dataSources,
                adapters: base.adapters,
            });
            if (shouldLogMeasureFirst()) {
                console.log('[measure-first] Generated measurement entries:', {
                    totalEntries: measurementEntries_1.length,
                    componentCount: base.components.length,
                    entryKeys: measurementEntries_1.map(function (e) { return e.measurementKey; }),
                });
            }
            var requiredKeys_1 = computeRequiredMeasurementKeys(measurementEntries_1);
            var missingKeys_1 = computeMissingMeasurementKeys(requiredKeys_1, base.measurements);
            if (shouldLogMeasureFirst()) {
                console.log('[measure-first] Measurement readiness:', {
                    requiredCount: requiredKeys_1.size,
                    missingCount: missingKeys_1.size,
                    sampleMissing: Array.from(missingKeys_1).slice(0, 5),
                });
            }
            // Initialize column cache for measure-first flow
            var columnCache_1 = COLUMN_CACHE_ENABLED
                ? updateColumnCache(base.columnMeasurementCache, [], // No new measurements yet
                base.homeRegions, requiredKeys_1, regionKey, base.measurements // Pass current measurements
                )
                : new Map();
            return __assign(__assign({}, base), { buckets: new Map(), // Empty - don't build yet!
                measurementEntries: measurementEntries_1, waitingForInitialMeasurements: true, allComponentsMeasured: false, requiredMeasurementKeys: requiredKeys_1, missingMeasurementKeys: missingKeys_1, columnMeasurementCache: columnCache_1, isLayoutDirty: false, measurementStatus: 'measuring' });
        }
        // We have measurements - proceed with normal bucket building
        var _c = buildCanvasEntries({
            instances: base.components,
            template: base.template,
            columnCount: base.columnCount,
            pageWidthPx: base.pageWidthPx,
            dataSources: base.dataSources,
            measurements: base.measurements,
            assignedRegions: base.assignedRegions,
            adapters: base.adapters,
        }), buckets = _c.buckets, measurementEntries = _c.measurementEntries;
        var requiredKeys = computeRequiredMeasurementKeys(measurementEntries);
        var missingKeys = computeMissingMeasurementKeys(requiredKeys, base.measurements);
        var allMeasured = checkAllComponentsMeasured(base.components, base.measurements);
        if (shouldLogMeasureFirst() && missingKeys.size > 0) {
            console.log('[measure-first] Waiting for remaining measurements:', {
                missingCount: missingKeys.size,
                sampleMissing: Array.from(missingKeys).slice(0, 5),
            });
        }
        // Update column cache when entries are recomputed
        var columnCache = COLUMN_CACHE_ENABLED
            ? updateColumnCache(base.columnMeasurementCache, [], // Use current measurements from state
            base.homeRegions, requiredKeys, regionKey, base.measurements // Pass current measurements
            )
            : new Map();
        return __assign(__assign({}, base), { buckets: buckets, measurementEntries: measurementEntries, waitingForInitialMeasurements: false, allComponentsMeasured: allMeasured, requiredMeasurementKeys: requiredKeys, missingMeasurementKeys: missingKeys, columnMeasurementCache: columnCache, measurementStatus: (missingKeys.size === 0 && allMeasured)
                ? 'complete'
                : ((_b = base.measurementStatus) !== null && _b !== void 0 ? _b : 'idle') });
    };
    switch (action.type) {
        case 'INITIALIZE':
            logLayoutDirty('INITIALIZE');
            logIsLayoutDirtySet('INITIALIZE', {});
            return recomputeEntries(__assign(__assign({}, state), { template: action.payload.template, pageVariables: action.payload.pageVariables, columnCount: action.payload.columnCount, regionHeightPx: action.payload.regionHeightPx, pageWidthPx: action.payload.pageWidthPx, pageHeightPx: action.payload.pageHeightPx, baseDimensions: action.payload.baseDimensions, adapters: action.payload.adapters, layoutPlan: initialPlan, pendingLayout: null, isLayoutDirty: true, assignedRegions: new Map(), homeRegions: new Map() }));
        case 'SET_COMPONENTS': {
            logLayoutDirty('SET_COMPONENTS', { count: action.payload.instances.length });
            logIsLayoutDirtySet('SET_COMPONENTS', { count: action.payload.instances.length });
            var homeRegions = state.template
                ? computeHomeRegions({
                    instances: action.payload.instances,
                    template: state.template,
                    columnCount: state.columnCount,
                    pageWidthPx: state.pageWidthPx,
                })
                : new Map();
            // ISSUE #001 FIX: Clear measurements when components change
            // Measurement keys don't include content hash, so different data
            // with same structure would reuse stale measurements causing overflow.
            if (process.env.NODE_ENV !== 'production') {
                // eslint-disable-next-line no-console
                console.log('🔄 [SET_COMPONENTS] Clearing measurement cache for new data', {
                    previousMeasurements: state.measurements.size,
                    newComponentCount: action.payload.instances.length,
                });
            }
            return recomputeEntries(__assign(__assign({}, state), { components: action.payload.instances, homeRegions: homeRegions, isLayoutDirty: true, 
                // Clear all measurement state to force re-measurement
                measurements: new Map(), measurementVersion: 0, lastMeasurementCompleteVersion: 0, columnMeasurementCache: new Map(), measurementStatus: 'idle' }));
        }
        case 'SET_TEMPLATE': {
            logLayoutDirty('SET_TEMPLATE');
            logIsLayoutDirtySet('SET_TEMPLATE', {});
            var homeRegions = state.components.length > 0
                ? computeHomeRegions({
                    instances: state.components,
                    template: action.payload.template,
                    columnCount: state.columnCount,
                    pageWidthPx: state.pageWidthPx,
                })
                : new Map();
            return recomputeEntries(__assign(__assign({}, state), { template: action.payload.template, homeRegions: homeRegions, isLayoutDirty: true }));
        }
        case 'SET_DATA_SOURCES': {
            logLayoutDirty('SET_DATA_SOURCES', { count: action.payload.dataSources.length });
            logIsLayoutDirtySet('SET_DATA_SOURCES', { count: action.payload.dataSources.length });
            // ISSUE #001 FIX: Clear measurements when data sources change
            // Data changes affect rendered heights but may not change measurement keys
            if (process.env.NODE_ENV !== 'production') {
                // eslint-disable-next-line no-console
                console.log('🔄 [SET_DATA_SOURCES] Clearing measurement cache for new data', {
                    previousMeasurements: state.measurements.size,
                    newDataSourceCount: action.payload.dataSources.length,
                });
            }
            return recomputeEntries(__assign(__assign({}, state), { dataSources: action.payload.dataSources, isLayoutDirty: true, 
                // Clear all measurement state to force re-measurement
                measurements: new Map(), measurementVersion: 0, lastMeasurementCompleteVersion: 0, columnMeasurementCache: new Map(), measurementStatus: 'idle' }));
        }
        case 'SET_REGISTRY':
            return __assign(__assign({}, state), { componentRegistry: action.payload.registry });
        case 'SET_PAGE_VARIABLES':
            logLayoutDirty('SET_PAGE_VARIABLES', { measurementVersion: state.measurementVersion });
            logIsLayoutDirtySet('SET_PAGE_VARIABLES', { measurementVersion: state.measurementVersion });
            // Preserve consumer-provided regionHeightPx (from initialRegionHeightPx in INITIALIZE)
            // Only use baseDimensions.contentHeightPx as fallback if state has no valid regionHeight
            var incomingBase = action.payload.baseDimensions;
            var incomingHeight = action.payload.regionHeightPx > 0
                ? action.payload.regionHeightPx
                : state.regionHeightPx > 0
                    ? state.regionHeightPx // Preserve existing consumer-provided value
                    : (incomingBase ? incomingBase.contentHeightPx : 0);
            return recomputeEntries(__assign(__assign({}, state), { pageVariables: action.payload.pageVariables, columnCount: action.payload.columnCount, regionHeightPx: incomingHeight, pageWidthPx: action.payload.pageWidthPx, pageHeightPx: action.payload.pageHeightPx, baseDimensions: action.payload.baseDimensions, isLayoutDirty: true }));
        case 'SET_REGION_HEIGHT': {
            // Phase 3 simplification: With measurement perfection (Phase 1), we don't need
            // timing-based stability checks. Region height is calculated correctly from the start.
            var incomingHeight_1 = action.payload.regionHeightPx;
            if (incomingHeight_1 <= 0 || Number.isNaN(incomingHeight_1)) {
                logRegionHeightEvent('set-region-height-invalid', {
                    previousHeight: state.regionHeightPx,
                    incomingHeight: incomingHeight_1,
                });
                return state;
            }
            var nextHeight = state.regionHeightPx <= 0 ? incomingHeight_1 : Math.min(state.regionHeightPx, incomingHeight_1);
            var heightDiff = Math.abs(state.regionHeightPx - nextHeight);
            // Skip if change is sub-pixel (< 1px)
            if (heightDiff < 1) {
                logRegionHeightEvent('set-region-height-skipped', {
                    previousHeight: state.regionHeightPx,
                    incomingHeight: incomingHeight_1,
                    heightDiff: heightDiff,
                });
                return state;
            }
            // Trigger pagination immediately when height changes significantly
            // (No longer waiting for timing-based stability)
            var shouldTriggerPagination = heightDiff >= 1;
            logLayoutDirty('SET_REGION_HEIGHT', {
                oldHeight: state.regionHeightPx,
                newHeight: nextHeight,
                incomingHeight: incomingHeight_1,
                diff: heightDiff,
                shouldTriggerPagination: shouldTriggerPagination,
            });
            if (process.env.NODE_ENV !== 'production') {
                // eslint-disable-next-line no-console
                console.log('[CanvasLayout] Region height updated', {
                    previousHeight: state.regionHeightPx,
                    incomingHeight: incomingHeight_1,
                    nextHeight: nextHeight,
                    diff: Number(heightDiff.toFixed(2)),
                });
            }
            // Don't trigger pagination if there's already a pending layout
            var canTriggerPagination = shouldTriggerPagination && !state.pendingLayout;
            logRegionHeightEvent('set-region-height-applied', {
                previousHeight: state.regionHeightPx,
                nextHeight: nextHeight,
                incomingHeight: incomingHeight_1,
                heightDiff: heightDiff,
                shouldTriggerPagination: shouldTriggerPagination,
                canTriggerPagination: canTriggerPagination,
                pendingLayoutExists: Boolean(state.pendingLayout),
            });
            if (shouldTriggerPagination) {
                logIsLayoutDirtySet('SET_REGION_HEIGHT', {
                    previousHeight: state.regionHeightPx,
                    nextHeight: nextHeight,
                    pendingLayoutExists: Boolean(state.pendingLayout),
                    willTrigger: canTriggerPagination,
                });
            }
            return __assign(__assign({}, state), { regionHeightPx: nextHeight, isLayoutDirty: canTriggerPagination });
        }
        case 'MEASUREMENTS_UPDATED': {
            // In publish-once mode for this spike branch, we ignore mid-stream pagination triggers.
            var measurements_1 = new Map(state.measurements);
            var didChange_1 = false;
            var hasAdditions_1 = false;
            var EPSILON_1 = 0.25; // Ignore sub-pixel fluctuations
            action.payload.measurements.forEach(function (_a) {
                var key = _a.key, height = _a.height, measuredAt = _a.measuredAt;
                var previous = state.measurements.get(key);
                // Negative height is treated as explicit deletion (zero is valid metadata height)
                if (height < 0) {
                    if (measurements_1.has(key)) {
                        measurements_1.delete(key);
                        didChange_1 = true;
                    }
                    return;
                }
                if (!previous || Math.abs(previous.height - height) > EPSILON_1) {
                    measurements_1.set(key, { key: key, height: height, measuredAt: measuredAt });
                    didChange_1 = true;
                    hasAdditions_1 = true;
                }
            });
            if (!didChange_1) {
                return state;
            }
            var nextVersion = state.measurementVersion + 1;
            // Phase 3.3b: Use selector instead of stored state field
            var requiredKeys = selectRequiredMeasurementKeys(state);
            var missingKeys = computeMissingMeasurementKeys(requiredKeys, measurements_1);
            // Check if we now have ALL component block measurements
            var allMeasured = checkAllComponentsMeasured(state.components, measurements_1);
            var wasWaitingForMeasurements = state.waitingForInitialMeasurements;
            var nowComplete_1 = wasWaitingForMeasurements && allMeasured;
            logLayoutDirty('MEASUREMENTS_UPDATED', {
                measurementVersion: nextVersion,
                allComponentsMeasured: allMeasured,
                missingMeasurementCount: missingKeys.size,
            });
            // Update column measurement cache
            var columnCacheEnabled = COLUMN_CACHE_ENABLED;
            var updatedCache = columnCacheEnabled
                ? updateColumnCache(state.columnMeasurementCache, action.payload.measurements, state.homeRegions, requiredKeys, regionKey, measurements_1 // Pass current measurements map
                )
                : new Map();
            // Check if any columns meet threshold for pagination
            var readyColumns_1 = columnCacheEnabled
                ? getReadyColumns(updatedCache, MEASUREMENT_STABILITY_THRESHOLD_MS, measurements_1)
                : new Set();
            // Always log column cache state for visibility (even without debug flag)
            if (process.env.NODE_ENV !== 'production') {
                if (!columnCacheEnabled) {
                    logColumnCacheDisabledOnce();
                }
                else if (updatedCache.size > 0) {
                    var cacheSummary = Array.from(updatedCache.entries()).map(function (_a) {
                        var key = _a[0], cacheState = _a[1];
                        return ({
                            columnKey: key,
                            requiredCount: cacheState.requiredKeys.size,
                            measuredCount: cacheState.measuredKeys.size,
                            ready: readyColumns_1.has(key),
                        });
                    });
                    // eslint-disable-next-line no-console
                    console.log('[ColumnCache] State updated:', {
                        readyColumns: Array.from(readyColumns_1),
                        cacheSummary: cacheSummary,
                    });
                }
                else {
                    // eslint-disable-next-line no-console
                    console.log('[ColumnCache] Cache empty:', {
                        requiredKeysCount: requiredKeys.size,
                        homeRegionsCount: state.homeRegions.size,
                        measurementsCount: measurements_1.size,
                        reason: requiredKeys.size === 0 ? 'no-required-keys'
                            : state.homeRegions.size === 0 ? 'no-home-regions'
                                : 'unknown',
                    });
                }
            }
            // Update state with new measurements first
            // CRITICAL: If MEASUREMENT_COMPLETE already fired (measurementStatus === 'complete'),
            // don't overwrite waitingForInitialMeasurements or measurementStatus - pagination is in progress
            var measurementCompleteAlreadyFired = state.measurementStatus === 'complete';
            if (process.env.NODE_ENV !== 'production' && measurementCompleteAlreadyFired) {
                // eslint-disable-next-line no-console
                console.log('🛡️ [MEASUREMENTS_UPDATED] Preserving complete state (pagination in progress)', {
                    previousStatus: state.measurementStatus,
                    previousWaitingForInitialMeasurements: state.waitingForInitialMeasurements,
                    previousIsLayoutDirty: state.isLayoutDirty,
                    allMeasured: allMeasured,
                    missingKeysCount: missingKeys.size,
                });
            }
            var updatedState_1 = __assign(__assign({}, state), { measurements: measurements_1, measurementVersion: nextVersion, allComponentsMeasured: measurementCompleteAlreadyFired ? state.allComponentsMeasured : allMeasured, 
                // Once MEASUREMENT_COMPLETE fires, keep waiting=false
                waitingForInitialMeasurements: measurementCompleteAlreadyFired
                    ? false
                    : (wasWaitingForMeasurements && !allMeasured), missingMeasurementKeys: measurementCompleteAlreadyFired ? state.missingMeasurementKeys : missingKeys, columnMeasurementCache: updatedCache, measurementStatus: measurementCompleteAlreadyFired
                    ? 'complete'
                    : ((missingKeys.size === 0 && allMeasured)
                        ? 'complete'
                        : 'measuring') });
            // Rebuild entries only when we are fully complete
            var isTransitioningFromWaiting_1 = wasWaitingForMeasurements && !updatedState_1.waitingForInitialMeasurements;
            var shouldRebuild = (missingKeys.size === 0 && allMeasured) || isTransitioningFromWaiting_1;
            if (shouldRebuild) {
                var recomputed = recomputeEntries(__assign(__assign({}, updatedState_1), { assignedRegions: state.assignedRegions }));
                // CRITICAL: Preserve existing measurementEntries to prevent remounting MeasurementLayer
                // recomputeEntries rebuilds measurementEntries, but they don't change after initial measurement
                // Remounting causes infinite measurement loop: measure -> detach -> remount -> measure...
                // Check if this rebuild is happening because measurements just completed
                var isCompletingMeasurements = (missingKeys.size === 0 && allMeasured) && state.measurementStatus !== 'complete';
                var preservedMeasurementEntries = isCompletingMeasurements
                    ? state.measurementEntries // Preserve during completion
                    : recomputed.measurementEntries; // Use new entries for other rebuilds
                // Disable column cache triggers during measuring; only allow when complete
                var readyColumnsAfterRebuild_1 = (updatedState_1.measurementStatus === 'complete' && columnCacheEnabled)
                    ? getReadyColumns(recomputed.columnMeasurementCache, MEASUREMENT_STABILITY_THRESHOLD_MS, measurements_1)
                    : new Set();
                // CRITICAL: Column cache optimization reduces pagination runs
                // Trigger pagination only when complete or cache-ready post-complete
                var shouldTriggerPagination = updatedState_1.measurementStatus === 'complete' &&
                    (readyColumnsAfterRebuild_1.size > 0 || nowComplete_1 || isTransitioningFromWaiting_1);
                // Ensure we have a valid regionHeight before attempting to paginate
                var nextRegionHeightPx = recomputed.regionHeightPx;
                if (shouldTriggerPagination && nextRegionHeightPx <= 0 && recomputed.baseDimensions) {
                    nextRegionHeightPx = recomputed.baseDimensions.contentHeightPx;
                    shouldTriggerPagination = nextRegionHeightPx > 0;
                }
                var triggerReason = (function () {
                    if (updatedState_1.measurementStatus !== 'complete')
                        return 'measuring';
                    if (nowComplete_1)
                        return 'initial-measurements-complete';
                    if (isTransitioningFromWaiting_1)
                        return 'initial-render';
                    if (readyColumnsAfterRebuild_1.size > 0)
                        return 'columns-ready';
                    return 'waiting-for-columns';
                })();
                // Always log pagination trigger decision when cache is active (even without debug flag)
                if (columnCacheEnabled && process.env.NODE_ENV !== 'production') {
                    // eslint-disable-next-line no-console
                    console.log('[ColumnCache] Pagination trigger decision:', {
                        shouldTrigger: shouldTriggerPagination,
                        readyColumns: Array.from(readyColumnsAfterRebuild_1),
                        nowComplete: nowComplete_1,
                        isInitialRender: isTransitioningFromWaiting_1,
                        wasWaitingForMeasurements: wasWaitingForMeasurements,
                        cacheSize: recomputed.columnMeasurementCache.size,
                        columnCacheEnabled: columnCacheEnabled,
                        reason: shouldTriggerPagination ? triggerReason : 'waiting-for-columns',
                    });
                }
                else if (!columnCacheEnabled) {
                    logColumnCacheDisabledOnce();
                }
                if (columnCacheEnabled && shouldLogLayoutDirty() && readyColumnsAfterRebuild_1.size > 0) {
                    console.log('[layout-dirty] Column cache ready columns:', {
                        readyColumns: Array.from(readyColumnsAfterRebuild_1),
                        totalColumns: recomputed.columnMeasurementCache.size,
                    });
                }
                // Debug logging for column cache state
                if (columnCacheEnabled && shouldLogLayoutDirty() && recomputed.columnMeasurementCache.size > 0) {
                    var cacheDetails = Array.from(recomputed.columnMeasurementCache.entries()).map(function (_a) {
                        var key = _a[0], state = _a[1];
                        return ({
                            columnKey: key,
                            requiredCount: state.requiredKeys.size,
                            measuredCount: state.measuredKeys.size,
                            isStable: state.isStable,
                            timeSinceUpdate: Date.now() - state.lastUpdateTime,
                            ready: readyColumnsAfterRebuild_1.has(key),
                        });
                    });
                    console.log('[layout-dirty] Column cache state:', {
                        cacheDetails: cacheDetails,
                        readyColumns: Array.from(readyColumnsAfterRebuild_1),
                    });
                }
                // CRITICAL: Don't trigger pagination if there's already a pending layout
                // Wait for current pagination to complete before triggering again
                var canTriggerPagination = shouldTriggerPagination && !state.pendingLayout;
                if (shouldTriggerPagination) {
                    logIsLayoutDirtySet('MEASUREMENTS_UPDATED', {
                        reason: triggerReason,
                        readyColumns: Array.from(readyColumnsAfterRebuild_1),
                        wasWaitingForMeasurements: wasWaitingForMeasurements,
                        pendingLayoutExists: Boolean(state.pendingLayout),
                        willTrigger: canTriggerPagination,
                    });
                }
                return __assign(__assign({}, recomputed), { measurementEntries: preservedMeasurementEntries, regionHeightPx: nextRegionHeightPx, 
                    // CRITICAL: If MEASUREMENT_COMPLETE already fired, preserve isLayoutDirty to allow pagination
                    // Otherwise, use canTriggerPagination
                    isLayoutDirty: measurementCompleteAlreadyFired
                        ? (state.isLayoutDirty || canTriggerPagination)
                        : canTriggerPagination, pendingLayout: null });
            }
            // Measuring but not complete: update measurements only, don't trigger pagination
            // CRITICAL: If MEASUREMENT_COMPLETE already fired, preserve isLayoutDirty to allow pagination
            return __assign(__assign({}, updatedState_1), { isLayoutDirty: measurementCompleteAlreadyFired ? state.isLayoutDirty : false, pendingLayout: null });
        }
        case 'REQUEST_REMEASURE': {
            // Delete measurements for specified components and mark status as measuring
            var nextMeasurements_1 = new Map(state.measurements);
            var ids_1 = new Set(action.payload.componentIds);
            Array.from(nextMeasurements_1.keys()).forEach(function (key) {
                var idMatch = key.match(/^(component-\d+):/);
                var compId = idMatch ? idMatch[1] : null;
                if (compId && ids_1.has(compId)) {
                    nextMeasurements_1.delete(key);
                }
            });
            // Recompute missing keys with updated map (Phase 3.3b: use selector)
            var missing = computeMissingMeasurementKeys(selectRequiredMeasurementKeys(state), nextMeasurements_1);
            return __assign(__assign({}, state), { measurements: nextMeasurements_1, measurementStatus: 'measuring', waitingForInitialMeasurements: true, missingMeasurementKeys: missing, isLayoutDirty: false });
        }
        case 'MEASUREMENT_START': {
            // Explicitly signal that measurement phase has begun
            if (state.measurementStatus === 'measuring') {
                // Already measuring, no change needed
                return state;
            }
            if (process.env.NODE_ENV !== 'production') {
                // eslint-disable-next-line no-console
                console.log('🧭 [Layout] MEASUREMENT_START', {
                    previousStatus: state.measurementStatus,
                });
            }
            return __assign(__assign({}, state), { measurementStatus: 'measuring' });
        }
        case 'MEASUREMENT_COMPLETE': {
            var version = action.payload.measurementVersion;
            var alreadyCommitted = state.lastMeasurementCompleteVersion >= version;
            if (alreadyCommitted) {
                if (process.env.NODE_ENV !== 'production') {
                    // eslint-disable-next-line no-console
                    console.log('⏭️ [Layout] MEASUREMENT_COMPLETE skipped - version already committed', {
                        measurementVersion: version,
                        lastCommittedVersion: state.lastMeasurementCompleteVersion,
                        currentStatus: state.measurementStatus,
                    });
                }
                return state;
            }
            var wasSeen = processedMeasurementVersions.has(version);
            if (!wasSeen) {
                processedMeasurementVersions.add(version);
                if (processedMeasurementVersions.size > 10) {
                    var sorted = Array.from(processedMeasurementVersions).sort(function (a, b) { return a - b; });
                    var toRemove = sorted.slice(0, sorted.length - 10);
                    toRemove.forEach(function (v) { return processedMeasurementVersions.delete(v); });
                }
            }
            if (wasSeen && state.measurementStatus === 'complete') {
                if (process.env.NODE_ENV !== 'production') {
                    // eslint-disable-next-line no-console
                    console.log('⏭️ [Layout] MEASUREMENT_COMPLETE skipped - duplicate (post-complete)', {
                        measurementVersion: version,
                        currentStatus: state.measurementStatus,
                        currentVersion: state.measurementVersion,
                        isLayoutDirty: state.isLayoutDirty,
                    });
                }
                return state;
            }
            if (!wasSeen && process.env.NODE_ENV !== 'production') {
                // eslint-disable-next-line no-console
                console.log('🧭 [Layout] MEASUREMENT_COMPLETE -> RECALCULATE_LAYOUT', {
                    measurementVersion: action.payload.measurementVersion,
                    previousVersion: state.measurementVersion,
                    previousStatus: state.measurementStatus,
                });
            }
            // Set regionHeightPx from baseDimensions if it's still <= 0
            var nextRegionHeightPx = state.regionHeightPx;
            if (nextRegionHeightPx <= 0 && state.baseDimensions) {
                nextRegionHeightPx = state.baseDimensions.contentHeightPx;
                if (process.env.NODE_ENV !== 'production') {
                    // eslint-disable-next-line no-console
                    console.log('🧭 [Layout] MEASUREMENT_COMPLETE: Set regionHeightPx from baseDimensions', {
                        regionHeightPx: nextRegionHeightPx,
                    });
                }
            }
            // CRITICAL: Rebuild buckets before triggering pagination
            // This ensures buckets are built even if MEASUREMENTS_UPDATED hasn't finished processing
            var updatedState = __assign(__assign({}, state), { measurementStatus: 'complete', measurementVersion: action.payload.measurementVersion, waitingForInitialMeasurements: false, regionHeightPx: nextRegionHeightPx, lastMeasurementCompleteVersion: version });
            // DIAGNOSTIC: Log state before recomputeEntries
            if (process.env.NODE_ENV !== 'production') {
                // eslint-disable-next-line no-console
                console.log('🔬 [Layout] MEASUREMENT_COMPLETE: State before recompute', {
                    componentCount: state.components.length,
                    dataSourceCount: state.dataSources.length,
                    measurementCount: state.measurements.size,
                    hasTemplate: !!state.template,
                    componentIds: state.components.slice(0, 5).map(function (c) { return c.id; }),
                });
            }
            // Rebuild entries to ensure buckets are populated
            var recomputed_1 = recomputeEntries(__assign(__assign({}, updatedState), { assignedRegions: state.assignedRegions }));
            if (process.env.NODE_ENV !== 'production') {
                var bucketKeys = Array.from(recomputed_1.buckets.keys());
                var bucketSizes = bucketKeys.map(function (key) {
                    var _a, _b;
                    return ({
                        key: key,
                        entryCount: (_b = (_a = recomputed_1.buckets.get(key)) === null || _a === void 0 ? void 0 : _a.length) !== null && _b !== void 0 ? _b : 0,
                    });
                });
                // eslint-disable-next-line no-console
                console.log('🧭 [Layout] MEASUREMENT_COMPLETE: Rebuilt buckets', {
                    bucketCount: recomputed_1.buckets.size,
                    bucketSizes: bucketSizes,
                    totalEntries: bucketSizes.reduce(function (sum, b) { return sum + b.entryCount; }, 0),
                });
            }
            return __assign(__assign({}, recomputed_1), { isLayoutDirty: true });
        }
        case 'RECALCULATE_LAYOUT': {
            // Don't paginate if we're waiting for initial measurements
            // UNLESS isLayoutDirty is true (MEASUREMENT_COMPLETE set it, signaling pagination should run)
            // OR measurementStatus is 'complete' (MEASUREMENT_COMPLETE already fired)
            // This handles the case where MEASUREMENT_COMPLETE sets waitingForInitialMeasurements: false,
            // but then new measurements arrive and set it back to true before RECALCULATE_LAYOUT runs
            if (state.waitingForInitialMeasurements && !state.isLayoutDirty && state.measurementStatus !== 'complete') {
                if (process.env.NODE_ENV !== 'production') {
                    // eslint-disable-next-line no-console
                    console.log('[RECALCULATE_LAYOUT] Skipping - waitingForInitialMeasurements', {
                        waitingForInitialMeasurements: state.waitingForInitialMeasurements,
                        isLayoutDirty: state.isLayoutDirty,
                        measurementStatus: state.measurementStatus,
                    });
                }
                return state;
            }
            // Gate by publish-once status: only paginate when complete
            // UNLESS isLayoutDirty is true (MEASUREMENT_COMPLETE explicitly triggered pagination)
            if (state.measurementStatus && state.measurementStatus !== 'complete' && !state.isLayoutDirty) {
                if (process.env.NODE_ENV !== 'production') {
                    // eslint-disable-next-line no-console
                    console.log('[RECALCULATE_LAYOUT] Skipping - measurementStatus not complete', {
                        measurementStatus: state.measurementStatus,
                        isLayoutDirty: state.isLayoutDirty,
                    });
                }
                return __assign(__assign({}, state), { isLayoutDirty: false });
            }
            // CRITICAL: Don't paginate if there's already a pending layout
            // This prevents multiple pagination runs when multiple actions set isLayoutDirty: true
            // Wait for the current pagination to complete (commit) before running again
            if (state.pendingLayout) {
                if (process.env.NODE_ENV !== 'production') {
                    // eslint-disable-next-line no-console
                    console.log('[RECALCULATE_LAYOUT] Skipping - pendingLayout already exists', {
                        pendingPageCount: state.pendingLayout.pages.length,
                    });
                }
                // Clear dirty flag to prevent re-triggering, but keep pendingLayout
                return __assign(__assign({}, state), { isLayoutDirty: false });
            }
            if (!state.template || !state.pageVariables) {
                if (process.env.NODE_ENV !== 'production') {
                    // eslint-disable-next-line no-console
                    console.log('[RECALCULATE_LAYOUT] Skipping - missing template or pageVariables', {
                        hasTemplate: !!state.template,
                        hasPageVariables: !!state.pageVariables,
                    });
                }
                return state;
            }
            if (state.regionHeightPx <= 0) {
                if (process.env.NODE_ENV !== 'production') {
                    // eslint-disable-next-line no-console
                    console.log('[RECALCULATE_LAYOUT] Skipping - regionHeightPx <= 0', {
                        regionHeightPx: state.regionHeightPx,
                    });
                }
                return state;
            }
            var requestedPageCount = (_b = (_a = state.pageVariables.pagination) === null || _a === void 0 ? void 0 : _a.pageCount) !== null && _b !== void 0 ? _b : 1;
            var baseDimensions = state.baseDimensions
                ? {
                    contentHeightPx: state.baseDimensions.contentHeightPx,
                    topMarginPx: state.baseDimensions.topMarginPx,
                }
                : null;
            // Debug: Log bucket state before pagination
            if (process.env.NODE_ENV !== 'production') {
                var bucketKeys = Array.from(state.buckets.keys());
                var bucketSizes = bucketKeys.map(function (key) {
                    var _a, _b;
                    return ({
                        key: key,
                        entryCount: (_b = (_a = state.buckets.get(key)) === null || _a === void 0 ? void 0 : _a.length) !== null && _b !== void 0 ? _b : 0,
                    });
                });
                // eslint-disable-next-line no-console
                console.log('[RECALCULATE_LAYOUT] Paginating with buckets:', {
                    bucketCount: state.buckets.size,
                    bucketSizes: bucketSizes,
                    totalEntries: bucketSizes.reduce(function (sum, b) { return sum + b.entryCount; }, 0),
                    columnCount: state.columnCount,
                    regionHeightPx: state.regionHeightPx,
                });
            }
            var pendingLayout = paginate({
                buckets: state.buckets,
                columnCount: state.columnCount,
                regionHeightPx: state.regionHeightPx,
                requestedPageCount: requestedPageCount,
                baseDimensions: baseDimensions,
                measurementVersion: state.measurementVersion,
                measurements: state.measurements,
                adapters: state.adapters,
                segmentRerouteCache: state.segmentRerouteCache,
                previousPlan: state.layoutPlan,
            });
            // Debug: Log pagination result
            if (process.env.NODE_ENV !== 'production') {
                var page1Col1Entries = (_e = (_d = (_c = pendingLayout.pages[0]) === null || _c === void 0 ? void 0 : _c.columns[0]) === null || _d === void 0 ? void 0 : _d.entries.length) !== null && _e !== void 0 ? _e : 0;
                var page1Col2Entries = (_h = (_g = (_f = pendingLayout.pages[0]) === null || _f === void 0 ? void 0 : _f.columns[1]) === null || _g === void 0 ? void 0 : _g.entries.length) !== null && _h !== void 0 ? _h : 0;
                // eslint-disable-next-line no-console
                console.log('[RECALCULATE_LAYOUT] Pagination result:', {
                    pageCount: pendingLayout.pages.length,
                    page1Col1Entries: page1Col1Entries,
                    page1Col2Entries: page1Col2Entries,
                    totalEntries: pendingLayout.pages.reduce(function (sum, p) {
                        return sum + p.columns.reduce(function (colSum, col) { return colSum + col.entries.length; }, 0);
                    }, 0),
                });
            }
            // Clear dirty flag immediately to prevent double pagination from effect re-firing
            return __assign(__assign({}, state), { pendingLayout: pendingLayout, isLayoutDirty: false });
        }
        case 'COMMIT_LAYOUT': {
            var committedPlan = (_j = state.pendingLayout) !== null && _j !== void 0 ? _j : state.layoutPlan;
            var assignedRegions_1 = new Map();
            if (committedPlan) {
                if (process.env.NODE_ENV !== 'production') {
                    var previousPlan = state.layoutPlan;
                    var previousPageCount = (_k = previousPlan === null || previousPlan === void 0 ? void 0 : previousPlan.pages.length) !== null && _k !== void 0 ? _k : 0;
                    var nextPageCount = committedPlan.pages.length;
                    var pendingPages = (_m = (_l = state.pendingLayout) === null || _l === void 0 ? void 0 : _l.pages.length) !== null && _m !== void 0 ? _m : null;
                    // Debug: Log plan commit details (gated behind plan-commit flag)
                    if (shouldLogPlanCommit()) {
                        // Debug: Log all entries in first page, first column to see what's actually there
                        var page1Col1Entries = (_q = (_p = (_o = committedPlan.pages[0]) === null || _o === void 0 ? void 0 : _o.columns[0]) === null || _p === void 0 ? void 0 : _p.entries) !== null && _q !== void 0 ? _q : [];
                        var page1Col2Entries = (_t = (_s = (_r = committedPlan.pages[0]) === null || _r === void 0 ? void 0 : _r.columns[1]) === null || _s === void 0 ? void 0 : _s.entries) !== null && _t !== void 0 ? _t : [];
                        var page2Col1Entries = (_w = (_v = (_u = committedPlan.pages[1]) === null || _u === void 0 ? void 0 : _u.columns[0]) === null || _v === void 0 ? void 0 : _v.entries) !== null && _w !== void 0 ? _w : [];
                        var page2Col2Entries = (_z = (_y = (_x = committedPlan.pages[1]) === null || _x === void 0 ? void 0 : _x.columns[1]) === null || _y === void 0 ? void 0 : _y.entries) !== null && _z !== void 0 ? _z : [];
                        // Find component-05 entry in committed plan for debugging
                        // Check both formats: 'component-05' and 'component-5'
                        var findComponent05 = function (entries) {
                            return entries.find(function (e) { return e.instance.id === 'component-05' || e.instance.id === 'component-5'; });
                        };
                        var component05Entry = (_3 = (_2 = (_1 = (_0 = findComponent05(page1Col1Entries)) !== null && _0 !== void 0 ? _0 : findComponent05(page1Col2Entries)) !== null && _1 !== void 0 ? _1 : findComponent05(page2Col1Entries)) !== null && _2 !== void 0 ? _2 : findComponent05(page2Col2Entries)) !== null && _3 !== void 0 ? _3 : committedPlan.pages.flatMap(function (p) {
                            return p.columns.flatMap(function (col) { return col.entries; });
                        }).find(function (e) { return e.instance.id === 'component-05' || e.instance.id === 'component-5'; });
                        // Expand entry IDs to show full details
                        var expandEntryDetails = function (entries) { return entries.map(function (e) {
                            var _a, _b;
                            return ({
                                id: e.instance.id,
                                spanTop: (_a = e.span) === null || _a === void 0 ? void 0 : _a.top,
                                spanBottom: (_b = e.span) === null || _b === void 0 ? void 0 : _b.bottom,
                                region: e.region,
                            });
                        }); };
                        // eslint-disable-next-line no-console
                        console.log('[CanvasLayout] Committed plan', {
                            previousPageCount: previousPageCount,
                            nextPageCount: nextPageCount,
                            pendingPages: pendingPages,
                            runId: (_4 = committedPlan.runId) !== null && _4 !== void 0 ? _4 : 'unknown',
                            component05: component05Entry ? {
                                spanTop: (_5 = component05Entry.span) === null || _5 === void 0 ? void 0 : _5.top,
                                spanBottom: (_6 = component05Entry.span) === null || _6 === void 0 ? void 0 : _6.bottom,
                                region: component05Entry.region,
                                page: (_7 = component05Entry.region) === null || _7 === void 0 ? void 0 : _7.page,
                                column: (_8 = component05Entry.region) === null || _8 === void 0 ? void 0 : _8.column,
                            } : 'not found',
                            page1Col1Entries: expandEntryDetails(page1Col1Entries),
                            page1Col2Entries: expandEntryDetails(page1Col2Entries),
                            page2Col1Entries: expandEntryDetails(page2Col1Entries),
                            page2Col2Entries: expandEntryDetails(page2Col2Entries),
                            allComponent05Entries: committedPlan.pages.flatMap(function (p) {
                                return p.columns.flatMap(function (col) {
                                    return col.entries.filter(function (e) { return e.instance.id === 'component-05' || e.instance.id === 'component-5'; }).map(function (e) {
                                        var _a, _b;
                                        return ({
                                            id: e.instance.id,
                                            page: p.pageNumber,
                                            column: col.columnNumber,
                                            spanTop: (_a = e.span) === null || _a === void 0 ? void 0 : _a.top,
                                            spanBottom: (_b = e.span) === null || _b === void 0 ? void 0 : _b.bottom,
                                        });
                                    });
                                });
                            }),
                            totalEntriesAcrossAllPages: committedPlan.pages.reduce(function (sum, p) {
                                return sum + p.columns.reduce(function (colSum, col) { return colSum + col.entries.length; }, 0);
                            }, 0),
                        });
                    }
                    var hasPendingPlan = Boolean(state.pendingLayout);
                    var didPageCountDecrease = previousPageCount > nextPageCount;
                    var shouldLogSummary = didPageCountDecrease || isDebugEnabled('layout-plan-diff');
                    if (hasPendingPlan && previousPlan && shouldLogSummary) {
                        var previousSummary = summarizePlanForDebug(previousPlan);
                        var nextSummary = summarizePlanForDebug(committedPlan);
                        // eslint-disable-next-line no-console
                        console.log('[CanvasLayout] Plan diff detail', {
                            previous: previousSummary,
                            next: nextSummary,
                        });
                    }
                }
                committedPlan.pages.forEach(function (page) {
                    page.columns.forEach(function (column) {
                        column.entries.forEach(function (entry) {
                            var _a;
                            var homeRegionRecord = state.homeRegions.get(entry.instance.id);
                            upsertRegionAssignment(assignedRegions_1, {
                                region: {
                                    page: page.pageNumber,
                                    column: column.columnNumber,
                                },
                                // Use immutable home region from homeRegions map
                                homeRegion: (_a = homeRegionRecord === null || homeRegionRecord === void 0 ? void 0 : homeRegionRecord.homeRegion) !== null && _a !== void 0 ? _a : entry.homeRegion,
                                slotIndex: entry.slotIndex,
                                orderIndex: entry.orderIndex,
                            }, entry.instance.id);
                        });
                    });
                });
            }
            var newState = __assign(__assign({}, state), { layoutPlan: committedPlan !== null && committedPlan !== void 0 ? committedPlan : state.layoutPlan, pendingLayout: null, isLayoutDirty: false, assignedRegions: assignedRegions_1 });
            return newState;
        }
        default:
            return state;
    }
};
export var CanvasLayoutProvider = function (_a) {
    var children = _a.children;
    var _b = useReducer(layoutReducer, undefined, createInitialState), state = _b[0], dispatch = _b[1];
    var value = useMemo(function () { return state; }, [state]);
    // Expose debugging APIs in development
    useEffect(function () {
        exposeStateDebugger(state);
        exposePaginationDiagnostics(); // window.__CANVAS_PAGINATION__
    }, [state]);
    return (_jsx(CanvasLayoutDispatchContext.Provider, __assign({ value: dispatch }, { children: _jsx(CanvasLayoutStateContext.Provider, __assign({ value: value }, { children: children })) })));
};
export var useCanvasLayoutState = function () {
    var context = useContext(CanvasLayoutStateContext);
    if (!context) {
        throw new Error('useCanvasLayoutState must be used within a CanvasLayoutProvider');
    }
    return context;
};
export var useCanvasLayoutDispatch = function () {
    var context = useContext(CanvasLayoutDispatchContext);
    if (!context) {
        throw new Error('useCanvasLayoutDispatch must be used within a CanvasLayoutProvider');
    }
    return context;
};
export var useCanvasLayoutActions = function () {
    var dispatch = useCanvasLayoutDispatch();
    var initialize = useCallback(function (template, pageVariables, instances, dataSources, registry, adapters, 
    /**
     * Optional initial region height. If provided, overrides contentHeightPx.
     * Use when theme containers (e.g., frames with borders) reduce available space.
     */
    initialRegionHeightPx) {
        var baseDimensions = computeBasePageDimensions(pageVariables);
        var columnCount = pageVariables.columns.columnCount;
        // Use provided initialRegionHeightPx if available, otherwise fall back to contentHeightPx
        // This allows consumers to account for theme-specific containers (e.g., frame borders)
        var effectiveRegionHeightPx = initialRegionHeightPx !== null && initialRegionHeightPx !== void 0 ? initialRegionHeightPx : baseDimensions.contentHeightPx;
        dispatch({
            type: 'INITIALIZE',
            payload: {
                template: template,
                pageVariables: pageVariables,
                columnCount: columnCount,
                regionHeightPx: effectiveRegionHeightPx,
                pageWidthPx: baseDimensions.widthPx,
                pageHeightPx: baseDimensions.heightPx,
                baseDimensions: baseDimensions,
                adapters: adapters,
            },
        });
        dispatch({ type: 'SET_COMPONENTS', payload: { instances: instances } });
        dispatch({ type: 'SET_DATA_SOURCES', payload: { dataSources: dataSources } });
        dispatch({ type: 'SET_REGISTRY', payload: { registry: registry } });
    }, [dispatch]);
    var setPageVariables = useCallback(function (pageVariables) {
        var baseDimensions = computeBasePageDimensions(pageVariables);
        var columnCount = pageVariables.columns.columnCount;
        dispatch({
            type: 'SET_PAGE_VARIABLES',
            payload: {
                pageVariables: pageVariables,
                columnCount: columnCount,
                // NOTE: Do NOT pass regionHeightPx here - let the reducer preserve 
                // the consumer-provided initialRegionHeightPx from INITIALIZE.
                // If we passed baseDimensions.contentHeightPx, it would overwrite the
                // frame-adjusted height that the consumer calculated.
                regionHeightPx: 0,
                pageWidthPx: baseDimensions.widthPx,
                pageHeightPx: baseDimensions.heightPx,
                baseDimensions: baseDimensions,
            },
        });
    }, [dispatch]);
    var setTemplate = useCallback(function (template) {
        dispatch({ type: 'SET_TEMPLATE', payload: { template: template } });
    }, [dispatch]);
    var setComponents = useCallback(function (instances) {
        dispatch({ type: 'SET_COMPONENTS', payload: { instances: instances } });
    }, [dispatch]);
    var setDataSources = useCallback(function (dataSources) {
        dispatch({ type: 'SET_DATA_SOURCES', payload: { dataSources: dataSources } });
    }, [dispatch]);
    var setRegistry = useCallback(function (registry) {
        dispatch({ type: 'SET_REGISTRY', payload: { registry: registry } });
    }, [dispatch]);
    var updateMeasurements = useCallback(function (updates) {
        dispatch({ type: 'MEASUREMENTS_UPDATED', payload: { measurements: updates } });
    }, [dispatch]);
    var recalculateLayout = useCallback(function () {
        dispatch({ type: 'RECALCULATE_LAYOUT' });
    }, [dispatch]);
    var commitLayout = useCallback(function () {
        dispatch({ type: 'COMMIT_LAYOUT' });
    }, [dispatch]);
    var measurementStart = useCallback(function () {
        dispatch({ type: 'MEASUREMENT_START' });
    }, [dispatch]);
    var measurementComplete = useCallback(function (measurementVersion) {
        dispatch({ type: 'MEASUREMENT_COMPLETE', payload: { measurementVersion: measurementVersion } });
    }, [dispatch]);
    var setRegionHeight = useCallback(function (regionHeightPx) {
        dispatch({ type: 'SET_REGION_HEIGHT', payload: { regionHeightPx: regionHeightPx } });
    }, [dispatch]);
    var requestRemeasureByComponent = useCallback(function (componentIds) {
        dispatch({ type: 'REQUEST_REMEASURE', payload: { componentIds: componentIds } });
    }, [dispatch]);
    return {
        initialize: initialize,
        setPageVariables: setPageVariables,
        setTemplate: setTemplate,
        setComponents: setComponents,
        setDataSources: setDataSources,
        setRegistry: setRegistry,
        updateMeasurements: updateMeasurements,
        measurementComplete: measurementComplete,
        recalculateLayout: recalculateLayout,
        commitLayout: commitLayout,
        setRegionHeight: setRegionHeight,
        requestRemeasureByComponent: requestRemeasureByComponent,
    };
};
