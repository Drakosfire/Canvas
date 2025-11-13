import type {
    ComponentInstance,
    RegionListContent,
    TemplateConfig,
    TemplateSlot,
    ComponentDataSource,
    ComponentDataReference,
    PageVariables,
} from '../types/canvas.types';
import type {
    CanvasEntriesResult,
    CanvasLayoutEntry,
    MeasurementKey,
    MeasurementRecord,
    MeasurementEntry,
    RegionBuckets,
    RegionAssignment,
    SlotAssignment,
} from './types';
import { toRegionContent } from './utils-generic';

// Adapter imports
import type { CanvasAdapters } from '../types/adapters.types';

export const PX_PER_INCH = 96;
export const MM_PER_INCH = 25.4;
export const MEASUREMENT_TOLERANCE_PX = 0.5;
export const MEASUREMENT_THROTTLE_MS = 150;

export const DEFAULT_PAGE_TOP_MARGIN_MM = 10;
export const DEFAULT_PAGE_BOTTOM_MARGIN_MM = 10;
export const COMPONENT_VERTICAL_SPACING_PX = 12; // Reduced from 18px for tighter layout
export const LIST_ITEM_SPACING_PX = 8; // Reduced from 12px for tighter layout
export const DEFAULT_COMPONENT_HEIGHT_PX = 200;

// Action-specific height constants removed - now provided by adapters
// Applications can implement their own height estimation in HeightEstimator adapter

export const regionKey = (page: number, column: number) => `${page}:${column}`;

export interface BasePageDimensions {
    widthPx: number;
    heightPx: number;
    contentHeightPx: number;
    topMarginPx: number;
    bottomMarginPx: number;
}

export const convertToPixels = (value: number, unit: 'px' | 'mm' | 'in'): number => {
    switch (unit) {
        case 'px':
            return value;
        case 'in':
            return value * PX_PER_INCH;
        case 'mm':
        default:
            return (value / MM_PER_INCH) * PX_PER_INCH;
    }
};

export const computeBasePageDimensions = (
    pageVariables: PageVariables,
    topMarginMm: number = DEFAULT_PAGE_TOP_MARGIN_MM,
    bottomMarginMm: number = DEFAULT_PAGE_BOTTOM_MARGIN_MM
): BasePageDimensions => {
    const effectiveTopMarginMm = pageVariables.margins?.topMm ?? topMarginMm;
    const effectiveBottomMarginMm = pageVariables.margins?.bottomMm ?? bottomMarginMm;
    const widthPx = convertToPixels(pageVariables.dimensions.width, pageVariables.dimensions.unit);
    const heightPx = convertToPixels(pageVariables.dimensions.height, pageVariables.dimensions.unit);
    const topMarginPx = convertToPixels(effectiveTopMarginMm, 'mm');
    const bottomMarginPx = convertToPixels(effectiveBottomMarginMm, 'mm');
    const contentHeightPx = Math.max(0, heightPx - (topMarginPx + bottomMarginPx));

    return {
        widthPx,
        heightPx,
        contentHeightPx,
        topMarginPx,
        bottomMarginPx,
    };
};

export const toColumnType = (column: number): 1 | 2 => (column <= 1 ? 1 : 2);

export const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export const buildSlotOrder = (template: TemplateConfig): Map<string, number> => {
    const order = new Map<string, number>();
    template.slots.forEach((slot, index) => {
        order.set(slot.id, index);
    });
    return order;
};

export const computeMeasurementKey = (
    instanceId: string,
    regionContent?: RegionListContent
): MeasurementKey => {
    if (!regionContent) {
        return `${instanceId}:block`;
    }

    return `${instanceId}:${regionContent.kind}:${regionContent.startIndex}:${regionContent.items.length}:${regionContent.totalCount}:${regionContent.isContinuation ? 'cont' : 'base'}`;
};

