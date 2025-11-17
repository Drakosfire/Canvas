import type {
    ComponentDataSource,
    ComponentInstance,
    ComponentRegistryEntry,
    PageVariables,
    TemplateConfig,
    RegionListContent,
} from '../types/canvas.types';
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
    splitRemainder?: unknown[]; // Generic items for split operations
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
    cursorOffsetPx?: number; // Cached cursor position when column is settled (for next run initialization)
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
    columnKey: string; // e.g., "1:1" (page:column)
    requiredKeys: Set<MeasurementKey>; // All measurement keys needed for this column
    measuredKeys: Set<MeasurementKey>; // Measurement keys we have
    lastUpdateTime: number; // Timestamp of last measurement update
    isStable: boolean; // Measurements haven't changed for STABILITY_THRESHOLD_MS
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
    layoutPlan: LayoutPlan | null;
    pendingLayout: LayoutPlan | null;
    measurementEntries: MeasurementEntry[];
    buckets: RegionBuckets;
    isLayoutDirty: boolean;

    // Measure-first flow: track if all components have initial measurements
    allComponentsMeasured: boolean;

    // Measure-first flow: explicitly track if we're waiting for initial measurements before pagination
    waitingForInitialMeasurements: boolean;

    // Required measurement coverage for current component/template configuration
    requiredMeasurementKeys: Set<MeasurementKey>;
    missingMeasurementKeys: Set<MeasurementKey>;

    // Committed placement from last layout plan
    assignedRegions: Map<string, SlotAssignment>;

    // Immutable home regions from template/configuration
    homeRegions: Map<string, HomeRegionAssignment>;

    // Adapters for domain-specific operations
    adapters: import('../types/adapters.types').CanvasAdapters;
    segmentRerouteCache: SegmentRerouteCache;

    // Column-based measurement caching for pagination optimization
    columnMeasurementCache: Map<string, ColumnMeasurementState>;
    measurementStabilityThreshold: number; // ms (default: 300ms)
    
    // Region height stability tracking for pagination optimization
    regionHeightLastUpdateTime: number; // Timestamp of last region height update
    regionHeightStabilityThreshold: number; // ms (default: 300ms)

    // Overall measurement lifecycle status for publish-once flow
    measurementStatus?: MeasurementStatus;
}


