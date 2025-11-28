import React, { createContext, useCallback, useContext, useEffect, useMemo, useReducer } from 'react';

import type {
    ComponentDataSource,
    ComponentInstance,
    ComponentRegistryEntry,
    PageVariables,
    TemplateConfig,
} from '../types/canvas.types';
import type {
    CanvasLayoutEntry,
    CanvasLayoutState,
    ColumnMeasurementState,
    LayoutPlan,
    MeasurementEntry,
    MeasurementKey,
    MeasurementRecord,
    SlotAssignment,
} from './types';
import { createDefaultAdapters } from '../types/adapters.types';
import { paginate } from './paginate';
import { SegmentRerouteCache } from './segmentTypes';
import {
    buildCanvasEntries,
    buildBuckets,
    computeBasePageDimensions,
    computeHomeRegions,
    createInitialMeasurementEntries,
    regionKey,
} from './utils';
import { isDebugEnabled } from './debugFlags';
import { logRegionHeightEvent } from './regionHeightDebug';
import { exposeStateDebugger } from './stateDebug';
import { exposePaginationDiagnostics } from './paginationDiagnostics';

const shouldLogPlanCommit = (): boolean => isDebugEnabled('plan-commit');

// Track processed measurement versions to prevent duplicate MEASUREMENT_COMPLETE dispatches
// (React StrictMode causes double dispatches before state updates)
const processedMeasurementVersions = new Set<number>();

// Diagnostic: Log when state.tsx loads (confirms module is loading)
if (typeof window !== 'undefined') {
    // eslint-disable-next-line no-console
    console.log('🔧 [Canvas state.tsx] Module loaded, paginate imported', {
        timestamp: new Date().toISOString(),
        hasPaginate: typeof paginate === 'function',
    });
}

const shouldLogLayoutDirty = (): boolean => isDebugEnabled('layout-dirty');
const shouldLogMeasureFirst = (): boolean => isDebugEnabled('measure-first');
const shouldLogMeasurementDebug = (): boolean => isDebugEnabled('measurement');

const logLayoutDirty = (reason: string, context: Record<string, unknown> = {}) => {
    if (!shouldLogLayoutDirty()) {
        return;
    }
    // eslint-disable-next-line no-console
    console.debug('[layout-dirty]', reason, context);
};

// Always log when isLayoutDirty is set to true (for debugging pagination triggers)
const logIsLayoutDirtySet = (reason: string, context: Record<string, unknown> = {}) => {
    if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.log('[isLayoutDirty] Set to true:', reason, context);
    }
};

type DebugPlanEntrySummary = {
    instanceId: string;
    componentType: string;
    slotIndex: number;
    orderIndex: number;
    sourceRegionKey: string;
    region: {
        page: number;
        column: 1 | 2;
    };
    homeRegion: {
        page: number;
        column: 1 | 2;
    };
    measurementKey: string;
    estimatedHeight: number;
    span?: {
        top: number;
        bottom: number;
        height: number;
    };
    overflow: boolean;
    overflowRouted: boolean;
    listContinuation?: {
        isContinuation: boolean;
        startIndex: number;
        totalCount: number;
    };
};

type DebugPlanColumnSummary = {
    columnNumber: 1 | 2;
    entryCount: number;
    usedHeightPx?: number;
    availableHeightPx?: number;
    entries: DebugPlanEntrySummary[];
};

type DebugPlanSummary = {
    pageCount: number;
    overflowWarningCount: number;
    overflowWarnings: LayoutPlan['overflowWarnings'];
    pages: Array<{
        pageNumber: number;
        columns: DebugPlanColumnSummary[];
    }>;
};

const round = (value: number): number => Number(value.toFixed(2));

const summarizeEntryForDebug = (entry: CanvasLayoutEntry): DebugPlanEntrySummary => ({
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
});

const summarizePlanForDebug = (plan: LayoutPlan | null): DebugPlanSummary | null => {
    if (!plan) {
        return null;
    }

    return {
        pageCount: plan.pages.length,
        overflowWarningCount: plan.overflowWarnings.length,
        overflowWarnings: plan.overflowWarnings,
        pages: plan.pages.map((page) => ({
            pageNumber: page.pageNumber,
            columns: page.columns.map((column) => ({
                columnNumber: column.columnNumber,
                entryCount: column.entries.length,
                usedHeightPx: column.usedHeightPx,
                availableHeightPx: column.availableHeightPx,
                entries: column.entries.map(summarizeEntryForDebug),
            })),
        })),
    };
};

type CanvasLayoutAction =
    | { type: 'INITIALIZE'; payload: { template: TemplateConfig; pageVariables: PageVariables; columnCount: number; regionHeightPx: number; pageWidthPx: number; pageHeightPx: number; baseDimensions: ReturnType<typeof computeBasePageDimensions>; adapters: import('../types/adapters.types').CanvasAdapters } }
    | { type: 'SET_COMPONENTS'; payload: { instances: ComponentInstance[] } }
    | { type: 'SET_TEMPLATE'; payload: { template: TemplateConfig } }
    | { type: 'SET_DATA_SOURCES'; payload: { dataSources: ComponentDataSource[] } }
    | { type: 'SET_REGISTRY'; payload: { registry: Record<string, ComponentRegistryEntry> } }
    | { type: 'SET_PAGE_VARIABLES'; payload: { pageVariables: PageVariables; columnCount: number; regionHeightPx: number; pageWidthPx: number; pageHeightPx: number; baseDimensions: ReturnType<typeof computeBasePageDimensions> } }
    | { type: 'SET_REGION_HEIGHT'; payload: { regionHeightPx: number } }
    | { type: 'MEASUREMENT_START' }
    | { type: 'MEASUREMENTS_UPDATED'; payload: { measurements: MeasurementRecord[] } }
    | { type: 'MEASUREMENT_COMPLETE'; payload: { measurementVersion: number } }
    | { type: 'REQUEST_REMEASURE'; payload: { componentIds: string[] } }
    | { type: 'RECALCULATE_LAYOUT' }
    | { type: 'COMMIT_LAYOUT' };

const CanvasLayoutStateContext = createContext<CanvasLayoutState | undefined>(undefined);
const CanvasLayoutDispatchContext = createContext<React.Dispatch<CanvasLayoutAction> | undefined>(undefined);

const initialPlan: LayoutPlan = { pages: [], overflowWarnings: [] };

// Column measurement stability threshold (used by column cache)
const MEASUREMENT_STABILITY_THRESHOLD_MS = 300; // Default: 300ms

const parseBooleanFlag = (value?: string | null): boolean | undefined => {
    if (typeof value !== 'string') {
        return undefined;
    }

    const normalized = value.trim().toLowerCase();
    if (['1', 'true', 'yes', 'on', 'enable', 'enabled'].includes(normalized)) {
        return true;
    }
    if (['0', 'false', 'no', 'off', 'disable', 'disabled'].includes(normalized)) {
        return false;
    }

    return undefined;
};