export const inferColumnFromPosition = (
    position: TemplateSlot['position'] | ComponentInstance['layout']['position'] | undefined,
    columnCount: number,
    pageWidthPx: number
): 1 | 2 => {
    if (!position || columnCount <= 1 || pageWidthPx <= 0) {
        return 1;
    }

    const columnWidth = pageWidthPx / columnCount;
    const x = position.x ?? 0;
    const width = position.width ?? columnWidth;
    const midpoint = x + width / 2;
    const columnIndex = Math.ceil(midpoint / columnWidth);
    const clampedColumn = clamp(columnIndex, 1, columnCount);
    return (clampedColumn === 1 ? 1 : 2) as 1 | 2;
};

export const resolveLocation = (
    instance: ComponentInstance,
    template: TemplateConfig,
    columnCount: number,
    pageWidthPx: number
) => {
    const explicit = instance.layout.location;
    if (explicit) {
        return {
            page: Math.max(1, explicit.page),
            column: columnCount === 1 ? 1 : (clamp(explicit.column, 1, columnCount) as 1 | 2),
        };
    }

    const slot = template.slots.find((slotEntry) => slotEntry.id === instance.layout.slotId);
    const inferredColumn = inferColumnFromPosition(
        instance.layout.position ?? slot?.position,
        columnCount,
        pageWidthPx
    );

    return { page: 1, column: columnCount === 1 ? 1 : inferredColumn };
};

// Height estimation functions removed - now provided by adapters
// Applications implement HeightEstimator adapter with domain-specific logic
// (e.g., statblock adapters provide Action-specific height estimation)

// Component type mapping moved to CanvasAdapters.componentTypeMap
// Applications configure which component types are list components

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

