import type { MeasurementKey } from './types';

export type SegmentId = string;

export interface SegmentDescriptor {
    componentId: string;
    segmentId: SegmentId;
    measurementKey: MeasurementKey;
    /**
     * Region the segment is currently queued in (home or rerouted).
     */
    regionKey: string;
    /**
     * Primary height drawn from measurements. The planner assumes this is authoritative.
     */
    heightPx: number;
    /**
     * Optional estimated height used for debugging/fallback scenarios.
     */
    estimatedHeightPx?: number;
    /**
     * Controls spacing after the segment. Defaults to planner spacing when undefined.
     */
    spacingAfterPx?: number;
    /**
     * True when the segment represents metadata (intro text, summary blocks).
     */
    isMetadata?: boolean;
    /**
     * True when the segment continues a list (start index > 0).
     */
    isContinuation?: boolean;
    /**
     * Start index inside the source list (for diagnostics).
     */
    startIndex?: number;
    /**
     * Number of items represented by this segment.
     */
    itemCount?: number;
    /**
     * Total items in the source list.
     */
    totalCount?: number;
}

export interface PlannerRegionConfig {
    key: string;
    /**
     * The absolute vertical capacity of the region in pixels.
     */
    maxHeightPx: number;
    /**
     * Existing cursor offset when the planner runs (e.g., previously placed blocks).
     */
    cursorOffsetPx?: number;
}

export interface PlannerRegionState extends PlannerRegionConfig {
    /**
     * Cursor after placement attempts have been applied.
     */
    cursorPx: number;
    /**
     * Index in the iteration order (used to compute next region).
     */
    orderIndex: number;
}

export interface SegmentPlacementIntent {
    type: 'place';
    regionKey: string;
    topPx: number;
    bottomPx: number;
    heightPx: number;
    cursorAfterPx: number;
    usedCachedRegion: boolean;
    reason: 'fits' | 'forced' | 'cached-region';
}

export interface SegmentDeferIntent {
    type: 'defer';
    fromRegionKey: string;
    toRegionKey: string | null;
    reason: 'insufficient-space' | 'missing-region' | 'no-next-region';
    attemptedRegionKey: string;
}

export type SegmentIntent = SegmentPlacementIntent | SegmentDeferIntent;

export interface SegmentPlanEntry {
    descriptor: SegmentDescriptor;
    intent: SegmentIntent;
}

export interface SegmentPlanMetrics {
    placed: number;
    deferred: number;
}

export interface SegmentPlan {
    entries: SegmentPlanEntry[];
    metrics: SegmentPlanMetrics;
}

interface SegmentRerouteRecord {
    targetRegionKey: string;
    updatedAt: number;
}

const DEFAULT_CACHE_TTL_MS = 1000 * 60 * 10; // 10 minutes – prevents stale reroutes after long idle

const buildCacheKey = (componentId: string, segmentId: SegmentId): string => `${componentId}::${segmentId}`;

export class SegmentRerouteCache {
    private cache: Map<string, SegmentRerouteRecord> = new Map();

    constructor(initial?: Iterable<[string, SegmentRerouteRecord]>) {
        if (!initial) {
            return;
        }

        Array.from(initial).forEach(([key, record]) => {
            this.cache.set(key, record);
        });
    }

    resolveTarget(componentId: string, segmentId: SegmentId): string | null {
        const key = buildCacheKey(componentId, segmentId);
        const record = this.cache.get(key);
        if (!record) {
            return null;
        }

        if (Date.now() - record.updatedAt > DEFAULT_CACHE_TTL_MS) {
            this.cache.delete(key);
            return null;
        }

        return record.targetRegionKey;
    }

    rememberDefer(componentId: string, segmentId: SegmentId, targetRegionKey: string | null): void {
        const key = buildCacheKey(componentId, segmentId);
        if (!targetRegionKey) {
            this.cache.delete(key);
            return;
        }
        this.cache.set(key, {
            targetRegionKey,
            updatedAt: Date.now(),
        });
    }

    clear(componentId: string, segmentId: SegmentId): void {
        const key = buildCacheKey(componentId, segmentId);
        this.cache.delete(key);
    }

    has(componentId: string, segmentId: SegmentId): boolean {
        const key = buildCacheKey(componentId, segmentId);
        return this.cache.has(key);
    }

    snapshot(): Array<{ componentId: string; segmentId: SegmentId; targetRegionKey: string; updatedAt: number }> {
        const entries: Array<{ componentId: string; segmentId: SegmentId; targetRegionKey: string; updatedAt: number }> = [];
        this.cache.forEach((record, key) => {
            const [componentId, segmentId] = key.split('::');
            entries.push({
                componentId,
                segmentId,
                targetRegionKey: record.targetRegionKey,
                updatedAt: record.updatedAt,
            });
        });
        return entries;
    }
}



