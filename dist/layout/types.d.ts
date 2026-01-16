import type { ComponentDataSource, ComponentInstance, ComponentRegistryEntry, PageVariables, TemplateConfig, RegionListContent } from '../types/canvas.types';
import type { SegmentRerouteCache } from './segmentTypes';
export type MeasurementKey = string;
export interface MeasurementRecord {
    key: MeasurementKey;
    height: number;
    measuredAt: number;
}
export interface LayoutRegion {
    page: number;
    column: 1 | 2;
    index?: number;
}
export interface CanvasLayoutEntry {
    instance: ComponentInstance;
    slotIndex: number;
    orderIndex: number;
    sourceRegionKey: string;
    region: LayoutRegion;
    homeRegion: RegionAssignment;
    homeRegionKey: string;
    regionContent?: RegionListContent;
    estimatedHeight: number;
    measurementKey: MeasurementKey;
    needsMeasurement: boolean;
    span?: RegionSpan;
    slotDimensions?: {
        widthPx?: number;
        heightPx?: number;
    };
    overflow?: boolean;
    overflowRouted?: boolean;
    splitRemainder?: unknown[];
    listContinuation?: {
        isContinuation: boolean;
        startIndex: number;
        totalCount: number;
    };
}
export type RegionBuckets = Map<string, CanvasLayoutEntry[]>;
export type MeasurementEntry = CanvasLayoutEntry;
export { RegionListContent };
export interface LayoutColumn {
    columnNumber: 1 | 2;
    key: string;
    entries: CanvasLayoutEntry[];
    usedHeightPx?: number;
    availableHeightPx?: number;
    cursorOffsetPx?: number;
}
export interface PageLayout {
    pageNumber: number;
    columns: LayoutColumn[];
}
export interface OverflowWarning {
    componentId: string;
    page: number;
    column: number;
}
export interface LayoutPlan {
    pages: PageLayout[];
    overflowWarnings: OverflowWarning[];
}
export type MeasurementStatus = 'idle' | 'measuring' | 'complete';
export interface CanvasEntriesResult {
    buckets: RegionBuckets;
    measurementEntries: MeasurementEntry[];
}
export interface RegionAssignment {
    page: number;
    column: 1 | 2;
}
export interface RegionSpan {
    top: number;
    bottom: number;
    height: number;
}
export interface RegionCursor {
    regionKey: string;
    currentOffset: number;
    maxHeight: number;
}
export interface SlotAssignment {
    region: RegionAssignment;
    homeRegion: RegionAssignment;
    slotIndex: number;
    orderIndex: number;
}
/**
 * Tracks the canonical "home" location for a component based on its template slot
 * or explicit layout.location. This is immutable unless the component's configuration changes.
 */
export interface HomeRegionAssignment {
    homeRegion: RegionAssignment;
    slotIndex: number;
    orderIndex: number;
}
/**
 * Tracks measurement state per column for caching optimization.
 * Allows pagination to wait until columns have "enough" measurements before running.
 */
export interface ColumnMeasurementState {
    columnKey: string;
    requiredKeys: Set<MeasurementKey>;
    measuredKeys: Set<MeasurementKey>;
    lastUpdateTime: number;
    isStable: boolean;
}
export interface CanvasLayoutState {
    components: ComponentInstance[];
    template: TemplateConfig | null;
    dataSources: ComponentDataSource[];
    componentRegistry: Record<string, ComponentRegistryEntry>;
    pageVariables: PageVariables | null;
    columnCount: number;
    regionHeightPx: number;
    pageWidthPx: number;
    pageHeightPx: number;
    baseDimensions: {
        widthPx: number;
        heightPx: number;
        contentHeightPx: number;
        topMarginPx: number;
        bottomMarginPx: number;
    } | null;
    measurements: Map<MeasurementKey, MeasurementRecord>;
    measurementVersion: number;
    lastMeasurementCompleteVersion: number;
    layoutPlan: LayoutPlan | null;
    pendingLayout: LayoutPlan | null;
    measurementEntries: MeasurementEntry[];
    buckets: RegionBuckets;
    isLayoutDirty: boolean;
    allComponentsMeasured: boolean;
    waitingForInitialMeasurements: boolean;
    requiredMeasurementKeys: Set<MeasurementKey>;
    missingMeasurementKeys: Set<MeasurementKey>;
    assignedRegions: Map<string, SlotAssignment>;
    homeRegions: Map<string, HomeRegionAssignment>;
    adapters: import('../types/adapters.types').CanvasAdapters;
    segmentRerouteCache: SegmentRerouteCache;
    columnMeasurementCache: Map<string, ColumnMeasurementState>;
    measurementStatus?: MeasurementStatus;
}
//# sourceMappingURL=types.d.ts.map