export const buildBuckets = ({
    instances,
    template,
    columnCount,
    pageWidthPx,
    dataSources,
    measurements,
    assignedRegions,
    adapters,
}: BuildBucketsArgs): RegionBuckets => {
    const slotOrder = buildSlotOrder(template);
    const buckets: RegionBuckets = new Map();

    instances.forEach((instance, index) => {
        const persisted = assignedRegions?.get(instance.id);
        const resolvedHomeRaw = resolveLocation(instance, template, columnCount, pageWidthPx);
        const resolvedHome: RegionAssignment = {
            page: Math.max(1, resolvedHomeRaw.page),
            column: columnCount === 1 ? 1 : (clamp(resolvedHomeRaw.column, 1, columnCount) as 1 | 2),
        };
        const baseLocation = persisted ? persisted.homeRegion : resolvedHome;
        const slotIndex = instance.layout.slotId ? slotOrder.get(instance.layout.slotId) ?? Number.MAX_SAFE_INTEGER : Number.MAX_SAFE_INTEGER;
        const slotDimensions = slotDimensionLookup(template, instance.layout.slotId);
        const homeKey = regionKey(resolvedHome.page, resolvedHome.column);
        const listKind = adapters.componentTypeMap[instance.type];

        if (listKind) {
            // Resolve data using adapter - fully generic, no statblock-specific logic
            const resolved = adapters.dataResolver.resolveDataReference(dataSources, instance.dataRef);

            // Normalize items using adapter
            // Adapter is responsible for:
            // - Handling nested structures (e.g., legendaryActions.actions)
            // - Combining multiple arrays (e.g., cantrips + knownSpells)
            // - Adding default IDs if missing
            const itemsSource = adapters.listNormalizer.normalizeListItems(
                resolved as unknown[] | undefined
            );

            if (itemsSource.length === 0) {
                const key = regionKey(baseLocation.page, baseLocation.column);
                const measurementKey = computeMeasurementKey(instance.id);
                const record = measurements.get(measurementKey);
                const entry: CanvasLayoutEntry = {
                    instance,
                    slotIndex,
                    orderIndex: index,
                    sourceRegionKey: key,
                    region: baseLocation,
                    homeRegion: resolvedHome,
                    homeRegionKey: homeKey,
                    measurementKey,
                    estimatedHeight: record?.height ?? DEFAULT_COMPONENT_HEIGHT_PX,
                    needsMeasurement: !record,
                    span: record ? { top: 0, bottom: record.height, height: record.height } : undefined,
                    slotDimensions,
                };
                if (!buckets.has(key)) {
                    buckets.set(key, []);
                }
                buckets.get(key)!.push(entry);
                return;
            }

            const totalCount = itemsSource.length;
            const segments = new Map<string, { items: unknown[]; startIndex: number }>();

            itemsSource.forEach((item, itemIndex) => {
                if (!item || typeof item !== 'object') return;
                const itemLocation = 'location' in item && typeof (item as { location?: unknown }).location === 'object' && (item as { location?: unknown }).location !== null
                    ? (item as { location: { page?: number; column?: number } }).location
                    : undefined;
                const location = itemLocation && typeof itemLocation.page === 'number' && typeof itemLocation.column === 'number'
                    ? {
                        page: Math.max(1, itemLocation.page),
                        column: columnCount === 1 ? 1 : (clamp(itemLocation.column, 1, columnCount) as 1 | 2),
                    }
                    : baseLocation;

                const key = regionKey(location.page, location.column);
                if (!segments.has(key)) {
                    segments.set(key, { items: [], startIndex: itemIndex });
                }
                segments.get(key)!.items.push(item);
            });

            // Extract summary metadata from resolved data (if present)
            // Adapter is responsible for including metadata in resolved data structure
            // Examples: { description: "...", actionsPerTurn: 3, actions: [...] }
            const summaryMetadata = resolved && typeof resolved === 'object' && !Array.isArray(resolved)
                ? (resolved as Record<string, unknown>)
                : undefined;
            const hasSummaryMetadata = !!summaryMetadata && Object.keys(summaryMetadata).length > 0;
            const metadataKind = `${listKind}-metadata`;
            const metadataEntriesAdded = new Set<string>();

            segments.forEach((segment, key) => {
                const [pagePart, columnPart] = key.split(':');
                const parsedPage = Number.parseInt(pagePart, 10);
                const parsedColumn = Number.parseInt(columnPart, 10);
                const pageNumber = Number.isNaN(parsedPage) ? baseLocation.page : parsedPage;
                const columnNumber = Number.isNaN(parsedColumn) ? baseLocation.column : toColumnType(parsedColumn);

                if (hasSummaryMetadata && segment.startIndex === 0 && !metadataEntriesAdded.has(key)) {
                    const metadataContent = toRegionContent(
                        metadataKind,
                        [],
                        0,
                        totalCount,
                        false,
                        summaryMetadata
                    );
                    const metadataMeasurementKey = computeMeasurementKey(instance.id, metadataContent);
                    const metadataRecord = measurements.get(metadataMeasurementKey);
                    const metadataEntry: CanvasLayoutEntry = {
                        instance,
                        slotIndex,
                        orderIndex: index - 0.5,
                        sourceRegionKey: key,
                        region: {
                            page: pageNumber,
                            column: columnNumber,
                        },
                        homeRegion: resolvedHome,
                        homeRegionKey: homeKey,
                        regionContent: metadataContent,
                        estimatedHeight: metadataRecord?.height ?? adapters.heightEstimator.estimateComponentHeight(summaryMetadata),
                        measurementKey: metadataMeasurementKey,
                        needsMeasurement: !metadataRecord,
                        span: metadataRecord ? { top: 0, bottom: metadataRecord.height, height: metadataRecord.height } : undefined,
                        slotDimensions,
                    };
                    if (!buckets.has(key)) {
                        buckets.set(key, []);
                    }
                    buckets.get(key)!.push(metadataEntry);
                    metadataEntriesAdded.add(key);
                }

                const regionContent = toRegionContent(
                    listKind,
                    segment.items,
                    segment.startIndex,
                    totalCount,
                    segment.startIndex > 0,
                    undefined
                );
                const measurementKey = computeMeasurementKey(instance.id, regionContent);
                const record = measurements.get(measurementKey);
                const entry: CanvasLayoutEntry = {
                    instance,
                    slotIndex,
                    orderIndex: index,
                    sourceRegionKey: key,
                    region: {
                        page: pageNumber,
                        column: columnNumber,
                    },
                    homeRegion: resolvedHome,
                    homeRegionKey: homeKey,
                    regionContent,
                    estimatedHeight: record?.height ?? adapters.heightEstimator.estimateListHeight(segment.items, segment.startIndex > 0),
                    measurementKey,
                    needsMeasurement: !record,
                    // CRITICAL FIX: Do NOT set span during creation
                    // span.top and span.bottom should only be set when entry is placed in a column (via computeSpan)
                    // Setting span.top = 0 causes overflow detection to fail because entryTop becomes 0
                    // Height is already stored in estimatedHeight, so we don't need span.height during creation
                    span: undefined,
                    slotDimensions,
                    listContinuation: {
                        isContinuation: segment.startIndex > 0,
                        startIndex: segment.startIndex,
                        totalCount,
                    },
                };
                if (!buckets.has(key)) {
                    buckets.set(key, []);
                }
                buckets.get(key)!.push(entry);
            });
            return;
        }

        const key = regionKey(baseLocation.page, baseLocation.column);
        const measurementKey = computeMeasurementKey(instance.id);
        const record = measurements.get(measurementKey);

        const entry: CanvasLayoutEntry = {
            instance,
            slotIndex,
            orderIndex: index,
            sourceRegionKey: key,
            region: baseLocation,
            homeRegion: resolvedHome,
            homeRegionKey: homeKey,
            measurementKey,
            estimatedHeight: record?.height ?? DEFAULT_COMPONENT_HEIGHT_PX,
            needsMeasurement: !record,
            // CRITICAL FIX: Do NOT set span during creation
            // span.top and span.bottom should only be set when entry is placed in a column (via computeSpan)
            // Setting span.top = 0 causes overflow detection to fail because entryTop becomes 0
            // Height is already stored in estimatedHeight, so we don't need span.height during creation
            span: undefined,
            slotDimensions,
        };
        if (!buckets.has(key)) {
            buckets.set(key, []);
        }
        buckets.get(key)!.push(entry);
    });

    buckets.forEach((entries) => {
        entries.sort((a, b) => {
            if (a.slotIndex !== b.slotIndex) return a.slotIndex - b.slotIndex;
            return a.orderIndex - b.orderIndex;
        });
    });

    return buckets;
};

