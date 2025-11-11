import { describe, it, expect, beforeEach } from '@jest/globals';
import { buildSegmentPlan, SegmentRerouteCache } from '../planner';
import type { PlannerRegionConfig, SegmentDescriptor } from '../segmentTypes';

const createSegment = (overrides: Partial<SegmentDescriptor>): SegmentDescriptor => ({
    componentId: 'component-1',
    segmentId: overrides.measurementKey ?? 'component-1:segment:base',
    measurementKey: overrides.measurementKey ?? 'component-1:segment:base',
    regionKey: '1:1',
    heightPx: 100,
    ...overrides,
});

const createRegions = (overrides: Partial<PlannerRegionConfig>[] = []): PlannerRegionConfig[] => {
    if (overrides.length === 0) {
        return [
            { key: '1:1', maxHeightPx: 300, cursorOffsetPx: 0 },
            { key: '1:2', maxHeightPx: 300, cursorOffsetPx: 0 },
        ];
    }
    return overrides.map((region, index) => ({
        key: `1:${index + 1}`,
        maxHeightPx: 300,
        cursorOffsetPx: 0,
        ...region,
    }));
};

describe('buildSegmentPlan', () => {
    let rerouteCache: SegmentRerouteCache;

    beforeEach(() => {
        rerouteCache = new SegmentRerouteCache();
    });

    it('places segments when sufficient space is available', () => {
        const segments: SegmentDescriptor[] = [
            createSegment({
                segmentId: 'component-1:metadata',
                measurementKey: 'component-1:spell-list-metadata:0:0:10:base',
                heightPx: 80,
                isMetadata: true,
            }),
            createSegment({
                segmentId: 'component-1:spell-list:0:5',
                measurementKey: 'component-1:spell-list:0:5:10:base',
                heightPx: 120,
                startIndex: 0,
                itemCount: 5,
                totalCount: 10,
            }),
        ];

        const plan = buildSegmentPlan({
            segments,
            regions: createRegions(),
            rerouteCache,
            spacingPx: 12,
        });

        expect(plan.metrics.placed).toBe(2);
        expect(plan.metrics.deferred).toBe(0);

        const [metadataEntry, listEntry] = plan.entries;
        expect(metadataEntry.intent.type).toBe('place');
        if (metadataEntry.intent.type === 'place') {
            expect(metadataEntry.intent.topPx).toBeCloseTo(0);
            expect(metadataEntry.intent.bottomPx).toBeCloseTo(80);
        }

        expect(listEntry.intent.type).toBe('place');
        if (listEntry.intent.type === 'place') {
            expect(listEntry.intent.regionKey).toBe('1:1');
            expect(listEntry.intent.topPx).toBeCloseTo(92); // 80 height + 12 spacing
            expect(listEntry.intent.bottomPx).toBeCloseTo(212);
        }
    });

    it('defers segments when no space is available and records reroute', () => {
        const segments: SegmentDescriptor[] = [
            createSegment({
                regionKey: '1:1',
                measurementKey: 'component-1:spell-list:0:6:10:base',
                heightPx: 260,
            }),
        ];

        const plan = buildSegmentPlan({
            segments,
            regions: createRegions([
                { key: '1:1', maxHeightPx: 200, cursorOffsetPx: 0 },
                { key: '1:2', maxHeightPx: 300, cursorOffsetPx: 0 },
            ]),
            rerouteCache,
            spacingPx: 12,
        });

        expect(plan.metrics.placed).toBe(0);
        expect(plan.metrics.deferred).toBe(1);

        const [entry] = plan.entries;
        expect(entry.intent.type).toBe('defer');
        if (entry.intent.type === 'defer') {
            expect(entry.intent.fromRegionKey).toBe('1:1');
            expect(entry.intent.toRegionKey).toBe('1:2');
            expect(entry.intent.reason).toBe('insufficient-space');
        }

        expect(rerouteCache.resolveTarget('component-1', segments[0].segmentId)).toBe('1:2');
    });

    it('reuses reroute cache to place segment in cached region', () => {
        const segment = createSegment({
            regionKey: '1:1',
            measurementKey: 'component-1:spell-list:0:4:10:base',
            heightPx: 220,
        });

        const firstPlan = buildSegmentPlan({
            segments: [segment],
            regions: createRegions([
                { key: '1:1', maxHeightPx: 180, cursorOffsetPx: 0 },
                { key: '1:2', maxHeightPx: 200, cursorOffsetPx: 0 },
            ]),
            rerouteCache,
        });

        expect(firstPlan.metrics.deferred).toBe(1);
        expect(rerouteCache.resolveTarget(segment.componentId, segment.segmentId)).toBe('1:2');

        const secondPlan = buildSegmentPlan({
            segments: [segment],
            regions: createRegions([
                { key: '1:1', maxHeightPx: 180, cursorOffsetPx: 0 },
                { key: '1:2', maxHeightPx: 400, cursorOffsetPx: 0 },
            ]),
            rerouteCache,
        });

        expect(secondPlan.metrics.placed).toBe(1);
        const [entry] = secondPlan.entries;
        expect(entry.intent.type).toBe('place');
        if (entry.intent.type === 'place') {
            expect(entry.intent.regionKey).toBe('1:2');
            expect(entry.intent.usedCachedRegion).toBe(true);
            expect(entry.intent.reason).toBe('cached-region');
        }

        expect(rerouteCache.resolveTarget(segment.componentId, segment.segmentId)).toBeNull();
    });
});



