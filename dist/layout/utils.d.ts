import type { ComponentInstance, RegionListContent, TemplateConfig, TemplateSlot, ComponentDataSource, PageVariables, CanvasConfig, CanvasDimensions, FrameConfig } from '../types/canvas.types';
import type { CanvasEntriesResult, MeasurementKey, MeasurementRecord, MeasurementEntry, RegionBuckets, RegionAssignment, SlotAssignment } from './types';
import type { CanvasAdapters } from '../types/adapters.types';
export declare const PX_PER_INCH = 96;
export declare const MM_PER_INCH = 25.4;
export declare const MEASUREMENT_TOLERANCE_PX = 0.5;
export declare const MEASUREMENT_THROTTLE_MS = 150;
export declare const DEFAULT_PAGE_TOP_MARGIN_MM = 10;
export declare const DEFAULT_PAGE_BOTTOM_MARGIN_MM = 10;
export declare const COMPONENT_VERTICAL_SPACING_PX = 12;
export declare const LIST_ITEM_SPACING_PX = 8;
export declare const COLUMN_PADDING_PX = 8;
export declare const DEFAULT_COMPONENT_HEIGHT_PX = 200;
export declare const regionKey: (page: number, column: number) => string;
export interface BasePageDimensions {
    widthPx: number;
    heightPx: number;
    contentHeightPx: number;
    topMarginPx: number;
    bottomMarginPx: number;
}
export declare const convertToPixels: (value: number, unit: 'px' | 'mm' | 'in') => number;
export declare const computeBasePageDimensions: (pageVariables: PageVariables, topMarginMm?: number, bottomMarginMm?: number) => BasePageDimensions;
/**
 * Compute all Canvas dimensions from a CanvasConfig.
 * This is the single source of truth for all layout dimensions.
 *
 * Consumer should NOT calculate these values - Canvas owns this calculation.
 *
 * @param config - The CanvasConfig provided by the consumer
 * @returns All calculated dimensions needed for layout and measurement
 */
export declare const computeCanvasDimensions: (config: CanvasConfig) => CanvasDimensions;
/**
 * Create default FrameConfig with zero values.
 * Used when consumer doesn't provide frameConfig.
 */
export declare const createDefaultFrameConfig: () => FrameConfig;
export declare const toColumnType: (column: number) => 1 | 2;
export declare const clamp: (value: number, min: number, max: number) => number;
export declare const buildSlotOrder: (template: TemplateConfig) => Map<string, number>;
export declare const computeMeasurementKey: (instanceId: string, regionContent?: RegionListContent) => MeasurementKey;
export declare const inferColumnFromPosition: (position: TemplateSlot['position'] | ComponentInstance['layout']['position'] | undefined, columnCount: number, pageWidthPx: number) => 1 | 2;
export declare const resolveLocation: (instance: ComponentInstance, template: TemplateConfig, columnCount: number, pageWidthPx: number) => {
    page: number;
    column: 1 | 2;
};
interface BuildBucketsArgs {
    instances: ComponentInstance[];
    template: TemplateConfig;
    columnCount: number;
    pageWidthPx: number;
    dataSources: ComponentDataSource[];
    measurements: Map<MeasurementKey, MeasurementRecord>;
    assignedRegions?: Map<string, SlotAssignment>;
    adapters: CanvasAdapters;
}
export declare const buildBuckets: ({ instances, template, columnCount, pageWidthPx, dataSources, measurements, assignedRegions, adapters, }: BuildBucketsArgs) => RegionBuckets;
/**
 * Create measurement entries from raw components BEFORE buckets are built.
 * This enables measure-first flow where we measure all components upfront.
 *
 * For list components (actions, spells, etc.), generates split measurements for
 * all possible split points (1 item, 2 items, ..., N items). This enables
 * accurate pagination without proportional estimation.
 */
export declare const createInitialMeasurementEntries: ({ instances, template, columnCount, pageWidthPx, dataSources, adapters, }: {
    instances: ComponentInstance[];
    template: TemplateConfig;
    columnCount: number;
    pageWidthPx: number;
    dataSources: ComponentDataSource[];
    adapters: CanvasAdapters;
}) => MeasurementEntry[];
export interface BuildCanvasEntriesArgs {
    instances: ComponentInstance[];
    template: TemplateConfig;
    columnCount: number;
    pageWidthPx: number;
    dataSources: ComponentDataSource[];
    measurements: Map<MeasurementKey, MeasurementRecord>;
    assignedRegions?: Map<string, SlotAssignment>;
    adapters: CanvasAdapters;
}
export declare const buildCanvasEntries: ({ instances, template, columnCount, pageWidthPx, dataSources, measurements, assignedRegions, adapters, }: BuildCanvasEntriesArgs) => CanvasEntriesResult;
/**
 * Computes canonical home regions for all component instances based on their template slots
 * and explicit layout.location settings. This map should be recomputed only when components
 * or the template change, not when measurements or reroutes occur.
 */
export declare const computeHomeRegions: ({ instances, template, columnCount, pageWidthPx, }: {
    instances: ComponentInstance[];
    template: TemplateConfig;
    columnCount: number;
    pageWidthPx: number;
}) => Map<string, {
    homeRegion: RegionAssignment;
    slotIndex: number;
    orderIndex: number;
}>;
export {};
//# sourceMappingURL=utils.d.ts.map