/**
 * Create measurement entries from raw components BEFORE buckets are built.
 * This enables measure-first flow where we measure all components upfront.
 * 
 * For list components (actions, spells, etc.), generates split measurements for
 * all possible split points (1 item, 2 items, ..., N items). This enables
 * accurate pagination without proportional estimation.
 */
export const createInitialMeasurementEntries = ({
    instances,
    template,
    columnCount,
    pageWidthPx,
    dataSources,
    adapters,
}: {
    instances: ComponentInstance[];
    template: TemplateConfig;
    columnCount: number;
    pageWidthPx: number;
    dataSources: ComponentDataSource[];
    adapters: CanvasAdapters;
}): MeasurementEntry[] => {
    const entries: MeasurementEntry[] = [];
    const slotOrder = buildSlotOrder(template);

    instances.forEach((instance, index) => {
        const slotDimensions = slotDimensionLookup(template, instance.layout.slotId);
        const slotIndex = instance.layout.slotId
            ? slotOrder.get(instance.layout.slotId) ?? Number.MAX_SAFE_INTEGER
            : Number.MAX_SAFE_INTEGER;

        // Determine home region for this component
        const resolvedHomeRaw = resolveLocation(instance, template, columnCount, pageWidthPx);
        const homeRegion: RegionAssignment = {
            page: Math.max(1, resolvedHomeRaw.page),
            column: toColumnType(resolvedHomeRaw.column),
        };

        const homeKey = regionKey(homeRegion.page, homeRegion.column);
        const listKind = adapters.componentTypeMap[instance.type];

        // For list components, generate split measurements (including full list)
        // For non-list components, create basic block measurement
        if (listKind) {
            // Resolve data using adapter - fully generic, no statblock-specific logic
            const resolved = adapters.dataResolver.resolveDataReference(dataSources, instance.dataRef);

            // Normalize items using adapter (same logic as buildBuckets)
            const itemsSource = adapters.listNormalizer.normalizeListItems(
                resolved as unknown[] | undefined
            );

            const totalCount = itemsSource.length;

            if (totalCount === 0) {
                return; // Skip this instance, move to next
            }

            // Generate summary metadata for first-segment measurements
            // Adapter is responsible for including metadata in resolved data structure
            const summaryMetadata = resolved && typeof resolved === 'object' && !Array.isArray(resolved)
                ? (resolved as Record<string, unknown>)
                : undefined;
            const hasSummaryMetadata = !!summaryMetadata && Object.keys(summaryMetadata).length > 0;
            const metadataKind = `${listKind}-metadata`;

            if (hasSummaryMetadata) {
                const metadataContent = toRegionContent(
                    metadataKind,
                    [],
                    0,
                    totalCount,
                    false,
                    summaryMetadata
                );
                const metadataMeasurementKey = computeMeasurementKey(instance.id, metadataContent);
                entries.push({
                    instance,
                    slotIndex,
                    orderIndex: index - 0.5,
                    sourceRegionKey: homeKey,
                    region: homeRegion,
                    homeRegion,
                    homeRegionKey: homeKey,
                    regionContent: metadataContent,
                    estimatedHeight: adapters.heightEstimator.estimateComponentHeight(summaryMetadata),
                    measurementKey: metadataMeasurementKey,
                    needsMeasurement: true,
                    slotDimensions,
                });
            }

            // Generate split measurements for each possible split point
            // Example: For 14 spells, generate measurements for 1, 2, 3, ..., 14 items
            // IMPORTANT: Generate ALL splits including the full list (splitAt === totalCount)
            // because pagination needs the full list measurement key (e.g., "component-12:spell-list:0:14:14")
            for (let splitAt = 1; splitAt <= totalCount; splitAt++) {
                const items = itemsSource.slice(0, splitAt);
                const isContinuation = false; // Initial splits are never continuations

                const regionContent = toRegionContent(
                    listKind,
                    items,
                    0, // startIndex
                    totalCount,
                    isContinuation,
                    undefined
                );

                const splitMeasurementKey = computeMeasurementKey(instance.id, regionContent);

                entries.push({
                    instance,
                    slotIndex,
                    orderIndex: index,
                    sourceRegionKey: homeKey,
                    region: homeRegion,
                    homeRegion,
                    homeRegionKey: homeKey,
                    regionContent,
                    estimatedHeight: adapters.heightEstimator.estimateListHeight(items, isContinuation),
                    measurementKey: splitMeasurementKey,
                    needsMeasurement: true,
                    slotDimensions,
                });
            }

            // Generate continuation measurements (Phase 1: Strategic Continuations)
            // For lists that span multiple columns, we need measurements for continuations
            // (segments that start at index > 0)
            // Strategy: Generate shallow continuations for common split patterns
            // - Covers startIndex 1-5 (most common continuation points)
            // - Generates all possible count values from each startIndex
            // Example: 14 spells with startIndex=1 generates: (1,1), (1,2), ..., (1,13)
            const MAX_CONTINUATION_START_INDEX = Math.min(5, totalCount - 1);

            for (let startIdx = 1; startIdx <= MAX_CONTINUATION_START_INDEX; startIdx++) {
                const remainingCount = totalCount - startIdx;

                // Generate measurements for all possible continuation lengths from this start point
                for (let count = 1; count <= remainingCount; count++) {
                    const items = itemsSource.slice(startIdx, startIdx + count);
                    const isContinuation = true; // These are continuations

                    // Continuations don't include summary metadata (no intro paragraphs)
                    const regionContent = toRegionContent(
                        listKind,
                        items,
                        startIdx, // startIndex for continuation
                        totalCount,
                        isContinuation,
                        undefined // No metadata for continuations
                    );

                    const splitMeasurementKey = computeMeasurementKey(instance.id, regionContent);

                    entries.push({
                        instance,
                        slotIndex,
                        orderIndex: index,
                        sourceRegionKey: homeKey,
                        region: homeRegion,
                        homeRegion,
                        homeRegionKey: homeKey,
                        regionContent,
                        estimatedHeight: adapters.heightEstimator.estimateListHeight(items, isContinuation),
                        measurementKey: splitMeasurementKey,
                        needsMeasurement: true,
                        slotDimensions,
                    });
                }
            }

            // Generate single-item continuations for remaining indices
            // These handle the "last few items" cases (e.g., spell 13/14, spell 14/14)
            // which are common when lists nearly fit but need 1-2 items to continue
            if (totalCount > MAX_CONTINUATION_START_INDEX + 1) {
                for (let startIdx = MAX_CONTINUATION_START_INDEX + 1; startIdx < totalCount; startIdx++) {
                    const items = itemsSource.slice(startIdx, startIdx + 1);
                    const isContinuation = true;

                    const regionContent = toRegionContent(
                        listKind,
                        items,
                        startIdx,
                        totalCount,
                        isContinuation,
                        undefined
                    );

                    const splitMeasurementKey = computeMeasurementKey(instance.id, regionContent);

                    entries.push({
                        instance,
                        slotIndex,
                        orderIndex: index,
                        sourceRegionKey: homeKey,
                        region: homeRegion,
                        homeRegion,
                        homeRegionKey: homeKey,
                        regionContent,
                        estimatedHeight: adapters.heightEstimator.estimateListHeight(items, isContinuation),
                        measurementKey: splitMeasurementKey,
                        needsMeasurement: true,
                        slotDimensions,
                    });
                }
            }
        } else {
            // Non-list component: create basic block measurement
            const measurementKey = computeMeasurementKey(instance.id);

            entries.push({
                instance,
                slotIndex,
                orderIndex: index,
                sourceRegionKey: homeKey,
                region: homeRegion,
                homeRegion,
                homeRegionKey: homeKey,
                estimatedHeight: DEFAULT_COMPONENT_HEIGHT_PX,
                measurementKey,
                needsMeasurement: true,
                slotDimensions,
            });
        }
    });

    return entries;
};

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

