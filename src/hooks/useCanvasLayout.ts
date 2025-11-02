import { useMemo, useRef, useEffect } from 'react';

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
    // Marker to prove we're using Canvas package (not local LandingPage/src/canvas/)
    if (process.env.NODE_ENV !== 'production') {
        console.log('📦 [Canvas Package] useCanvasLayout called with adapters:', !!adapters);
    }

    const state = useCanvasLayoutState();
    const {
        initialize,
        setTemplate,
        setComponents,
        setDataSources,
        setRegistry,
        setPageVariables,
        updateMeasurements,
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
        if (process.env.NODE_ENV !== 'production') {
            // eslint-disable-next-line no-console
            console.debug('[useCanvasLayout] PageVariables changed, dispatching SET_PAGE_VARIABLES');
        }
        prevPageVariablesRef.current = pageVariables;
        setPageVariables(pageVariables);
    }, [setPageVariables, pageVariables]);

    useEffect(() => {
        if (!state.isLayoutDirty) return;
        recalculateLayout();
    }, [recalculateLayout, state.isLayoutDirty]);

    useEffect(() => {
        if (state.pendingLayout) {
            commitLayout();
        }
    }, [commitLayout, state.pendingLayout]);

    const measurementEntries = state.measurementEntries;
    const baseDimensions = state.baseDimensions ?? computeBasePageDimensions(pageVariables);

    return {
        plan: state.layoutPlan,
        measurementEntries,
        onMeasurements: updateMeasurements,
        setRegionHeight,
        MeasurementLayer,
        baseDimensions,
    };
};



