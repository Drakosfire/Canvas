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

// Temporary stubs for statblock-specific utilities
// TODO: Replace with adapter pattern or make configurable
function getPrimaryStatblock<T = unknown>(dataSources: ComponentDataSource[]): T | undefined {
    const source = dataSources.find((s) => s.type === 'statblock');
    return source?.payload as T | undefined;
}

function normalizeActionArray<T = unknown>(items: T[] | undefined | null): T[] {
    return items ? (Array.isArray(items) ? items : []) : [];
}

function resolveDataReference<T = unknown>(
    dataSources: ComponentDataSource[],
    dataRef: ComponentDataReference
): T | undefined {
    if (dataRef.type === 'statblock') {
        const source = dataSources.find((s) => s.type === 'statblock');
        if (source && typeof source.payload === 'object' && source.payload !== null) {
            const payload = source.payload as Record<string, unknown>;
            return payload[dataRef.path] as T | undefined;
        }
    } else if (dataRef.type === 'custom') {
        const source = dataSources.find((s) => s.type === 'custom');
        if (source && typeof source.payload === 'object' && source.payload !== null) {
            const payload = source.payload as Record<string, unknown>;
            return payload[dataRef.key] as T | undefined;
        }
    }
    return undefined;
}

export const PX_PER_INCH = 96;
export const MM_PER_INCH = 25.4;
export const MEASUREMENT_TOLERANCE_PX = 0.5;
export const MEASUREMENT_THROTTLE_MS = 150;

export const DEFAULT_PAGE_TOP_MARGIN_MM = 18;
export const DEFAULT_PAGE_BOTTOM_MARGIN_MM = 18;
export const COMPONENT_VERTICAL_SPACING_PX = 12; // Reduced from 18px for tighter layout
export const LIST_ITEM_SPACING_PX = 8; // Reduced from 12px for tighter layout
export const ACTION_HEADER_HEIGHT_PX = 36;
export const ACTION_CONTINUATION_HEADER_HEIGHT_PX = 28;
export const ACTION_META_LINE_HEIGHT_PX = 16;
export const ACTION_DESC_LINE_HEIGHT_PX = 18;
export const ACTION_AVG_CHARS_PER_LINE = 75;
export const DEFAULT_COMPONENT_HEIGHT_PX = 200;
export const MIN_LIST_ITEM_HEIGHT_PX = ACTION_HEADER_HEIGHT_PX + ACTION_DESC_LINE_HEIGHT_PX;

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
    const widthPx = convertToPixels(pageVariables.dimensions.width, pageVariables.dimensions.unit);
    const heightPx = convertToPixels(pageVariables.dimensions.height, pageVariables.dimensions.unit);
    const topMarginPx = convertToPixels(topMarginMm, 'mm');
    const bottomMarginPx = convertToPixels(bottomMarginMm, 'mm');
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

    return `${instanceId}:${regionContent.kind}:${regionContent.startIndex}:${regionContent.items.length}:${regionContent.totalCount}`;
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

const lineCountFromText = (text: string | undefined, avgCharsPerLine: number) => {
    if (!text) return 0;
    const length = text.length;
    if (length <= 0) return 0;
    return Math.ceil(length / avgCharsPerLine);
};

// Generic height estimation (accepts any object with desc-like property)
export const estimateActionHeight = (item: unknown) => {
    if (!item || typeof item !== 'object') return MIN_LIST_ITEM_HEIGHT_PX;
    const nameHeight = ACTION_HEADER_HEIGHT_PX;
    // Check for common metadata fields
    const hasMeta = 'usage' in item || 'recharge' in item || 'range' in item || 
                     'damageType' in item || 'damage' in item || 'attackBonus' in item;
    const metaHeight = hasMeta ? ACTION_META_LINE_HEIGHT_PX : 0;
    const desc = 'desc' in item && typeof item.desc === 'string' ? item.desc : '';
    const descLines = lineCountFromText(desc, ACTION_AVG_CHARS_PER_LINE);
    const descHeight = descLines * ACTION_DESC_LINE_HEIGHT_PX;
    const total = nameHeight + metaHeight + descHeight;
    return Math.max(total, MIN_LIST_ITEM_HEIGHT_PX);
};

