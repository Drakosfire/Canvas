import { describe, it, expect } from '@jest/globals';
import type { CanvasLayoutEntry, LayoutPlan } from '../types';
import type { ComponentInstance } from '../../types/canvas.types';
import type { RegionListContent } from '../../types/canvas.types';
import type { CanvasAdapters } from '../../types/adapters.types';
import { createDefaultAdapters } from '../../types/adapters.types';
import { paginate } from '../paginate';
import { COMPONENT_VERTICAL_SPACING_PX } from '../utils';

// Generic mock item type for testing
interface MockItem {
    id: string;
    name: string;
}

const createInstance = (id: string, overrides: Partial<ComponentInstance> = {}): ComponentInstance => ({
    id,
    type: 'test-list',
    dataRef: { type: 'custom', key: 'testData' },
    layout: { isVisible: true },
    ...overrides,
});

const createEntry = (id: string, estimatedHeight: number, overrides: Partial<CanvasLayoutEntry> = {}): CanvasLayoutEntry => ({
    instance: createInstance(id),
    slotIndex: 0,
    orderIndex: 0,
    sourceRegionKey: '1:1',
    region: { page: 1, column: 1 },
    homeRegion: { page: 1, column: 1 },
    homeRegionKey: '1:1',
    estimatedHeight,
    measurementKey: `${id}:block`,
    needsMeasurement: false,
    ...overrides,
});

const createListEntry = (id: string, items: MockItem[], estimatedHeight: number, overrides: Partial<CanvasLayoutEntry> = {}): CanvasLayoutEntry =>
    createEntry(id, estimatedHeight, {
        regionContent: {
            kind: 'test-list',
            items: items as unknown[],
            startIndex: 0,
            totalCount: items.length,
            isContinuation: false,
        } as RegionListContent,
        measurementKey: `${id}:test-list:0:${items.length}:${items.length}`,
        ...overrides,
    });

const createListSegmentEntry = (
    id: string,
    measurementKey: string,
    startIndex: number,
    segmentLength: number,
    totalCount: number,
    estimatedHeight: number,
    overrides: Partial<CanvasLayoutEntry> = {}
): CanvasLayoutEntry =>
    createEntry(id, estimatedHeight, {
        regionContent: {
            kind: 'test-list',
            items: Array.from({ length: segmentLength }, (_, index) => ({
                id: String(startIndex + index + 1),
                name: `Item ${startIndex + index + 1}`,
            })) as unknown[],
            startIndex,
            totalCount,
            isContinuation: startIndex > 0,
        } as RegionListContent,
        measurementKey,
        ...overrides,
    });

const runPaginate = (entries: CanvasLayoutEntry[], columnCount = 1, regionHeightPx = 800, requestedPageCount = 1): LayoutPlan => {
    const buckets = new Map<string, CanvasLayoutEntry[]>();
    entries.forEach((entry) => {
        const key = entry.sourceRegionKey;
        if (!buckets.has(key)) {
            buckets.set(key, []);
        }
        buckets.get(key)!.push(entry);
    });

    // Create mock adapters for testing
    const mockAdapters: CanvasAdapters = createDefaultAdapters({
        defaultItemHeight: 50,
        defaultComponentHeight: 200,
    });

    return paginate({
        buckets,
        columnCount,
        regionHeightPx,
        requestedPageCount,
        measurements: new Map(),
        adapters: mockAdapters,
    });
};

