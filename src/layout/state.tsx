import React, { createContext, useCallback, useContext, useMemo, useReducer } from 'react';

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
} from './utils';
import { isDebugEnabled } from './debugFlags';

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

const logLayoutDirty = (reason: string, context: Record<string, unknown> = {}) => {
    if (!shouldLogLayoutDirty()) {
        return;
    }
    // eslint-disable-next-line no-console
    console.debug('[layout-dirty]', reason, context);
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
    | { type: 'MEASUREMENTS_UPDATED'; payload: { measurements: MeasurementRecord[] } }
    | { type: 'RECALCULATE_LAYOUT' }
    | { type: 'COMMIT_LAYOUT' };

const CanvasLayoutStateContext = createContext<CanvasLayoutState | undefined>(undefined);
const CanvasLayoutDispatchContext = createContext<React.Dispatch<CanvasLayoutAction> | undefined>(undefined);

const initialPlan: LayoutPlan = { pages: [], overflowWarnings: [] };

export const createInitialState = (): CanvasLayoutState => ({
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
});

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
    for (const component of components) {
        const blockKey = `${component.id}:block`;
        if (!measurements.has(blockKey)) {
            // We need at least the block measurement for every component
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

            return {
                ...base,
                buckets: new Map(), // Empty - don't build yet!
                measurementEntries,
                waitingForInitialMeasurements: true,
                allComponentsMeasured: false,
                requiredMeasurementKeys: requiredKeys,
                missingMeasurementKeys: missingKeys,
                isLayoutDirty: false, // Don't trigger pagination yet
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

        return {
            ...base,
            buckets,
            measurementEntries,
            waitingForInitialMeasurements: false,
            allComponentsMeasured: allMeasured,
            requiredMeasurementKeys: requiredKeys,
            missingMeasurementKeys: missingKeys,
        };
    };

    switch (action.type) {
        case 'INITIALIZE':
            logLayoutDirty('INITIALIZE');
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

            const homeRegions = state.template
                ? computeHomeRegions({
                    instances: action.payload.instances,
                    template: state.template,
                    columnCount: state.columnCount,
                    pageWidthPx: state.pageWidthPx,
                })
                : new Map();

            return recomputeEntries({
                ...state,
                components: action.payload.instances,
                homeRegions,
                isLayoutDirty: true
            });
        }
        case 'SET_TEMPLATE': {
            logLayoutDirty('SET_TEMPLATE');

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
        case 'SET_DATA_SOURCES':
            logLayoutDirty('SET_DATA_SOURCES', { count: action.payload.dataSources.length });
            return recomputeEntries({ ...state, dataSources: action.payload.dataSources, isLayoutDirty: true });
        case 'SET_REGISTRY':
            return { ...state, componentRegistry: action.payload.registry };
        case 'SET_PAGE_VARIABLES':
            logLayoutDirty('SET_PAGE_VARIABLES', { measurementVersion: state.measurementVersion });
            return recomputeEntries({
                ...state,
                pageVariables: action.payload.pageVariables,
                columnCount: action.payload.columnCount,
                regionHeightPx: action.payload.regionHeightPx,
                pageWidthPx: action.payload.pageWidthPx,
                pageHeightPx: action.payload.pageHeightPx,
                baseDimensions: action.payload.baseDimensions,
                isLayoutDirty: true,
            });
        case 'SET_REGION_HEIGHT': {
            const incomingHeight = action.payload.regionHeightPx;
            const nextHeight =
                state.regionHeightPx <= 0 ? incomingHeight : Math.min(state.regionHeightPx, incomingHeight);
            const heightDiff = Math.abs(state.regionHeightPx - nextHeight);

            if (heightDiff < 1) {
                if (process.env.NODE_ENV !== 'production' && incomingHeight < state.regionHeightPx) {
                    // eslint-disable-next-line no-console
                    console.log('[CanvasLayout] Region height ignored (diff too small)', {
                        previousHeight: state.regionHeightPx,
                        incomingHeight,
                    });
                }
                return state;
            }

            logLayoutDirty('SET_REGION_HEIGHT', {
                oldHeight: state.regionHeightPx,
                newHeight: nextHeight,
                incomingHeight,
                diff: heightDiff,
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
            return {
                ...state,
                regionHeightPx: nextHeight,
                isLayoutDirty: true,
            };
        }
        case 'MEASUREMENTS_UPDATED': {
            const measurements = new Map(state.measurements);
            let didChange = false;
            let hasAdditions = false;
            const EPSILON = 0.25; // Ignore sub-pixel fluctuations

            action.payload.measurements.forEach(({ key, height, measuredAt }) => {
                const previous = state.measurements.get(key);

                // Height of 0 is treated as explicit deletion
                if (height <= 0) {
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
            const wasWaiting = state.waitingForInitialMeasurements;
            const nowComplete = wasWaiting && allMeasured;

            logLayoutDirty('MEASUREMENTS_UPDATED', {
                measurementVersion: nextVersion,
                allComponentsMeasured: allMeasured,
                missingMeasurementCount: missingKeys.size,
            });

            // Update state with new measurements first
            const updatedState = {
                ...state,
                measurements,
                measurementVersion: nextVersion,
                allComponentsMeasured: allMeasured,
                waitingForInitialMeasurements: wasWaiting && !allMeasured,
                missingMeasurementKeys: missingKeys,
            };

            // If we just completed initial measurements OR have new measurements, rebuild entries
            const shouldRebuild = nowComplete || hasAdditions;

            if (shouldRebuild) {
                const recomputed = recomputeEntries({
                    ...updatedState,
                    assignedRegions: state.assignedRegions,
                });

                return {
                    ...recomputed,
                    isLayoutDirty: true,
                    pendingLayout: null,
                };
            }

            // For deletions only, just update measurements without rebuilding entries
            return {
                ...updatedState,
                isLayoutDirty: true,
                pendingLayout: null,
            };
        }
        case 'RECALCULATE_LAYOUT': {
            // Don't paginate if we're waiting for initial measurements
            if (state.waitingForInitialMeasurements) {
                return state;
            }

            if (!state.template || !state.pageVariables) {
                return state;
            }

            if (state.regionHeightPx <= 0) {
                return state;
            }

            const requestedPageCount = state.pageVariables.pagination?.pageCount ?? 1;
            const baseDimensions = state.baseDimensions
                ? {
                    contentHeightPx: state.baseDimensions.contentHeightPx,
                    topMarginPx: state.baseDimensions.topMarginPx,
                }
                : null;

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
            });
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
                    // eslint-disable-next-line no-console
                    console.log('[CanvasLayout] Committed plan', {
                        previousPageCount,
                        nextPageCount,
                        pendingPages,
                    });

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

            return {
                ...state,
                layoutPlan: committedPlan ?? state.layoutPlan,
                pendingLayout: null,
                isLayoutDirty: false,
                assignedRegions,
                // homeRegions remains unchanged
            };
        }
        default:
            return state;
    }
};

export const CanvasLayoutProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [state, dispatch] = useReducer(layoutReducer, undefined, createInitialState);

    const value = useMemo(() => state, [state]);

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

    const setRegionHeight = useCallback((regionHeightPx: number) => {
        dispatch({ type: 'SET_REGION_HEIGHT', payload: { regionHeightPx } });
    }, [dispatch]);

    return {
        initialize,
        setPageVariables,
        setTemplate,
        setComponents,
        setDataSources,
        setRegistry,
        updateMeasurements,
        recalculateLayout,
        commitLayout,
        setRegionHeight,
    };
};


