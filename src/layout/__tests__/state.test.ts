import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import type { TemplateConfig, PageVariables } from '../../types/canvas.types';
import type { LayoutPlan } from '../types';
import { createInitialState, layoutReducer } from '../state';
import { createDefaultAdapters } from '../../types/adapters.types';
import * as utils from '../utils';
import * as paginateModule from '../paginate';
jest.mock('../utils', () => ({
    buildCanvasEntries: jest.fn(() => ({
        buckets: new Map<string, never>(),
        measurementEntries: [],
    })),
    computeHomeRegions: jest.fn(() => new Map()),
    createInitialMeasurementEntries: jest.fn(() => []),
}));

jest.mock('../paginate', () => ({
    paginate: jest.fn(() => ({ pages: [], overflowWarnings: [] })),
}));

const template: TemplateConfig = {
    id: 'tmpl',
    name: 'Test Template',
    defaultMode: 'locked',
    defaultPageVariables: {
        dimensions: { width: 210, height: 297, unit: 'mm' },
        background: { type: 'parchment' },
        columns: { enabled: true, columnCount: 2, gutter: 12, unit: 'mm' },
        pagination: { pageCount: 1, columnCount: 2 },
        snap: { enabled: true, gridSize: 5, gridUnit: 'mm', snapToSlots: true, snapToEdges: true },
    },
    slots: [],
    defaultComponents: [],
    allowedComponents: [],
};

const pageVariables: PageVariables = {
    mode: 'locked',
    templateId: 'tmpl',
    dimensions: { width: 210, height: 297, unit: 'mm' },
    background: { type: 'parchment' },
    columns: { enabled: true, columnCount: 2, gutter: 12, unit: 'mm' },
    pagination: { pageCount: 1, columnCount: 2 },
    snap: { enabled: true, gridSize: 5, gridUnit: 'mm', snapToSlots: true, snapToEdges: true },
};

const initializeState = () =>
    layoutReducer(createInitialState(), {
        type: 'INITIALIZE',
        payload: {
            template,
            pageVariables,
            columnCount: 2,
            regionHeightPx: 1000,
            pageWidthPx: 800,
            pageHeightPx: 1100,
            baseDimensions: {
                widthPx: 800,
                heightPx: 1100,
                contentHeightPx: 1000,
                topMarginPx: 50,
                bottomMarginPx: 50,
            },
            adapters: createDefaultAdapters(),
        },
    });

const initializeWithRenderableData = () => {
    const base = initializeState();
    const instance = {
        id: 'comp',
        type: 'test-component',
        dataRef: { type: 'statblock' as const, path: 'name' as const },
        layout: {
            isVisible: true,
            slotId: 'slot-1',
            position: { x: 0, y: 0, width: 100, height: 100 },
            location: { page: 1, column: 1 as 1 },
        },
    };
    const dataSource = {
        id: 'statblock',
        type: 'statblock',
        payload: { name: 'Test Creature' },
        updatedAt: new Date().toISOString(),
    };
    const withComponents = layoutReducer(base, {
        type: 'SET_COMPONENTS',
        payload: { instances: [instance] },
    });
    return layoutReducer(withComponents, {
        type: 'SET_DATA_SOURCES',
        payload: { dataSources: [dataSource] },
    });
};

describe('layoutReducer', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('records measurements and marks layout dirty', () => {
        const baseState = initializeWithRenderableData();
        const nextState = layoutReducer(baseState, {
            type: 'MEASUREMENTS_UPDATED',
            payload: {
                measurements: [{ key: 'comp:block', height: 120, measuredAt: 12345 }],
            },
        });

        expect(nextState.measurements.get('comp:block')?.height).toBe(120);
        expect(nextState.measurementVersion).toBe(baseState.measurementVersion + 1);
        expect(nextState.isLayoutDirty).toBe(true);
        const buildCanvasEntries = utils.buildCanvasEntries as jest.Mock;
        expect(buildCanvasEntries).toHaveBeenCalled();
    });

    it('removes explicit deletions', () => {
        const baseState = initializeWithRenderableData();
        const withMeasurement = layoutReducer(baseState, {
            type: 'MEASUREMENTS_UPDATED',
            payload: {
                measurements: [{ key: 'comp:block', height: 120, measuredAt: 12345 }],
            },
        });

        const cleared = layoutReducer(withMeasurement, {
            type: 'MEASUREMENTS_UPDATED',
            payload: {
                measurements: [{ key: 'comp:block', height: -1, measuredAt: 12346 }],
            },
        });

        expect(cleared.measurements.has('comp:block')).toBe(false);
    });

    it('recalculates and commits layout plans', () => {
        const mockPlan: LayoutPlan = {
            pages: [
                {
                    pageNumber: 1,
                    columns: [
                        { columnNumber: 1, key: '1:1', entries: [] },
                        { columnNumber: 2, key: '1:2', entries: [] },
                    ],
                },
            ],
            overflowWarnings: [],
        };
        const paginate = paginateModule.paginate as jest.Mock;
        const buildCanvasEntries = utils.buildCanvasEntries as jest.Mock;
        paginate.mockReturnValue(mockPlan);
        buildCanvasEntries.mockReturnValue({ buckets: new Map([['1:1', []]]), measurementEntries: [] });

        const baseState = initializeState();
        const withLayoutDirty = { ...baseState, isLayoutDirty: true };
        const recalculated = layoutReducer(withLayoutDirty, { type: 'RECALCULATE_LAYOUT' });

        expect(recalculated.pendingLayout).toBe(mockPlan);
        expect(paginate).toHaveBeenCalled();

        const committed = layoutReducer(recalculated, { type: 'COMMIT_LAYOUT' });
        expect(committed.layoutPlan).toBe(mockPlan);
        expect(committed.pendingLayout).toBeNull();
        expect(committed.isLayoutDirty).toBe(false);
    });
});

