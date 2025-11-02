import type {
    ComponentDataSource,
    ComponentInstance,
    ComponentRegistryEntry,
    PageVariables,
    TemplateConfig,
    RegionListContent,
} from '../types/canvas.types';

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

    // Committed placement from last layout plan
    assignedRegions: Map<string, SlotAssignment>;

    // Immutable home regions from template/configuration
    homeRegions: Map<string, HomeRegionAssignment>;
}


