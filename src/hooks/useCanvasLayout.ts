import { useMemo, useRef, useEffect, useLayoutEffect, useCallback } from 'react';

import type {
    ComponentDataSource,
    ComponentInstance,
    ComponentRegistryEntry,
    PageVariables,
    TemplateConfig,
    CanvasConfig,
    CanvasDimensions,
} from '../types/canvas.types';
import type { CanvasAdapters } from '../types/adapters.types';
import type { MeasurementEntry } from '../layout/types';
import { MeasurementLayer } from '../layout/measurement';
import { useCanvasLayoutActions, useCanvasLayoutState } from '../layout/state';
import { computeBasePageDimensions, computeCanvasDimensions } from '../layout/utils';

/**
 * Arguments for useCanvasLayout hook.
 * 
 * Phase 5 Architecture: Supports both legacy and new config patterns.
 * - Legacy: Pass pageVariables + initialRegionHeightPx separately
 * - New: Pass config object with pageVariables, frameConfig, and ready signal
 */
interface UseCanvasLayoutArgs {
    componentInstances: ComponentInstance[];
    template: TemplateConfig;
    dataSources: ComponentDataSource[];
    componentRegistry: Record<string, ComponentRegistryEntry>;
    adapters: CanvasAdapters;

    /**
     * NEW (Phase 5): Unified configuration object.
     * When provided, Canvas calculates all dimensions internally.
     * Consumer just provides config, Canvas calculates everything.
     */
    config?: CanvasConfig;

    /**
     * LEGACY: Page variables (use config.pageVariables instead).
     * @deprecated Use config.pageVariables instead
     */
    pageVariables?: PageVariables;

    /**
     * LEGACY: Initial region height (use config.frameConfig instead).
     * @deprecated Use config.frameConfig.verticalBorderPx instead
     */
    initialRegionHeightPx?: number;
}

/**
 * Return type for useCanvasLayout hook.
 */
interface UseCanvasLayoutReturn {
    /** Current layout plan with paginated components */
    plan: import('../layout/types').LayoutPlan | null;
    /** Entries that need measurement */
    measurementEntries: MeasurementEntry[];
    /** Callback to receive measurement updates */
    onMeasurements: (updates: import('../layout/types').MeasurementRecord[]) => void;
    /** Callback when measurement cycle completes */
    onMeasurementComplete: (version: number) => void;
    /** Set region height (LEGACY - prefer using config.frameConfig) */
    setRegionHeight: (height: number) => void;
    /** MeasurementLayer component */
    MeasurementLayer: typeof MeasurementLayer;
    /** Base page dimensions */
    baseDimensions: import('../layout/utils').BasePageDimensions;
    /** Whether a layout update is pending */
    hasPendingLayout: boolean;
    /** Number of pages in pending layout */
    pendingLayoutPageCount: number;
    /** Current measurement status */
    measurementStatus: import('../layout/types').MeasurementStatus | undefined;
    /**
     * NEW (Phase 5): Calculated dimensions.
     * All values derived from config - consumer should NOT calculate these.
     */
    dimensions: CanvasDimensions | null;
    /**
     * NEW (Phase 5): Whether Canvas is ready to measure.
     * True when config.ready is true.
     */
    ready: boolean;
}