const readReactAppColumnCacheFlag = (): string | undefined => {
    try {
        // React Scripts (and other bundlers) replace REACT_APP_* variables at build time.
        // Accessing process.env directly ensures the substitution happens even when "process"
        // is undefined at runtime in the browser.
        return process.env.REACT_APP_CANVAS_COLUMN_CACHE;
    } catch {
        return undefined;
    }
};

const resolveColumnCacheFlag = (): boolean => {
    const reactAppValue = readReactAppColumnCacheFlag();
    const parsedReact = parseBooleanFlag(reactAppValue);
    if (parsedReact !== undefined) {
        return parsedReact;
    }

    if (typeof process !== 'undefined' && typeof process.env !== 'undefined') {
        const nodeValue = process.env.CANVAS_COLUMN_CACHE;
        const parsedNode = parseBooleanFlag(nodeValue);
        if (parsedNode !== undefined) {
            return parsedNode;
        }
    }

    return true; // Default: enabled
};

const COLUMN_CACHE_ENABLED = resolveColumnCacheFlag();
let columnCacheFlagLogged = false;

const logColumnCacheDisabledOnce = () => {
    if (COLUMN_CACHE_ENABLED || columnCacheFlagLogged || process.env.NODE_ENV === 'production') {
        return;
    }
    columnCacheFlagLogged = true;
    // eslint-disable-next-line no-console
    console.log('[ColumnCache] Disabled via REACT_APP_CANVAS_COLUMN_CACHE flag (telemetry mode)');
};

export const createInitialState = (): CanvasLayoutState => {
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
        measurementStatus: 'idle' as import('./types').MeasurementStatus,
    };
};

const upsertRegionAssignment = (assignedRegions: Map<string, SlotAssignment>, entry: SlotAssignment, instanceId: string) => {
    assignedRegions.set(instanceId, entry);
};

/**
 * Check if we have measurements for all components.
 * For block components: just need the component-id:block measurement.
 * For list components: need at least the full list measurement.
 */
const checkAllComponentsMeasured = (
    components: ComponentInstance[],
    measurements: Map<MeasurementKey, MeasurementRecord>
): boolean => {
    const measuredComponents = new Set<string>();
    measurements.forEach((_, key) => {
        const match = key.match(/^(component-\d+)/);
        if (match) {
            measuredComponents.add(match[1]);
        }
    });

    for (const component of components) {
        if (!measuredComponents.has(component.id)) {
            return false;
        }
    }
    return true;
};

const computeRequiredMeasurementKeys = (entries: MeasurementEntry[]): Set<MeasurementKey> => {
    const next = new Set<MeasurementKey>();
    entries.forEach((entry) => {
        next.add(entry.measurementKey);
    });
    return next;
};

