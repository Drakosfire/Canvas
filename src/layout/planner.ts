import { COMPONENT_VERTICAL_SPACING_PX } from './utils';
import type {
    PlannerRegionConfig,
    PlannerRegionState,
    SegmentDeferIntent,
    SegmentDescriptor,
    SegmentIntent,
    SegmentPlan,
    SegmentPlanEntry,
} from './segmentTypes';
import { SegmentRerouteCache } from './segmentTypes';
import { logPlannerEvaluation, logSegmentDecision } from './debug/plannerLogs';

const HEIGHT_EPSILON = 0.5;

interface BuildSegmentPlanArgs {
    segments: SegmentDescriptor[];
    regions: PlannerRegionConfig[];
    rerouteCache?: SegmentRerouteCache;
    spacingPx?: number;
}

const initializeRegionStates = (regions: PlannerRegionConfig[]): Map<string, PlannerRegionState> => {
    const states = new Map<string, PlannerRegionState>();
    regions.forEach((region, index) => {
        states.set(region.key, {
            ...region,
            cursorPx: region.cursorOffsetPx ?? 0,
            orderIndex: index,
        });
    });
    return states;
};

const computeNextRegionLookup = (regions: PlannerRegionConfig[]): Map<string, string | null> => {
    const lookup = new Map<string, string | null>();
    regions.forEach((region, index) => {
        const nextRegion = regions[index + 1];
        lookup.set(region.key, nextRegion ? nextRegion.key : null);
    });
    return lookup;
};

const resolveTargetRegion = (
    descriptor: SegmentDescriptor,
    regionStates: Map<string, PlannerRegionState>,
    rerouteCache: SegmentRerouteCache
): { region: PlannerRegionState | null; usedCachedRegion: boolean } => {
    const cached = rerouteCache.resolveTarget(descriptor.componentId, descriptor.segmentId);
    if (cached) {
        const cachedRegion = regionStates.get(cached);
        if (cachedRegion) {
            return { region: cachedRegion, usedCachedRegion: true };
        }
        // Cached region missing – purge and fall back
        rerouteCache.clear(descriptor.componentId, descriptor.segmentId);
    }

    const preferred = regionStates.get(descriptor.regionKey);
    if (preferred) {
        return { region: preferred, usedCachedRegion: false };
    }

    return { region: null, usedCachedRegion: false };
};

const fitsInRegion = (
    region: PlannerRegionState,
    descriptor: SegmentDescriptor,
    spacingPx: number
): { fits: boolean; topPx: number; bottomPx: number; cursorAfterPx: number } => {
    const topPx = region.cursorPx;
    const height = descriptor.heightPx;
    const bottomPx = topPx + height;
    const cursorAfterPx = bottomPx + (descriptor.spacingAfterPx ?? spacingPx);

    const fits = cursorAfterPx <= region.maxHeightPx + HEIGHT_EPSILON;
    return { fits, topPx, bottomPx, cursorAfterPx };
};

const buildPlacementIntent = (
    descriptor: SegmentDescriptor,
    region: PlannerRegionState,
    usedCachedRegion: boolean,
    topPx: number,
    bottomPx: number,
    cursorAfterPx: number
): SegmentIntent => ({
    type: 'place',
    regionKey: region.key,
    topPx,
    bottomPx,
    heightPx: descriptor.heightPx,
    cursorAfterPx,
    usedCachedRegion,
    reason: usedCachedRegion ? 'cached-region' : 'fits',
});

const buildDeferIntent = (
    attemptedRegionKey: string,
    nextRegionKey: string | null,
    reason: SegmentDeferIntent['reason']
): SegmentIntent => ({
    type: 'defer',
    fromRegionKey: attemptedRegionKey,
    toRegionKey: nextRegionKey,
    reason,
    attemptedRegionKey,
});

export const buildSegmentPlan = ({
    segments,
    regions,
    rerouteCache = new SegmentRerouteCache(),
    spacingPx = COMPONENT_VERTICAL_SPACING_PX,
}: BuildSegmentPlanArgs): SegmentPlan => {
    const regionStates = initializeRegionStates(regions);
    const nextRegionLookup = computeNextRegionLookup(regions);
    const entries: SegmentPlanEntry[] = [];

    logPlannerEvaluation('🧮', 'planner-run-start', {
        segmentCount: segments.length,
        regionCount: regions.length,
        spacingPx,
    });

    segments.forEach((descriptor) => {
        const { region, usedCachedRegion } = resolveTargetRegion(descriptor, regionStates, rerouteCache);

        if (!region) {
            const intent = buildDeferIntent(
                descriptor.regionKey,
                null,
                'missing-region'
            );
            rerouteCache.rememberDefer(descriptor.componentId, descriptor.segmentId, null);
            entries.push({ descriptor, intent });
            logSegmentDecision(descriptor, intent);
            return;
        }

        const { fits, topPx, bottomPx, cursorAfterPx } = fitsInRegion(region, descriptor, spacingPx);

        if (fits) {
            region.cursorPx = cursorAfterPx;
            rerouteCache.clear(descriptor.componentId, descriptor.segmentId);

            const intent = buildPlacementIntent(
                descriptor,
                region,
                usedCachedRegion,
                topPx,
                bottomPx,
                cursorAfterPx
            );
            entries.push({ descriptor, intent });
            logSegmentDecision(descriptor, intent);
            return;
        }

        const nextRegionKey = nextRegionLookup.get(region.key) ?? null;
        rerouteCache.rememberDefer(descriptor.componentId, descriptor.segmentId, nextRegionKey);

        const intent = buildDeferIntent(
            region.key,
            nextRegionKey,
            nextRegionKey ? 'insufficient-space' : 'no-next-region'
        );
        entries.push({ descriptor, intent });
        logSegmentDecision(descriptor, intent);
    });

    const placed = entries.filter((entry) => entry.intent.type === 'place').length;
    const deferred = entries.length - placed;

    logPlannerEvaluation('🧾', 'planner-run-complete', {
        placed,
        deferred,
    });

    return {
        entries,
        metrics: {
            placed,
            deferred,
        },
    };
};

export { SegmentRerouteCache };



