import type { LayoutPlan, RegionBuckets, MeasurementKey, MeasurementRecord } from './types';
import type { CanvasAdapters } from '../types/adapters.types';
export { isComponentDebugEnabled, normalizeComponentId } from './paginate/debug';
import { SegmentRerouteCache } from './planner';
interface PaginateArgs {
    buckets: RegionBuckets;
    columnCount: number;
    regionHeightPx: number;
    requestedPageCount: number;
    baseDimensions?: {
        contentHeightPx: number;
        topMarginPx: number;
    } | null;
    measurementVersion?: number;
    measurements: Map<MeasurementKey, MeasurementRecord>;
    adapters: CanvasAdapters;
    segmentRerouteCache?: SegmentRerouteCache;
    previousPlan?: LayoutPlan | null;
}
export declare const paginate: ({ buckets, columnCount, regionHeightPx, requestedPageCount, baseDimensions, measurementVersion, measurements, adapters, segmentRerouteCache, previousPlan, }: PaginateArgs) => LayoutPlan;
//# sourceMappingURL=paginate.d.ts.map