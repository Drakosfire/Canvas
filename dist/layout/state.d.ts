import React from 'react';
import type { ComponentDataSource, ComponentInstance, ComponentRegistryEntry, PageVariables, TemplateConfig } from '../types/canvas.types';
import type { CanvasLayoutState, MeasurementRecord } from './types';
import { computeBasePageDimensions } from './utils';
type CanvasLayoutAction = {
    type: 'INITIALIZE';
    payload: {
        template: TemplateConfig;
        pageVariables: PageVariables;
        columnCount: number;
        regionHeightPx: number;
        pageWidthPx: number;
        pageHeightPx: number;
        baseDimensions: ReturnType<typeof computeBasePageDimensions>;
        adapters: import('../types/adapters.types').CanvasAdapters;
    };
} | {
    type: 'SET_COMPONENTS';
    payload: {
        instances: ComponentInstance[];
    };
} | {
    type: 'SET_TEMPLATE';
    payload: {
        template: TemplateConfig;
    };
} | {
    type: 'SET_DATA_SOURCES';
    payload: {
        dataSources: ComponentDataSource[];
    };
} | {
    type: 'SET_REGISTRY';
    payload: {
        registry: Record<string, ComponentRegistryEntry>;
    };
} | {
    type: 'SET_PAGE_VARIABLES';
    payload: {
        pageVariables: PageVariables;
        columnCount: number;
        regionHeightPx: number;
        pageWidthPx: number;
        pageHeightPx: number;
        baseDimensions: ReturnType<typeof computeBasePageDimensions>;
    };
} | {
    type: 'SET_REGION_HEIGHT';
    payload: {
        regionHeightPx: number;
    };
} | {
    type: 'MEASUREMENT_START';
} | {
    type: 'MEASUREMENTS_UPDATED';
    payload: {
        measurements: MeasurementRecord[];
    };
} | {
    type: 'MEASUREMENT_COMPLETE';
    payload: {
        measurementVersion: number;
    };
} | {
    type: 'REQUEST_REMEASURE';
    payload: {
        componentIds: string[];
    };
} | {
    type: 'RECALCULATE_LAYOUT';
} | {
    type: 'COMMIT_LAYOUT';
};
export declare const createInitialState: () => CanvasLayoutState;
export declare const layoutReducer: (state: CanvasLayoutState, action: CanvasLayoutAction) => CanvasLayoutState;
export declare const CanvasLayoutProvider: React.FC<{
    children: React.ReactNode;
}>;
export declare const useCanvasLayoutState: () => CanvasLayoutState;
export declare const useCanvasLayoutDispatch: () => React.Dispatch<CanvasLayoutAction>;
export declare const useCanvasLayoutActions: () => {
    initialize: (template: TemplateConfig, pageVariables: PageVariables, instances: ComponentInstance[], dataSources: ComponentDataSource[], registry: Record<string, ComponentRegistryEntry>, adapters: import('../types/adapters.types').CanvasAdapters, initialRegionHeightPx?: number) => void;
    setPageVariables: (pageVariables: PageVariables) => void;
    setTemplate: (template: TemplateConfig) => void;
    setComponents: (instances: ComponentInstance[]) => void;
    setDataSources: (dataSources: ComponentDataSource[]) => void;
    setRegistry: (registry: Record<string, ComponentRegistryEntry>) => void;
    updateMeasurements: (updates: MeasurementRecord[]) => void;
    measurementComplete: (measurementVersion: number) => void;
    recalculateLayout: () => void;
    commitLayout: () => void;
    setRegionHeight: (regionHeightPx: number) => void;
    requestRemeasureByComponent: (componentIds: string[]) => void;
};
export {};
//# sourceMappingURL=state.d.ts.map