describe('paginate', () => {
    it('keeps components on a single page when heights fit', () => {
        const plan = runPaginate(
            [createEntry('first', 200, { orderIndex: 0 }), createEntry('second', 300, { orderIndex: 1 })],
            1,
            800,
            1
        );
        expect(plan.pages).toHaveLength(1);
        expect(plan.pages[0].columns[0].entries.map((entry) => entry.instance.id)).toEqual(['first', 'second']);
    });

    it('routes block entries across columns and advances to a new page when they overflow', () => {
        const tallEntry = createEntry('tall', 900);
        const plan = runPaginate([tallEntry], 2, 600, 1);
        expect(plan.pages).toHaveLength(2);

        const firstPage = plan.pages[0];
        const secondPage = plan.pages[1];

        const firstColumnEntry = firstPage.columns[0].entries[0];
        expect(firstColumnEntry.instance.id).toBe('tall');
        expect(firstColumnEntry.overflow).toBe(true);

        const reroutedEntry = firstPage.columns[1].entries[0];
        expect(reroutedEntry.instance.id).toBe('tall');
        expect(reroutedEntry.overflow).toBe(true);
        expect(reroutedEntry.overflowRouted).toBe(true);

        const nextPageEntry = secondPage.columns[0].entries[0];
        expect(nextPageEntry.instance.id).toBe('tall');
        expect(nextPageEntry.overflow).toBe(true);
        expect(nextPageEntry.overflowRouted).toBe(true);
    });

    it('appends a new page when both columns overflow on the first page', () => {
        const entryA = createEntry('A', 700, { orderIndex: 0 });
        const entryB = createEntry('B', 700, { orderIndex: 1 });
        const plan = runPaginate([entryA, entryB], 2, 600, 1);
        expect(plan.pages).toHaveLength(2);
        expect(plan.pages[0].columns[0].entries[0].instance.id).toBe('A');
        expect(plan.pages[0].columns[0].entries[0].overflow).toBe(true);
        expect(plan.pages[0].columns[1].entries.map((entry) => entry.instance.id)).toEqual(['A']);

        const secondPageEntries = plan.pages[1].columns[0].entries;
        expect(secondPageEntries.map((entry) => entry.instance.id)).toEqual(['A', 'B']);
        secondPageEntries.forEach((entry) => {
            expect(entry.overflow).toBe(true);
            expect(entry.overflowRouted).toBe(true);
        });
    });

    it('splits list entries across pages and marks continuation metadata', () => {
        // Create mock items (generic, not Action type)
        const items: MockItem[] = Array.from({ length: 5 }, (_, index) => ({
            id: String(index + 1),
            name: `Item ${index + 1}`,
        }));
        const listEntry = createListEntry('list', items, 900);
        const plan = runPaginate([listEntry], 1, 250, 1);

        expect(plan.pages.length).toBeGreaterThan(1);

        const firstEntry = plan.pages[0].columns[0].entries[0];
        const continuationEntry = plan.pages[1].columns[0].entries[0];

        expect(firstEntry.listContinuation?.isContinuation).toBe(false);
        expect(firstEntry.listContinuation?.startIndex).toBe(0);
        expect(firstEntry.listContinuation?.totalCount).toBe(items.length);

        expect(continuationEntry.listContinuation?.isContinuation).toBe(true);
        expect(continuationEntry.listContinuation?.startIndex).toBeGreaterThan(0);
        expect(continuationEntry.listContinuation?.totalCount).toBe(items.length);
    });

    it('retains multiple list segments with the same instance id when measurement keys differ', () => {
        const totalCount = 5;
        const baseSegment = createListSegmentEntry(
            'component-7',
            'component-7:test-list:0:2:5:base',
            0,
            2,
            totalCount,
            220,
            { orderIndex: 0 }
        );

        const continuationSegment = createListSegmentEntry(
            'component-7',
            'component-7:test-list:2:3:5:cont',
            2,
            3,
            totalCount,
            230,
            { orderIndex: 1 }
        );

        const plan = runPaginate([baseSegment, continuationSegment], 1, 600, 1);
        const columnEntries = plan.pages[0].columns[0].entries.filter((entry) => entry.instance.id === 'component-7');

        expect(columnEntries).toHaveLength(2);
        expect(columnEntries.map((entry) => entry.measurementKey)).toEqual([
            'component-7:test-list:0:2:5:base',
            'component-7:test-list:2:3:5:cont',
        ]);
        expect(columnEntries[0].listContinuation?.isContinuation).toBe(false);
        expect(columnEntries[1].listContinuation?.isContinuation).toBe(true);
    });

    it('uses requested page count when greater than the computed layout', () => {
        const plan = runPaginate([createEntry('only', 200)], 1, 800, 3);
        expect(plan.pages).toHaveLength(3);
    });

    it('treats boundary-aligned spans as fitting within the region height', () => {
        const regionHeight = 320;
        const firstEntryHeight = 180;
        const first = createEntry('component-3', firstEntryHeight, { orderIndex: 0 });

        const cursorBeforeSecond = firstEntryHeight + COMPONENT_VERTICAL_SPACING_PX;
        const secondEntryHeight = regionHeight - COMPONENT_VERTICAL_SPACING_PX - cursorBeforeSecond;
        expect(secondEntryHeight).toBeGreaterThan(0);

        const second = createEntry('component-4', secondEntryHeight, { orderIndex: 1 });

        const plan = runPaginate([first, second], 1, regionHeight, 1);
        const firstPageEntries = plan.pages[0].columns[0].entries;

        expect(firstPageEntries).toHaveLength(2);
        const fittedEntry = firstPageEntries[1];
        expect(fittedEntry.instance.id).toBe('component-4');
        expect(fittedEntry.overflow).toBeFalsy();
        expect(fittedEntry.span?.bottom).toBeCloseTo(regionHeight - COMPONENT_VERTICAL_SPACING_PX, 5);
    });

    it('reroutes overflowing home-region components to the sibling column before advancing pages', () => {
        const regionHeight = 500;
        const columnCount = 2;
        const anchor = createEntry('component-3', 420, { orderIndex: 0 });
        const overflowing = createEntry('component-4', 200, { orderIndex: 1 });

        const plan = runPaginate([anchor, overflowing], columnCount, regionHeight, 1);
        const firstPage = plan.pages[0];
        const columnTwoEntries = firstPage.columns[1].entries.filter((entry) => entry.instance.id === 'component-4');
        expect(columnTwoEntries.length).toBe(1);
        const rerouted = columnTwoEntries[0];
        expect(rerouted.region.column).toBe(2);
        expect(rerouted.region.page).toBe(1);
        expect(rerouted.span?.top ?? -1).toBe(0);
        expect(rerouted.span?.bottom ?? -1).toBeGreaterThan(0);
        expect(rerouted.sourceRegionKey).toBe('1:2');
    });
});