export const estimateListHeight = (items: unknown[], isContinuation: boolean = false): number => {
    if (items.length === 0) return 0;
    const itemsHeight = items.reduce((acc: number, item) => acc + estimateActionHeight(item), 0);
    const spacingHeight = (items.length - 1) * LIST_ITEM_SPACING_PX;
    return itemsHeight + spacingHeight;
};

const REGION_KIND_MAP: Partial<Record<ComponentInstance['type'], RegionListContent['kind']>> = {
    'action-section': 'action-list',
    'trait-list': 'trait-list',
    'bonus-action-section': 'bonus-action-list',
    'reaction-section': 'reaction-list',
    'legendary-actions': 'legendary-action-list',
    'lair-actions': 'lair-action-list',
    'spellcasting-block': 'spell-list',
};

interface BuildBucketsArgs {
    instances: ComponentInstance[];
    template: TemplateConfig;
    columnCount: number;
    pageWidthPx: number;
    dataSources: ComponentDataSource[];
    measurements: Map<MeasurementKey, MeasurementRecord>;
    assignedRegions?: Map<string, SlotAssignment>;
}

export const buildBuckets = ({
    instances,
    template,
    columnCount,
    pageWidthPx,
    dataSources,
    measurements,
    assignedRegions,
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
        const listKind = REGION_KIND_MAP[instance.type];

        if (listKind) {
            const statblock = getPrimaryStatblock(dataSources);
            const resolved = resolveDataReference(dataSources, instance.dataRef);

            const itemsSource: unknown[] = (() => {
                switch (instance.type) {
                    case 'action-section': {
                        if (resolved && Array.isArray(resolved)) return normalizeActionArray(resolved);
                        const actions = statblock ? ((statblock as Record<string, unknown> as { actions?: unknown[] }).actions ?? undefined) : undefined;
                        return normalizeActionArray(actions);
                    }
                    case 'trait-list': {
                        if (resolved && Array.isArray(resolved)) return normalizeActionArray(resolved);
                        const abilities = statblock ? ((statblock as Record<string, unknown> as { specialAbilities?: unknown[] }).specialAbilities ?? undefined) : undefined;
                        return normalizeActionArray(abilities);
                    }
                    case 'bonus-action-section': {
                        if (resolved && Array.isArray(resolved)) return normalizeActionArray(resolved);
                        const bonusActions = statblock ? ((statblock as Record<string, unknown> as { bonusActions?: unknown[] }).bonusActions ?? undefined) : undefined;
                        return normalizeActionArray(bonusActions);
                    }
                    case 'reaction-section': {
                        if (resolved && Array.isArray(resolved)) return normalizeActionArray(resolved);
                        const reactions = statblock ? ((statblock as Record<string, unknown> as { reactions?: unknown[] }).reactions ?? undefined) : undefined;
                        return normalizeActionArray(reactions);
                    }
                    case 'legendary-actions': {
                        const legendary = (resolved as { actions?: unknown[] }) ?? (statblock as { legendaryActions?: { actions?: unknown[] } })?.legendaryActions;
                        return normalizeActionArray(legendary?.actions);
                    }
                    case 'lair-actions': {
                        const lair = (resolved as { actions?: unknown[] }) ?? (statblock as { lairActions?: { actions?: unknown[] } })?.lairActions;
                        return normalizeActionArray(lair?.actions);
                    }
                    case 'spellcasting-block': {
                        const spellcasting = (resolved as { cantrips?: unknown[]; knownSpells?: unknown[] }) ?? (statblock as { spells?: { cantrips?: unknown[]; known?: unknown[] } })?.spells;
                        // Combine cantrips and known spells into a single list for splitting
                        // Preserve ALL spell properties (level, school, usage) for proper rendering
                        const cantrips = (spellcasting?.cantrips ?? []).map((spell: any) => ({
                            id: spell.id ?? `cantrip-${spell.name?.toLowerCase().replace(/\s+/g, '-')}`,
                            name: spell.name,
                            desc: spell.description ?? '',
                            level: spell.level ?? 0,
                            school: spell.school,
                            usage: spell.usage,
                        }));
                        const knownSpells = (spellcasting?.knownSpells ?? []).map((spell: any) => ({
                            id: spell.id ?? `spell-${spell.name?.toLowerCase().replace(/\s+/g, '-')}`,
                            name: spell.name,
                            desc: spell.description ?? '',
                            level: spell.level,
                            school: spell.school,
                            usage: spell.usage,
                        }));
                        return normalizeActionArray([...cantrips, ...knownSpells] as unknown[]);
                    }
                    default:
                        return [];
                }
            })();

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

            const summaryMetadata = (() => {
                switch (instance.type) {
                    case 'legendary-actions':
                        return {
                            legendarySummary:
                                (resolved as { description?: string; actionsPerTurn?: number })?.description ??
                                (statblock as { legendaryActions?: { description?: string } })?.legendaryActions?.description ??
                                'The creature can take the following legendary actions, choosing from the options below.',
                            legendaryFrequency:
                                (resolved as { actionsPerTurn?: number })?.actionsPerTurn ??
                                (statblock as { legendaryActions?: { actionsPerTurn?: number } })?.legendaryActions?.actionsPerTurn,
                        };
                    case 'lair-actions':
                        return {
                            lairSummary:
                                (resolved as { description?: string })?.description ??
                                (statblock as { lairActions?: { description?: string } })?.lairActions?.description ??
                                'On initiative count 20 (losing initiative ties), the creature uses one of the following lair actions.',
                        };
                    default:
                        return undefined;
                }
            })();

            segments.forEach((segment, key) => {
                const [pagePart, columnPart] = key.split(':');
                const parsedPage = Number.parseInt(pagePart, 10);
                const parsedColumn = Number.parseInt(columnPart, 10);
                const pageNumber = Number.isNaN(parsedPage) ? baseLocation.page : parsedPage;
                const columnNumber = Number.isNaN(parsedColumn) ? baseLocation.column : toColumnType(parsedColumn);
                const regionContent = toRegionContent(
                    listKind,
                    segment.items,
                    segment.startIndex,
                    totalCount,
                    segment.startIndex > 0,
                    segment.startIndex === 0 ? summaryMetadata : undefined
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
                    estimatedHeight: record?.height ?? estimateListHeight(segment.items, segment.startIndex > 0),
                    measurementKey,
                    needsMeasurement: !record,
                    span: record ? { top: 0, bottom: record.height, height: record.height } : undefined,
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
            span: record ? { top: 0, bottom: record.height, height: record.height } : undefined,
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
}: {
    instances: ComponentInstance[];
    template: TemplateConfig;
    columnCount: number;
    pageWidthPx: number;
    dataSources: ComponentDataSource[];
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
        const listKind = REGION_KIND_MAP[instance.type];

        // For list components, generate split measurements (including full list)
        // For non-list components, create basic block measurement
        if (listKind) {
            const statblock = getPrimaryStatblock(dataSources);
            const resolved = resolveDataReference(dataSources, instance.dataRef);

            // Extract items using same logic as buildBuckets
            const itemsSource: unknown[] = (() => {
                switch (instance.type) {
                    case 'action-section': {
                        if (resolved && Array.isArray(resolved)) return normalizeActionArray(resolved);
                        const actions = statblock ? ((statblock as Record<string, unknown> as { actions?: unknown[] }).actions ?? undefined) : undefined;
                        return normalizeActionArray(actions);
                    }
                    case 'trait-list': {
                        if (resolved && Array.isArray(resolved)) return normalizeActionArray(resolved);
                        const abilities = statblock ? ((statblock as Record<string, unknown> as { specialAbilities?: unknown[] }).specialAbilities ?? undefined) : undefined;
                        return normalizeActionArray(abilities);
                    }
                    case 'bonus-action-section': {
                        if (resolved && Array.isArray(resolved)) return normalizeActionArray(resolved);
                        const bonusActions = statblock ? ((statblock as Record<string, unknown> as { bonusActions?: unknown[] }).bonusActions ?? undefined) : undefined;
                        return normalizeActionArray(bonusActions);
                    }
                    case 'reaction-section': {
                        if (resolved && Array.isArray(resolved)) return normalizeActionArray(resolved);
                        const reactions = statblock ? ((statblock as Record<string, unknown> as { reactions?: unknown[] }).reactions ?? undefined) : undefined;
                        return normalizeActionArray(reactions);
                    }
                    case 'legendary-actions': {
                        const legendary = (resolved as { actions?: unknown[] }) ?? (statblock as { legendaryActions?: { actions?: unknown[] } })?.legendaryActions;
                        return normalizeActionArray(legendary?.actions);
                    }
                    case 'lair-actions': {
                        const lair = (resolved as { actions?: unknown[] }) ?? (statblock as { lairActions?: { actions?: unknown[] } })?.lairActions;
                        return normalizeActionArray(lair?.actions);
                    }
                    case 'spellcasting-block': {
                        const spellcasting = (resolved as { cantrips?: unknown[]; knownSpells?: unknown[] }) ?? (statblock as { spells?: { cantrips?: unknown[]; known?: unknown[] } })?.spells;
                        const cantrips = (spellcasting?.cantrips ?? []).map((spell: any) => ({
                            id: spell.id ?? `cantrip-${spell.name?.toLowerCase().replace(/\s+/g, '-')}`,
                            name: spell.name,
                            desc: spell.description ?? '',
                            level: spell.level ?? 0,
                            school: spell.school,
                            usage: spell.usage,
                        }));
                        const knownSpells = (spellcasting?.knownSpells ?? []).map((spell: any) => ({
                            id: spell.id ?? `spell-${spell.name?.toLowerCase().replace(/\s+/g, '-')}`,
                            name: spell.name,
                            desc: spell.description ?? '',
                            level: spell.level,
                            school: spell.school,
                            usage: spell.usage,
                        }));
                        return normalizeActionArray([...cantrips, ...knownSpells] as unknown[]);
                    }
                    default:
                        return [];
                }
            })();

            const totalCount = itemsSource.length;

            if (totalCount === 0) {
                return; // Skip this instance, move to next
            }

            // Generate summary metadata for first-segment measurements
            // This ensures measurements include the intro paragraph (e.g., legendary actions summary)
            const summaryMetadata = (() => {
                switch (instance.type) {
                    case 'legendary-actions':
                        return {
                            legendarySummary:
                                (resolved as { description?: string; actionsPerTurn?: number })?.description ??
                                (statblock as { legendaryActions?: { description?: string } })?.legendaryActions?.description ??
                                'The creature can take the following legendary actions, choosing from the options below.',
                            legendaryFrequency:
                                (resolved as { actionsPerTurn?: number })?.actionsPerTurn ??
                                (statblock as { legendaryActions?: { actionsPerTurn?: number } })?.legendaryActions?.actionsPerTurn,
                        };
                    case 'lair-actions':
                        return {
                            lairSummary:
                                (resolved as { description?: string })?.description ??
                                (statblock as { lairActions?: { description?: string } })?.lairActions?.description ??
                                'On initiative count 20 (losing initiative ties), the creature uses one of the following lair actions.',
                        };
                    default:
                        return undefined;
                }
            })();

            // Generate split measurements for each possible split point
            // Example: For 14 spells, generate measurements for 1, 2, 3, ..., 14 items
            // IMPORTANT: Generate ALL splits including the full list (splitAt === totalCount)
            // because pagination needs the full list measurement key (e.g., "component-12:spell-list:0:14:14")
            // CRITICAL: Include summaryMetadata for first segments (startIndex === 0) to match visible rendering
            for (let splitAt = 1; splitAt <= totalCount; splitAt++) {
                const items = itemsSource.slice(0, splitAt);
                const isContinuation = false; // Initial splits are never continuations

                const regionContent = toRegionContent(
                    listKind,
                    items,
                    0, // startIndex
                    totalCount,
                    isContinuation,
                    summaryMetadata // Include metadata for accurate measurement
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
                    estimatedHeight: estimateListHeight(items, isContinuation),
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
                        estimatedHeight: estimateListHeight(items, isContinuation),
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
                        estimatedHeight: estimateListHeight(items, isContinuation),
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
}

export const buildCanvasEntries = ({
    instances,
    template,
    columnCount,
    pageWidthPx,
    dataSources,
    measurements,
    assignedRegions,
}: BuildCanvasEntriesArgs): CanvasEntriesResult => {
    const buckets = buildBuckets({ instances, template, columnCount, pageWidthPx, dataSources, measurements, assignedRegions });

    // CRITICAL: Always regenerate ALL split measurements, not just the ones used in pagination
    // This ensures all split variations remain available for future pagination runs
    // (e.g., after zoom, resize, or data updates)
    const allMeasurementEntries = createInitialMeasurementEntries({
        instances,
        template,
        columnCount,
        pageWidthPx,
        dataSources,
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