export const buildCanvasEntries = ({
    instances,
    template,
    columnCount,
    pageWidthPx,
    dataSources,
    measurements,
    assignedRegions,
    adapters,
}: BuildCanvasEntriesArgs): CanvasEntriesResult => {
    const buckets = buildBuckets({ instances, template, columnCount, pageWidthPx, dataSources, measurements, assignedRegions, adapters });

    // CRITICAL: Always regenerate ALL split measurements, not just the ones used in pagination
    // This ensures all split variations remain available for future pagination runs
    // (e.g., after zoom, resize, or data updates)
    const allMeasurementEntries = createInitialMeasurementEntries({
        instances,
        template,
        columnCount,
        pageWidthPx,
        dataSources,
        adapters,
    });

    return { buckets, measurementEntries: allMeasurementEntries };
};

const slotDimensionLookup = (template: TemplateConfig, slotId: string | undefined) => {
    if (!slotId) {
        return undefined;
    }
    const slot = template.slots.find((item) => item.id === slotId);
    if (!slot) {
        return undefined;
    }
    return {
        widthPx: slot.position.width,
        heightPx: slot.position.height,
    };
};

/**
 * Computes canonical home regions for all component instances based on their template slots
 * and explicit layout.location settings. This map should be recomputed only when components
 * or the template change, not when measurements or reroutes occur.
 */
export const computeHomeRegions = ({
    instances,
    template,
    columnCount,
    pageWidthPx,
}: {
    instances: ComponentInstance[];
    template: TemplateConfig;
    columnCount: number;
    pageWidthPx: number;
}): Map<string, { homeRegion: RegionAssignment; slotIndex: number; orderIndex: number }> => {
    const slotOrder = buildSlotOrder(template);
    const homeRegions = new Map<string, { homeRegion: RegionAssignment; slotIndex: number; orderIndex: number }>();

    instances.forEach((instance, index) => {
        const resolvedHomeRaw = resolveLocation(instance, template, columnCount, pageWidthPx);
        const homeRegion: RegionAssignment = {
            page: Math.max(1, resolvedHomeRaw.page),
            column: columnCount === 1 ? 1 : (clamp(resolvedHomeRaw.column, 1, columnCount) as 1 | 2),
        };
        const slotIndex = instance.layout.slotId
            ? slotOrder.get(instance.layout.slotId) ?? Number.MAX_SAFE_INTEGER
            : Number.MAX_SAFE_INTEGER;

        homeRegions.set(instance.id, {
            homeRegion,
            slotIndex,
            orderIndex: index,
        });
    });

    return homeRegions;
};

