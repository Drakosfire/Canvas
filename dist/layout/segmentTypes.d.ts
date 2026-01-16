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
export declare class SegmentRerouteCache {
    private cache;
    constructor(initial?: Iterable<[string, SegmentRerouteRecord]>);
    resolveTarget(componentId: string, segmentId: SegmentId): string | null;
    rememberDefer(componentId: string, segmentId: SegmentId, targetRegionKey: string | null): void;
    clear(componentId: string, segmentId: SegmentId): void;
    has(componentId: string, segmentId: SegmentId): boolean;
    snapshot(): Array<{
        componentId: string;
        segmentId: SegmentId;
        targetRegionKey: string;
        updatedAt: number;
    }>;
}
export {};
//# sourceMappingURL=segmentTypes.d.ts.map