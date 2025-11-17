import { useMemo, useRef, useEffect, useLayoutEffect, useCallback } from 'react';

import type {
    ComponentDataSource,
    ComponentInstance,
    ComponentRegistryEntry,
    PageVariables,
    TemplateConfig,
} from '../types/canvas.types';
import type { CanvasAdapters } from '../types/adapters.types';
import type { MeasurementEntry } from '../layout/types';
import { MeasurementLayer } from '../layout/measurement';
import { useCanvasLayoutActions, useCanvasLayoutState } from '../layout/state';
import { computeBasePageDimensions } from '../layout/utils';

interface UseCanvasLayoutArgs {
    componentInstances: ComponentInstance[];
    template: TemplateConfig;
    dataSources: ComponentDataSource[];
    componentRegistry: Record<string, ComponentRegistryEntry>;
    pageVariables: PageVariables;
    adapters: CanvasAdapters;
}

export const useCanvasLayout = ({
    componentInstances,
    template,
    dataSources,
    componentRegistry,
    pageVariables,
    adapters,
}: UseCanvasLayoutArgs) => {
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
            });
        }

        initialize(template, pageVariables, componentInstances, dataSources, componentRegistry, adapters);
        prevTemplateRef.current = template;
        prevComponentIdsRef.current = memoizedComponents;
        prevDataSourceIdsRef.current = memoizedDataSources;
        prevRegistryKeysRef.current = memoizedRegistryKeys;
        prevPageVariablesRef.current = pageVariables;
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
        if (previous && JSON.stringify(previous) === JSON.stringify(pageVariables)) {
            return;
        }
        // (Debug logging removed to reduce console noise)
        prevPageVariablesRef.current = pageVariables;
        setPageVariables(pageVariables);
    }, [setPageVariables, pageVariables]);

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
    const baseDimensions = state.baseDimensions ?? computeBasePageDimensions(pageVariables);

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
    };
};



