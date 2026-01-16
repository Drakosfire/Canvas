import type { PlannerRegionConfig, SegmentDescriptor, SegmentPlan } from './segmentTypes';
import { SegmentRerouteCache } from './segmentTypes';
interface BuildSegmentPlanArgs {
    segments: SegmentDescriptor[];
    regions: PlannerRegionConfig[];
    rerouteCache?: SegmentRerouteCache;
    spacingPx?: number;
}
export declare const buildSegmentPlan: ({ segments, regions, rerouteCache, spacingPx, }: BuildSegmentPlanArgs) => SegmentPlan;
export { SegmentRerouteCache };
//# sourceMappingURL=planner.d.ts.map