export const useCanvasLayout = ({
    componentInstances,
    template,
    dataSources,
    componentRegistry,
    config,
    pageVariables: legacyPageVariables,
    adapters,
    initialRegionHeightPx: legacyInitialRegionHeightPx,
}: UseCanvasLayoutArgs): UseCanvasLayoutReturn => {
    const state = useCanvasLayoutState();
    const {
        initialize,
        setTemplate,
        setComponents,
        setDataSources,
        setRegistry,
        setPageVariables,
        updateMeasurements,
        measurementComplete,
        recalculateLayout,
        commitLayout,
        setRegionHeight,
    } = useCanvasLayoutActions();

    // Phase 5: Support both new config and legacy params
    // New config takes precedence if provided
    const effectivePageVariables = config?.pageVariables ?? legacyPageVariables;
    if (!effectivePageVariables) {
        throw new Error('[useCanvasLayout] Either config.pageVariables or pageVariables must be provided');
    }

    // Calculate dimensions from config (Phase 5)
    // If config is provided, Canvas owns all dimension calculations
    const dimensions = useMemo<CanvasDimensions | null>(() => {
        if (!config) {
            return null; // Legacy mode - consumer calculates dimensions
        }
        return computeCanvasDimensions(config);
    }, [config]);

    // Compute initial region height
    // Phase 5: Use dimensions.regionHeightPx from config
    // Legacy: Use initialRegionHeightPx param
    const effectiveInitialRegionHeightPx = useMemo(() => {
        if (dimensions) {
            return dimensions.regionHeightPx;
        }
        return legacyInitialRegionHeightPx;
    }, [dimensions, legacyInitialRegionHeightPx]);

    // Ready signal from config
    const ready = config?.ready ?? true;

    const prevTemplateRef = useRef<TemplateConfig | null>(null);
    const prevComponentIdsRef = useRef<string[]>([]);
    const prevDataSourceIdsRef = useRef<string[]>([]);
    const prevRegistryKeysRef = useRef<string[]>([]);
    const prevPageVariablesRef = useRef<PageVariables | null>(null);
    const initRef = useRef(false);

    const memoizedComponents = useMemo(
        () => componentInstances.map((instance) => instance.id),
        [componentInstances]
    );
    const memoizedDataSources = useMemo(
        () => dataSources.map((source) => source.id ?? JSON.stringify(source)),
        [dataSources]
    );
    const memoizedRegistryKeys = useMemo(
        () => Object.keys(componentRegistry).sort(),
        [componentRegistry]
    );

    useEffect(() => {
        // Guard against React Strict Mode double-initialization
        if (initRef.current) {
            if (process.env.NODE_ENV !== 'production') {
                // eslint-disable-next-line no-console
                console.debug('[useCanvasLayout] Skipping re-initialization (guard active)');
            }
            return;
        }
        initRef.current = true;

        if (process.env.NODE_ENV !== 'production') {
            // eslint-disable-next-line no-console
            console.debug('[useCanvasLayout] Initializing layout system', {
                componentCount: componentInstances.length,
                dataSourceCount: dataSources.length,
                hasConfig: !!config,
                ready,
            });
        }

        initialize(template, effectivePageVariables, componentInstances, dataSources, componentRegistry, adapters, effectiveInitialRegionHeightPx);
        prevTemplateRef.current = template;
        prevComponentIdsRef.current = memoizedComponents;
        prevDataSourceIdsRef.current = memoizedDataSources;
        prevRegistryKeysRef.current = memoizedRegistryKeys;
        prevPageVariablesRef.current = effectivePageVariables;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (prevTemplateRef.current === template) {
            return;
        }
        if (process.env.NODE_ENV !== 'production') {
            // eslint-disable-next-line no-console
            console.debug('[useCanvasLayout] Template changed, dispatching SET_TEMPLATE');
        }
        prevTemplateRef.current = template;
        setTemplate(template);
    }, [setTemplate, template]);

    useEffect(() => {
        const previous = prevComponentIdsRef.current;
        if (previous.length === memoizedComponents.length && previous.every((id, index) => id === memoizedComponents[index])) {
            return;
        }
        if (process.env.NODE_ENV !== 'production') {
            // eslint-disable-next-line no-console
            console.debug('[useCanvasLayout] Components changed, dispatching SET_COMPONENTS', {
                previousCount: previous.length,
                newCount: memoizedComponents.length,
            });
        }
        prevComponentIdsRef.current = memoizedComponents;
        setComponents(componentInstances);
    }, [setComponents, componentInstances, memoizedComponents]);

    useEffect(() => {
        const previous = prevDataSourceIdsRef.current;
        if (previous.length === memoizedDataSources.length && previous.every((id, index) => id === memoizedDataSources[index])) {
            return;
        }
        if (process.env.NODE_ENV !== 'production') {
            // eslint-disable-next-line no-console
            console.debug('[useCanvasLayout] DataSources changed, dispatching SET_DATA_SOURCES', {
                previousCount: previous.length,
                newCount: memoizedDataSources.length,
            });
        }
        prevDataSourceIdsRef.current = memoizedDataSources;
        setDataSources(dataSources);
    }, [setDataSources, dataSources, memoizedDataSources]);

    useEffect(() => {
        const previous = prevRegistryKeysRef.current;
        if (previous.length === memoizedRegistryKeys.length && previous.every((key, index) => key === memoizedRegistryKeys[index])) {
            return;
        }
        prevRegistryKeysRef.current = memoizedRegistryKeys;
        setRegistry(componentRegistry);
    }, [setRegistry, componentRegistry, memoizedRegistryKeys]);

    useEffect(() => {
        const previous = prevPageVariablesRef.current;
        if (previous && JSON.stringify(previous) === JSON.stringify(effectivePageVariables)) {
            return;
        }
        // (Debug logging removed to reduce console noise)
        prevPageVariablesRef.current = effectivePageVariables;
        setPageVariables(effectivePageVariables);
    }, [setPageVariables, effectivePageVariables]);

    // Track the last measurement version we've triggered pagination for
    // This prevents duplicate pagination runs when measurementStatus changes
    const lastPaginationVersionRef = useRef<number | null>(null);

    // Use useLayoutEffect to ensure we see state updates synchronously
    // This is critical for MEASUREMENT_COMPLETE -> RECALCULATE_LAYOUT flow
    // Use measurementStatus === 'complete' as the trigger instead of isLayoutDirty
    // to avoid React state batching issues
    useLayoutEffect(() => {
        const hasRenderableComponents = state.components.length > 0;
        const hasMeasurementHistory = state.measurementVersion > 0;

        if (!hasRenderableComponents && !hasMeasurementHistory) {
            if (process.env.NODE_ENV !== 'production') {
                // eslint-disable-next-line no-console
                console.log('⏸️ [useCanvasLayout] Skipping pagination - no components or measurements yet', {
                    componentCount: state.components.length,
                    measurementVersion: state.measurementVersion,
                    measurementStatus: state.measurementStatus,
                });
            }
            return;
        }

        if (process.env.NODE_ENV !== 'production') {
            // eslint-disable-next-line no-console
            console.log('🔍 [useCanvasLayout] useLayoutEffect triggered', {
                isLayoutDirty: state.isLayoutDirty,
                measurementStatus: state.measurementStatus,
                measurementVersion: state.measurementVersion,
                waitingForInitialMeasurements: state.waitingForInitialMeasurements,
                hasPendingLayout: !!state.pendingLayout,
                lastPaginationVersion: lastPaginationVersionRef.current,
            });
        }

        // Trigger pagination when measurements are complete and we haven't paginated for this version yet
        // Primary path: measurementStatus === 'complete' (state machine pattern)
        // Fallback path: isLayoutDirty === true (in case measurements complete via different path)
        const shouldTriggerPagination =
            (state.measurementStatus === 'complete' || state.isLayoutDirty) &&
            state.measurementVersion !== lastPaginationVersionRef.current &&
            !state.waitingForInitialMeasurements &&
            !state.pendingLayout;

        if (shouldTriggerPagination) {
            if (process.env.NODE_ENV !== 'production') {
                // eslint-disable-next-line no-console
                console.log('🔄 [useCanvasLayout] Triggering RECALCULATE_LAYOUT', {
                    measurementStatus: state.measurementStatus,
                    isLayoutDirty: state.isLayoutDirty,
                    measurementVersion: state.measurementVersion,
                    trigger: state.measurementStatus === 'complete' ? 'measurementStatus' : 'isLayoutDirty',
                });
            }
            lastPaginationVersionRef.current = state.measurementVersion;
            recalculateLayout();
        }
    }, [
        recalculateLayout,
        state.components.length,
        state.measurementStatus,
        state.isLayoutDirty,
        state.measurementVersion,
        state.waitingForInitialMeasurements,
        state.pendingLayout,
    ]);

    useEffect(() => {
        if (state.pendingLayout) {
            commitLayout();
        }
    }, [commitLayout, state.pendingLayout]);

    // Wrap measurementComplete to trigger pagination directly after MEASUREMENT_COMPLETE processes
    // This bypasses the effect timing issue where new measurements might arrive before the effect runs
    const handleMeasurementComplete = useCallback(
        (measurementVersion: number) => {
            if (process.env.NODE_ENV !== 'production') {
                // eslint-disable-next-line no-console
                console.log('🎯 [useCanvasLayout] measurementComplete callback', {
                    measurementVersion,
                    lastPaginationVersion: lastPaginationVersionRef.current,
                });
            }
            // Dispatch MEASUREMENT_COMPLETE action
            measurementComplete(measurementVersion);
            // Trigger pagination directly after a brief delay to ensure reducer has processed
            // Use setTimeout(0) to let the reducer process first, then trigger pagination
            setTimeout(() => {
                // Check if we haven't already paginated for this version
                if (measurementVersion !== lastPaginationVersionRef.current) {
                    if (process.env.NODE_ENV !== 'production') {
                        // eslint-disable-next-line no-console
                        console.log('🔄 [useCanvasLayout] Direct pagination trigger from measurementComplete', {
                            measurementVersion,
                        });
                    }
                    lastPaginationVersionRef.current = measurementVersion;
                    recalculateLayout();
                }
            }, 0);
        },
        [measurementComplete, recalculateLayout]
    );

    const measurementEntries = state.measurementEntries;
    const baseDimensions = state.baseDimensions ?? computeBasePageDimensions(effectivePageVariables);

    const hasPendingLayout = Boolean(state.pendingLayout);
    const pendingLayoutPageCount = state.pendingLayout?.pages.length ?? 0;

    return {
        plan: state.layoutPlan,
        measurementEntries,
        onMeasurements: updateMeasurements,
        onMeasurementComplete: handleMeasurementComplete,
        setRegionHeight,
        MeasurementLayer,
        baseDimensions,
        hasPendingLayout,
        pendingLayoutPageCount,
        measurementStatus: state.measurementStatus,
        // Phase 5: New returns
        dimensions,
        ready,
    };
};



