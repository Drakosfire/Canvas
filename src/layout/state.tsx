import React, { createContext, useCallback, useContext, useMemo, useReducer } from 'react';

import type {
    ComponentDataSource,
    ComponentInstance,
    ComponentRegistryEntry,
    PageVariables,
    TemplateConfig,
} from '../types/canvas.types';
import type {
    CanvasLayoutState,
    LayoutPlan,
    MeasurementEntry,
    MeasurementKey,
    MeasurementRecord,
    SlotAssignment,
} from './types';
import { paginate } from './paginate';
import {
    buildCanvasEntries,
    buildBuckets,
    computeBasePageDimensions,
    computeHomeRegions,
    createInitialMeasurementEntries,
} from './utils';

const shouldLogLayoutDirty = process.env.NODE_ENV !== 'production';

const logLayoutDirty = (reason: string, context: Record<string, unknown> = {}) => {
    if (!shouldLogLayoutDirty) {
        return;
    }
    // eslint-disable-next-line no-console
    console.debug('[layout-dirty]', reason, context);
};

type CanvasLayoutAction =
    | { type: 'INITIALIZE'; payload: { template: TemplateConfig; pageVariables: PageVariables; columnCount: number; regionHeightPx: number; pageWidthPx: number; pageHeightPx: number; baseDimensions: ReturnType<typeof computeBasePageDimensions> } }
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
    assignedRegions: new Map(),
    homeRegions: new Map(),
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

export const layoutReducer = (state: CanvasLayoutState, action: CanvasLayoutAction): CanvasLayoutState => {
    const recomputeEntries = (base: CanvasLayoutState): CanvasLayoutState => {
        if (!base.template) {
            return {
                ...base,
                buckets: new Map(),
                measurementEntries: [],
                waitingForInitialMeasurements: false,
                allComponentsMeasured: false,
            };
        }

        // If we have no measurements yet AND we have components, start measure-first flow
        const hasNoMeasurements = base.measurements.size === 0;
        const hasComponents = base.components.length > 0;
        const shouldWaitForMeasurements = hasNoMeasurements && hasComponents;

        if (process.env.NODE_ENV !== 'production') {
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
            });

            if (process.env.NODE_ENV !== 'production') {
                console.log('[measure-first] Generated measurement entries:', {
                    totalEntries: measurementEntries.length,
                    componentCount: base.components.length,
                    entryKeys: measurementEntries.map(e => e.measurementKey),
                });
            }

            return {
                ...base,
                buckets: new Map(), // Empty - don't build yet!
                measurementEntries,
                waitingForInitialMeasurements: true,
                allComponentsMeasured: false,
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
        });

        const allMeasured = checkAllComponentsMeasured(base.components, base.measurements);

        return {
            ...base,
            buckets,
            measurementEntries,
            waitingForInitialMeasurements: false,
            allComponentsMeasured: allMeasured,
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
            const heightDiff = Math.abs(state.regionHeightPx - action.payload.regionHeightPx);
            if (heightDiff < 1) {
                return state;
            }
            logLayoutDirty('SET_REGION_HEIGHT', {
                oldHeight: state.regionHeightPx,
                newHeight: action.payload.regionHeightPx,
                diff: heightDiff
            });
            return {
                ...state,
                regionHeightPx: action.payload.regionHeightPx,
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

            // Check if we now have ALL component measurements
            const allMeasured = checkAllComponentsMeasured(state.components, measurements);
            const wasWaiting = state.waitingForInitialMeasurements;
            const nowComplete = wasWaiting && allMeasured;

            logLayoutDirty('MEASUREMENTS_UPDATED', {
                measurementVersion: nextVersion,
                allComponentsMeasured: allMeasured,
            });

            // Update state with new measurements first
            const updatedState = {
                ...state,
                measurements,
                measurementVersion: nextVersion,
                allComponentsMeasured: allMeasured,
                waitingForInitialMeasurements: wasWaiting && !allMeasured,
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
            });
            // Clear dirty flag immediately to prevent double pagination from effect re-firing
            return { ...state, pendingLayout, isLayoutDirty: false };
        }
        case 'COMMIT_LAYOUT': {
            const committedPlan = state.pendingLayout ?? state.layoutPlan;
            const assignedRegions = new Map<string, SlotAssignment>();

            if (committedPlan) {
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
            registry: Record<string, ComponentRegistryEntry>
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


