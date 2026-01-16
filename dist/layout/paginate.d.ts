import type { LayoutPlan, RegionBuckets, MeasurementKey, MeasurementRecord } from './types';
import type { CanvasAdapters } from '../types/adapters.types';
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
/**
 * Normalize component IDs to zero-padded format for consistent logging.
 * Examples: "component-0" -> "component-00", "component-1" -> "component-01", "component-10" -> "component-10"
 *
 * @export
 * Exported for use in measurement.tsx and other modules
 */
export declare const normalizeComponentId: (componentId: string) => string;
export declare const isComponentDebugEnabled: (componentId: string) => boolean;
export declare const paginate: ({ buckets, columnCount, regionHeightPx, requestedPageCount, baseDimensions, measurementVersion, measurements, adapters, segmentRerouteCache, previousPlan, }: PaginateArgs) => LayoutPlan;
export {};
//# sourceMappingURL=paginate.d.ts.map