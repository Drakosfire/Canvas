import { useMemo, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { MeasurementLayer } from '../layout/measurement';
import { useCanvasLayoutActions, useCanvasLayoutState } from '../layout/state';
import { computeBasePageDimensions, computeCanvasDimensions } from '../layout/utils';
export var useCanvasLayout = function (_a) {
    var _b, _c, _d, _e, _f;
    var componentInstances = _a.componentInstances, template = _a.template, dataSources = _a.dataSources, componentRegistry = _a.componentRegistry, config = _a.config, legacyPageVariables = _a.pageVariables, adapters = _a.adapters, legacyInitialRegionHeightPx = _a.initialRegionHeightPx;
    var state = useCanvasLayoutState();
    var _g = useCanvasLayoutActions(), initialize = _g.initialize, setTemplate = _g.setTemplate, setComponents = _g.setComponents, setDataSources = _g.setDataSources, setRegistry = _g.setRegistry, setPageVariables = _g.setPageVariables, updateMeasurements = _g.updateMeasurements, measurementComplete = _g.measurementComplete, recalculateLayout = _g.recalculateLayout, commitLayout = _g.commitLayout, setRegionHeight = _g.setRegionHeight;
    // Phase 5: Support both new config and legacy params
    // New config takes precedence if provided
    var effectivePageVariables = (_b = config === null || config === void 0 ? void 0 : config.pageVariables) !== null && _b !== void 0 ? _b : legacyPageVariables;
    if (!effectivePageVariables) {
        throw new Error('[useCanvasLayout] Either config.pageVariables or pageVariables must be provided');
    }
    // Calculate dimensions from config (Phase 5)
    // If config is provided, Canvas owns all dimension calculations
    var dimensions = useMemo(function () {
        if (!config) {
            return null; // Legacy mode - consumer calculates dimensions
        }
        return computeCanvasDimensions(config);
    }, [config]);
    // Compute initial region height
    // Phase 5: Use dimensions.regionHeightPx from config
    // Legacy: Use initialRegionHeightPx param
    var effectiveInitialRegionHeightPx = useMemo(function () {
        if (dimensions) {
            return dimensions.regionHeightPx;
        }
        return legacyInitialRegionHeightPx;
    }, [dimensions, legacyInitialRegionHeightPx]);
    // Ready signal from config
    var ready = (_c = config === null || config === void 0 ? void 0 : config.ready) !== null && _c !== void 0 ? _c : true;
    var prevTemplateRef = useRef(null);
    var prevComponentIdsRef = useRef([]);
    var prevDataSourceIdsRef = useRef([]);
    var prevRegistryKeysRef = useRef([]);
    var prevPageVariablesRef = useRef(null);
    var initRef = useRef(false);
    var memoizedComponents = useMemo(function () { return componentInstances.map(function (instance) { return instance.id; }); }, [componentInstances]);
    var memoizedDataSources = useMemo(function () { return dataSources.map(function (source) { var _a; return (_a = source.id) !== null && _a !== void 0 ? _a : JSON.stringify(source); }); }, [dataSources]);
    var memoizedRegistryKeys = useMemo(function () { return Object.keys(componentRegistry).sort(); }, [componentRegistry]);
    useEffect(function () {
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
                ready: ready,
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
    useEffect(function () {
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
    useEffect(function () {
        var previous = prevComponentIdsRef.current;
        if (previous.length === memoizedComponents.length && previous.every(function (id, index) { return id === memoizedComponents[index]; })) {
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
    useEffect(function () {
        var previous = prevDataSourceIdsRef.current;
        if (previous.length === memoizedDataSources.length && previous.every(function (id, index) { return id === memoizedDataSources[index]; })) {
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
    useEffect(function () {
        var previous = prevRegistryKeysRef.current;
        if (previous.length === memoizedRegistryKeys.length && previous.every(function (key, index) { return key === memoizedRegistryKeys[index]; })) {
            return;
        }
        prevRegistryKeysRef.current = memoizedRegistryKeys;
        setRegistry(componentRegistry);
    }, [setRegistry, componentRegistry, memoizedRegistryKeys]);
    useEffect(function () {
        var previous = prevPageVariablesRef.current;
        if (previous && JSON.stringify(previous) === JSON.stringify(effectivePageVariables)) {
            return;
        }
        // (Debug logging removed to reduce console noise)
        prevPageVariablesRef.current = effectivePageVariables;
        setPageVariables(effectivePageVariables);
    }, [setPageVariables, effectivePageVariables]);
    // Track the last measurement version we've triggered pagination for
    // This prevents duplicate pagination runs when measurementStatus changes
    var lastPaginationVersionRef = useRef(null);
    // Use useLayoutEffect to ensure we see state updates synchronously
    // This is critical for MEASUREMENT_COMPLETE -> RECALCULATE_LAYOUT flow
    // Use measurementStatus === 'complete' as the trigger instead of isLayoutDirty
    // to avoid React state batching issues
    useLayoutEffect(function () {
        var hasRenderableComponents = state.components.length > 0;
        var hasMeasurementHistory = state.measurementVersion > 0;
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
        var shouldTriggerPagination = (state.measurementStatus === 'complete' || state.isLayoutDirty) &&
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
    useEffect(function () {
        if (state.pendingLayout) {
            commitLayout();
        }
    }, [commitLayout, state.pendingLayout]);
    // Wrap measurementComplete to trigger pagination directly after MEASUREMENT_COMPLETE processes
    // This bypasses the effect timing issue where new measurements might arrive before the effect runs
    var handleMeasurementComplete = useCallback(function (measurementVersion) {
        if (process.env.NODE_ENV !== 'production') {
            // eslint-disable-next-line no-console
            console.log('🎯 [useCanvasLayout] measurementComplete callback', {
                measurementVersion: measurementVersion,
                lastPaginationVersion: lastPaginationVersionRef.current,
            });
        }
        // Dispatch MEASUREMENT_COMPLETE action
        measurementComplete(measurementVersion);
        // Trigger pagination directly after a brief delay to ensure reducer has processed
        // Use setTimeout(0) to let the reducer process first, then trigger pagination
        setTimeout(function () {
            // Check if we haven't already paginated for this version
            if (measurementVersion !== lastPaginationVersionRef.current) {
                if (process.env.NODE_ENV !== 'production') {
                    // eslint-disable-next-line no-console
                    console.log('🔄 [useCanvasLayout] Direct pagination trigger from measurementComplete', {
                        measurementVersion: measurementVersion,
                    });
                }
                lastPaginationVersionRef.current = measurementVersion;
                recalculateLayout();
            }
        }, 0);
    }, [measurementComplete, recalculateLayout]);
    var measurementEntries = state.measurementEntries;
    var baseDimensions = (_d = state.baseDimensions) !== null && _d !== void 0 ? _d : computeBasePageDimensions(effectivePageVariables);
    var hasPendingLayout = Boolean(state.pendingLayout);
    var pendingLayoutPageCount = (_f = (_e = state.pendingLayout) === null || _e === void 0 ? void 0 : _e.pages.length) !== null && _f !== void 0 ? _f : 0;
    return {
        plan: state.layoutPlan,
        measurementEntries: measurementEntries,
        onMeasurements: updateMeasurements,
        onMeasurementComplete: handleMeasurementComplete,
        setRegionHeight: setRegionHeight,
        MeasurementLayer: MeasurementLayer,
        baseDimensions: baseDimensions,
        hasPendingLayout: hasPendingLayout,
        pendingLayoutPageCount: pendingLayoutPageCount,
        measurementStatus: state.measurementStatus,
        // Phase 5: New returns
        dimensions: dimensions,
        ready: ready,
    };
};