const computeMissingMeasurementKeys = (
    requiredKeys: Set<MeasurementKey>,
    measurements: Map<MeasurementKey, MeasurementRecord>
): Set<MeasurementKey> => {
    const missing = new Set<MeasurementKey>();
    requiredKeys.forEach((key) => {
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
const extractComponentId = (key: MeasurementKey): string | null => {
    const match = key.match(/^(component-\d+):/);
    return match ? match[1] : null;
};

/**
 * Update column measurement cache with new measurements
 */
const updateColumnCache = (
    currentCache: Map<string, ColumnMeasurementState>,
    newMeasurements: MeasurementRecord[],
    homeRegions: Map<string, import('./types').HomeRegionAssignment>,
    requiredKeys: Set<MeasurementKey>,
    regionKeyFn: (page: number, column: 1 | 2) => string,
    currentMeasurements?: Map<MeasurementKey, MeasurementRecord>
): Map<string, ColumnMeasurementState> => {
    const updatedCache = new Map(currentCache);
    const now = Date.now();

    // Group required keys by column based on home regions
    const keysByColumn = new Map<string, Set<MeasurementKey>>();

    requiredKeys.forEach(key => {
        const componentId = extractComponentId(key);
        if (!componentId) return;

        const homeRegion = homeRegions.get(componentId);
        if (!homeRegion) return;

        const columnKey = regionKeyFn(
            homeRegion.homeRegion.page,
            homeRegion.homeRegion.column
        );

        if (!keysByColumn.has(columnKey)) {
            keysByColumn.set(columnKey, new Set());
        }
        keysByColumn.get(columnKey)!.add(key);
    });

    // Create a set of measured keys from new measurements
    const newMeasuredKeysSet = new Set<MeasurementKey>();
    newMeasurements.forEach(m => {
        if (m.height > 0) {
            newMeasuredKeysSet.add(m.key);
        }
    });

    // Update cache for each column
    keysByColumn.forEach((requiredKeysForColumn, columnKey) => {
        const existing = updatedCache.get(columnKey);
        const measuredKeys = new Set<MeasurementKey>();

        // Check which required keys we now have measurements for
        // Include both new measurements and existing measurements from state
        requiredKeysForColumn.forEach(key => {
            if (newMeasuredKeysSet.has(key)) {
                measuredKeys.add(key);
            } else if (currentMeasurements && currentMeasurements.has(key)) {
                // Also include existing measurements from state
                measuredKeys.add(key);
            } else if (existing && existing.measuredKeys.has(key)) {
                // Preserve existing measured keys if they're still valid
                measuredKeys.add(key);
            }
        });

        // Check if measurements are stable (haven't changed recently)
        const keysChanged = existing ? (
            existing.measuredKeys.size !== measuredKeys.size ||
            Array.from(existing.measuredKeys).some(key => !measuredKeys.has(key)) ||
            Array.from(measuredKeys).some(key => !existing.measuredKeys.has(key))
        ) : true;

        const isStable = !keysChanged && existing
            ? (now - existing.lastUpdateTime) >= MEASUREMENT_STABILITY_THRESHOLD_MS
            : false;

        const columnState: ColumnMeasurementState = {
            columnKey,
            requiredKeys: requiredKeysForColumn,
            measuredKeys,
            lastUpdateTime: now,
            isStable,
        };

        updatedCache.set(columnKey, columnState);
    });

    return updatedCache;
};

/**
 * Get columns that meet threshold for pagination
 * Returns set of column keys that are ready
 */
const getReadyColumns = (
    cache: Map<string, ColumnMeasurementState>,
    stabilityThreshold: number,
    currentMeasurements: Map<MeasurementKey, MeasurementRecord>
): Set<string> => {
    const readyColumns = new Set<string>();
    const now = Date.now();

    // If cache is empty, return empty set (no columns ready yet)
    if (cache.size === 0) {
        return readyColumns;
    }

    cache.forEach((columnState, columnKey) => {
        // Update measuredKeys from current measurements
        const measuredKeys = new Set<MeasurementKey>();
        columnState.requiredKeys.forEach(key => {
            if (currentMeasurements.has(key)) {
                measuredKeys.add(key);
            }
        });

        // Option A: All measurements present
        const allPresent =
            columnState.requiredKeys.size > 0 &&
            measuredKeys.size === columnState.requiredKeys.size;

        // Option B: Stability threshold met (measurements haven't changed for threshold ms)
        const timeSinceUpdate = now - columnState.lastUpdateTime;
        const isStable =
            measuredKeys.size > 0 &&
            timeSinceUpdate >= stabilityThreshold;

        // Option C: Hybrid (recommended) - all present OR stable
        if (allPresent || isStable) {
            readyColumns.add(columnKey);
        }
    });

    return readyColumns;
};

export const layoutReducer = (state: CanvasLayoutState, action: CanvasLayoutAction): CanvasLayoutState => {
    const recomputeEntries = (base: CanvasLayoutState): CanvasLayoutState => {
        if (!base.template) {
            return {
                ...base,
                buckets: new Map(),
                measurementEntries: [],
                waitingForInitialMeasurements: false,
                allComponentsMeasured: false,
                requiredMeasurementKeys: new Set(),
                missingMeasurementKeys: new Set(),
            };
        }

        const hasRenderableComponents = base.components.length > 0;
        const hasRenderableDataSources = base.dataSources.length > 0;

        if (shouldLogMeasurementDebug()) {
            console.log('[measurement-debug] recomputeEntries', {
                componentCount: base.components.length,
                dataSourceCount: base.dataSources.length,
                measurementEntryCount: base.measurementEntries.length,
                measurementStoreSize: base.measurements.size,
                waitingForInitialMeasurements: base.waitingForInitialMeasurements,
                measurementStatus: base.measurementStatus ?? 'unknown',
                hasRenderableComponents,
                hasRenderableDataSources,
            });
        }

        // REFRESH FIX: Detect and flush stale measurement state on refresh
        // CRITICAL: Only flush when measurements exist WITHOUT components (true stale state)
        // Do NOT flush when cache exists but plan is empty - that's normal during measure-first flow
        const hasStaleMeasurements = base.measurements.size > 0 && !hasRenderableComponents;

        if (hasStaleMeasurements) {
            if (process.env.NODE_ENV !== 'production') {
                // eslint-disable-next-line no-console
                console.log('🔄 [CanvasLayout] Flushing stale measurement state detected on refresh', {
                    measurementCount: base.measurements.size,
                    componentCount: base.components.length,
                    dataSourceCount: base.dataSources.length,
                });
            }

            return {
                ...base,
                measurements: new Map<MeasurementKey, MeasurementRecord>(),
                measurementVersion: 0,
                lastMeasurementCompleteVersion: 0,
                columnMeasurementCache: new Map<string, ColumnMeasurementState>(),
                measurementStatus: 'idle' as import('./types').MeasurementStatus,
                waitingForInitialMeasurements: false,
                allComponentsMeasured: false,
                requiredMeasurementKeys: new Set(),
                missingMeasurementKeys: new Set(),
                buckets: new Map(),
                measurementEntries: [],
            };
        }

        if (!hasRenderableComponents || !hasRenderableDataSources) {
            if (process.env.NODE_ENV !== 'production') {
                // eslint-disable-next-line no-console
                console.log('⏸️ [CanvasLayout] Holding recompute until renderable data is ready', {
                    componentCount: base.components.length,
                    dataSourceCount: base.dataSources.length,
                });
            }

            return {
                ...base,
                buckets: new Map(),
                measurementEntries: [],
                waitingForInitialMeasurements: false,
                allComponentsMeasured: false,
                requiredMeasurementKeys: new Set(),
                missingMeasurementKeys: new Set(),
                measurements: new Map<MeasurementKey, MeasurementRecord>(),
                measurementVersion: 0,
                lastMeasurementCompleteVersion: 0,
                columnMeasurementCache: new Map<string, ColumnMeasurementState>(),
                measurementStatus: 'idle' as import('./types').MeasurementStatus,
                layoutPlan: initialPlan,
                pendingLayout: null,
                isLayoutDirty: false,
            };
        }

        // If we have no measurements yet AND we have components, start measure-first flow
        const hasNoMeasurements = base.measurements.size === 0;
        const hasComponents = base.components.length > 0;
        const shouldWaitForMeasurements = hasNoMeasurements && hasComponents;

        if (shouldLogMeasureFirst()) {
            console.log('[measure-first] Check:', {
                hasNoMeasurements,
                measurementCount: base.measurements.size,
                hasComponents,
                componentCount: base.components.length,
                shouldWaitForMeasurements,
            });
        }

        if (shouldWaitForMeasurements) {
            // Create measurement entries from RAW components (no buckets yet)
            const measurementEntries = createInitialMeasurementEntries({
                instances: base.components,
                template: base.template,
                columnCount: base.columnCount,
                pageWidthPx: base.pageWidthPx,
                dataSources: base.dataSources,
                adapters: base.adapters,
            });

            if (shouldLogMeasureFirst()) {
                console.log('[measure-first] Generated measurement entries:', {
                    totalEntries: measurementEntries.length,
                    componentCount: base.components.length,
                    entryKeys: measurementEntries.map(e => e.measurementKey),
                });
            }

            const requiredKeys = computeRequiredMeasurementKeys(measurementEntries);
            const missingKeys = computeMissingMeasurementKeys(requiredKeys, base.measurements);
            if (shouldLogMeasureFirst()) {
                console.log('[measure-first] Measurement readiness:', {
                    requiredCount: requiredKeys.size,
                    missingCount: missingKeys.size,
                    sampleMissing: Array.from(missingKeys).slice(0, 5),
                });
            }

            // Initialize column cache for measure-first flow
            const columnCache = COLUMN_CACHE_ENABLED
                ? updateColumnCache(
                    base.columnMeasurementCache,
                    [], // No new measurements yet
                    base.homeRegions,
                    requiredKeys,
                    regionKey,
                    base.measurements // Pass current measurements
                )
                : new Map<string, ColumnMeasurementState>();

            return {
                ...base,
                buckets: new Map(), // Empty - don't build yet!
                measurementEntries,
                waitingForInitialMeasurements: true,
                allComponentsMeasured: false,
                requiredMeasurementKeys: requiredKeys,
                missingMeasurementKeys: missingKeys,
                columnMeasurementCache: columnCache,
                isLayoutDirty: false, // Don't trigger pagination yet
                measurementStatus: 'measuring' as import('./types').MeasurementStatus,
            };
        }

        // We have measurements - proceed with normal bucket building
        const { buckets, measurementEntries } = buildCanvasEntries({
            instances: base.components,
            template: base.template,
            columnCount: base.columnCount,
            pageWidthPx: base.pageWidthPx,
            dataSources: base.dataSources,
            measurements: base.measurements,
            assignedRegions: base.assignedRegions,
            adapters: base.adapters,
        });

        const requiredKeys = computeRequiredMeasurementKeys(measurementEntries);
        const missingKeys = computeMissingMeasurementKeys(requiredKeys, base.measurements);
        const allMeasured = checkAllComponentsMeasured(base.components, base.measurements);

        if (shouldLogMeasureFirst() && missingKeys.size > 0) {
            console.log('[measure-first] Waiting for remaining measurements:', {
                missingCount: missingKeys.size,
                sampleMissing: Array.from(missingKeys).slice(0, 5),
            });
        }

        // Update column cache when entries are recomputed
        const columnCache = COLUMN_CACHE_ENABLED
            ? updateColumnCache(
                base.columnMeasurementCache,
                [], // Use current measurements from state
                base.homeRegions,
                requiredKeys,
                regionKey,
                base.measurements // Pass current measurements
            )
            : new Map<string, ColumnMeasurementState>();

        return {
            ...base,
            buckets,
            measurementEntries,
            waitingForInitialMeasurements: false,
            allComponentsMeasured: allMeasured,
            requiredMeasurementKeys: requiredKeys,
            missingMeasurementKeys: missingKeys,
            columnMeasurementCache: columnCache,
            measurementStatus: (missingKeys.size === 0 && allMeasured)
                ? ('complete' as import('./types').MeasurementStatus)
                : (base.measurementStatus ?? ('idle' as import('./types').MeasurementStatus)),
        };
    };

    switch (action.type) {
        case 'INITIALIZE':
            logLayoutDirty('INITIALIZE');
            logIsLayoutDirtySet('INITIALIZE', {});
            return recomputeEntries({
                ...state,
                template: action.payload.template,
                pageVariables: action.payload.pageVariables,
                columnCount: action.payload.columnCount,
                regionHeightPx: action.payload.regionHeightPx,
                pageWidthPx: action.payload.pageWidthPx,
                pageHeightPx: action.payload.pageHeightPx,
                baseDimensions: action.payload.baseDimensions,
                adapters: action.payload.adapters,
                layoutPlan: initialPlan,
                pendingLayout: null,
                isLayoutDirty: true,
                assignedRegions: new Map(),
                homeRegions: new Map(),
            });
        case 'SET_COMPONENTS': {
            logLayoutDirty('SET_COMPONENTS', { count: action.payload.instances.length });
            logIsLayoutDirtySet('SET_COMPONENTS', { count: action.payload.instances.length });

            const homeRegions = state.template
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

            return recomputeEntries({
                ...state,
                components: action.payload.instances,
                homeRegions,
                isLayoutDirty: true,
                // Clear all measurement state to force re-measurement
                measurements: new Map(),
                measurementVersion: 0,
                lastMeasurementCompleteVersion: 0,
                columnMeasurementCache: new Map(),
                measurementStatus: 'idle' as import('./types').MeasurementStatus,
            });
        }
        case 'SET_TEMPLATE': {
            logLayoutDirty('SET_TEMPLATE');
            logIsLayoutDirtySet('SET_TEMPLATE', {});

            const homeRegions = state.components.length > 0
                ? computeHomeRegions({
                    instances: state.components,
                    template: action.payload.template,
                    columnCount: state.columnCount,
                    pageWidthPx: state.pageWidthPx,
                })
                : new Map();

            return recomputeEntries({
                ...state,
                template: action.payload.template,
                homeRegions,
                isLayoutDirty: true
            });
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

            return recomputeEntries({
                ...state,
                dataSources: action.payload.dataSources,
                isLayoutDirty: true,
                // Clear all measurement state to force re-measurement
                measurements: new Map(),
                measurementVersion: 0,
                lastMeasurementCompleteVersion: 0,
                columnMeasurementCache: new Map(),
                measurementStatus: 'idle' as import('./types').MeasurementStatus,
            });
        }
        case 'SET_REGISTRY':
            return { ...state, componentRegistry: action.payload.registry };
        case 'SET_PAGE_VARIABLES':
            logLayoutDirty('SET_PAGE_VARIABLES', { measurementVersion: state.measurementVersion });
            logIsLayoutDirtySet('SET_PAGE_VARIABLES', { measurementVersion: state.measurementVersion });
            // Fallback: ensure regionHeightPx has a usable value immediately from baseDimensions
            const incomingBase = action.payload.baseDimensions;
            const incomingHeight = action.payload.regionHeightPx > 0
                ? action.payload.regionHeightPx
                : (incomingBase ? incomingBase.contentHeightPx : 0);
            return recomputeEntries({
                ...state,
                pageVariables: action.payload.pageVariables,
                columnCount: action.payload.columnCount,
                regionHeightPx: incomingHeight || state.regionHeightPx,
                pageWidthPx: action.payload.pageWidthPx,
                pageHeightPx: action.payload.pageHeightPx,
                baseDimensions: action.payload.baseDimensions,
                isLayoutDirty: true,
            });
        case 'SET_REGION_HEIGHT': {
            // Phase 3 simplification: With measurement perfection (Phase 1), we don't need
            // timing-based stability checks. Region height is calculated correctly from the start.
            const incomingHeight = action.payload.regionHeightPx;
            if (incomingHeight <= 0 || Number.isNaN(incomingHeight)) {
                logRegionHeightEvent('set-region-height-invalid', {
                    previousHeight: state.regionHeightPx,
                    incomingHeight,
                });
                return state;
            }

            const nextHeight =
                state.regionHeightPx <= 0 ? incomingHeight : Math.min(state.regionHeightPx, incomingHeight);
            const heightDiff = Math.abs(state.regionHeightPx - nextHeight);

            // Skip if change is sub-pixel (< 1px)
            if (heightDiff < 1) {
                logRegionHeightEvent('set-region-height-skipped', {
                    previousHeight: state.regionHeightPx,
                    incomingHeight,
                    heightDiff,
                });
                return state;
            }

            // Trigger pagination immediately when height changes significantly
            // (No longer waiting for timing-based stability)
            const shouldTriggerPagination = heightDiff >= 1;

            logLayoutDirty('SET_REGION_HEIGHT', {
                oldHeight: state.regionHeightPx,
                newHeight: nextHeight,
                incomingHeight,
                diff: heightDiff,
                shouldTriggerPagination,
            });

            if (process.env.NODE_ENV !== 'production') {
                // eslint-disable-next-line no-console
                console.log('[CanvasLayout] Region height updated', {
                    previousHeight: state.regionHeightPx,
                    incomingHeight,
                    nextHeight,
                    diff: Number(heightDiff.toFixed(2)),
                });
            }

            // Don't trigger pagination if there's already a pending layout
            const canTriggerPagination = shouldTriggerPagination && !state.pendingLayout;

            logRegionHeightEvent('set-region-height-applied', {
                previousHeight: state.regionHeightPx,
                nextHeight,
                incomingHeight,
                heightDiff,
                shouldTriggerPagination,
                canTriggerPagination,
                pendingLayoutExists: Boolean(state.pendingLayout),
            });

            if (shouldTriggerPagination) {
                logIsLayoutDirtySet('SET_REGION_HEIGHT', {
                    previousHeight: state.regionHeightPx,
                    nextHeight,
                    pendingLayoutExists: Boolean(state.pendingLayout),
                    willTrigger: canTriggerPagination,
                });
            }
            return {
                ...state,
                regionHeightPx: nextHeight,
                isLayoutDirty: canTriggerPagination,
            };
        }
        case 'MEASUREMENTS_UPDATED': {
            // In publish-once mode for this spike branch, we ignore mid-stream pagination triggers.
            const measurements = new Map(state.measurements);
            let didChange = false;
            let hasAdditions = false;
            const EPSILON = 0.25; // Ignore sub-pixel fluctuations

            action.payload.measurements.forEach(({ key, height, measuredAt }) => {
                const previous = state.measurements.get(key);

                // Negative height is treated as explicit deletion (zero is valid metadata height)
                if (height < 0) {
                    if (measurements.has(key)) {
                        measurements.delete(key);
                        didChange = true;
                    }
                    return;
                }

                if (!previous || Math.abs(previous.height - height) > EPSILON) {
                    measurements.set(key, { key, height, measuredAt });
                    didChange = true;
                    hasAdditions = true;
                }
            });

            if (!didChange) {
                return state;
            }

            const nextVersion = state.measurementVersion + 1;

            const requiredKeys = state.requiredMeasurementKeys;
            const missingKeys = computeMissingMeasurementKeys(requiredKeys, measurements);

            // Check if we now have ALL component block measurements
            const allMeasured = checkAllComponentsMeasured(state.components, measurements);
            const wasWaitingForMeasurements = state.waitingForInitialMeasurements;
            const nowComplete = wasWaitingForMeasurements && allMeasured;

            logLayoutDirty('MEASUREMENTS_UPDATED', {
                measurementVersion: nextVersion,
                allComponentsMeasured: allMeasured,
                missingMeasurementCount: missingKeys.size,
            });

            // Update column measurement cache
            const columnCacheEnabled = COLUMN_CACHE_ENABLED;
            const updatedCache = columnCacheEnabled
                ? updateColumnCache(
                    state.columnMeasurementCache,
                    action.payload.measurements,
                    state.homeRegions,
                    requiredKeys,
                    regionKey,
                    measurements // Pass current measurements map
                )
                : new Map<string, ColumnMeasurementState>();

            // Check if any columns meet threshold for pagination
            const readyColumns = columnCacheEnabled
                ? getReadyColumns(
                    updatedCache,
                    MEASUREMENT_STABILITY_THRESHOLD_MS,
                    measurements
                )
                : new Set<string>();

            // Always log column cache state for visibility (even without debug flag)
            if (process.env.NODE_ENV !== 'production') {
                if (!columnCacheEnabled) {
                    logColumnCacheDisabledOnce();
                } else if (updatedCache.size > 0) {
                    const cacheSummary = Array.from(updatedCache.entries()).map(([key, cacheState]) => ({
                        columnKey: key,
                        requiredCount: cacheState.requiredKeys.size,
                        measuredCount: cacheState.measuredKeys.size,
                        ready: readyColumns.has(key),
                    }));
                    // eslint-disable-next-line no-console
                    console.log('[ColumnCache] State updated:', {
                        readyColumns: Array.from(readyColumns),
                        cacheSummary,
                    });
                } else {
                    // eslint-disable-next-line no-console
                    console.log('[ColumnCache] Cache empty:', {
                        requiredKeysCount: requiredKeys.size,
                        homeRegionsCount: state.homeRegions.size,
                        measurementsCount: measurements.size,
                        reason: requiredKeys.size === 0 ? 'no-required-keys'
                            : state.homeRegions.size === 0 ? 'no-home-regions'
                                : 'unknown',
                    });
                }
            }

            // Update state with new measurements first
            // CRITICAL: If MEASUREMENT_COMPLETE already fired (measurementStatus === 'complete'),
            // don't overwrite waitingForInitialMeasurements or measurementStatus - pagination is in progress
            const measurementCompleteAlreadyFired = state.measurementStatus === 'complete';
            if (process.env.NODE_ENV !== 'production' && measurementCompleteAlreadyFired) {
                // eslint-disable-next-line no-console
                console.log('🛡️ [MEASUREMENTS_UPDATED] Preserving complete state (pagination in progress)', {
                    previousStatus: state.measurementStatus,
                    previousWaitingForInitialMeasurements: state.waitingForInitialMeasurements,
                    previousIsLayoutDirty: state.isLayoutDirty,
                    allMeasured,
                    missingKeysCount: missingKeys.size,
                });
            }
            const updatedState = {
                ...state,
                measurements,
                measurementVersion: nextVersion,
                allComponentsMeasured: measurementCompleteAlreadyFired ? state.allComponentsMeasured : allMeasured,
                // Once MEASUREMENT_COMPLETE fires, keep waiting=false
                waitingForInitialMeasurements: measurementCompleteAlreadyFired
                    ? false
                    : (wasWaitingForMeasurements && !allMeasured),
                missingMeasurementKeys: measurementCompleteAlreadyFired ? state.missingMeasurementKeys : missingKeys,
                columnMeasurementCache: updatedCache,
                measurementStatus: measurementCompleteAlreadyFired
                    ? 'complete' as import('./types').MeasurementStatus
                    : ((missingKeys.size === 0 && allMeasured)
                        ? ('complete' as import('./types').MeasurementStatus)
                        : ('measuring' as import('./types').MeasurementStatus)),
            };

            // Rebuild entries only when we are fully complete
            const isTransitioningFromWaiting = wasWaitingForMeasurements && !updatedState.waitingForInitialMeasurements;
            const shouldRebuild = (missingKeys.size === 0 && allMeasured) || isTransitioningFromWaiting;

            if (shouldRebuild) {
                const recomputed = recomputeEntries({
                    ...updatedState,
                    assignedRegions: state.assignedRegions,
                });

                // CRITICAL: Preserve existing measurementEntries to prevent remounting MeasurementLayer
                // recomputeEntries rebuilds measurementEntries, but they don't change after initial measurement
                // Remounting causes infinite measurement loop: measure -> detach -> remount -> measure...
                // Check if this rebuild is happening because measurements just completed
                const isCompletingMeasurements = (missingKeys.size === 0 && allMeasured) && state.measurementStatus !== 'complete';
                const preservedMeasurementEntries = isCompletingMeasurements
                    ? state.measurementEntries  // Preserve during completion
                    : recomputed.measurementEntries;  // Use new entries for other rebuilds

                // Disable column cache triggers during measuring; only allow when complete
                const readyColumnsAfterRebuild = (updatedState.measurementStatus === 'complete' && columnCacheEnabled)
                    ? getReadyColumns(
                        recomputed.columnMeasurementCache,
                        MEASUREMENT_STABILITY_THRESHOLD_MS,
                        measurements
                    )
                    : new Set<string>();

                // CRITICAL: Column cache optimization reduces pagination runs
                // Trigger pagination only when complete or cache-ready post-complete
                let shouldTriggerPagination =
                    updatedState.measurementStatus === 'complete' &&
                    (readyColumnsAfterRebuild.size > 0 || nowComplete || isTransitioningFromWaiting);

                // Ensure we have a valid regionHeight before attempting to paginate
                let nextRegionHeightPx = recomputed.regionHeightPx;
                if (shouldTriggerPagination && nextRegionHeightPx <= 0 && recomputed.baseDimensions) {
                    nextRegionHeightPx = recomputed.baseDimensions.contentHeightPx;
                    shouldTriggerPagination = nextRegionHeightPx > 0;
                }

                const triggerReason = (() => {
                    if (updatedState.measurementStatus !== 'complete') return 'measuring';
                    if (nowComplete) return 'initial-measurements-complete';
                    if (isTransitioningFromWaiting) return 'initial-render';
                    if (readyColumnsAfterRebuild.size > 0) return 'columns-ready';
                    return 'waiting-for-columns';
                })();

                // Always log pagination trigger decision when cache is active (even without debug flag)
                if (columnCacheEnabled && process.env.NODE_ENV !== 'production') {
                    // eslint-disable-next-line no-console
                    console.log('[ColumnCache] Pagination trigger decision:', {
                        shouldTrigger: shouldTriggerPagination,
                        readyColumns: Array.from(readyColumnsAfterRebuild),
                        nowComplete,
                        isInitialRender: isTransitioningFromWaiting,
                        wasWaitingForMeasurements,
                        cacheSize: recomputed.columnMeasurementCache.size,
                        columnCacheEnabled,
                        reason: shouldTriggerPagination ? triggerReason : 'waiting-for-columns',
                    });
                } else if (!columnCacheEnabled) {
                    logColumnCacheDisabledOnce();
                }

                if (columnCacheEnabled && shouldLogLayoutDirty() && readyColumnsAfterRebuild.size > 0) {
                    console.log('[layout-dirty] Column cache ready columns:', {
                        readyColumns: Array.from(readyColumnsAfterRebuild),
                        totalColumns: recomputed.columnMeasurementCache.size,
                    });
                }

                // Debug logging for column cache state
                if (columnCacheEnabled && shouldLogLayoutDirty() && recomputed.columnMeasurementCache.size > 0) {
                    const cacheDetails = Array.from(recomputed.columnMeasurementCache.entries()).map(([key, state]) => ({
                        columnKey: key,
                        requiredCount: state.requiredKeys.size,
                        measuredCount: state.measuredKeys.size,
                        isStable: state.isStable,
                        timeSinceUpdate: Date.now() - state.lastUpdateTime,
                        ready: readyColumnsAfterRebuild.has(key),
                    }));
                    console.log('[layout-dirty] Column cache state:', {
                        cacheDetails,
                        readyColumns: Array.from(readyColumnsAfterRebuild),
                    });
                }

                // CRITICAL: Don't trigger pagination if there's already a pending layout
                // Wait for current pagination to complete before triggering again
                const canTriggerPagination = shouldTriggerPagination && !state.pendingLayout;

                if (shouldTriggerPagination) {
                    logIsLayoutDirtySet('MEASUREMENTS_UPDATED', {
                        reason: triggerReason,
                        readyColumns: Array.from(readyColumnsAfterRebuild),
                        wasWaitingForMeasurements,
                        pendingLayoutExists: Boolean(state.pendingLayout),
                        willTrigger: canTriggerPagination,
                    });
                }
                return {
                    ...recomputed,
                    measurementEntries: preservedMeasurementEntries,
                    regionHeightPx: nextRegionHeightPx,
                    // CRITICAL: If MEASUREMENT_COMPLETE already fired, preserve isLayoutDirty to allow pagination
                    // Otherwise, use canTriggerPagination
                    isLayoutDirty: measurementCompleteAlreadyFired
                        ? (state.isLayoutDirty || canTriggerPagination)
                        : canTriggerPagination,
                    pendingLayout: null,
                };
            }

            // Measuring but not complete: update measurements only, don't trigger pagination
            // CRITICAL: If MEASUREMENT_COMPLETE already fired, preserve isLayoutDirty to allow pagination
            return {
                ...updatedState,
                isLayoutDirty: measurementCompleteAlreadyFired ? state.isLayoutDirty : false,
                pendingLayout: null,
            };
        }
        case 'REQUEST_REMEASURE': {
            // Delete measurements for specified components and mark status as measuring
            const nextMeasurements = new Map(state.measurements);
            const ids = new Set(action.payload.componentIds);
            Array.from(nextMeasurements.keys()).forEach((key) => {
                const idMatch = key.match(/^(component-\d+):/);
                const compId = idMatch ? idMatch[1] : null;
                if (compId && ids.has(compId)) {
                    nextMeasurements.delete(key);
                }
            });
            // Recompute missing keys with updated map
            const missing = computeMissingMeasurementKeys(state.requiredMeasurementKeys, nextMeasurements);
            return {
                ...state,
                measurements: nextMeasurements,
                measurementStatus: 'measuring' as import('./types').MeasurementStatus,
                waitingForInitialMeasurements: true,
                missingMeasurementKeys: missing,
                isLayoutDirty: false,
            };
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
            return {
                ...state,
                measurementStatus: 'measuring' as import('./types').MeasurementStatus,
                // Don't reset version - keep incrementing
            };
        }
        case 'MEASUREMENT_COMPLETE': {
            const version = action.payload.measurementVersion;
            const alreadyCommitted = state.lastMeasurementCompleteVersion >= version;

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

            const wasSeen = processedMeasurementVersions.has(version);
            if (!wasSeen) {
                processedMeasurementVersions.add(version);
                if (processedMeasurementVersions.size > 10) {
                    const sorted = Array.from(processedMeasurementVersions).sort((a, b) => a - b);
                    const toRemove = sorted.slice(0, sorted.length - 10);
                    toRemove.forEach(v => processedMeasurementVersions.delete(v));
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
            let nextRegionHeightPx = state.regionHeightPx;
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
            const updatedState = {
                ...state,
                measurementStatus: 'complete' as import('./types').MeasurementStatus,
                measurementVersion: action.payload.measurementVersion,
                waitingForInitialMeasurements: false,
                regionHeightPx: nextRegionHeightPx,
                lastMeasurementCompleteVersion: version,
            };

            // DIAGNOSTIC: Log state before recomputeEntries
            if (process.env.NODE_ENV !== 'production') {
                // eslint-disable-next-line no-console
                console.log('🔬 [Layout] MEASUREMENT_COMPLETE: State before recompute', {
                    componentCount: state.components.length,
                    dataSourceCount: state.dataSources.length,
                    measurementCount: state.measurements.size,
                    hasTemplate: !!state.template,
                    componentIds: state.components.slice(0, 5).map(c => c.id),
                });
            }

            // Rebuild entries to ensure buckets are populated
            const recomputed = recomputeEntries({
                ...updatedState,
                assignedRegions: state.assignedRegions,
            });
            if (process.env.NODE_ENV !== 'production') {
                const bucketKeys = Array.from(recomputed.buckets.keys());
                const bucketSizes = bucketKeys.map(key => ({
                    key,
                    entryCount: recomputed.buckets.get(key)?.length ?? 0,
                }));
                // eslint-disable-next-line no-console
                console.log('🧭 [Layout] MEASUREMENT_COMPLETE: Rebuilt buckets', {
                    bucketCount: recomputed.buckets.size,
                    bucketSizes,
                    totalEntries: bucketSizes.reduce((sum, b) => sum + b.entryCount, 0),
                });
            }
            return {
                ...recomputed,
                isLayoutDirty: true, // Trigger a layout recalculation
            };
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
                return { ...state, isLayoutDirty: false };
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
                return { ...state, isLayoutDirty: false };
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

            const requestedPageCount = state.pageVariables.pagination?.pageCount ?? 1;
            const baseDimensions = state.baseDimensions
                ? {
                    contentHeightPx: state.baseDimensions.contentHeightPx,
                    topMarginPx: state.baseDimensions.topMarginPx,
                }
                : null;

            // Debug: Log bucket state before pagination
            if (process.env.NODE_ENV !== 'production') {
                const bucketKeys = Array.from(state.buckets.keys());
                const bucketSizes = bucketKeys.map(key => ({
                    key,
                    entryCount: state.buckets.get(key)?.length ?? 0,
                }));
                // eslint-disable-next-line no-console
                console.log('[RECALCULATE_LAYOUT] Paginating with buckets:', {
                    bucketCount: state.buckets.size,
                    bucketSizes,
                    totalEntries: bucketSizes.reduce((sum, b) => sum + b.entryCount, 0),
                    columnCount: state.columnCount,
                    regionHeightPx: state.regionHeightPx,
                });
            }

            const pendingLayout = paginate({
                buckets: state.buckets,
                columnCount: state.columnCount,
                regionHeightPx: state.regionHeightPx,
                requestedPageCount,
                baseDimensions,
                measurementVersion: state.measurementVersion,
                measurements: state.measurements,
                adapters: state.adapters,
                segmentRerouteCache: state.segmentRerouteCache,
                previousPlan: state.layoutPlan,
            });

            // Debug: Log pagination result
            if (process.env.NODE_ENV !== 'production') {
                const page1Col1Entries = pendingLayout.pages[0]?.columns[0]?.entries.length ?? 0;
                const page1Col2Entries = pendingLayout.pages[0]?.columns[1]?.entries.length ?? 0;
                // eslint-disable-next-line no-console
                console.log('[RECALCULATE_LAYOUT] Pagination result:', {
                    pageCount: pendingLayout.pages.length,
                    page1Col1Entries,
                    page1Col2Entries,
                    totalEntries: pendingLayout.pages.reduce((sum, p) =>
                        sum + p.columns.reduce((colSum, col) => colSum + col.entries.length, 0), 0),
                });
            }

            // Clear dirty flag immediately to prevent double pagination from effect re-firing
            return { ...state, pendingLayout, isLayoutDirty: false };
        }
        case 'COMMIT_LAYOUT': {
            const committedPlan = state.pendingLayout ?? state.layoutPlan;
            const assignedRegions = new Map<string, SlotAssignment>();

            if (committedPlan) {
                if (process.env.NODE_ENV !== 'production') {
                    const previousPlan = state.layoutPlan;
                    const previousPageCount = previousPlan?.pages.length ?? 0;
                    const nextPageCount = committedPlan.pages.length;
                    const pendingPages = state.pendingLayout?.pages.length ?? null;

                    // Debug: Log plan commit details (gated behind plan-commit flag)
                    if (shouldLogPlanCommit()) {
                        // Debug: Log all entries in first page, first column to see what's actually there
                        const page1Col1Entries = committedPlan.pages[0]?.columns[0]?.entries ?? [];
                        const page1Col2Entries = committedPlan.pages[0]?.columns[1]?.entries ?? [];
                        const page2Col1Entries = committedPlan.pages[1]?.columns[0]?.entries ?? [];
                        const page2Col2Entries = committedPlan.pages[1]?.columns[1]?.entries ?? [];

                        // Find component-05 entry in committed plan for debugging
                        // Check both formats: 'component-05' and 'component-5'
                        const findComponent05 = (entries: CanvasLayoutEntry[]) =>
                            entries.find((e) => e.instance.id === 'component-05' || e.instance.id === 'component-5');

                        const component05Entry = findComponent05(page1Col1Entries)
                            ?? findComponent05(page1Col2Entries)
                            ?? findComponent05(page2Col1Entries)
                            ?? findComponent05(page2Col2Entries)
                            ?? committedPlan.pages.flatMap((p) =>
                                p.columns.flatMap((col) => col.entries)
                            ).find((e) => e.instance.id === 'component-05' || e.instance.id === 'component-5');

                        // Expand entry IDs to show full details
                        const expandEntryDetails = (entries: CanvasLayoutEntry[]) => entries.map(e => ({
                            id: e.instance.id,
                            spanTop: e.span?.top,
                            spanBottom: e.span?.bottom,
                            region: e.region,
                        }));

                        // eslint-disable-next-line no-console
                        console.log('[CanvasLayout] Committed plan', {
                            previousPageCount,
                            nextPageCount,
                            pendingPages,
                            runId: (committedPlan as any).runId ?? 'unknown',
                            component05: component05Entry ? {
                                spanTop: component05Entry.span?.top,
                                spanBottom: component05Entry.span?.bottom,
                                region: component05Entry.region,
                                page: component05Entry.region?.page,
                                column: component05Entry.region?.column,
                            } : 'not found',
                            page1Col1Entries: expandEntryDetails(page1Col1Entries),
                            page1Col2Entries: expandEntryDetails(page1Col2Entries),
                            page2Col1Entries: expandEntryDetails(page2Col1Entries),
                            page2Col2Entries: expandEntryDetails(page2Col2Entries),
                            allComponent05Entries: committedPlan.pages.flatMap((p) =>
                                p.columns.flatMap((col) =>
                                    col.entries.filter((e) => e.instance.id === 'component-05' || e.instance.id === 'component-5').map((e) => ({
                                        id: e.instance.id,
                                        page: p.pageNumber,
                                        column: col.columnNumber,
                                        spanTop: e.span?.top,
                                        spanBottom: e.span?.bottom,
                                    }))
                                )
                            ),
                            totalEntriesAcrossAllPages: committedPlan.pages.reduce((sum, p) =>
                                sum + p.columns.reduce((colSum, col) => colSum + col.entries.length, 0), 0
                            ),
                        });
                    }

                    const hasPendingPlan = Boolean(state.pendingLayout);
                    const didPageCountDecrease = previousPageCount > nextPageCount;
                    const shouldLogSummary = didPageCountDecrease || isDebugEnabled('layout-plan-diff');

                    if (hasPendingPlan && previousPlan && shouldLogSummary) {
                        const previousSummary = summarizePlanForDebug(previousPlan);
                        const nextSummary = summarizePlanForDebug(committedPlan);
                        // eslint-disable-next-line no-console
                        console.log('[CanvasLayout] Plan diff detail', {
                            previous: previousSummary,
                            next: nextSummary,
                        });
                    }
                }
                committedPlan.pages.forEach((page) => {
                    page.columns.forEach((column) => {
                        column.entries.forEach((entry) => {
                            const homeRegionRecord = state.homeRegions.get(entry.instance.id);
                            upsertRegionAssignment(
                                assignedRegions,
                                {
                                    region: {
                                        page: page.pageNumber,
                                        column: column.columnNumber,
                                    },
                                    // Use immutable home region from homeRegions map
                                    homeRegion: homeRegionRecord?.homeRegion ?? entry.homeRegion,
                                    slotIndex: entry.slotIndex,
                                    orderIndex: entry.orderIndex,
                                },
                                entry.instance.id
                            );
                        });
                    });
                });
            }

            const newState = {
                ...state,
                layoutPlan: committedPlan ?? state.layoutPlan,
                pendingLayout: null,
                isLayoutDirty: false,
                assignedRegions,
                // homeRegions remains unchanged
            };


            return newState;
        }
        default:
            return state;
    }
};

export const CanvasLayoutProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [state, dispatch] = useReducer(layoutReducer, undefined, createInitialState);

    const value = useMemo(() => state, [state]);

    // Expose debugging APIs in development
    useEffect(() => {
        exposeStateDebugger(state);
        exposePaginationDiagnostics(); // window.__CANVAS_PAGINATION__
    }, [state]);

    return (
        <CanvasLayoutDispatchContext.Provider value={dispatch} >
            <CanvasLayoutStateContext.Provider value={value}>
                {children}
            </CanvasLayoutStateContext.Provider>
        </CanvasLayoutDispatchContext.Provider>
    );
};

export const useCanvasLayoutState = () => {
    const context = useContext(CanvasLayoutStateContext);
    if (!context) {
        throw new Error('useCanvasLayoutState must be used within a CanvasLayoutProvider');
    }
    return context;
};

export const useCanvasLayoutDispatch = () => {
    const context = useContext(CanvasLayoutDispatchContext);
    if (!context) {
        throw new Error('useCanvasLayoutDispatch must be used within a CanvasLayoutProvider');
    }
    return context;
};

export const useCanvasLayoutActions = () => {
    const dispatch = useCanvasLayoutDispatch();

    const initialize = useCallback(
        (
            template: TemplateConfig,
            pageVariables: PageVariables,
            instances: ComponentInstance[],
            dataSources: ComponentDataSource[],
            registry: Record<string, ComponentRegistryEntry>,
            adapters: import('../types/adapters.types').CanvasAdapters
        ) => {
            const baseDimensions = computeBasePageDimensions(pageVariables);
            const columnCount = pageVariables.columns.columnCount;

            dispatch({
                type: 'INITIALIZE',
                payload: {
                    template,
                    pageVariables,
                    columnCount,
                    regionHeightPx: baseDimensions.contentHeightPx,
                    pageWidthPx: baseDimensions.widthPx,
                    pageHeightPx: baseDimensions.heightPx,
                    baseDimensions,
                    adapters,
                },
            });

            dispatch({ type: 'SET_COMPONENTS', payload: { instances } });
            dispatch({ type: 'SET_DATA_SOURCES', payload: { dataSources } });
            dispatch({ type: 'SET_REGISTRY', payload: { registry } });
        },
        [dispatch]
    );

    const setPageVariables = useCallback(
        (pageVariables: PageVariables) => {
            const baseDimensions = computeBasePageDimensions(pageVariables);
            const columnCount = pageVariables.columns.columnCount;

            dispatch({
                type: 'SET_PAGE_VARIABLES',
                payload: {
                    pageVariables,
                    columnCount,
                    regionHeightPx: baseDimensions.contentHeightPx,
                    pageWidthPx: baseDimensions.widthPx,
                    pageHeightPx: baseDimensions.heightPx,
                    baseDimensions,
                },
            });
        },
        [dispatch]
    );

    const setTemplate = useCallback(
        (template: TemplateConfig) => {
            dispatch({ type: 'SET_TEMPLATE', payload: { template } });
        },
        [dispatch]
    );

    const setComponents = useCallback(
        (instances: ComponentInstance[]) => {
            dispatch({ type: 'SET_COMPONENTS', payload: { instances } });
        },
        [dispatch]
    );

    const setDataSources = useCallback(
        (dataSources: ComponentDataSource[]) => {
            dispatch({ type: 'SET_DATA_SOURCES', payload: { dataSources } });
        },
        [dispatch]
    );

    const setRegistry = useCallback(
        (registry: Record<string, ComponentRegistryEntry>) => {
            dispatch({ type: 'SET_REGISTRY', payload: { registry } });
        },
        [dispatch]
    );

    const updateMeasurements = useCallback(
        (updates: MeasurementRecord[]) => {
            dispatch({ type: 'MEASUREMENTS_UPDATED', payload: { measurements: updates } });
        },
        [dispatch]
    );

    const recalculateLayout = useCallback(() => {
        dispatch({ type: 'RECALCULATE_LAYOUT' });
    }, [dispatch]);

    const commitLayout = useCallback(() => {
        dispatch({ type: 'COMMIT_LAYOUT' });
    }, [dispatch]);

    const measurementStart = useCallback(() => {
        dispatch({ type: 'MEASUREMENT_START' });
    }, [dispatch]);

    const measurementComplete = useCallback(
        (measurementVersion: number) => {
            dispatch({ type: 'MEASUREMENT_COMPLETE', payload: { measurementVersion } });
        },
        [dispatch]
    );

    const setRegionHeight = useCallback((regionHeightPx: number) => {
        dispatch({ type: 'SET_REGION_HEIGHT', payload: { regionHeightPx } });
    }, [dispatch]);

    const requestRemeasureByComponent = useCallback((componentIds: string[]) => {
        dispatch({ type: 'REQUEST_REMEASURE', payload: { componentIds } });
    }, [dispatch]);

    return {
        initialize,
        setPageVariables,
        setTemplate,
        setComponents,
        setDataSources,
        setRegistry,
        updateMeasurements,
        measurementComplete,
        recalculateLayout,
        commitLayout,
        setRegionHeight,
        requestRemeasureByComponent,
    };
};


