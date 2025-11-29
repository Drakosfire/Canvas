import type {
    LayoutPlan,
    CanvasLayoutEntry,
    LayoutColumn,
    PageLayout,
    OverflowWarning,
    RegionBuckets,
    RegionListContent,
    RegionCursor,
    RegionSpan,
    MeasurementKey,
    MeasurementRecord,
} from './types';
import type { CanvasAdapters } from '../types/adapters.types';
import { toRegionContent } from './utils-generic';
import {
    COMPONENT_VERTICAL_SPACING_PX,
    LIST_ITEM_SPACING_PX,
    COLUMN_PADDING_PX,
    computeMeasurementKey,
    regionKey,
    toColumnType,
    DEFAULT_COMPONENT_HEIGHT_PX,
} from './utils';
import { isDebugEnabled } from './debugFlags';
import { buildSegmentPlan, SegmentRerouteCache } from './planner';
import type { PlannerRegionConfig, SegmentDescriptor } from './segmentTypes';
import { logRegionHeightEvent } from './regionHeightDebug';

interface RegionPosition {
    pageNumber: number;
    columnNumber: 1 | 2;
    key: string;
}

interface PaginateArgs {
    buckets: RegionBuckets;
    columnCount: number;
    regionHeightPx: number;
    requestedPageCount: number;
    baseDimensions?: { contentHeightPx: number; topMarginPx: number } | null;
    measurementVersion?: number;
    measurements: Map<MeasurementKey, MeasurementRecord>;
    adapters: CanvasAdapters;
    segmentRerouteCache?: SegmentRerouteCache;
    previousPlan?: LayoutPlan | null;
}

// Diagnostic: Log when module loads (before any other code)
// Always log in browser (webpack will strip this in production builds)
if (typeof window !== 'undefined') {
    // eslint-disable-next-line no-console
    console.log('🔧 [Canvas paginate.ts] Module loaded', {
        timestamp: new Date().toISOString(),
        hasWindow: typeof window !== 'undefined',
        hasProcess: typeof process !== 'undefined',
        NODE_ENV: typeof process !== 'undefined' ? process.env.NODE_ENV : 'browser',
        // React Scripts replaces process.env.REACT_APP_* at build time
        REACT_APP_CANVAS_DEBUG_COMPONENTS: process.env.REACT_APP_CANVAS_DEBUG_COMPONENTS || 'not set',
    });
}

const MAX_REGION_ITERATIONS = 400;
const MAX_PAGES = 10; // Circuit breaker to prevent infinite pagination loops
const MAX_PAGINATION_RUNS_PER_SIGNATURE = 10; // Prevent runaway pagination loops without layout changes

type PaginationLoopGuardKey = string;

let paginationLoopGuardKey: PaginationLoopGuardKey | null = null;
let paginationLoopGuardCount = 0;
let paginationLoopGuardTriggered = false;

const buildBucketSignature = (buckets: RegionBuckets): string => {
    if (buckets.size === 0) {
        return 'empty';
    }
    return Array.from(buckets.entries())
        .map(([key, entries]) => `${key}:${entries.length}`)
        .sort()
        .join('|');
};

const createEmptyPlan = (): LayoutPlan => ({
    pages: [],
    overflowWarnings: [],
});

// Entry removal threshold: Only remove entries if overflow exceeds this value (prevents aggressive removal for sub-pixel overflows)
const ENTRY_REMOVAL_OVERFLOW_THRESHOLD_PX = 5;

// Significant region height change threshold: Reset already-rerouted flag if region height changes by more than this
const SIGNIFICANT_REGION_HEIGHT_CHANGE_PX = 10;

// No default debug components - use CLI/env vars to specify: npm run canvas-debug -- component-1 component-2
const DEFAULT_DEBUG_COMPONENT_IDS: string[] = [];

const parseComponentIdList = (value: unknown): string[] => {
    if (Array.isArray(value)) {
        return value
            .map((item) => (typeof item === 'string' ? item.trim() : ''))
            .filter((item): item is string => item.length > 0);
    }

    if (typeof value === 'string') {
        return value
            .split(/[, ]+/)
            .map((item) => item.trim())
            .filter((item) => item.length > 0);
    }

    if (value && typeof value === 'object') {
        return parseComponentIdList((value as { ids?: unknown }).ids);
    }

    return [];
};

const readComponentIdsFromEnv = (): string[] => {
    // React Scripts replaces process.env.REACT_APP_* at build time
    // Access directly - webpack will replace with literal string or undefined
    const reactAppValue = process.env.REACT_APP_CANVAS_DEBUG_COMPONENTS;
    if (reactAppValue) {
        return parseComponentIdList(reactAppValue);
    }
    // Fallback to non-prefixed var (for Node.js/server-side)
    const envValue = typeof process !== 'undefined' && process.env ? process.env.CANVAS_DEBUG_COMPONENTS : undefined;
    return parseComponentIdList(envValue);
};

const readComponentIdsFromGlobal = (): string[] => {
    if (typeof globalThis === 'undefined') {
        return [];
    }
    const globalValue = (globalThis as { __CANVAS_DEBUG_COMPONENTS?: unknown }).__CANVAS_DEBUG_COMPONENTS;
    return parseComponentIdList(globalValue);
};

const readComponentIdsFromStorage = (): string[] => {
    if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
        return [];
    }
    try {
        const stored = window.localStorage.getItem('canvas-debug:components');
        return parseComponentIdList(stored);
    } catch {
        return [];
    }
};

const buildDebugComponentSet = (): Set<string> => {
    const ids = new Set<string>();
    DEFAULT_DEBUG_COMPONENT_IDS.forEach((id) => ids.add(id));
    readComponentIdsFromEnv().forEach((id) => ids.add(id));
    readComponentIdsFromGlobal().forEach((id) => ids.add(id));
    readComponentIdsFromStorage().forEach((id) => ids.add(id));
    return ids;
};

const DEBUG_COMPONENT_IDS = buildDebugComponentSet();

/**
 * Normalize component IDs to zero-padded format for consistent logging.
 * Examples: "component-0" -> "component-00", "component-1" -> "component-01", "component-10" -> "component-10"
 * 
 * @export
 * Exported for use in measurement.tsx and other modules
 */
export const normalizeComponentId = (componentId: string): string => {
    const match = componentId.match(/^component-(\d+)$/);
    if (match) {
        const num = parseInt(match[1], 10);
        return `component-${num.toString().padStart(2, '0')}`;
    }
    return componentId; // Return as-is if not in expected format
};

/**
 * Check if a component ID matches a normalized debug component ID.
 * This allows checking against zero-padded IDs (e.g., "component-01") even if the actual ID is "component-1".
 */
const matchesDebugComponent = (componentId: string, debugId: string): boolean => {
    const normalized = normalizeComponentId(componentId);
    const normalizedDebug = normalizeComponentId(debugId);
    return normalized === normalizedDebug;
};

const isPaginationDebugEnabled = (): boolean => isDebugEnabled('paginate-spellcasting');
const isPlannerDebugEnabled = (): boolean => isDebugEnabled('planner-spellcasting');
const isCursorDebugEnabled = (): boolean => isDebugEnabled('cursor');
// Only debug components explicitly specified via CLI/env vars
// If "*" is in the set, debug all components; otherwise check if component ID is in set
const shouldDebugComponent = (componentId: string): boolean =>
    DEBUG_COMPONENT_IDS.has('*') || DEBUG_COMPONENT_IDS.has(componentId);

// Export for use in other modules (e.g., StatblockPage.tsx)
export const isComponentDebugEnabled = (componentId: string): boolean =>
    shouldDebugComponent(componentId);

// Log debug configuration on module load (once per page load)
// Check in browser context (webpack replaces process.env.REACT_APP_* at build time)
if (typeof window !== 'undefined') {
    const enabledFlags: string[] = [];
    if (isPaginationDebugEnabled()) enabledFlags.push('paginate');
    if (isPlannerDebugEnabled()) enabledFlags.push('planner');
    if (isCursorDebugEnabled()) enabledFlags.push('cursor');
    if (isDebugEnabled('layout-plan-diff')) enabledFlags.push('plan-diff');
    if (isDebugEnabled('measurement-spellcasting')) enabledFlags.push('measurement');
    if (isDebugEnabled('layout-dirty')) enabledFlags.push('layout');
    if (isDebugEnabled('measure-first')) enabledFlags.push('measure-first');

    // Always log debug configuration in browser (removed conditional to ensure visibility)
    // eslint-disable-next-line no-console
    console.log('🎯 [Canvas Debug] Active configuration:', {
        componentIds: Array.from(DEBUG_COMPONENT_IDS),
        wildcardEnabled: DEBUG_COMPONENT_IDS.has('*'),
        enabledFlags: enabledFlags.length > 0 ? enabledFlags : ['none'],
        source: {
            env: readComponentIdsFromEnv().length > 0 ? 'env' : null,
            global: readComponentIdsFromGlobal().length > 0 ? 'global' : null,
            storage: readComponentIdsFromStorage().length > 0 ? 'storage' : null,
            default: DEFAULT_DEBUG_COMPONENT_IDS.length > 0 ? 'default' : null,
        },
        envVars: {
            // React Scripts replaces process.env.REACT_APP_* at build time
            REACT_APP_CANVAS_DEBUG_COMPONENTS: process.env.REACT_APP_CANVAS_DEBUG_COMPONENTS || 'not set',
            REACT_APP_CANVAS_DEBUG_PAGINATE: process.env.REACT_APP_CANVAS_DEBUG_PAGINATE || 'not set',
            REACT_APP_CANVAS_DEBUG_PLANNER: process.env.REACT_APP_CANVAS_DEBUG_PLANNER || 'not set',
        },
        diagnostic: {
            DEBUG_COMPONENT_IDS_size: DEBUG_COMPONENT_IDS.size,
            enabledFlags_length: enabledFlags.length,
            NODE_ENV: typeof process !== 'undefined' ? process.env.NODE_ENV : 'browser',
        },
    });
}

const logPaginationTrace = (emoji: string, label: string, payload?: unknown) => {
    if (!isPaginationDebugEnabled()) {
        return;
    }

    if (typeof payload !== 'undefined') {
        console.log(`${emoji} [paginate][Debug] ${label}`, payload);
    } else {
        console.log(`${emoji} [paginate][Debug] ${label}`);
    }
};

const debugLog = (componentId: string, emoji: string, label: string, payload?: unknown) => {
    if (!shouldDebugComponent(componentId)) {
        return;
    }

    // Normalize componentId for consistent logging
    const normalizedId = normalizeComponentId(componentId);
    const basePayload: Record<string, unknown> = { componentId: normalizedId };

    // If payload has its own componentId, normalize it too
    if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
        const payloadObj = payload as Record<string, unknown>;
        const normalizedPayload = { ...payloadObj };
        if (normalizedPayload.componentId && typeof normalizedPayload.componentId === 'string') {
            normalizedPayload.componentId = normalizeComponentId(normalizedPayload.componentId);
        }
        Object.assign(basePayload, normalizedPayload);
    } else if (payload !== undefined) {
        basePayload.value = payload;
    }

    logPaginationTrace(emoji, label, basePayload);
};

let debugRunId = 0;

// Track last pagination inputs to detect duplicate runs
interface LastPaginationInputs {
    regionHeightPx: number;
    columnCount: number;
    requestedPageCount: number;
    bucketCount: number;
    measurementVersion: number | undefined;
    measurementKeysHash: string; // Hash of measurement keys and heights
}

let lastPaginationInputs: LastPaginationInputs | null = null;

/**
 * Create a hash of measurement keys and heights for comparison
 */
function hashMeasurements(measurements: Map<MeasurementKey, MeasurementRecord>): string {
    const entries = Array.from(measurements.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, record]) => `${key}:${record.height.toFixed(2)}`)
        .join('|');
    return entries;
}

/**
 * Check if pagination inputs are identical to last run
 */
function areInputsIdentical(
    regionHeightPx: number,
    columnCount: number,
    requestedPageCount: number,
    bucketCount: number,
    measurementVersion: number | undefined,
    measurements: Map<MeasurementKey, MeasurementRecord>
): boolean {
    if (!lastPaginationInputs) {
        return false;
    }

    const measurementKeysHash = hashMeasurements(measurements);

    return (
        Math.abs(lastPaginationInputs.regionHeightPx - regionHeightPx) < 0.01 &&
        lastPaginationInputs.columnCount === columnCount &&
        lastPaginationInputs.requestedPageCount === requestedPageCount &&
        lastPaginationInputs.bucketCount === bucketCount &&
        lastPaginationInputs.measurementVersion === measurementVersion &&
        lastPaginationInputs.measurementKeysHash === measurementKeysHash
    );
}

const shouldLogPaginationDecisions = (): boolean => isPaginationDebugEnabled();

// Track statistics for optimization analysis
interface PaginationStats {
    heightSources: { measured: number; proportional: number; estimate: number };
    bottomZoneRejections: number;
    splitDecisions: number;
    componentsPlaced: number;
}

const paginationStats: PaginationStats = {
    heightSources: { measured: 0, proportional: 0, estimate: 0 },
    bottomZoneRejections: 0,
    splitDecisions: 0,
    componentsPlaced: 0,
};

const logPaginationDecision = (...args: unknown[]) => {
    if (!shouldLogPaginationDecisions()) {
        return;
    }

    // Extract componentId from payload if present
    // Format: logPaginationDecision(runId, 'label', { componentId: ..., ... })
    let shouldLog = true;
    let normalizedArgs = [...args];

    if (args.length >= 3 && typeof args[2] === 'object' && args[2] !== null) {
        const payload = args[2] as { componentId?: string;[key: string]: unknown };
        if (payload.componentId) {
            // Only log if this component is in the debug list
            shouldLog = shouldDebugComponent(payload.componentId);

            // Normalize componentId in payload for consistent logging
            const normalizedPayload = { ...payload };
            normalizedPayload.componentId = normalizeComponentId(payload.componentId);
            normalizedArgs = [args[0], args[1], normalizedPayload, ...args.slice(3)];
        }
    }
    // For logs without componentId (like 'run-start'), always log if pagination debug is enabled

    if (!shouldLog) {
        return;
    }

    // eslint-disable-next-line no-console
    console.debug('[paginate]', ...normalizedArgs);
};

const isSpellcastingMeasurementKey = (key: string): boolean =>
    key.includes('spell-list');

const toSegmentDescriptor = (
    entry: CanvasLayoutEntry,
    regionKey: string,
    measurements: Map<MeasurementKey, MeasurementRecord>
): SegmentDescriptor | null => {
    if (!isSpellcastingMeasurementKey(entry.measurementKey)) {
        return null;
    }

    const measurement = measurements.get(entry.measurementKey);
    const heightPx = measurement?.height ?? entry.estimatedHeight ?? DEFAULT_COMPONENT_HEIGHT_PX;

    const descriptor: SegmentDescriptor = {
        componentId: entry.instance.id,
        segmentId: entry.measurementKey,
        measurementKey: entry.measurementKey,
        regionKey,
        heightPx,
        estimatedHeightPx: measurement ? undefined : entry.estimatedHeight,
        spacingAfterPx: COMPONENT_VERTICAL_SPACING_PX,
        isMetadata: entry.regionContent?.kind?.includes('metadata') ?? false,
        isContinuation: entry.regionContent?.isContinuation ?? false,
        startIndex: entry.regionContent?.startIndex,
        itemCount: entry.regionContent?.items.length,
        totalCount: entry.regionContent?.totalCount,
    };

    return descriptor;
};

const buildPlannerRegions = (
    pages: PageLayout[],
    regionHeightPx: number
): PlannerRegionConfig[] => {
    const sequence = computeRegionSequence(pages);
    // Ensure unique keys in region order
    const seen = new Set<string>();
    const configs: PlannerRegionConfig[] = [];

    // Account for column padding: content area is reduced by top + bottom padding
    const contentMaxHeightPx = regionHeightPx - (2 * COLUMN_PADDING_PX);

    sequence.forEach((region, index) => {
        if (seen.has(region.key)) {
            return;
        }
        seen.add(region.key);
        configs.push({
            key: region.key,
            maxHeightPx: contentMaxHeightPx,
            cursorOffsetPx: COLUMN_PADDING_PX, // Start after top padding
        });
    });

    return configs;
};

const ensurePage = (
    pages: PageLayout[],
    pageNumber: number,
    columnCount: number,
    pendingQueues: Map<string, CanvasLayoutEntry[]>,
    runId?: number,
    reason?: string
): boolean => {
    while (pages.length < pageNumber) {
        const nextPageNumber = pages.length + 1;

        // Circuit breaker: prevent infinite pagination
        if (nextPageNumber > MAX_PAGES) {
            console.error('[paginate] ⚠️ MAX_PAGES LIMIT REACHED:', {
                currentPages: pages.length,
                requestedPage: pageNumber,
                maxPages: MAX_PAGES,
                reason: 'Pagination stopped to prevent infinite loop',
                suggestion: 'Check for components with abnormal heights (>1500px) that never fit on a page',
            });
            return false; // Signal that we hit the limit
        }

        const columns: LayoutColumn[] = [];
        for (let columnIndex = 1; columnIndex <= columnCount; columnIndex += 1) {
            const key = regionKey(nextPageNumber, columnIndex);
            columns.push({ columnNumber: toColumnType(columnIndex), key, entries: [] });
            if (!pendingQueues.has(key)) {
                pendingQueues.set(key, []);
            }
        }
        pages.push({ pageNumber: nextPageNumber, columns });

        // Log page creation for debugging
        if (isCursorDebugEnabled() || isPaginationDebugEnabled()) {
            logPaginationDecision(runId ?? 0, 'page-created', {
                pageNumber: nextPageNumber,
                totalPages: pages.length,
                requestedPage: pageNumber,
                reason: reason ?? 'unknown',
                columnCount,
            });
        }
    }
    return true; // Successfully created pages
};

const computeRegionSequence = (pages: PageLayout[]): RegionPosition[] =>
    pages.flatMap((page) =>
        page.columns.map((column) => ({
            pageNumber: page.pageNumber,
            columnNumber: column.columnNumber,
            key: column.key,
        }))
    );

const findNextRegion = (pages: PageLayout[], currentKey: string): RegionPosition | null => {
    const sequence = computeRegionSequence(pages);
    const currentIndex = sequence.findIndex((region) => region.key === currentKey);
    if (currentIndex === -1) {
        return null;
    }
    return sequence[currentIndex + 1] ?? null;
};

/**
 * Find the other column on the same page as the current region.
 * For 2-column layouts, returns column 2 if current is column 1, and vice versa.
 * Returns null if there's no other column (single-column layout or invalid region).
 */
const findOtherColumnOnSamePage = (pages: PageLayout[], currentKey: string): RegionPosition | null => {
    for (const page of pages) {
        for (const column of page.columns) {
            if (column.key === currentKey) {
                // Found the current region, now find the other column on the same page
                const otherColumn = page.columns.find((col) => col.key !== currentKey);
                if (otherColumn) {
                    return {
                        pageNumber: page.pageNumber,
                        columnNumber: otherColumn.columnNumber,
                        key: otherColumn.key,
                    };
                }
                return null; // Single-column layout or no other column found
            }
        }
    }
    return null; // Current region not found
};

const createCursor = (regionKey: string, maxHeight: number, initialOffset: number = 0): RegionCursor => ({
    regionKey,
    currentOffset: initialOffset,
    maxHeight,
});

const computeSpan = (cursor: RegionCursor, estimatedHeight: number): RegionSpan => {
    const span: RegionSpan = {
        top: cursor.currentOffset,
        bottom: cursor.currentOffset + estimatedHeight,
        height: estimatedHeight,
    };

    return span;
};

const fitsInRegion = (span: RegionSpan, cursor: RegionCursor, componentId?: string): boolean => {
    // Add safety buffer to account for measurement/rendering micro-differences
    // Sub-pixel rendering and margin collapse can cause ~10-15px variations
    const BOTTOM_ZONE_SAFETY_BUFFER_PX = 20;

    // Check if component + safety buffer fits in region
    // CSS gap handles spacing between entries, so we only check entry bottom
    const cursorAfterPlacement = span.bottom;
    const fits = cursorAfterPlacement <= (cursor.maxHeight - BOTTOM_ZONE_SAFETY_BUFFER_PX);

    // CRITICAL: Log component-5 fitsInRegion checks
    if (isPaginationDebugEnabled() && componentId && (componentId === 'component-5' || componentId.includes('component-5'))) {
        debugLog('component-5', '🔍', 'fitsInRegion-check', {
            spanTop: span.top,
            spanBottom: span.bottom,
            spanHeight: span.height,
            cursorAfterPlacement,
            cursorMaxHeight: cursor.maxHeight,
            safetyBuffer: BOTTOM_ZONE_SAFETY_BUFFER_PX,
            effectiveMaxHeight: cursor.maxHeight - BOTTOM_ZONE_SAFETY_BUFFER_PX,
            fits,
            reason: fits ? 'FITS' : 'OVERFLOWS',
            overflowAmount: cursorAfterPlacement - (cursor.maxHeight - BOTTOM_ZONE_SAFETY_BUFFER_PX),
        });
    }

    return fits;
};

const advanceCursor = (cursor: RegionCursor, span: RegionSpan) => {
    // Add gap after entry to match CSS flex gap between entries
    // This ensures pagination accounts for the 12px spacing CSS applies
    cursor.currentOffset = span.bottom + COMPONENT_VERTICAL_SPACING_PX;
};

const detachFromSource = (entry: CanvasLayoutEntry, key: string, buckets: Map<string, CanvasLayoutEntry[]>) => {
    if (entry.sourceRegionKey === key) {
        return;
    }
    const original = buckets.get(entry.sourceRegionKey);
    if (!original) {
        return;
    }
    const index = original.indexOf(entry);
    if (index !== -1) {
        original.splice(index, 1);
    }
};

// Track previous regionHeight to detect feedback loops
let lastRegionHeightPx: number | null = null;
let lastNormalizedHeight: number | null = null;

/**
 * Split decision result for list components
 */
interface SplitDecision {
    canPlace: boolean;              // Can we place any items?
    placedItems: unknown[];         // Items to place in current region
    remainingItems: unknown[];      // Items to move to next region
    placedHeight: number;           // Height of placed segment
    placedTop: number;              // Top position in region
    placedBottom: number;           // Bottom position in region
    willOverflow: boolean;          // Will placed segment exceed region boundary?
    reason: string;                 // Why this decision was made
    metadataOnly?: boolean;         // True when placing intro metadata without items
    preferMove?: boolean;           // Suggest moving whole component is better than splitting
}

/**
 * Configuration for smarter split decisions (Phase 4 A2)
 */
interface SmartSplitConfig {
    /** Minimum items to justify a split. Below this, prefer moving whole component. Default: 2 */
    minItemsForSplit: number;
    /** If whole list fits in next region and only this many items would split, prefer move. Default: 2 */
    preferMoveThreshold: number;
    /** Available space in next region (if known). Used to decide split vs move. */
    nextRegionCapacity?: number;
}

const DEFAULT_SMART_SPLIT_CONFIG: SmartSplitConfig = {
    minItemsForSplit: 2,
    preferMoveThreshold: 2,
};

/**
 * Find best split point for list component using measurement-based evaluation.
 * 
 * Algorithm (Phase 4 A2 - Enhanced with cost-based decisions):
 * 1. Calculate full component height
 * 2. Check if moving whole component is better than splitting:
 *    - If only 1-2 items would fit, AND whole list fits in next region → prefer move
 * 3. Try splits from largest to smallest (greedy: maximize items in current region)
 * 4. For each split option, MEASURE where it would be placed
 * 5. Check constraints:
 *    - Top: Does it start in bottom 20%? (invalid except minimum-1-item rule)
 *    - Bottom: Does it exceed region boundary? (try fewer items)
 * 6. Return first split that satisfies constraints
 * 
 * @param entry - Layout entry with regionContent
 * @param cursor - Current position in region
 * @param regionHeight - Total region height
 * @param measurements - Measurement map to look up actual heights
 * @param adapters - Canvas adapters for height estimation
 * @param smartSplitConfig - Configuration for smart split decisions (optional)
 * @returns Split decision with placement details
 */
const findBestListSplit = (
    entry: CanvasLayoutEntry,
    cursor: RegionCursor,
    regionHeight: number,
    measurements: Map<MeasurementKey, MeasurementRecord>,
    adapters: CanvasAdapters,
    smartSplitConfig?: Partial<SmartSplitConfig>
): SplitDecision => {
    const config = { ...DEFAULT_SMART_SPLIT_CONFIG, ...smartSplitConfig };
    const items = entry.regionContent!.items;
    const BOTTOM_THRESHOLD = 1; // Cannot start in bottom 20%
    const currentOffset = cursor.currentOffset;
    const hasIntroMetadata =
        !!entry.regionContent!.metadata &&
        entry.regionContent!.startIndex === 0 &&
        !entry.regionContent!.isContinuation;
    const minimumSplit = hasIntroMetadata ? 0 : 1;

    // Phase 4 A2: With measurement perfection (Phase 1 & 2), we no longer need
    // artificial chunk size limits. Let the split algorithm find the natural break point.
    const maxSplit = items.length;

    // Phase 4 A2: Smart split decision - check if moving is better than splitting
    // Get full component height to check if it would fit in next region
    const remainingSpaceInCurrent = regionHeight - currentOffset;

    if (config.nextRegionCapacity !== undefined && items.length > 1) {
        // Calculate full list height
        const fullRegionContent = toRegionContent(
            entry.regionContent!.kind,
            items,
            entry.regionContent!.startIndex,
            entry.regionContent!.totalCount,
            entry.regionContent!.isContinuation,
            entry.regionContent!.metadata
        );
        const fullMeasurementKey = computeMeasurementKey(entry.instance.id, fullRegionContent);
        const fullMeasured = measurements.get(fullMeasurementKey);
        const fullEstimated = adapters.heightEstimator.estimateListHeight(items, entry.regionContent!.isContinuation);
        const fullHeight = fullMeasured?.height ?? fullEstimated;

        // Estimate how many items would fit in current region (rough estimate)
        const avgItemHeight = fullHeight / items.length;
        const itemsThatWouldFit = Math.floor(remainingSpaceInCurrent / avgItemHeight);

        // Check if moving whole list is better than splitting
        const wholeListFitsInNextRegion = fullHeight <= config.nextRegionCapacity;
        const tooFewItemsToJustifySplit = itemsThatWouldFit < config.preferMoveThreshold;

        if (wholeListFitsInNextRegion && tooFewItemsToJustifySplit && !hasIntroMetadata) {
            paginationStats.splitDecisions++;
            debugLog(entry.instance.id, '🚚', 'prefer-move-over-split', {
                reason: 'Too few items to justify split - whole list fits in next region',
                itemsThatWouldFit,
                totalItems: items.length,
                remainingSpaceInCurrent,
                fullHeight,
                nextRegionCapacity: config.nextRegionCapacity,
                threshold: config.preferMoveThreshold,
            });

            return {
                canPlace: false,
                placedItems: [],
                remainingItems: items,
                placedHeight: 0,
                placedTop: currentOffset,
                placedBottom: currentOffset,
                willOverflow: false,
                reason: `Prefer move: only ${itemsThatWouldFit} items would fit, whole list (${items.length}) fits in next region`,
                preferMove: true,
            };
        }
    }

    // Try splits from largest to smallest (greedy: maximize items in current region)
    for (let splitAt = maxSplit; splitAt >= minimumSplit; splitAt--) {
        const firstSegment = items.slice(0, splitAt);
        const secondSegment = items.slice(splitAt);

        // MEASURE where this split would place
        // Try to use actual measurement first, fallback to estimate
        const splitRegionContent = toRegionContent(
            entry.regionContent!.kind,
            firstSegment,
            entry.regionContent!.startIndex,
            entry.regionContent!.totalCount,
            entry.regionContent!.isContinuation,
            entry.regionContent!.metadata
        );
        const splitMeasurementKey = computeMeasurementKey(entry.instance.id, splitRegionContent);
        const measured = measurements.get(splitMeasurementKey);
        const isContinuation = entry.regionContent!.isContinuation;
        const estimated = adapters.heightEstimator.estimateListHeight(firstSegment, isContinuation);

        // If split measurement doesn't exist, try proportional calculation from full measurement
        let proportionalHeight: number | undefined;
        if (!measured && splitAt < items.length) {
            // Look up full component measurement
            const fullRegionContent = toRegionContent(
                entry.regionContent!.kind,
                items,
                entry.regionContent!.startIndex,
                entry.regionContent!.totalCount,
                entry.regionContent!.isContinuation,
                entry.regionContent!.metadata
            );
            const fullMeasurementKey = computeMeasurementKey(entry.instance.id, fullRegionContent);
            const fullMeasured = measurements.get(fullMeasurementKey);

            if (fullMeasured) {
                // Calculate proportionally: (fullHeight / totalItems) * splitItems
                // Note: This is a fallback. Ideally all split variations should be pre-measured.
                proportionalHeight = (fullMeasured.height / items.length) * splitAt;
            }
        }

        const firstSegmentHeight = measured?.height ?? proportionalHeight ?? estimated;
        const firstSegmentTop = currentOffset;
        // CSS gap handles spacing, so cursor tracks entry bottom directly
        const firstSegmentBottom = firstSegmentTop + firstSegmentHeight;

        // Track which height calculation path was used
        const heightSource = measured ? 'measured' : proportionalHeight ? 'proportional' : 'estimate';
        if (measured) {
            paginationStats.heightSources.measured++;
        } else if (proportionalHeight) {
            paginationStats.heightSources.proportional++;
            // Warn about fallback usage - with measure-first, this should be rare
            console.warn('[paginate] Using proportional height fallback:', {
                component: entry.instance.id,
                splitKey: splitMeasurementKey,
                reason: 'Split measurement not found - using proportional calculation from full measurement',
                splitAt,
                totalItems: items.length,
            });
        } else {
            paginationStats.heightSources.estimate++;
        }

        // CHECK constraint: Does it start in bottom 20%?
        const startsInBottomZone = firstSegmentTop > (regionHeight * BOTTOM_THRESHOLD);

        if (startsInBottomZone) {
            paginationStats.bottomZoneRejections++;

            // Invalid start position
            if (splitAt === 1 || (splitAt === 0 && hasIntroMetadata)) {
                // Minimum rule: Always place at least 1 item, even if in bottom zone
                paginationStats.splitDecisions++;
                return {
                    canPlace: true,
                    placedItems: firstSegment,
                    remainingItems: secondSegment,
                    placedHeight: firstSegmentHeight,
                    placedTop: firstSegmentTop,
                    placedBottom: firstSegmentBottom,
                    willOverflow: firstSegmentBottom > regionHeight,
                    reason: splitAt === 0
                        ? `Place intro metadata despite starting at ${((firstSegmentTop / regionHeight) * 100).toFixed(1)}% (metadata only)`
                        : `Minimum rule: Place 1 item despite starting at ${((firstSegmentTop / regionHeight) * 100).toFixed(1)}% (in bottom 20%)`,
                    metadataOnly: splitAt === 0,
                };
            }

            // Try fewer items
            continue;
        }

        // CHECK constraint: Does it exceed region boundary?
        const exceedsRegion = firstSegmentBottom > regionHeight;

        if (!exceedsRegion) {
            // Fits completely - this is our best split
            paginationStats.splitDecisions++;
            return {
                canPlace: true,
                placedItems: firstSegment,
                remainingItems: secondSegment,
                placedHeight: firstSegmentHeight,
                placedTop: firstSegmentTop,
                placedBottom: firstSegmentBottom,
                willOverflow: false,
                reason: `Fits completely: ${splitAt} item(s) at ${((firstSegmentTop / regionHeight) * 100).toFixed(1)}%-${((firstSegmentBottom / regionHeight) * 100).toFixed(1)}%`,
                metadataOnly: splitAt === 0,
            };
        }

        // Overflows but starts in valid zone - try fewer items
        // (continue loop)
    }

    // Should never reach here due to minimum-1-item rule
    return {
        canPlace: false,
        placedItems: [],
        remainingItems: items,
        placedHeight: 0,
        placedTop: currentOffset,
        placedBottom: currentOffset,
        willOverflow: false,
        reason: 'No valid split available - defer to reroute',
    };
};

export const paginate = ({
    buckets,
    columnCount,
    regionHeightPx,
    requestedPageCount,
    baseDimensions,
    measurementVersion,
    measurements,
    adapters,
    segmentRerouteCache,
    previousPlan,
}: PaginateArgs): LayoutPlan => {
    const runId = ++debugRunId;
    const rerouteCache = segmentRerouteCache ?? new SegmentRerouteCache();
    const plannerDiagnosticsEnabled = isPlannerDebugEnabled();

    // NOTE: regionHeightPx is the measured column height from DOM, which already
    // accounts for all rendered content (headers, etc). We use it directly without adjustment.

    // CRITICAL: Check if inputs are identical to last run
    // If so, return previousPlan without running pagination (prevents duplicate runs)
    const bucketCount = buckets.size;

    const bucketSignature = buildBucketSignature(buckets);
    const loopGuardKey: PaginationLoopGuardKey = [
        columnCount,
        regionHeightPx.toFixed(2),
        requestedPageCount,
        bucketSignature,
    ].join('|');
    if (paginationLoopGuardKey !== loopGuardKey) {
        paginationLoopGuardKey = loopGuardKey;
        paginationLoopGuardCount = 0;
        paginationLoopGuardTriggered = false;
    }
    paginationLoopGuardCount += 1;

    if (paginationLoopGuardCount > MAX_PAGINATION_RUNS_PER_SIGNATURE) {
        if (!paginationLoopGuardTriggered) {
            paginationLoopGuardTriggered = true;
            // eslint-disable-next-line no-console
            console.error(
                '⛔ [paginate] Loop guard triggered - more than %d runs without layout changes (key=%s). Returning previous plan.',
                MAX_PAGINATION_RUNS_PER_SIGNATURE,
                loopGuardKey
            );
        } else if (isPaginationDebugEnabled()) {
            logPaginationDecision(runId, 'loop-guard-short-circuit', {
                loopGuardKey,
                loopGuardCount: paginationLoopGuardCount,
                regionHeightPx,
                requestedPageCount,
                bucketCount,
            });
        }

        lastRegionHeightPx = regionHeightPx;
        lastNormalizedHeight = regionHeightPx;
        return previousPlan ?? createEmptyPlan();
    }

    logRegionHeightEvent('paginate-run-start', {
        runId,
        regionHeightPx,
        previousRegionHeight: lastRegionHeightPx,
        heightDiff: lastRegionHeightPx != null ? regionHeightPx - lastRegionHeightPx : null,
        requestedPageCount,
        columnCount,
        bucketCount,
    });
    const inputsIdentical = areInputsIdentical(
        regionHeightPx,
        columnCount,
        requestedPageCount,
        bucketCount,
        measurementVersion,
        measurements
    );

    // CRITICAL: Only skip if previousPlan exists AND has pages
    // If previousPlan is null or empty, we must run pagination to create the plan
    if (inputsIdentical && previousPlan && previousPlan.pages.length > 0) {
        if (isPaginationDebugEnabled()) {
            logPaginationDecision(runId, 'run-skipped-identical-inputs', {
                regionHeightPx,
                columnCount,
                requestedPageCount,
                bucketCount,
                measurementVersion: measurementVersion ?? 'unknown',
                previousPageCount: previousPlan.pages.length,
                reason: 'All inputs identical to previous run, returning previousPlan',
            });
        }
        // Still update tracking for next comparison
        lastRegionHeightPx = regionHeightPx;
        lastNormalizedHeight = regionHeightPx;
        return previousPlan;
    }

    // Update last inputs for next comparison
    const measurementKeysHash = hashMeasurements(measurements);
    lastPaginationInputs = {
        regionHeightPx,
        columnCount,
        requestedPageCount,
        bucketCount,
        measurementVersion,
        measurementKeysHash,
    };

    // Detect regionHeight changes (feedback loop indicator)
    const regionHeightChanged = lastRegionHeightPx !== null && Math.abs(lastRegionHeightPx - regionHeightPx) > 1;
    const normalizedHeightChanged = lastNormalizedHeight !== null && Math.abs(lastNormalizedHeight - regionHeightPx) > 1;

    if (regionHeightChanged) {
        logRegionHeightEvent('paginate-region-height-change', {
            runId,
            previousRaw: lastRegionHeightPx,
            currentRaw: regionHeightPx,
            rawDelta: lastRegionHeightPx != null ? regionHeightPx - lastRegionHeightPx : null,
            normalizedDelta: lastNormalizedHeight != null ? regionHeightPx - lastNormalizedHeight : null,
            warningFeedbackLoop: normalizedHeightChanged,
        });
    }

    // Component-5 region height change logging
    if (isPaginationDebugEnabled() && shouldDebugComponent('component-5')) {
        debugLog('component-5', '📏', 'region-height-at-start', {
            runId,
            regionHeightPx,
            previousRegionHeight: lastRegionHeightPx,
            heightChanged: lastRegionHeightPx !== null && lastRegionHeightPx !== regionHeightPx,
            heightDiff: lastRegionHeightPx !== null ? regionHeightPx - lastRegionHeightPx : 0,
        });
    }

    logPaginationDecision(runId, 'run-start', {
        columnCount,
        regionHeightPx,
        requestedPageCount,
        bucketCount: buckets.size,
        measurementVersion: measurementVersion ?? 'unknown',
        debugComponents: Array.from(DEBUG_COMPONENT_IDS),
        heightChanges: regionHeightChanged ? {
            previousRaw: lastRegionHeightPx,
            currentRaw: regionHeightPx,
            rawDelta: regionHeightPx - (lastRegionHeightPx ?? 0),
            previousNormalized: lastNormalizedHeight,
            currentNormalized: regionHeightPx,
            normalizedDelta: regionHeightPx - (lastNormalizedHeight ?? 0),
            warningFeedbackLoop: normalizedHeightChanged,
        } : null,
    });

    lastRegionHeightPx = regionHeightPx;
    lastNormalizedHeight = regionHeightPx;

    // Initialize pages from previous plan if available, preserving column.entries for cursor initialization
    // CRITICAL: Ensure all pages have columnCount columns, even if previousPlan didn't have them all
    const pages: PageLayout[] = previousPlan?.pages
        ? previousPlan.pages.map((prevPage) => {
            const columns: LayoutColumn[] = [];
            for (let columnIndex = 1; columnIndex <= columnCount; columnIndex += 1) {
                const key = regionKey(prevPage.pageNumber, columnIndex);
                const prevColumn = prevPage.columns.find((col) => col.columnNumber === columnIndex);


                columns.push({
                    columnNumber: toColumnType(columnIndex),
                    key,
                    entries: prevColumn ? [...prevColumn.entries] : [], // Preserve entries from previous run if they exist
                });

            }
            return {
                pageNumber: prevPage.pageNumber,
                columns,
            };
        })
        : [];
    const overflowWarnings: OverflowWarning[] = [];
    const pendingQueues = new Map<string, CanvasLayoutEntry[]>();
    const routedInRegion = new Set<string>();

    const processedBuckets = new Map<string, CanvasLayoutEntry[]>(Array.from(buckets.entries(), ([key, entries]) => [key, entries]));
    const homeBuckets = new Map<string, CanvasLayoutEntry[]>();

    processedBuckets.forEach((entries, key) => {
        entries.forEach((entry) => {
            if (!homeBuckets.has(entry.homeRegionKey)) {
                homeBuckets.set(entry.homeRegionKey, []);
            }
            homeBuckets.get(entry.homeRegionKey)!.push(entry);
        });
        entries.sort((a, b) => {
            if (a.slotIndex !== b.slotIndex) return a.slotIndex - b.slotIndex;
            return a.orderIndex - b.orderIndex;
        });
    });

    homeBuckets.forEach((entries) => {
        entries.sort((a, b) => {
            if (a.slotIndex !== b.slotIndex) return a.slotIndex - b.slotIndex;
            return a.orderIndex - b.orderIndex;
        });
    });

    const maxBucketPage = Array.from(buckets.keys()).reduce((max, key) => {
        const [pagePart] = key.split(':');
        const parsed = Number.parseInt(pagePart, 10);
        return Number.isNaN(parsed) ? max : Math.max(max, parsed);
    }, 1);

    const initialPageCount = Math.max(1, requestedPageCount, maxBucketPage);
    if (!ensurePage(pages, initialPageCount, columnCount, pendingQueues, runId, 'initial-page-count')) {
        // Hit MAX_PAGES limit during initial setup
        return { pages, overflowWarnings: [] };
    }

    const getPendingQueue = (key: string) => {
        if (!pendingQueues.has(key)) {
            pendingQueues.set(key, []);
        }
        return pendingQueues.get(key)!;
    };

    pages.forEach((page) => {
        page.columns.forEach((column) => {
            if (!processedBuckets.has(column.key)) {
                processedBuckets.set(column.key, []);
            }
        });
    });

    const allPages = () => pages; // helper to use latest pages within closures

    for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
        const page = pages[pageIndex];
        for (let columnIndex = 0; columnIndex < page.columns.length; columnIndex += 1) {
            const column = page.columns[columnIndex];
            const key = column.key;

            // Phase 0.5: Region Processing Start Tracking
            if (isPaginationDebugEnabled() && key === '2:2') {
                const debugEntries = column.entries.filter(e => shouldDebugComponent(e.instance.id));
                debugEntries.forEach(debugEntry => {
                    debugLog(normalizeComponentId(debugEntry.instance.id), '🚀', 'component-trace-region-processing-start', {
                        componentId: normalizeComponentId(debugEntry.instance.id),
                        runId,
                        regionKey: key,
                        page: page.pageNumber,
                        column: column.columnNumber,
                        columnEntriesCount: column.entries.length,
                        debugComponentInColumnEntries: column.entries.filter(e => e.instance.id === debugEntry.instance.id).length,
                    });
                });
            }
            const sourceEntries = processedBuckets.get(key) ?? [];
            const pendingEntries = getPendingQueue(key);

            // Log pending queue state before processing
            if (isPaginationDebugEnabled() && pendingEntries.length > 0) {
                debugLog('pending-queue', '📋', 'pending-queue-processing', {
                    runId,
                    regionKey: key,
                    page: page.pageNumber,
                    column: column.columnNumber,
                    pendingCount: pendingEntries.length,
                    pendingEntries: pendingEntries.map(e => ({
                        id: e.instance.id,
                        overflow: e.overflow,
                        overflowRouted: e.overflowRouted,
                        sourceRegionKey: e.sourceRegionKey,
                    })),
                });
            }

            // Phase 1: Entry Source Tracking - pendingQueue
            if (isPaginationDebugEnabled()) {
                const debugEntries = pendingEntries.filter(e => shouldDebugComponent(e.instance.id));
                debugEntries.forEach(debugEntry => {
                    debugLog(normalizeComponentId(debugEntry.instance.id), '🎯', 'component-trace-pending-queue-entry', {
                        componentId: normalizeComponentId(debugEntry.instance.id),
                        runId,
                        regionKey: key,
                        page: page.pageNumber,
                        column: column.columnNumber,
                        source: 'pendingQueue',
                        pendingCount: pendingEntries.filter(e => e.instance.id === debugEntry.instance.id).length,
                        entries: pendingEntries.filter(e => e.instance.id === debugEntry.instance.id).map(e => ({
                            entryRegion: e.region,
                            entrySpanTop: e.span?.top,
                            entrySpanBottom: e.span?.bottom,
                            entryOverflow: e.overflow,
                            entryOverflowRouted: e.overflowRouted,
                            sourceRegionKey: e.sourceRegionKey,
                        })),
                        columnEntriesCount: column.entries.length,
                        alreadyInColumnEntries: column.entries.some(e => e.instance.id === debugEntry.instance.id && e.region?.page === page.pageNumber && e.region?.column === column.columnNumber),
                    });
                });
            }

            const homeEntries = (homeBuckets.get(key) ?? []).filter((entry) => entry.sourceRegionKey !== key);
            const regionQueue: CanvasLayoutEntry[] = [...pendingEntries, ...sourceEntries];
            const debugQueueEntry = regionQueue.find((entry) => shouldDebugComponent(entry.instance.id));

            homeEntries.forEach((candidate) => {
                if (!regionQueue.includes(candidate)) {
                    regionQueue.push(candidate);
                }
            });

            regionQueue.sort((a, b) => {
                if (a.slotIndex !== b.slotIndex) return a.slotIndex - b.slotIndex;
                return a.orderIndex - b.orderIndex;
            });

            if (regionQueue.length > 0 && debugQueueEntry) {
                debugLog(debugQueueEntry.instance.id, '📬', 'region-queue-init', {
                    runId,
                    regionKey: key,
                    page: page.pageNumber,
                    column: column.columnNumber,
                    pendingCount: pendingEntries.length,
                    sourceCount: sourceEntries.length,
                    homeCount: homeEntries.length,
                    queueSnapshot: regionQueue.map((queued) => ({
                        componentId: queued.instance.id,
                        overflow: queued.overflow ?? false,
                        overflowRouted: queued.overflowRouted ?? false,
                        sourceRegionKey: queued.sourceRegionKey,
                        homeRegionKey: queued.homeRegionKey,
                    })),
                });
            }

            pendingQueues.set(key, []);

            // CRITICAL FIX: Initialize columnEntries with entries from previousPlan
            // Otherwise, restored entries are lost when we replace column.entries at the end
            // This preserves spans from previousPlan for entries that aren't reprocessed
            // FIX: Filter out entries that overflow the current region height
            // This handles both region height changes AND measurement height changes
            // CRITICAL FIX: Deduplicate entries at initialization for THIS region only
            // Single-instance components should only appear once per region
            // (Global deduplication happens in findExistingEntry when adding new entries)
            const seenSingleInstanceInRegion = new Set<string>();
            const seenListSegmentsInRegion = new Set<string>(); // measurementKey
            let columnEntries: CanvasLayoutEntry[] = column.entries.filter((entry) => {
                // Only deduplicate entries that are in THIS region
                const isInThisRegion = entry.region?.page === page.pageNumber && entry.region?.column === column.columnNumber;

                if (!isInThisRegion) {
                    // Keep entries from other regions (they'll be handled by their own regions)
                    return true;
                }

                // For entries in THIS region, deduplicate:
                // For list components: deduplicate by measurementKey (same segment shouldn't appear twice in same region)
                if (entry.regionContent) {
                    if (seenListSegmentsInRegion.has(entry.measurementKey)) {
                        return false; // Duplicate list segment in this region
                    }
                    seenListSegmentsInRegion.add(entry.measurementKey);
                    return true;
                }
                // For single-instance components: only allow one per region
                if (seenSingleInstanceInRegion.has(entry.instance.id)) {
                    return false; // Duplicate single-instance component in this region
                }
                seenSingleInstanceInRegion.add(entry.instance.id);
                return true;
            });
            const beforeCount = column.entries.length;
            // Track removed entry IDs so we can remove them from the queue
            const removedEntryIds = new Set<string>();
            columnEntries = columnEntries.filter((entry) => {
                // Keep entries that are in other regions (they'll be handled by their own regions)
                if (!entry.region || entry.region.page !== page.pageNumber || entry.region.column !== column.columnNumber) {
                    return true;
                }
                // For entries in this region, check if they overflow the current height
                if (!entry.span) {
                    removedEntryIds.add(entry.instance.id);
                    return false;
                }

                // CRITICAL FIX: Only remove entries if they actually overflow the region
                // If the measurement layer is working correctly, measurement refinements shouldn't change order
                // The display layer should just render at the measured height - if it fits, it fits
                const currentMeasurement = measurements.get(entry.measurementKey);
                const currentHeight = currentMeasurement?.height ?? entry.span.height;
                const entryTop = entry.span.top;
                const entryBottom = entryTop + currentHeight;

                // Only remove if the component actually overflows the region with its current measurement
                // Use threshold to avoid aggressive removal for sub-pixel overflows
                const overflowAmount = entryBottom - regionHeightPx;
                const overflows = overflowAmount > ENTRY_REMOVAL_OVERFLOW_THRESHOLD_PX;

                // Log small overflows that we're keeping (for debugging)
                if (overflowAmount > 0 && overflowAmount <= ENTRY_REMOVAL_OVERFLOW_THRESHOLD_PX && isPaginationDebugEnabled()) {
                    logPaginationDecision(runId, 'entry-kept-despite-small-overflow', {
                        componentId: entry.instance.id,
                        regionKey: key,
                        calculatedBottom: entryBottom,
                        newRegionHeight: regionHeightPx,
                        overflowAmount,
                        threshold: ENTRY_REMOVAL_OVERFLOW_THRESHOLD_PX,
                        reason: 'Overflow below threshold, keeping entry',
                    });
                }

                if (overflows) {
                    removedEntryIds.add(entry.instance.id);
                    if (isPaginationDebugEnabled()) {
                        logPaginationDecision(runId, 'entry-removed-from-columnEntries-invalid', {
                            componentId: entry.instance.id,
                            regionKey: key,
                            oldSpanBottom: entry.span.bottom,
                            oldSpanHeight: entry.span.height,
                            currentMeasurementHeight: currentMeasurement?.height,
                            calculatedBottom: entryBottom,
                            newRegionHeight: regionHeightPx,
                            overflowAmount,
                            threshold: ENTRY_REMOVAL_OVERFLOW_THRESHOLD_PX,
                            reason: 'overflow',
                        });
                    }
                    return false;
                }
                return true;
            });
            if (beforeCount > columnEntries.length && isPaginationDebugEnabled()) {
                logPaginationDecision(runId, 'columnEntries-filtered-invalid-entries', {
                    regionKey: key,
                    beforeCount,
                    afterCount: columnEntries.length,
                    removedCount: beforeCount - columnEntries.length,
                    regionHeightPx,
                    previousRegionHeight: lastRegionHeightPx,
                    heightChanged: regionHeightChanged,
                });
            }

            // CRITICAL FIX: Remove entries from queue that were removed from columnEntries
            // This prevents cascading routing when entries are removed due to overflow
            // See: 2025-11-16-component-04-cascading-routing-fix-HANDOFF.md
            if (removedEntryIds.size > 0) {
                const queueBeforeCount = regionQueue.length;
                // Filter out removed entries from the queue
                const filteredQueue = regionQueue.filter(
                    entry => !removedEntryIds.has(entry.instance.id)
                );
                regionQueue.length = 0;
                regionQueue.push(...filteredQueue);
                const queueAfterCount = regionQueue.length;
                const removedFromQueue = queueBeforeCount - queueAfterCount;

                if (isPaginationDebugEnabled()) {
                    logPaginationDecision(runId, 'queue-entries-removed-after-columnEntries-filter', {
                        regionKey: key,
                        removedEntryIds: Array.from(removedEntryIds),
                        queueBeforeCount,
                        queueAfterCount,
                        removedFromQueue,
                        reason: 'Entries removed from columnEntries due to overflow, also removed from queue to prevent cascading routing',
                    });
                }
            }

            // Fix 1: Helper function to find existing entry in columnEntries to prevent duplication
            // Strategy: Use measurementKey for list components (includes startIndex, making segments unique)
            //           Use instance.id for single-instance components (GLOBAL deduplication - only one per component)
            const findExistingEntry = (entry: CanvasLayoutEntry, columnEntries: CanvasLayoutEntry[], page: number, column: number): number => {
                return columnEntries.findIndex(
                    e => {
                        // For list components, use measurementKey (includes startIndex, making segments unique)
                        // measurementKey format: `${instanceId}:${kind}:${startIndex}:${items.length}:${totalCount}:${isContinuation ? 'cont' : 'base'}`
                        // List components CAN exist in multiple regions (different segments)
                        if (entry.regionContent && e.regionContent) {
                            // Both are list components - match by measurementKey AND region
                            // Different segments of same list can exist in different regions
                            return e.measurementKey === entry.measurementKey &&
                                e.region?.page === page &&
                                e.region?.column === column;
                        }

                        // For single-instance components (no regionContent), use instance.id GLOBALLY
                        // CRITICAL FIX: Single-instance components should only exist ONCE total
                        // Don't check region - if component exists anywhere, it's a duplicate
                        // This prevents the same component from being added to multiple regions
                        if (!entry.regionContent && !e.regionContent) {
                            return e.instance.id === entry.instance.id;
                        }

                        // Mixed case: one is list, one is single-instance - not a match
                        return false;
                    }
                );
            };

            // Phase 0: Column Entries Initialization Tracking
            if (isPaginationDebugEnabled()) {
                const debugEntries = column.entries.filter(e => shouldDebugComponent(e.instance.id));
                debugEntries.forEach(debugEntry => {
                    const sameComponentEntries = column.entries.filter(e => e.instance.id === debugEntry.instance.id);
                    debugLog(normalizeComponentId(debugEntry.instance.id), '🏁', 'component-trace-column-entries-init', {
                        componentId: normalizeComponentId(debugEntry.instance.id),
                        runId,
                        regionKey: key,
                        page: page.pageNumber,
                        column: column.columnNumber,
                        componentCount: sameComponentEntries.length,
                        componentEntries: sameComponentEntries.map(e => ({
                            page: e.region?.page,
                            column: e.region?.column,
                            spanTop: e.span?.top,
                            spanBottom: e.span?.bottom,
                            sourceRegionKey: e.sourceRegionKey,
                        })),
                        totalEntriesCount: column.entries.length,
                        fromPreviousPlan: true,
                    });
                });
            }
            // Use measured column height directly, but account for column padding
            // The regionHeightPx is the measured column height from the DOM.
            // We reduce by padding and start cursor after top padding.
            const effectiveMaxHeight = regionHeightPx - (2 * COLUMN_PADDING_PX);
            const cursor = createCursor(key, effectiveMaxHeight, COLUMN_PADDING_PX);
            let safetyCounter = 0;

            // Cursor debug: Log cursor creation
            if (isCursorDebugEnabled()) {
                logPaginationDecision(runId, 'cursor-created', {
                    regionKey: key,
                    cursorOffset: cursor.currentOffset,
                    cursorMaxHeight: cursor.maxHeight,
                    regionHeightPx,
                });
            }

            // CRITICAL FIX: Initialize cursor from already-placed entries in THIS column
            // Use columnEntries (filtered from previousPlan) instead of filtering regionQueue,
            // because regionQueue contains entries ASSIGNED to this region, not entries
            // ACTUALLY PLACED in this column. Entries may have been moved to other columns.
            // Note: columnEntries is already filtered to remove overflow entries when height changes
            const alreadyPlacedEntries = columnEntries.filter(
                (entry) =>
                    entry.span &&
                    entry.region &&
                    entry.region.page === page.pageNumber &&
                    entry.region.column === column.columnNumber
            );

            // Debug: Log cursor initialization attempt
            if (isPaginationDebugEnabled() || isCursorDebugEnabled()) {
                logPaginationDecision(runId, 'cursor-initialization-attempt', {
                    regionKey: key,
                    columnEntriesCount: column.entries.length,
                    alreadyPlacedCount: alreadyPlacedEntries.length,
                    cursorOffsetBeforeInit: cursor.currentOffset,
                    sampleEntry: column.entries[0] ? {
                        id: column.entries[0].instance.id,
                        hasSpan: !!column.entries[0].span,
                        hasRegion: !!column.entries[0].region,
                        regionPage: column.entries[0].region?.page,
                        regionColumn: column.entries[0].region?.column,
                        expectedPage: page.pageNumber,
                        expectedColumn: column.columnNumber,
                    } : null,
                });
            }

            if (alreadyPlacedEntries.length > 0) {
                // CRITICAL FIX: Sort by visual position (span.bottom) first, not orderIndex
                // orderIndex reflects array index (component creation order), not visual placement order
                // Components can be visually placed out of orderIndex sequence, so we must sort by span.bottom
                // to find the visually last component (highest span.bottom)
                alreadyPlacedEntries.sort((a, b) => {
                    const aBottom = a.span?.bottom ?? 0;
                    const bBottom = b.span?.bottom ?? 0;
                    if (aBottom !== bBottom) return aBottom - bBottom;
                    // Tiebreaker: use orderIndex for deterministic sorting when spans are equal
                    return a.orderIndex - b.orderIndex;
                });
                const lastPlacedEntry = alreadyPlacedEntries[alreadyPlacedEntries.length - 1];
                if (lastPlacedEntry.span) {
                    // Initialize cursor to bottom of last placed entry (CSS gap handles spacing)
                    cursor.currentOffset = lastPlacedEntry.span.bottom;

                    // FIX: Reset cursor if it exceeds new region height (race condition protection)
                    // This handles the case where regionHeightPx changed between pagination runs,
                    // causing cursor from previousPlan to be stale (calculated with old height)
                    if (cursor.currentOffset > cursor.maxHeight) {
                        logPaginationDecision(runId, 'cursor-reset-exceeds-height', {
                            regionKey: key,
                            oldCursorOffset: cursor.currentOffset,
                            newRegionHeight: cursor.maxHeight,
                            heightDiff: cursor.currentOffset - cursor.maxHeight,
                            lastPlacedSpanBottom: lastPlacedEntry.span.bottom,
                            reason: 'Cursor from previousPlan exceeds new regionHeightPx (race condition)',
                        });
                        cursor.currentOffset = 0;
                    } else {
                        if (isPaginationDebugEnabled() || isCursorDebugEnabled()) {
                            logPaginationDecision(runId, 'cursor-initialized-from-column-entries', {
                                regionKey: key,
                                alreadyPlacedCount: alreadyPlacedEntries.length,
                                lastPlacedEntryId: lastPlacedEntry.instance.id,
                                lastPlacedSpanBottom: lastPlacedEntry.span.bottom,
                                cursorInitializedTo: cursor.currentOffset,
                                regionHeightPx,
                            });
                        }
                    }
                }
            } else if (column.entries.length > 0 && isPaginationDebugEnabled()) {
                // Debug: Why didn't we find already-placed entries?
                logPaginationDecision(runId, 'cursor-init-failed-no-matches', {
                    regionKey: key,
                    columnEntriesCount: column.entries.length,
                    sampleEntries: column.entries.slice(0, 3).map(e => ({
                        id: e.instance.id,
                        hasSpan: !!e.span,
                        hasRegion: !!e.region,
                        regionPage: e.region?.page,
                        regionColumn: e.region?.column,
                        expectedPage: page.pageNumber,
                        expectedColumn: column.columnNumber,
                    })),
                });
            }

            if (plannerDiagnosticsEnabled) {
                const segmentDescriptors = regionQueue
                    .map((entry) => toSegmentDescriptor(entry, key, measurements))
                    .filter((descriptor): descriptor is SegmentDescriptor => descriptor !== null);

                if (segmentDescriptors.length > 0) {
                    const plannerRegions = buildPlannerRegions(allPages(), regionHeightPx);
                    if (plannerRegions.length > 0) {
                        buildSegmentPlan({
                            segments: segmentDescriptors,
                            regions: plannerRegions,
                            rerouteCache,
                            spacingPx: COMPONENT_VERTICAL_SPACING_PX,
                        });
                    }
                }
            }

            while (regionQueue.length > 0 && safetyCounter < MAX_REGION_ITERATIONS) {
                safetyCounter += 1;

                // Cursor debug: Log cursor position at start of loop iteration
                if (isCursorDebugEnabled() && regionQueue.length > 0) {
                    logPaginationDecision(runId, 'cursor-at-loop-start', {
                        regionKey: key,
                        loopIteration: safetyCounter,
                        cursorOffset: cursor.currentOffset,
                        cursorMaxHeight: cursor.maxHeight,
                        queueLength: regionQueue.length,
                        nextComponentId: regionQueue[0]?.instance.id,
                    });
                }

                // Peek at next entry without removing it
                const peekedEntry = regionQueue[0];
                if (!peekedEntry) {
                    break;
                }

                // OPTIMIZATION: Check if entry is already correctly placed before dequeuing
                // This prevents unnecessary processing and logging for settled components
                // LOGGING REDUCTION: Skipped entries don't log 'dequeued-entry' or other processing logs
                // Only entries that need reprocessing will be logged, reducing noise for debugging
                const alreadyPlacedEntry = columnEntries.find(
                    (e) => {
                        // For list components, match by measurementKey AND region
                        if (peekedEntry.regionContent && e.regionContent) {
                            return e.measurementKey === peekedEntry.measurementKey &&
                                e.region?.page === page.pageNumber &&
                                e.region?.column === column.columnNumber;
                        }
                        // For single-instance components, match by instance.id AND region
                        if (!peekedEntry.regionContent && !e.regionContent) {
                            return e.instance.id === peekedEntry.instance.id &&
                                e.region?.page === page.pageNumber &&
                                e.region?.column === column.columnNumber;
                        }
                        return false;
                    }
                );

                // Check if entry is already correctly placed and doesn't need reprocessing
                const isAlreadyCorrectlyPlaced = alreadyPlacedEntry &&
                    alreadyPlacedEntry.span &&
                    alreadyPlacedEntry.region &&
                    alreadyPlacedEntry.region.page === page.pageNumber &&
                    alreadyPlacedEntry.region.column === column.columnNumber;

                if (isAlreadyCorrectlyPlaced && alreadyPlacedEntry.span) {
                    // TypeScript guard: span is guaranteed to exist here
                    const placedSpan = alreadyPlacedEntry.span;

                    // Check if measurements changed (would require reprocessing)
                    const currentMeasurement = measurements.get(peekedEntry.measurementKey);
                    const currentHeight = currentMeasurement?.height ?? peekedEntry.estimatedHeight ?? DEFAULT_COMPONENT_HEIGHT_PX;
                    const storedHeight = placedSpan.height;
                    const heightChanged = Math.abs(currentHeight - storedHeight) > 0.01;

                    // Check if entry would overflow with current height
                    const entryTop = placedSpan.top;
                    const entryBottom = entryTop + currentHeight;
                    const wouldOverflow = entryBottom > regionHeightPx;

                    // Skip if height hasn't changed AND it doesn't overflow
                    // CRITICAL FIX: Advance cursor when skipping entries to ensure correct positioning
                    // Even though cursor is initialized from columnEntries, we need to advance it past
                    // skipped entries to handle cases where entries are processed out of order or
                    // cursor initialization doesn't account for all skipped entries
                    if (!heightChanged && !wouldOverflow) {
                        // Advance cursor to bottom of skipped entry (CSS gap handles spacing)
                        const entryBottom = entryTop + currentHeight;
                        const prevCursorOffset = cursor.currentOffset;

                        // Only advance if skipped entry extends beyond current cursor position
                        if (entryBottom > cursor.currentOffset) {
                            cursor.currentOffset = entryBottom;

                            if (isCursorDebugEnabled()) {
                                // Cursor debug: Always log cursor advancement when cursor flag enabled
                                logPaginationDecision(runId, 'cursor-advanced-for-skipped-entry', {
                                    regionKey: key,
                                    componentId: peekedEntry.instance.id,
                                    entrySpanBottom: entryBottom,
                                    cursorBefore: prevCursorOffset,
                                    cursorAfter: cursor.currentOffset,
                                    cursorAdvance: cursor.currentOffset - prevCursorOffset,
                                });
                            } else if (isPaginationDebugEnabled() && shouldDebugComponent(peekedEntry.instance.id)) {
                                debugLog(peekedEntry.instance.id, '🔧', 'cursor-advanced-for-skipped-entry', {
                                    runId,
                                    regionKey: key,
                                    componentId: peekedEntry.instance.id,
                                    entrySpanBottom: entryBottom,
                                    cursorBefore: prevCursorOffset,
                                    cursorAfter: cursor.currentOffset,
                                    cursorAdvance: cursor.currentOffset - prevCursorOffset,
                                });
                            }
                        }

                        // CRITICAL FIX: Advance cursor even when skipping entries
                        // The cursor must reflect the actual position of skipped entries to maintain consistency
                        // This ensures cursor matches the visual position (CSS gap handles spacing)
                        if (placedSpan.bottom > cursor.currentOffset) {
                            cursor.currentOffset = placedSpan.bottom;
                            if (isPaginationDebugEnabled() && shouldDebugComponent(peekedEntry.instance.id)) {
                                debugLog(peekedEntry.instance.id, '⏭️', 'entry-skipped-cursor-advanced', {
                                    runId,
                                    regionKey: key,
                                    componentId: peekedEntry.instance.id,
                                    spanBottom: placedSpan.bottom,
                                    cursorBefore: prevCursorOffset,
                                    cursorAfter: cursor.currentOffset,
                                    reason: 'Entry skipped but cursor advanced to maintain position consistency',
                                });
                            }
                        } else if (isPaginationDebugEnabled() && shouldDebugComponent(peekedEntry.instance.id)) {
                            debugLog(peekedEntry.instance.id, '⏭️', 'entry-skipped-already-correctly-placed', {
                                runId,
                                regionKey: key,
                                componentId: peekedEntry.instance.id,
                                spanTop: placedSpan.top,
                                spanBottom: placedSpan.bottom,
                                storedHeight,
                                currentHeight,
                                heightChanged,
                                wouldOverflow,
                                cursorBefore: prevCursorOffset,
                                cursorAfter: cursor.currentOffset,
                                reason: 'Entry already correctly placed, measurements unchanged, no overflow',
                            });
                        }
                        // Remove from queue without processing
                        regionQueue.shift();
                        continue;
                    }
                }

                // Entry needs processing - dequeue it now
                const entry = regionQueue.shift();
                if (!entry) {
                    break;
                }

                // Phase 1: Entry Source Tracking - regionQueue
                if (isPaginationDebugEnabled() && shouldDebugComponent(entry.instance.id)) {
                    debugLog(normalizeComponentId(entry.instance.id), '🎯', 'component-trace-region-queue-entry', {
                        componentId: normalizeComponentId(entry.instance.id),
                        runId,
                        regionKey: key,
                        page: page.pageNumber,
                        column: column.columnNumber,
                        source: 'regionQueue',
                        queueIndex: regionQueue.findIndex(e => e.instance.id === entry.instance.id),
                        entryRegion: entry.region,
                        entrySpanTop: entry.span?.top,
                        entrySpanBottom: entry.span?.bottom,
                        entryOverflow: entry.overflow,
                        entryOverflowRouted: entry.overflowRouted,
                        sourceRegionKey: entry.sourceRegionKey,
                        columnEntriesCount: columnEntries.length,
                        alreadyInColumnEntries: columnEntries.some(e => e.instance.id === entry.instance.id && e.region?.page === page.pageNumber && e.region?.column === column.columnNumber),
                    });
                }

                debugLog(entry.instance.id, '📥', 'dequeued-entry', {
                    runId,
                    regionKey: key,
                    queueRemaining: regionQueue.length,
                    pendingQueueSize: getPendingQueue(key).length,
                    overflow: entry.overflow ?? false,
                    overflowRouted: entry.overflowRouted ?? false,
                    sourceRegionKey: entry.sourceRegionKey,
                    homeRegionKey: entry.homeRegionKey,
                    cursorOffset: cursor.currentOffset,
                });

                // Cursor debug: Log cursor position when component is dequeued
                if (isCursorDebugEnabled()) {
                    logPaginationDecision(runId, 'cursor-at-dequeue', {
                        regionKey: key,
                        componentId: entry.instance.id,
                        cursorOffset: cursor.currentOffset,
                        cursorMaxHeight: cursor.maxHeight,
                        queueRemaining: regionQueue.length,
                    });
                }

                // Component-5/6 specific dequeued logging
                if (isPaginationDebugEnabled() && (entry.instance.id === 'component-5' || entry.instance.id === 'component-6')) {
                    debugLog(entry.instance.id, '🎯', `${entry.instance.id}-dequeued`, {
                        runId,
                        regionKey: key,
                        cursorOffset: cursor.currentOffset,
                        cursorMaxHeight: cursor.maxHeight,
                        regionHeightPx,
                        entryHeight: entry.estimatedHeight,
                        measurementKey: entry.measurementKey,
                        hasMeasurement: measurements.has(entry.measurementKey),
                        measurementHeight: measurements.get(entry.measurementKey)?.height,
                    });
                }

                if (safetyCounter >= MAX_REGION_ITERATIONS) {
                    logPaginationDecision(runId, 'safety-cap-hit', {
                        regionKey: key,
                        regionQueueLength: regionQueue.length,
                    });
                }

                detachFromSource(entry, key, processedBuckets);

                // Phase 1.5: Track entry before conditional check
                if (isPaginationDebugEnabled() && shouldDebugComponent(entry.instance.id)) {
                    debugLog(normalizeComponentId(entry.instance.id), '🔍', 'component-trace-before-conditional-check', {
                        componentId: normalizeComponentId(entry.instance.id),
                        runId,
                        regionKey: key,
                        page: page.pageNumber,
                        column: column.columnNumber,
                        hasSpan: !!entry.span,
                        hasRegion: !!entry.region,
                        entryRegionPage: entry.region?.page,
                        entryRegionColumn: entry.region?.column,
                        targetPage: page.pageNumber,
                        targetColumn: column.columnNumber,
                        willEnterConditional: !!(entry.span && entry.region && entry.region.page === page.pageNumber && entry.region.column === column.columnNumber),
                    });
                }

                // Fix 2: Check if entry is already in columnEntries before conditional check
                // This prevents bypass of conditional check when entry loses span but still exists in columnEntries
                // Use same logic as findExistingEntry: measurementKey for list components, instance.id for single-instance (GLOBAL)
                const alreadyInColumnEntries = columnEntries.some(
                    e => {
                        // For list components, use measurementKey AND region (segments can exist in multiple regions)
                        if (entry.regionContent && e.regionContent) {
                            return e.measurementKey === entry.measurementKey &&
                                e.region?.page === page.pageNumber &&
                                e.region?.column === column.columnNumber;
                        }

                        // For single-instance components (no regionContent), use instance.id GLOBALLY
                        // CRITICAL FIX: Single-instance components should only exist ONCE total
                        if (!entry.regionContent && !e.regionContent) {
                            return e.instance.id === entry.instance.id;
                        }

                        // Mixed case: one is list, one is single-instance - not a match
                        return false;
                    }
                );

                // Skip entries that already have a valid span for this region
                // This prevents re-processing entries from previous pagination runs
                if (entry.span && entry.region && entry.region.page === page.pageNumber && entry.region.column === column.columnNumber) {
                    // Entry already placed - process overflow/routing logic
                    // Entry already placed in this region - check if it overflows
                    const prevCursorOffset = cursor.currentOffset;

                    // CRITICAL FIX: Look up placed entry from columnEntries first (entries already processed),
                    // then fallback to column.entries (entries from previousPlan)
                    // This prevents duplication when entries are processed multiple times
                    const placedEntryInColumnEntries = columnEntries.find(
                        (e) => e.instance.id === entry.instance.id &&
                            e.region?.page === page.pageNumber &&
                            e.region?.column === column.columnNumber
                    );

                    // Fallback to column.entries (entries from previousPlan)
                    const placedEntryFromPrevious = column.entries.find(
                        (e) => e.instance.id === entry.instance.id &&
                            e.region?.page === page.pageNumber &&
                            e.region?.column === column.columnNumber
                    );

                    const placedEntry = placedEntryInColumnEntries ?? placedEntryFromPrevious;
                    const actualSpan = placedEntry?.span ?? entry.span;

                    // CRITICAL: If actualSpan.top is 0, this means the entry was placed with span.top = 0
                    // This should NOT happen - entries should have non-zero top when placed
                    // For overflow detection, we need the ACTUAL top position, not 0
                    // If span.top is 0, we can't reliably detect overflow
                    const entryTop = actualSpan.top || 0; // Use 0 as fallback, but this is a bug indicator

                    // Phase 2: PlacedEntry Lookup Tracking
                    if (isPaginationDebugEnabled() && shouldDebugComponent(entry.instance.id)) {
                        debugLog(normalizeComponentId(entry.instance.id), '🔍', 'component-trace-placed-entry-lookup', {
                            componentId: normalizeComponentId(entry.instance.id),
                            runId,
                            regionKey: key,
                            page: page.pageNumber,
                            column: column.columnNumber,
                            foundInColumnEntries: !!placedEntryInColumnEntries,
                            foundInPrevious: !!placedEntryFromPrevious,
                            placedEntryFound: !!placedEntry,
                            placedEntryRegion: placedEntry?.region,
                            placedEntrySpanTop: placedEntry?.span?.top,
                            placedEntrySpanBottom: placedEntry?.span?.bottom,
                            actualSpanTop: actualSpan.top,
                            actualSpanBottom: actualSpan.bottom,
                            entryTop,
                            // Check columnEntries for this component
                            componentInColumnEntries: columnEntries.filter(e => e.instance.id === entry.instance.id).map(e => ({
                                page: e.region?.page,
                                column: e.region?.column,
                                spanTop: e.span?.top,
                                spanBottom: e.span?.bottom,
                            })),
                            // Check column.entries for this component
                            componentInPreviousEntries: column.entries.filter(e => e.instance.id === entry.instance.id).map(e => ({
                                page: e.region?.page,
                                column: e.region?.column,
                                spanTop: e.span?.top,
                                spanBottom: e.span?.bottom,
                            })),
                        });
                    }

                    // Debug: Log what we found in column.entries
                    if (isPaginationDebugEnabled()) {
                        debugLog(entry.instance.id, '🔍', 'found-placed-entry', {
                            runId,
                            regionKey: key,
                            foundInColumnEntries: !!placedEntryInColumnEntries,
                            foundInPrevious: !!placedEntryFromPrevious,
                            found: !!placedEntry,
                            placedEntrySpanTop: placedEntry?.span?.top,
                            placedEntrySpanBottom: placedEntry?.span?.bottom,
                            entrySpanTop: entry.span?.top,
                            entrySpanBottom: entry.span?.bottom,
                            actualSpanTop: actualSpan.top,
                            actualSpanBottom: actualSpan.bottom,
                            entryTop, // The value we'll use for overflow detection
                            cursorOffset: cursor.currentOffset,
                            columnEntriesCount: column.entries.length,
                            columnEntriesSpans: column.entries.slice(0, 5).map(e => ({
                                id: e.instance.id,
                                spanTop: e.span?.top,
                                spanBottom: e.span?.bottom,
                                spanHeight: e.span?.height,
                                regionPage: e.region?.page,
                                regionColumn: e.region?.column,
                            })),
                            // CRITICAL DEBUG: Check if ALL entries have span.top = 0
                            allEntriesHaveZeroTop: column.entries.every(e => !e.span || e.span.top === 0),
                            entriesWithZeroTop: column.entries.filter(e => !e.span || e.span.top === 0).length,
                            entriesWithNonZeroTop: column.entries.filter(e => e.span && e.span.top !== 0).length,
                            // WARNING: If entryTop is 0, overflow detection will be wrong
                            entryTopIsZero: entryTop === 0,
                        });
                    }

                    // CRITICAL: Use CURRENT measured height, not stored span.bottom
                    // The stored span might be outdated if measurements changed
                    const currentMeasurement = measurements.get(entry.measurementKey);
                    const currentHeight = currentMeasurement?.height ?? actualSpan.height ?? entry.estimatedHeight ?? DEFAULT_COMPONENT_HEIGHT_PX;
                    // entryTop is set above (line ~980) from actualSpan.top
                    // If entryTop is 0, this is a bug - entries should have non-zero top when placed

                    // Recalculate bottom using current height (measurements may have changed)
                    // This ensures we detect overflow even if the entry's height increased
                    const entryBottom = entryTop + currentHeight;
                    // CSS gap handles spacing, so we check entry bottom directly

                    // CRITICAL: Check if already-placed entry overflows its region
                    // Use the RECALCULATED bottom (with current height) to detect overflow
                    // This catches cases where measurements changed and the entry now overflows
                    const entryOverflows = entryBottom > regionHeightPx;

                    // Detailed overflow detection logging
                    if (isPaginationDebugEnabled()) {
                        const rawOverflowAmount = entryBottom - regionHeightPx;
                        // overflowAmount: positive = overflow, negative = fits, zero = exactly fits
                        debugLog(entry.instance.id, '🔍', 'overflow-check', {
                            runId,
                            regionKey: key,
                            entryTop,
                            entryBottom,
                            regionHeightPx,
                            entryOverflows,
                            overflowAmount: rawOverflowAmount, // positive = overflow, negative = fits
                            overflowAmountInterpretation: rawOverflowAmount > 0 ? 'OVERFLOWS' : rawOverflowAmount < 0 ? 'FITS' : 'EXACTLY_FITS',
                            cursorOffset: cursor.currentOffset,
                            currentHeight,
                            actualSpanHeight: actualSpan.height,
                            // WARNING: If entryTop is 0, overflow detection is unreliable
                            entryTopIsZero: entryTop === 0,
                            warning: entryTop === 0 ? 'entryTop is 0 - overflow detection may be incorrect!' : undefined,
                        });
                    }

                    if (entryOverflows && !entry.overflowRouted) {
                        // Entry overflows - route to next region
                        const nextRegion = findNextRegion(pages, key);

                        if (isPaginationDebugEnabled()) {
                            debugLog(entry.instance.id, '🔀', 'routing-attempt', {
                                runId,
                                currentRegion: key,
                                currentPage: page.pageNumber,
                                currentColumn: column.columnNumber,
                                nextRegion: nextRegion?.key,
                                nextPage: nextRegion?.pageNumber,
                                nextColumn: nextRegion?.columnNumber,
                                routeKey: nextRegion ? `${entry.instance.id}:${nextRegion.key}` : null,
                                alreadyRouted: nextRegion ? routedInRegion.has(`${entry.instance.id}:${nextRegion.key}`) : false,
                            });
                        }

                        if (nextRegion && ensurePage(pages, nextRegion.pageNumber, columnCount, pendingQueues, runId, 'route-overflow-already-placed')) {
                            const routeKey = `${entry.instance.id}:${nextRegion.key}`;
                            if (!routedInRegion.has(routeKey)) {
                                const followUp: CanvasLayoutEntry = {
                                    ...entry,
                                    region: {
                                        page: nextRegion.pageNumber,
                                        column: nextRegion.columnNumber,
                                    },
                                    span: undefined, // Clear span so it gets recomputed in new region
                                    overflow: true,
                                    overflowRouted: true,
                                    sourceRegionKey: nextRegion.key,
                                };

                                const pendingQueue = getPendingQueue(nextRegion.key);
                                pendingQueue.push(followUp);
                                routedInRegion.add(routeKey);

                                debugLog(entry.instance.id, '➡️', 'route-overflow-enqueued-from-already-placed', {
                                    runId,
                                    from: key,
                                    to: nextRegion.key,
                                    targetPage: nextRegion.pageNumber,
                                    targetColumn: nextRegion.columnNumber,
                                    entryTop,
                                    entryBottom,
                                    currentHeight,
                                    storedSpanBottom: actualSpan.bottom,
                                    queueEntrySpanTop: entry.span.top, // Debug: show queue entry's incorrect span.top
                                    regionHeightPx,
                                    overflowAmount: entryBottom - regionHeightPx,
                                    pendingCount: pendingQueue.length,
                                });

                                logPaginationDecision(runId, 'entry-reroute-overflow-already-placed', {
                                    componentId: entry.instance.id,
                                    from: key,
                                    to: nextRegion.key,
                                    entryTop,
                                    entryBottom,
                                    currentHeight,
                                    storedSpanBottom: actualSpan.bottom,
                                    queueEntrySpanTop: entry.span.top, // Debug: show queue entry's incorrect span.top
                                    regionHeightPx,
                                    overflowAmount: entryBottom - regionHeightPx,
                                });

                                // Don't add to columnEntries - it's being routed away
                                continue;
                            } else {
                                // Entry already routed to this region
                                if (isPaginationDebugEnabled()) {
                                    debugLog(entry.instance.id, '⚠️', 'routing-already-routed', {
                                        runId,
                                        targetRegion: nextRegion.key,
                                        routeKey,
                                    });
                                }
                            }
                        } else {
                            // Routing failed - nextRegion is null or ensurePage failed
                            if (isPaginationDebugEnabled()) {
                                debugLog(entry.instance.id, '❌', 'routing-failed', {
                                    runId,
                                    nextRegionFound: !!nextRegion,
                                    nextRegionKey: nextRegion?.key,
                                    nextPageNumber: nextRegion?.pageNumber,
                                    // Note: ensurePage was called in the if condition above
                                    // If nextRegion exists but we're here, ensurePage returned false
                                });
                            }
                        }
                    }

                    // Entry fits or couldn't be routed - keep it and advance cursor
                    // CRITICAL: Advance cursor to account for this already-placed entry
                    // Otherwise, subsequent entries will be placed at incorrect positions (CSS gap handles spacing)
                    if (entryBottom > cursor.currentOffset) {
                        cursor.currentOffset = entryBottom;
                        if (isCursorDebugEnabled()) {
                            // Cursor debug: Always log cursor advancement when cursor flag enabled
                            logPaginationDecision(runId, 'cursor-advanced-for-already-placed-entry', {
                                regionKey: key,
                                componentId: entry.instance.id,
                                entrySpanBottom: entryBottom,
                                cursorBefore: prevCursorOffset,
                                cursorAfter: cursor.currentOffset,
                                cursorAdvance: cursor.currentOffset - prevCursorOffset,
                            });
                        } else if (isPaginationDebugEnabled() && shouldDebugComponent(entry.instance.id)) {
                            debugLog(entry.instance.id, '🔧', 'cursor-advanced-for-skipped-entry', {
                                runId,
                                regionKey: key,
                                entrySpanBottom: entryBottom,
                                cursorBefore: prevCursorOffset,
                                cursorAfter: cursor.currentOffset,
                                cursorAdvance: cursor.currentOffset - prevCursorOffset,
                            });
                        }
                    }

                    // CRITICAL FIX: Update or add entry to columnEntries
                    // Search by instance.id AND region to handle cross-column entries correctly
                    // Use entry.instance.id (the entry being processed) not placedEntry.instance.id

                    // Phase 3: ExistingIndex Search Tracking - Before search
                    if (isPaginationDebugEnabled() && shouldDebugComponent(entry.instance.id)) {
                        // Log state BEFORE search
                        const componentBeforeSearch = columnEntries.filter(e => e.instance.id === entry.instance.id);
                        debugLog(normalizeComponentId(entry.instance.id), '🔎', 'component-trace-before-existing-index-search', {
                            componentId: normalizeComponentId(entry.instance.id),
                            runId,
                            regionKey: key,
                            page: page.pageNumber,
                            column: column.columnNumber,
                            componentCount: componentBeforeSearch.length,
                            componentEntries: componentBeforeSearch.map(e => ({
                                page: e.region?.page,
                                column: e.region?.column,
                                spanTop: e.span?.top,
                                spanBottom: e.span?.bottom,
                            })),
                            searchCriteria: {
                                instanceId: entry.instance.id,
                                targetPage: page.pageNumber,
                                targetColumn: column.columnNumber,
                            },
                        });
                    }

                    const existingIndex = columnEntries.findIndex(
                        e => e.instance.id === entry.instance.id &&
                            e.region?.page === page.pageNumber &&
                            e.region?.column === column.columnNumber
                    );

                    // Phase 3: ExistingIndex Search Tracking - After search
                    if (isPaginationDebugEnabled() && shouldDebugComponent(entry.instance.id)) {
                        debugLog(normalizeComponentId(entry.instance.id), '🔎', 'component-trace-existing-index-result', {
                            componentId: normalizeComponentId(entry.instance.id),
                            runId,
                            regionKey: key,
                            page: page.pageNumber,
                            column: column.columnNumber,
                            existingIndex,
                            found: existingIndex >= 0,
                            // Show what the search found
                            foundEntry: existingIndex >= 0 ? {
                                page: columnEntries[existingIndex].region?.page,
                                column: columnEntries[existingIndex].region?.column,
                                spanTop: columnEntries[existingIndex].span?.top,
                                spanBottom: columnEntries[existingIndex].span?.bottom,
                            } : null,
                            // Show all entries for this component in columnEntries
                            allComponentEntries: columnEntries
                                .map((e, idx) => ({ idx, entry: e }))
                                .filter(({ entry: e }) => e.instance.id === entry.instance.id)
                                .map(({ idx, entry: e }) => ({
                                    index: idx,
                                    page: e.region?.page,
                                    column: e.region?.column,
                                    spanTop: e.span?.top,
                                    spanBottom: e.span?.bottom,
                                    matchesSearch: e.instance.id === entry.instance.id &&
                                        e.region?.page === page.pageNumber &&
                                        e.region?.column === column.columnNumber,
                                })),
                        });
                    }

                    if (existingIndex >= 0) {
                        // Phase 4: Update/Add Tracking - Update branch
                        if (isPaginationDebugEnabled() && shouldDebugComponent(entry.instance.id)) {
                            debugLog(normalizeComponentId(entry.instance.id), '✏️', 'component-trace-updating-entry', {
                                componentId: normalizeComponentId(entry.instance.id),
                                runId,
                                regionKey: key,
                                page: page.pageNumber,
                                column: column.columnNumber,
                                existingIndex,
                                beforeUpdate: {
                                    page: columnEntries[existingIndex].region?.page,
                                    column: columnEntries[existingIndex].region?.column,
                                    spanTop: columnEntries[existingIndex].span?.top,
                                    spanBottom: columnEntries[existingIndex].span?.bottom,
                                },
                                afterUpdate: {
                                    page: page.pageNumber,
                                    column: column.columnNumber,
                                    spanTop: actualSpan.top,
                                    spanBottom: actualSpan.bottom,
                                },
                                componentCountBefore: columnEntries.filter(e => e.instance.id === entry.instance.id).length,
                            });
                        }

                        // Update existing entry with current span (preserves span.top from previousPlan)
                        columnEntries[existingIndex] = {
                            ...columnEntries[existingIndex],
                            span: actualSpan, // Use actualSpan which preserves span.top from placedEntry
                        };
                    } else {
                        // Phase 4: Update/Add Tracking - Add branch
                        if (isPaginationDebugEnabled() && shouldDebugComponent(entry.instance.id)) {
                            debugLog(normalizeComponentId(entry.instance.id), '➕', 'component-trace-adding-entry', {
                                componentId: normalizeComponentId(entry.instance.id),
                                runId,
                                regionKey: key,
                                page: page.pageNumber,
                                column: column.columnNumber,
                                existingIndex,
                                whyNotFound: 'existingIndex search returned -1',
                                componentCountBefore: columnEntries.filter(e => e.instance.id === entry.instance.id).length,
                                entryToAdd: {
                                    page: page.pageNumber,
                                    column: column.columnNumber,
                                    spanTop: actualSpan.top,
                                    spanBottom: actualSpan.bottom,
                                    fromPlacedEntry: !!placedEntry,
                                    placedEntryRegion: placedEntry?.region,
                                },
                                // Check if this component already exists with different region
                                componentWithDifferentRegion: columnEntries
                                    .filter(e => e.instance.id === entry.instance.id)
                                    .map(e => ({
                                        page: e.region?.page,
                                        column: e.region?.column,
                                        spanTop: e.span?.top,
                                        spanBottom: e.span?.bottom,
                                    })),
                            });
                        }

                        // Entry not found in columnEntries - add it
                        // Use placedEntry if available (has correct span from previousPlan),
                        // otherwise use entry with actualSpan
                        const entryToAdd = placedEntry
                            ? { ...placedEntry, span: actualSpan }
                            : { ...entry, span: actualSpan };

                        // Fix 1: Check for duplicate before adding (Path 1: Already-placed entry add branch)
                        // Note: This path already has existingIndex check above, but this is a safety net
                        const existingIndexPath1Add = findExistingEntry(entry, columnEntries, page.pageNumber, column.columnNumber);
                        if (existingIndexPath1Add >= 0) {
                            // Update existing entry instead of adding duplicate
                            columnEntries[existingIndexPath1Add] = {
                                ...columnEntries[existingIndexPath1Add],
                                span: entryToAdd.span,
                            };
                            if (isPaginationDebugEnabled() && shouldDebugComponent(entry.instance.id)) {
                                debugLog(normalizeComponentId(entry.instance.id), '🔄', 'component-trace-updated-instead-of-duplicate-path1-add', {
                                    componentId: normalizeComponentId(entry.instance.id),
                                    runId,
                                    regionKey: key,
                                    page: page.pageNumber,
                                    column: column.columnNumber,
                                    existingIndex: existingIndexPath1Add,
                                });
                            }
                        } else {
                            columnEntries.push(entryToAdd);
                        }
                    }

                    // Phase 4: Update/Add Tracking - After update/add
                    if (isPaginationDebugEnabled() && shouldDebugComponent(entry.instance.id)) {
                        const componentAfter = columnEntries.filter(e => e.instance.id === entry.instance.id);
                        debugLog(normalizeComponentId(entry.instance.id), '📊', 'component-trace-after-update-add', {
                            componentId: normalizeComponentId(entry.instance.id),
                            runId,
                            regionKey: key,
                            page: page.pageNumber,
                            column: column.columnNumber,
                            componentCount: componentAfter.length,
                            componentEntries: componentAfter.map(e => ({
                                page: e.region?.page,
                                column: e.region?.column,
                                spanTop: e.span?.top,
                                spanBottom: e.span?.bottom,
                            })),
                            hasDuplicates: componentAfter.length > 1,
                            duplicatesInSameRegion: componentAfter.filter(e =>
                                e.region?.page === page.pageNumber &&
                                e.region?.column === column.columnNumber
                            ).length,
                        });
                    }

                    // Detect duplicates after update/add
                    if (isPaginationDebugEnabled()) {
                        const duplicateEntries = columnEntries.filter(
                            e => e.instance.id === entry.instance.id
                        );
                        if (duplicateEntries.length > 1) {
                            console.warn('⚠️ [DUPLICATE] Entry found multiple times in columnEntries:', {
                                componentId: entry.instance.id,
                                duplicateCount: duplicateEntries.length,
                                locations: duplicateEntries.map(e => ({
                                    page: e.region?.page,
                                    column: e.region?.column,
                                    spanTop: e.span?.top,
                                })),
                                currentRegion: key,
                                placedEntryFound: !!placedEntry,
                                existingIndexFound: existingIndex >= 0,
                            });
                        }

                        // Phase 5: Duplication Detection Tracking
                        if (shouldDebugComponent(entry.instance.id)) {
                            const componentDuplicates = columnEntries.filter(e => e.instance.id === entry.instance.id);
                            if (componentDuplicates.length > 1) {
                                debugLog(normalizeComponentId(entry.instance.id), '⚠️', 'component-trace-duplicate-detected', {
                                    componentId: normalizeComponentId(entry.instance.id),
                                    runId,
                                    regionKey: key,
                                    page: page.pageNumber,
                                    column: column.columnNumber,
                                    duplicateCount: componentDuplicates.length,
                                    duplicates: componentDuplicates.map((e, idx) => ({
                                        index: idx,
                                        page: e.region?.page,
                                        column: e.region?.column,
                                        spanTop: e.span?.top,
                                        spanBottom: e.span?.bottom,
                                        isInTargetRegion: e.region?.page === page.pageNumber && e.region?.column === column.columnNumber,
                                    })),
                                    duplicatesInTargetRegion: componentDuplicates.filter(e =>
                                        e.region?.page === page.pageNumber &&
                                        e.region?.column === column.columnNumber
                                    ).length,
                                    placedEntryFound: !!placedEntry,
                                    existingIndexFound: existingIndex >= 0,
                                    // Show when each duplicate was added (approximate)
                                    columnEntriesIndices: columnEntries
                                        .map((e, idx) => ({ idx, entry: e }))
                                        .filter(({ entry: e }) => e.instance.id === entry.instance.id)
                                        .map(({ idx }) => idx),
                                });
                            }
                        }
                    }

                    // Get the entry that was added/updated for logging
                    const finalEntry = placedEntry
                        ? columnEntries.find(
                            e => e.instance.id === placedEntry.instance.id &&
                                e.region?.page === page.pageNumber &&
                                e.region?.column === column.columnNumber
                        ) ?? placedEntry
                        : columnEntries[columnEntries.length - 1]; // Last added entry

                    logPaginationDecision(runId, 'entry-skip-already-placed', {
                        componentId: entry.instance.id,
                        regionKey: key,
                        existingSpan: entry.span,
                        usedPlacedEntry: !!placedEntry,
                        addedEntrySpanTop: finalEntry?.span?.top,
                        addedEntrySpanBottom: finalEntry?.span?.bottom,
                        actualSpan: actualSpan,
                        existingRegion: entry.region,
                        entryTop,
                        entryBottom,
                        currentHeight,
                        storedSpanBottom: actualSpan.bottom,
                        queueEntrySpanTop: entry.span.top, // Debug: show queue entry's incorrect span.top
                        regionHeightPx,
                        cursorBefore: prevCursorOffset,
                        cursorAfter: cursor.currentOffset,
                        cursorAdvanced: cursor.currentOffset > prevCursorOffset,
                        overflows: entryOverflows,
                        overflowAmount: entryOverflows ? entryBottom - regionHeightPx : 0,
                    });

                    // Cursor debug: Log cursor advancement for already-placed entries
                    if (isCursorDebugEnabled() && cursor.currentOffset > prevCursorOffset) {
                        logPaginationDecision(runId, 'cursor-advanced-for-skip-already-placed', {
                            regionKey: key,
                            componentId: entry.instance.id,
                            entrySpanBottom: entryBottom,
                            cursorBefore: prevCursorOffset,
                            cursorAfter: cursor.currentOffset,
                            cursorAdvance: cursor.currentOffset - prevCursorOffset,
                        });
                    }
                    continue;
                }

                // Fix 2: Skip entry if already in columnEntries but doesn't match conditional check
                // This prevents duplicate processing when entry loses span but still exists in columnEntries
                if (alreadyInColumnEntries && !(entry.span && entry.region && entry.region.page === page.pageNumber && entry.region.column === column.columnNumber)) {
                    if (isPaginationDebugEnabled() && shouldDebugComponent(entry.instance.id)) {
                        debugLog(normalizeComponentId(entry.instance.id), '⏭️', 'component-trace-skipped-already-in-column-entries', {
                            componentId: normalizeComponentId(entry.instance.id),
                            runId,
                            regionKey: key,
                            page: page.pageNumber,
                            column: column.columnNumber,
                            reason: 'Entry already in columnEntries but conditional check failed (span missing or region mismatch)',
                        });
                    }
                    continue;
                }

                // Use measurement height if available, otherwise fall back to estimatedHeight
                const measurement = measurements.get(entry.measurementKey);
                const estimatedHeight = measurement?.height ?? entry.estimatedHeight ?? DEFAULT_COMPONENT_HEIGHT_PX;
                const span = computeSpan(cursor, estimatedHeight);

                // Component-5 span calculation logging
                if (isPaginationDebugEnabled() && entry.instance.id === 'component-5') {
                    debugLog('component-5', '📐', 'span-calculation', {
                        runId,
                        regionKey: key,
                        cursorOffset: cursor.currentOffset,
                        estimatedHeight,
                        spanTop: span.top,
                        spanBottom: span.bottom,
                        spanHeight: span.height,
                        cursorAfterAdvance: span.bottom,
                        regionHeightPx: cursor.maxHeight,
                        willFit: span.bottom <= cursor.maxHeight,
                    });
                }

                // Component-6 span calculation logging
                if (isPaginationDebugEnabled() && entry.instance.id === 'component-6') {
                    debugLog('component-6', '📐', 'span-calculation', {
                        runId,
                        regionKey: key,
                        cursorOffset: cursor.currentOffset,
                        estimatedHeight,
                        spanTop: span.top,
                        spanBottom: span.bottom,
                        spanHeight: span.height,
                        cursorAfterAdvance: span.bottom,
                        regionHeightPx: cursor.maxHeight,
                        willFit: span.bottom <= cursor.maxHeight,
                        previousEntryId: columnEntries[columnEntries.length - 1]?.instance.id,
                        previousEntryBottom: columnEntries[columnEntries.length - 1]?.span?.bottom,
                    });
                }

                const fits = fitsInRegion(span, cursor, entry.instance.id);

                // Calculate available space for debugging
                const availableSpace = cursor.maxHeight - cursor.currentOffset;
                const spaceNeeded = estimatedHeight;
                const spaceDeficit = fits ? 0 : spaceNeeded - availableSpace;
                const utilizationPercent = ((cursor.currentOffset / cursor.maxHeight) * 100).toFixed(1);

                logPaginationDecision(runId, 'entry-check', {
                    componentId: entry.instance.id,
                    regionKey: key,
                    page: page.pageNumber,
                    column: column.columnNumber,
                    top: span.top,
                    bottom: span.bottom,
                    estimatedHeight,
                    measurementKey: entry.measurementKey,
                    needsMeasurement: entry.needsMeasurement,
                    hasEstimateOnly: estimatedHeight === DEFAULT_COMPONENT_HEIGHT_PX,
                    regionHeightPx,
                    fits,
                    spaceAnalysis: {
                        cursorOffset: cursor.currentOffset,
                        availableSpace,
                        spaceNeeded,
                        spaceDeficit,
                        utilizationPercent: `${utilizationPercent}%`,
                        willOverflow: !fits,
                    },
                });

                // Phase 4 A2: Removed "proactive spell-list chunking" workaround
                // With measurement perfection (Phase 1 & 2), we no longer need to force
                // artificial splits. Components that fit should be placed as-is.

                if (fits) {
                    // Filter out zero-height entries before committing (fits path)
                    // Components return null for 0-item entries, creating empty DOM elements
                    // EXCEPTION: Metadata entries have 0 items but render real content (title, description)
                    const isMetadataEntry = entry.regionContent?.kind?.includes('metadata') ?? false;
                    const hasZeroItems = entry.regionContent && entry.regionContent.items.length === 0;
                    const hasZeroHeight = span.height === 0 || (hasZeroItems && !isMetadataEntry);

                    if (hasZeroHeight) {
                        debugLog(entry.instance.id, '⏭️', 'skipping-zero-height-fits-path', {
                            runId,
                            regionKey: key,
                            reason: 'Entry has 0 height or 0 items (not metadata)',
                            spanHeight: span.height,
                            itemCount: entry.regionContent?.items.length ?? 'N/A',
                            kind: entry.regionContent?.kind ?? 'N/A',
                            isMetadata: isMetadataEntry,
                        });
                        // Don't create entry, continue to next component
                        continue;
                    }

                    paginationStats.componentsPlaced++;

                    const committedEntry: CanvasLayoutEntry = {
                        ...entry,
                        region: {
                            page: page.pageNumber,
                            column: column.columnNumber,
                            index: columnEntries.length,
                        },
                        span,
                        overflow: entry.overflow ?? false,
                        listContinuation: entry.regionContent
                            ? {
                                isContinuation: entry.regionContent.isContinuation,
                                startIndex: entry.regionContent.startIndex,
                                totalCount: entry.regionContent.totalCount,
                            }
                            : undefined,
                        sourceRegionKey: column.key,
                    };

                    // Phase 4.5: New Entry Placement Tracking - Fits path
                    if (isPaginationDebugEnabled() && shouldDebugComponent(entry.instance.id)) {
                        debugLog(normalizeComponentId(entry.instance.id), '✅', 'component-trace-new-entry-fits', {
                            componentId: normalizeComponentId(entry.instance.id),
                            runId,
                            regionKey: key,
                            page: page.pageNumber,
                            column: column.columnNumber,
                            spanTop: span.top,
                            spanBottom: span.bottom,
                            componentCountBefore: columnEntries.filter(e => e.instance.id === entry.instance.id).length,
                            committedEntryRegion: committedEntry.region,
                        });
                    }

                    // Fix 1: Check for duplicate before adding (Path 2: New entry fits)
                    const existingIndexPath2 = findExistingEntry(entry, columnEntries, page.pageNumber, column.columnNumber);
                    if (existingIndexPath2 >= 0) {
                        // Update existing entry instead of adding duplicate
                        columnEntries[existingIndexPath2] = {
                            ...columnEntries[existingIndexPath2],
                            span: committedEntry.span,
                            region: committedEntry.region,
                        };
                        if (isPaginationDebugEnabled() && shouldDebugComponent(entry.instance.id)) {
                            debugLog(normalizeComponentId(entry.instance.id), '🔄', 'component-trace-updated-instead-of-duplicate-path2', {
                                componentId: normalizeComponentId(entry.instance.id),
                                runId,
                                regionKey: key,
                                page: page.pageNumber,
                                column: column.columnNumber,
                                existingIndex: existingIndexPath2,
                            });
                        }
                    } else {
                        columnEntries.push(committedEntry);
                    }
                    const prevOffset = cursor.currentOffset;
                    advanceCursor(cursor, span);

                    // Component-5 placement logging
                    if (isPaginationDebugEnabled() && entry.instance.id === 'component-5') {
                        const spanBottom = entry.span?.bottom ?? span.bottom;
                        const actuallyOverflows = spanBottom > regionHeightPx;
                        debugLog('component-5', '✅', 'component-5-placed', {
                            runId,
                            regionKey: key,
                            page: page.pageNumber,
                            column: column.columnNumber,
                            spanTop: entry.span?.top ?? span.top,
                            spanBottom,
                            spanHeight: entry.span?.height ?? span.height,
                            cursorBefore: prevOffset,
                            cursorAfter: cursor.currentOffset,
                            regionHeightPx,
                            // FIX: Only report overflow if component actually exceeds region height
                            // This was incorrectly reporting overflow even when component fits
                            overflows: actuallyOverflows,
                            overflowAmount: actuallyOverflows ? spanBottom - regionHeightPx : 0,
                            fits: !actuallyOverflows,
                            availableSpace: regionHeightPx - spanBottom,
                        });
                    }

                    // Component-6 placement logging
                    if (isPaginationDebugEnabled() && entry.instance.id === 'component-6') {
                        debugLog('component-6', '✅', 'component-6-placed', {
                            runId,
                            regionKey: key,
                            page: page.pageNumber,
                            column: column.columnNumber,
                            spanTop: entry.span?.top ?? span.top,
                            spanBottom: entry.span?.bottom ?? span.bottom,
                            spanHeight: entry.span?.height ?? span.height,
                            cursorBefore: prevOffset,
                            cursorAfter: cursor.currentOffset,
                            regionHeightPx,
                            overflows: (entry.span?.bottom ?? span.bottom) > regionHeightPx,
                            overflowAmount: (entry.span?.bottom ?? span.bottom) - regionHeightPx,
                            previousEntryId: columnEntries[columnEntries.length - 1]?.instance.id,
                            previousEntryBottom: columnEntries[columnEntries.length - 1]?.span?.bottom,
                        });
                    }

                    logPaginationDecision(runId, 'entry-placed', {
                        componentId: entry.instance.id,
                        regionKey: key,
                        spanTop: span.top,
                        spanBottom: span.bottom,
                        spanHeight: span.height,
                        cursorBefore: prevOffset,
                        cursorAfter: cursor.currentOffset,
                        cursorAdvance: cursor.currentOffset - prevOffset,
                        remainingSpace: cursor.maxHeight - cursor.currentOffset,
                    });

                    // Cursor debug: Log cursor advancement during normal placement
                    if (isCursorDebugEnabled() && cursor.currentOffset > prevOffset) {
                        logPaginationDecision(runId, 'cursor-advanced-for-placed-entry', {
                            regionKey: key,
                            componentId: entry.instance.id,
                            spanBottom: span.bottom,
                            cursorBefore: prevOffset,
                            cursorAfter: cursor.currentOffset,
                            cursorAdvance: cursor.currentOffset - prevOffset,
                        });
                    }
                    continue;
                }

                overflowWarnings.push({ componentId: entry.instance.id, page: page.pageNumber, column: column.columnNumber });

                debugLog(entry.instance.id, '📛', 'component overflow', {
                    runId,
                    regionKey: key,
                    page: page.pageNumber,
                    column: column.columnNumber,
                    estimatedHeight,
                    cursorOffset: cursor.currentOffset,
                    regionHeightPx,
                    span,
                    hasRegionContent: !!entry.regionContent,
                    itemCount: entry.regionContent?.items.length ?? 0,
                });

                // Component-5/6 overflow routing logging
                if (isPaginationDebugEnabled() && (entry.instance.id === 'component-5' || entry.instance.id === 'component-6')) {
                    const nextRegion = findNextRegion(pages, key);
                    debugLog(entry.instance.id, '⏭️', `${entry.instance.id}-routed-to-next-column`, {
                        reason: 'does-not-fit',
                        runId,
                        regionKey: key,
                        nextRegionKey: nextRegion?.key ?? null,
                        nextPage: nextRegion?.pageNumber ?? null,
                        nextColumn: nextRegion?.columnNumber ?? null,
                        spanTop: span.top,
                        spanBottom: span.bottom,
                        spanHeight: span.height,
                        cursorOffset: cursor.currentOffset,
                        regionHeightPx,
                        overflowAmount: span.bottom - regionHeightPx,
                    });
                }

                logPaginationDecision(runId, 'entry-overflow', {
                    componentId: entry.instance.id,
                    regionKey: key,
                    page: page.pageNumber,
                    column: column.columnNumber,
                    span,
                    estimatedHeight,
                    regionHeightPx,
                    hasRegionContent: !!entry.regionContent,
                    itemCount: entry.regionContent?.items.length ?? 0,
                });

                // Measurement-based split evaluation for list components
                // For list components with multiple items, use concrete measurements to determine
                // the best split point. For block components, use simple threshold check.
                const startsInBottomFifth = span.top > (regionHeightPx * 0.8);
                let shouldAvoidSplit = startsInBottomFifth; // Default: simple threshold for blocks
                let splitDecision: SplitDecision | null = null;

                // Phase 4 A2: Find next region FIRST so we can use its capacity for smart split decisions
                const nextRegion = findNextRegion(pages, key);
                // Assume next region is empty (full capacity available) - reasonable approximation
                const nextRegionCapacity = nextRegion ? regionHeightPx : undefined;

                debugLog(entry.instance.id, '🪓', 'evaluating split', {
                    runId,
                    items: entry.regionContent?.items?.length ?? 0,
                    cursorOffset: cursor.currentOffset,
                    regionHeightPx,
                    nextRegionKey: nextRegion?.key ?? null,
                    nextRegionCapacity,
                });

                // For list components with multiple items, use measurement-based evaluation
                if (
                    entry.regionContent &&
                    (entry.regionContent.items.length > 1 ||
                        (entry.regionContent.items.length === 1 &&
                            entry.regionContent.metadata &&
                            entry.regionContent.startIndex === 0 &&
                            !entry.regionContent.isContinuation))
                ) {
                    // Phase 4 A2: Pass nextRegionCapacity for smarter split vs move decisions
                    splitDecision = findBestListSplit(
                        entry,
                        cursor,
                        regionHeightPx,
                        measurements,
                        adapters,
                        { nextRegionCapacity }
                    );

                    // If split evaluation says we can't place, treat like shouldAvoidSplit
                    if (!splitDecision.canPlace) {
                        shouldAvoidSplit = true;
                    }

                    // Phase 4 A2: Log when smart split prefers moving
                    if (splitDecision.preferMove) {
                        debugLog(entry.instance.id, '🚚', 'smart-split-prefers-move', {
                            runId,
                            regionKey: key,
                            reason: splitDecision.reason,
                            nextRegionKey: nextRegion?.key ?? null,
                        });
                    }
                }

                // nextRegion already computed above for smart split decisions
                if (debugQueueEntry) {
                    // FIX: Log next-region-snapshot with context that this is informational,
                    // not indicating where the current component was placed
                    debugLog(debugQueueEntry.instance.id, '🧮', 'next-region-snapshot', {
                        runId,
                        from: key,
                        nextRegionKey: nextRegion?.key ?? null,
                        nextRegionPage: nextRegion?.pageNumber ?? null,
                        nextRegionColumn: nextRegion?.columnNumber ?? null,
                        totalPages: pages.length,
                        note: 'Informational: shows next region if overflow occurs, not actual placement',
                    });
                }

                const moveRemainingToRegion = (targetKey: string | null): boolean => {
                    if (!targetKey) {
                        return false;
                    }
                    const pendingQueue = getPendingQueue(targetKey);
                    if (regionQueue.length > 0) {
                        const debugEntry = regionQueue.find((queued) => shouldDebugComponent(queued.instance.id));
                        if (debugEntry) {
                            debugLog(debugEntry.instance.id, '🚚', 'move-remaining-to-region', {
                                runId,
                                from: key,
                                to: targetKey,
                                movingIds: regionQueue.map((queued) => queued.instance.id),
                                pendingBefore: pendingQueue.length,
                            });
                        }
                    }
                    if (regionQueue.length > 0) {
                        pendingQueue.push(...regionQueue);
                        regionQueue.length = 0;
                        const debugEntry = pendingQueue.find((queued) => shouldDebugComponent(queued.instance.id));
                        if (debugEntry) {
                            debugLog(debugEntry.instance.id, '📦', 'moved-remaining-enqueued', {
                                runId,
                                targetKey,
                                pendingAfter: pendingQueue.length,
                                reroutedIds: pendingQueue.map((queued) => queued.instance.id),
                            });
                        }
                    }
                    return true;
                };

                if (!entry.regionContent || entry.regionContent.items.length <= 1 || shouldAvoidSplit) {
                    // For block entries we only want to enqueue a follow-up copy once; without this guard
                    // the overflow version gets re-enqueued forever and the paginator never advances.
                    // Keep this note because removing it caused an infinite loop earlier.
                    const routeOverflowToNextRegion = ({ allowOverflowReroute = false, forceAdvance = false }: { allowOverflowReroute?: boolean; forceAdvance?: boolean } = {}): string | null => {
                        let alreadyRerouted = entry.overflowRouted ?? false;
                        const isOverflowingFromHomeRegion = entry.homeRegionKey === key;

                        // CRITICAL FIX: Reset already-rerouted flag if region height changed significantly
                        // This allows re-routing when region height drops (e.g., component-10 split segment invalidation)
                        const regionHeightChanged = lastRegionHeightPx !== null && Math.abs(lastRegionHeightPx - regionHeightPx) > SIGNIFICANT_REGION_HEIGHT_CHANGE_PX;
                        if (alreadyRerouted && regionHeightChanged) {
                            if (isPaginationDebugEnabled()) {
                                debugLog(entry.instance.id, '🔄', 'already-rerouted-reset-region-height-changed', {
                                    runId,
                                    regionKey: key,
                                    previousRegionHeight: lastRegionHeightPx,
                                    currentRegionHeight: regionHeightPx,
                                    heightDiff: lastRegionHeightPx !== null ? regionHeightPx - lastRegionHeightPx : 0,
                                    threshold: SIGNIFICANT_REGION_HEIGHT_CHANGE_PX,
                                    reason: 'Region height changed significantly, allowing re-routing',
                                });
                            }
                            alreadyRerouted = false; // Reset flag to allow re-routing
                        }

                        debugLog(entry.instance.id, '🧭', 'route-overflow-start', {
                            runId,
                            regionKey: key,
                            homeRegionKey: entry.homeRegionKey,
                            isOverflowingFromHomeRegion,
                            allowOverflowReroute,
                            forceAdvance,
                            alreadyRerouted,
                            regionHeightChanged,
                        });

                        // CRITICAL: If component is overflowing from its home region, prefer the other column
                        // on the same page instead of advancing to the next page. This prevents components
                        // from being incorrectly routed to page 2 when they should be in column 2 of page 1.
                        let candidateRegion: RegionPosition | null = null;
                        if (isOverflowingFromHomeRegion && columnCount > 1) {
                            candidateRegion = findOtherColumnOnSamePage(pages, key);
                            if (candidateRegion && process.env.NODE_ENV !== 'production') {
                                debugLog(entry.instance.id, '🏠', 'route-overflow-prefer-home-page-column', {
                                    runId,
                                    from: key,
                                    to: candidateRegion.key,
                                    reason: 'overflowing-from-home-region',
                                });
                            }
                        }

                        // Fall back to sequential next region if no same-page column found
                        if (!candidateRegion) {
                            candidateRegion = findNextRegion(pages, key);
                        }

                        if (!candidateRegion && forceAdvance) {
                            const newPageNumber = pages.length + 1;
                            if (!ensurePage(pages, newPageNumber, columnCount, pendingQueues, runId, 'force-advance-overflow')) {
                                // Hit MAX_PAGES limit, stop pagination
                                return null;
                            }
                            candidateRegion = findNextRegion(pages, key);
                        }

                        if (!candidateRegion) {
                            logPaginationDecision(runId, 'route-blocked-no-candidate', {
                                componentId: entry.instance.id,
                                regionKey: key,
                                pagesCount: pages.length,
                            });
                            debugLog(entry.instance.id, '⛔', 'route-overflow-no-candidate', {
                                runId,
                                regionKey: key,
                                pagesCount: pages.length,
                            });
                            return null;
                        }

                        if (!ensurePage(pages, candidateRegion.pageNumber, columnCount, pendingQueues, runId, 'route-overflow-to-next-region')) {
                            // Hit MAX_PAGES limit, stop pagination
                            return null;
                        }

                        const previousRegion = entry.region ?? { page: page.pageNumber, column: page.columns[columnIndex].columnNumber };

                        if (alreadyRerouted && !allowOverflowReroute) {
                            const advancesPage = candidateRegion.pageNumber > previousRegion.page;
                            if (!advancesPage) {
                                logPaginationDecision(runId, 'route-blocked-already-rerouted', {
                                    componentId: entry.instance.id,
                                    regionKey: key,
                                    allowOverflowReroute,
                                    candidateRegion,
                                    previousRegion,
                                });
                                debugLog(entry.instance.id, '⛔', 'route-overflow-blocked-already-rerouted', {
                                    runId,
                                    regionKey: key,
                                    allowOverflowReroute,
                                    candidateRegion,
                                    previousRegion,
                                });
                                return null;
                            }
                        }

                        if (!forceAdvance) {
                            if (candidateRegion.pageNumber < previousRegion.page) {
                                logPaginationDecision(runId, 'route-blocked-backwards', {
                                    componentId: entry.instance.id,
                                    candidatePage: candidateRegion.pageNumber,
                                    previousPage: previousRegion.page,
                                });
                                return null;
                            }

                            const sameRegion =
                                candidateRegion.pageNumber === previousRegion.page && candidateRegion.columnNumber === previousRegion.column;

                            if (sameRegion) {
                                logPaginationDecision(runId, 'route-blocked-same-region', {
                                    componentId: entry.instance.id,
                                    regionKey: key,
                                    candidateKey: candidateRegion.key,
                                    previousRegion,
                                    candidateRegion,
                                });
                                debugLog(entry.instance.id, '⛔', 'route-overflow-same-region', {
                                    runId,
                                    regionKey: key,
                                    candidateRegion,
                                    previousRegion,
                                });
                                return null;
                            }
                        }

                        const routeKey = `${entry.instance.id}:${candidateRegion.key}`;
                        if (routedInRegion.has(routeKey)) {
                            logPaginationDecision(runId, 'route-blocked-already-routed-to-region', {
                                componentId: entry.instance.id,
                                routeKey,
                            });
                            debugLog(entry.instance.id, '⛔', 'route-overflow-duplicate-route', {
                                runId,
                                routeKey,
                            });
                            return null;
                        }

                        const followUp: CanvasLayoutEntry = {
                            ...entry,
                            region: {
                                page: candidateRegion.pageNumber,
                                column: candidateRegion.columnNumber,
                            },
                            span: undefined,
                            overflow: true,
                            overflowRouted: true,
                            sourceRegionKey: candidateRegion.key,
                            orderIndex: entry.orderIndex,
                        };

                        const pendingQueue = getPendingQueue(candidateRegion.key);
                        pendingQueue.push(followUp);
                        routedInRegion.add(routeKey);
                        debugLog(entry.instance.id, '➡️', 'route-overflow-enqueued', {
                            runId,
                            from: key,
                            to: candidateRegion.key,
                            targetPage: candidateRegion.pageNumber,
                            targetColumn: candidateRegion.columnNumber,
                            pendingCount: pendingQueue.length,
                        });
                        logPaginationDecision(runId, 'route-entry', {
                            componentId: entry.instance.id,
                            from: key,
                            to: candidateRegion.key,
                            targetPage: candidateRegion.pageNumber,
                            targetColumn: candidateRegion.columnNumber,
                        });
                        return candidateRegion.key;
                    };

                    if (estimatedHeight > regionHeightPx) {
                        const columnHasOverflow = columnEntries.some((existing) => existing.overflow || existing.overflowRouted);
                        const rerouteKey = routeOverflowToNextRegion({
                            allowOverflowReroute: !(entry.overflowRouted ?? false),
                            forceAdvance: true,
                        });
                        if (columnHasOverflow && rerouteKey) {
                            moveRemainingToRegion(rerouteKey);
                            logPaginationDecision(runId, 'move-remaining-after-reroute', {
                                componentId: entry.instance.id,
                                from: key,
                                to: rerouteKey,
                                pendingCount: regionQueue.length,
                            });
                            break;
                        }

                        // Filter out zero-height entries (overflow path 1)
                        // EXCEPTION: Metadata entries have 0 items but render real content
                        const isMetadataEntry = entry.regionContent?.kind?.includes('metadata') ?? false;
                        const hasZeroItems = entry.regionContent && entry.regionContent.items.length === 0;
                        const hasZeroHeight = span.height === 0 || (hasZeroItems && !isMetadataEntry);

                        if (hasZeroHeight) {
                            debugLog(entry.instance.id, '⏭️', 'skipping-zero-height-overflow-path1', {
                                runId,
                                regionKey: key,
                                reason: 'Entry has 0 height or 0 items (not metadata)',
                                spanHeight: span.height,
                                itemCount: entry.regionContent?.items.length ?? 'N/A',
                                kind: entry.regionContent?.kind ?? 'N/A',
                                isMetadata: isMetadataEntry,
                            });
                            continue;
                        }

                        const committedEntry: CanvasLayoutEntry = {
                            ...entry,
                            region: {
                                page: page.pageNumber,
                                column: column.columnNumber,
                                index: columnEntries.length,
                            },
                            span,
                            overflow: true,
                            listContinuation: entry.regionContent
                                ? {
                                    isContinuation: entry.regionContent.isContinuation,
                                    startIndex: entry.regionContent.startIndex,
                                    totalCount: entry.regionContent.totalCount,
                                }
                                : undefined,
                            sourceRegionKey: column.key,
                        };

                        // Phase 4.6: Split Entry Placement Tracking - Overflow path 1
                        if (isPaginationDebugEnabled() && shouldDebugComponent(entry.instance.id)) {
                            debugLog(normalizeComponentId(entry.instance.id), '🔄', 'component-trace-split-entry-overflow-1', {
                                componentId: normalizeComponentId(entry.instance.id),
                                runId,
                                regionKey: key,
                                page: page.pageNumber,
                                column: column.columnNumber,
                                spanTop: span.top,
                                spanBottom: span.bottom,
                                componentCountBefore: columnEntries.filter(e => e.instance.id === entry.instance.id).length,
                                committedEntryRegion: committedEntry.region,
                            });
                        }

                        // Fix 1: Check for duplicate before adding (Path 3: Split entry - first segment)
                        const existingIndexPath3 = findExistingEntry(entry, columnEntries, page.pageNumber, column.columnNumber);
                        if (existingIndexPath3 >= 0) {
                            // Update existing entry instead of adding duplicate
                            columnEntries[existingIndexPath3] = {
                                ...columnEntries[existingIndexPath3],
                                span: committedEntry.span,
                                region: committedEntry.region,
                            };
                            if (isPaginationDebugEnabled() && shouldDebugComponent(entry.instance.id)) {
                                debugLog(normalizeComponentId(entry.instance.id), '🔄', 'component-trace-updated-instead-of-duplicate-path3', {
                                    componentId: normalizeComponentId(entry.instance.id),
                                    runId,
                                    regionKey: key,
                                    page: page.pageNumber,
                                    column: column.columnNumber,
                                    existingIndex: existingIndexPath3,
                                });
                            }
                        } else {
                            columnEntries.push(committedEntry);
                        }

                        // Mark the column as full so subsequent entries route elsewhere
                        cursor.currentOffset = regionHeightPx;
                        const forcedRouteKey = routeOverflowToNextRegion({ forceAdvance: true });
                        const movedRemainingToRegion = moveRemainingToRegion(forcedRouteKey ?? null);
                        logPaginationDecision(runId, 'force-route', {
                            componentId: entry.instance.id,
                            from: key,
                            to: forcedRouteKey,
                            movedRemaining: movedRemainingToRegion,
                        });
                        if (movedRemainingToRegion) {
                            break;
                        }
                        continue;
                    }

                    if (!nextRegion) {
                        const newPageNumber = pages.length + 1;
                        if (!ensurePage(pages, newPageNumber, columnCount, pendingQueues, runId, 'overflow-no-next-region')) {
                            // Hit MAX_PAGES limit, stop pagination
                            break;
                        }
                    }

                    const updatedNextRegion = findNextRegion(pages, key);
                    if (!updatedNextRegion) {
                        // Phase 4.10: Fallback Entry Placement Tracking - No next region
                        if (isPaginationDebugEnabled() && shouldDebugComponent(entry.instance.id)) {
                            debugLog(normalizeComponentId(entry.instance.id), '⚠️', 'component-trace-fallback-no-next-region', {
                                componentId: normalizeComponentId(entry.instance.id),
                                runId,
                                regionKey: key,
                                page: page.pageNumber,
                                column: column.columnNumber,
                                spanTop: span.top,
                                spanBottom: span.bottom,
                                componentCountBefore: columnEntries.filter(e => e.instance.id === entry.instance.id).length,
                            });
                        }

                        // Filter out zero-height entries (overflow path 2)
                        // EXCEPTION: Metadata entries have 0 items but render real content
                        const isMetadataEntry = entry.regionContent?.kind?.includes('metadata') ?? false;
                        const hasZeroItems = entry.regionContent && entry.regionContent.items.length === 0;
                        const hasZeroHeight = span.height === 0 || (hasZeroItems && !isMetadataEntry);

                        if (hasZeroHeight) {
                            debugLog(entry.instance.id, '⏭️', 'skipping-zero-height-overflow-path2', {
                                runId,
                                regionKey: key,
                                reason: 'Entry has 0 height or 0 items (not metadata)',
                                spanHeight: span.height,
                                itemCount: entry.regionContent?.items.length ?? 'N/A',
                                kind: entry.regionContent?.kind ?? 'N/A',
                                isMetadata: isMetadataEntry,
                            });
                            continue;
                        }

                        const committedEntry: CanvasLayoutEntry = {
                            ...entry,
                            region: {
                                page: page.pageNumber,
                                column: column.columnNumber,
                                index: columnEntries.length,
                            },
                            span,
                            overflow: true,
                            listContinuation: entry.regionContent
                                ? {
                                    isContinuation: entry.regionContent.isContinuation,
                                    startIndex: entry.regionContent.startIndex,
                                    totalCount: entry.regionContent.totalCount,
                                }
                                : undefined,
                            sourceRegionKey: column.key,
                        };

                        // Phase 4.7: Split Entry Placement Tracking - Overflow path 2
                        if (isPaginationDebugEnabled() && shouldDebugComponent(entry.instance.id)) {
                            debugLog(normalizeComponentId(entry.instance.id), '🔄', 'component-trace-split-entry-overflow-2', {
                                componentId: normalizeComponentId(entry.instance.id),
                                runId,
                                regionKey: key,
                                page: page.pageNumber,
                                column: column.columnNumber,
                                spanTop: span.top,
                                spanBottom: span.bottom,
                                componentCountBefore: columnEntries.filter(e => e.instance.id === entry.instance.id).length,
                                committedEntryRegion: committedEntry.region,
                            });
                        }

                        // Fix 1: Check for duplicate before adding (Path 4: Split entry - overflow segment)
                        const existingIndexPath4 = findExistingEntry(entry, columnEntries, page.pageNumber, column.columnNumber);
                        if (existingIndexPath4 >= 0) {
                            // Update existing entry instead of adding duplicate
                            columnEntries[existingIndexPath4] = {
                                ...columnEntries[existingIndexPath4],
                                span: committedEntry.span,
                                region: committedEntry.region,
                            };
                            if (isPaginationDebugEnabled() && shouldDebugComponent(entry.instance.id)) {
                                debugLog(normalizeComponentId(entry.instance.id), '🔄', 'component-trace-updated-instead-of-duplicate-path4', {
                                    componentId: normalizeComponentId(entry.instance.id),
                                    runId,
                                    regionKey: key,
                                    page: page.pageNumber,
                                    column: column.columnNumber,
                                    existingIndex: existingIndexPath4,
                                });
                            }
                        } else {
                            columnEntries.push(committedEntry);
                        }
                        // Mark region as full to prevent subsequent entries from overlapping
                        cursor.currentOffset = regionHeightPx;
                        logPaginationDecision(runId, 'region-full-no-next', {
                            componentId: entry.instance.id,
                            regionKey: key,
                        });
                        continue;
                    }

                    if (!ensurePage(pages, updatedNextRegion.pageNumber, columnCount, pendingQueues, runId, 'route-remaining-after-overflow')) {
                        // Hit MAX_PAGES limit, stop pagination
                        break;
                    }
                    const routedNextKey = routeOverflowToNextRegion();
                    const movedRemaining = moveRemainingToRegion(routedNextKey ?? null);
                    logPaginationDecision(runId, 'route-remaining', {
                        componentId: entry.instance.id,
                        from: key,
                        to: routedNextKey,
                        movedRemaining,
                    });
                    if (movedRemaining) {
                        break;
                    }
                    continue;
                }

                // Use splitDecision if available (has accurate measurements)
                // Otherwise fall back to estimate-based splitting
                const items = entry.regionContent.items;
                let remainingItems: typeof items = [];
                let placedItems: typeof items = [];
                let placedHeight = 0;
                const metadataOnlyPlacement = splitDecision?.metadataOnly ?? false;

                if (splitDecision && splitDecision.canPlace) {
                    // Use measured split decision
                    placedItems = splitDecision.placedItems as typeof items;
                    remainingItems = splitDecision.remainingItems as typeof items;
                    placedHeight = splitDecision.placedHeight;

                    debugLog(entry.instance.id, '🧮', 'split decision', {
                        runId,
                        placedCount: placedItems.length,
                        remainingCount: remainingItems.length,
                        placedHeight,
                        reason: splitDecision.reason,
                    });

                    logPaginationDecision(runId, 'split-using-measurements', {
                        componentId: entry.instance.id,
                        regionKey: key,
                        placedCount: placedItems.length,
                        remainingCount: remainingItems.length,
                        placedHeight,
                        reason: splitDecision.reason,
                    });
                } else {
                    // Fallback: estimate-based splitting (legacy path)
                    let cumulativeHeight = 0;
                    const availableHeight = Math.max(regionHeightPx - cursor.currentOffset, 0);

                    items.forEach((item, itemIndex) => {
                        const itemHeight = adapters.heightEstimator.estimateItemHeight(item) + (itemIndex > 0 ? LIST_ITEM_SPACING_PX : 0);
                        if (cumulativeHeight + itemHeight <= availableHeight || placedItems.length === 0) {
                            placedItems.push(item);
                            cumulativeHeight += itemHeight;
                        } else {
                            remainingItems.push(item);
                        }
                    });

                    placedHeight = cumulativeHeight;

                    logPaginationDecision(runId, 'split-using-estimates', {
                        componentId: entry.instance.id,
                        regionKey: key,
                        placedCount: placedItems.length,
                        remainingCount: remainingItems.length,
                        placedHeight,
                        reason: 'No split decision available',
                    });

                    debugLog(entry.instance.id, '📐', 'estimate split', {
                        runId,
                        placedCount: placedItems.length,
                        remainingCount: remainingItems.length,
                        placedHeight,
                        availableHeight,
                    });
                }

                if (placedItems.length === 0 && !metadataOnlyPlacement) {
                    const rerouteKey = (() => {
                        const candidate = findNextRegion(pages, key);
                        if (!candidate) {
                            const newPageNumber = pages.length + 1;
                            if (!ensurePage(pages, newPageNumber, columnCount, pendingQueues, runId, 'reroute-empty-split')) {
                                return null;
                            }
                            return findNextRegion(pages, key)?.key ?? null;
                        }
                        return candidate.key;
                    })();

                    debugLog(entry.instance.id, '🚚', 'rerouting empty split', {
                        runId,
                        regionKey: key,
                        cursorOffset: cursor.currentOffset,
                        regionHeightPx,
                        rerouteKey,
                    });

                    if (rerouteKey) {
                        const pendingQueue = getPendingQueue(rerouteKey);
                        pendingQueue.push({
                            ...entry,
                            overflow: true,
                            overflowRouted: true,
                            sourceRegionKey: rerouteKey,
                        });
                        routedInRegion.add(`${entry.instance.id}:${rerouteKey}`);
                    } else {
                        // Phase 4.8: Empty Split Placement Tracking
                        if (isPaginationDebugEnabled() && shouldDebugComponent(entry.instance.id)) {
                            debugLog(normalizeComponentId(entry.instance.id), '📦', 'component-trace-empty-split-place', {
                                componentId: normalizeComponentId(entry.instance.id),
                                runId,
                                regionKey: key,
                                page: page.pageNumber,
                                column: column.columnNumber,
                                spanTop: span.top,
                                spanBottom: span.bottom,
                                componentCountBefore: columnEntries.filter(e => e.instance.id === entry.instance.id).length,
                            });
                        }

                        // Fix 1: Check for duplicate before adding (Path 5: Fallback entry placement)
                        const fallbackEntry = {
                            ...entry,
                            region: {
                                page: page.pageNumber,
                                column: column.columnNumber,
                                index: columnEntries.length,
                            },
                            span,
                        };
                        const existingIndexPath5 = findExistingEntry(entry, columnEntries, page.pageNumber, column.columnNumber);
                        if (existingIndexPath5 >= 0) {
                            // Update existing entry instead of adding duplicate
                            columnEntries[existingIndexPath5] = {
                                ...columnEntries[existingIndexPath5],
                                span: fallbackEntry.span,
                                region: fallbackEntry.region,
                            };
                            if (isPaginationDebugEnabled() && shouldDebugComponent(entry.instance.id)) {
                                debugLog(normalizeComponentId(entry.instance.id), '🔄', 'component-trace-updated-instead-of-duplicate-path5', {
                                    componentId: normalizeComponentId(entry.instance.id),
                                    runId,
                                    regionKey: key,
                                    page: page.pageNumber,
                                    column: column.columnNumber,
                                    existingIndex: existingIndexPath5,
                                });
                            }
                        } else {
                            columnEntries.push(fallbackEntry);
                        }
                        logPaginationDecision(runId, 'region-full-no-next', {
                            componentId: entry.instance.id,
                            regionKey: key,
                            overflow: true,
                        });
                        cursor.currentOffset = regionHeightPx;
                    }
                    continue;
                }

                const placedContent = toRegionContent(
                    entry.regionContent.kind,
                    placedItems,
                    entry.regionContent.startIndex,
                    entry.regionContent.totalCount,
                    entry.regionContent.isContinuation,
                    entry.regionContent.metadata
                );
                const hasContinuation = remainingItems.length > 0;
                const hadOverflow = entry.overflow ?? false;
                const willClearOverflow = hadOverflow && !hasContinuation;

                const placedEntry: CanvasLayoutEntry = {
                    ...entry,
                    regionContent: placedContent,
                    measurementKey: computeMeasurementKey(entry.instance.id, placedContent),
                    region: {
                        page: page.pageNumber,
                        column: column.columnNumber,
                        index: columnEntries.length,
                    },
                    estimatedHeight: placedHeight,
                    span: computeSpan(cursor, placedHeight),
                    overflow: hasContinuation ? true : false,
                    overflowRouted: hasContinuation ? entry.overflowRouted ?? false : false,
                    listContinuation: {
                        isContinuation: placedContent.isContinuation,
                        startIndex: placedContent.startIndex,
                        totalCount: placedContent.totalCount,
                    },
                    sourceRegionKey: column.key,
                };

                // Phase 4.9: Placed Entry from Split Tracking
                if (isPaginationDebugEnabled() && shouldDebugComponent(entry.instance.id)) {
                    debugLog(normalizeComponentId(entry.instance.id), '📋', 'component-trace-placed-entry-from-split', {
                        componentId: normalizeComponentId(entry.instance.id),
                        runId,
                        regionKey: key,
                        page: page.pageNumber,
                        column: column.columnNumber,
                        spanTop: placedEntry.span?.top,
                        spanBottom: placedEntry.span?.bottom,
                        componentCountBefore: columnEntries.filter(e => e.instance.id === entry.instance.id).length,
                        placedEntryRegion: placedEntry.region,
                    });
                }

                // Filter out entries with 0 items - components return null for empty items
                // EXCEPTION: Metadata entries (spell-list-metadata, etc.) render title/description without items
                const isMetadataEntry = entry.regionContent?.kind?.includes('metadata') ?? false;

                if (placedItems.length === 0 && !isMetadataEntry) {
                    debugLog(entry.instance.id, '⏭️', 'skipping empty entry', {
                        runId,
                        regionKey: key,
                        reason: 'Component returns null for empty items - would create zero-height entry',
                        metadataOnly: metadataOnlyPlacement,
                        kind: entry.regionContent?.kind ?? 'N/A',
                    });
                    // Don't create entry, but still advance cursor if metadata was placed (CSS gap handles spacing)
                    if (metadataOnlyPlacement && placedHeight > 0) {
                        cursor.currentOffset += placedHeight;
                    }
                    continue;
                }

                // Allow metadata entries to proceed even with 0 items
                if (placedItems.length === 0 && isMetadataEntry) {
                    debugLog(entry.instance.id, '✅', 'metadata-entry-with-zero-items', {
                        runId,
                        regionKey: key,
                        reason: 'Metadata renders without items (title/description)',
                        kind: entry.regionContent?.kind,
                        placedHeight,
                    });
                }

                // Fix 1: Check for duplicate before adding (Path 6: Placed entry from split)
                const existingIndexPath6 = findExistingEntry(entry, columnEntries, page.pageNumber, column.columnNumber);
                if (existingIndexPath6 >= 0) {
                    // Update existing entry instead of adding duplicate
                    columnEntries[existingIndexPath6] = {
                        ...columnEntries[existingIndexPath6],
                        span: placedEntry.span,
                        region: placedEntry.region,
                    };
                    if (isPaginationDebugEnabled() && shouldDebugComponent(entry.instance.id)) {
                        debugLog(normalizeComponentId(entry.instance.id), '🔄', 'component-trace-updated-instead-of-duplicate-path6', {
                            componentId: normalizeComponentId(entry.instance.id),
                            runId,
                            regionKey: key,
                            page: page.pageNumber,
                            column: column.columnNumber,
                            existingIndex: existingIndexPath6,
                        });
                    }
                } else {
                    columnEntries.push(placedEntry);
                }
                advanceCursor(cursor, placedEntry.span!);

                debugLog(entry.instance.id, '📦', 'placed segment', {
                    runId,
                    regionKey: key,
                    measurementKey: placedEntry.measurementKey,
                    span: placedEntry.span,
                    cursorOffset: cursor.currentOffset,
                    remainingItems: remainingItems.length,
                    overflow: placedEntry.overflow ?? false,
                    overflowRouted: placedEntry.overflowRouted ?? false,
                    clearedOverflow: willClearOverflow,
                });

                if (remainingItems.length > 0) {
                    if (!nextRegion) {
                        const newPageNumber = pages.length + 1;
                        if (!ensurePage(pages, newPageNumber, columnCount, pendingQueues, runId, 'split-remaining-no-next-region')) {
                            // Hit MAX_PAGES limit, mark as overflow and stop
                            columnEntries[columnEntries.length - 1] = {
                                ...columnEntries[columnEntries.length - 1],
                                overflow: true,
                            };
                            debugLog(entry.instance.id, '🚨', 'forced overflow on placed segment (no next region)', {
                                runId,
                                regionKey: key,
                                columnLength: columnEntries.length,
                            });
                            continue;
                        }
                    }

                    const updatedNextRegion = findNextRegion(pages, key);

                    if (!updatedNextRegion) {
                        columnEntries[columnEntries.length - 1] = {
                            ...columnEntries[columnEntries.length - 1],
                            overflow: true,
                        };
                        debugLog(entry.instance.id, '🚨', 'forced overflow on placed segment (missing updated region)', {
                            runId,
                            regionKey: key,
                            columnLength: columnEntries.length,
                        });
                        continue;
                    }

                    if (!ensurePage(pages, updatedNextRegion.pageNumber, columnCount, pendingQueues, runId, 'split-remaining-route-to-next')) {
                        // Hit MAX_PAGES limit, mark as overflow and stop
                        columnEntries[columnEntries.length - 1] = {
                            ...columnEntries[columnEntries.length - 1],
                            overflow: true,
                        };
                        debugLog(entry.instance.id, '🚨', 'forced overflow on placed segment (ensurePage failed)', {
                            runId,
                            regionKey: key,
                            columnLength: columnEntries.length,
                        });
                        continue;
                    }

                    const followUpContent = toRegionContent(
                        entry.regionContent.kind,
                        remainingItems,
                        entry.regionContent.startIndex + placedItems.length,
                        entry.regionContent.totalCount,
                        true,
                        metadataOnlyPlacement ? undefined : entry.regionContent.metadata
                    );

                    const followUpEntry: CanvasLayoutEntry = {
                        ...entry,
                        regionContent: followUpContent,
                        measurementKey: computeMeasurementKey(entry.instance.id, followUpContent),
                        estimatedHeight: adapters.heightEstimator.estimateListHeight(remainingItems, true), // Continuation segment
                        span: undefined,
                        overflow: true,
                        overflowRouted: true,
                        region: {
                            page: updatedNextRegion.pageNumber,
                            column: updatedNextRegion.columnNumber,
                        },
                        sourceRegionKey: updatedNextRegion.key,
                        listContinuation: {
                            isContinuation: followUpContent.isContinuation,
                            startIndex: followUpContent.startIndex,
                            totalCount: followUpContent.totalCount,
                        },
                    };

                    const pendingQueue = getPendingQueue(updatedNextRegion.key);
                    pendingQueue.push(followUpEntry);
                    debugLog(entry.instance.id, '📬', 'queued continuation segment', {
                        runId,
                        fromRegion: key,
                        toRegion: updatedNextRegion.key,
                        remainingCount: remainingItems.length,
                        estimatedHeight: followUpEntry.estimatedHeight,
                        overflow: followUpEntry.overflow ?? false,
                        overflowRouted: followUpEntry.overflowRouted ?? false,
                    });
                }
            }

            // Phase 6: Column Commit Tracking
            if (isPaginationDebugEnabled()) {
                const debugEntries = columnEntries.filter(e => shouldDebugComponent(e.instance.id));
                debugEntries.forEach(debugEntry => {
                    const sameComponentEntries = columnEntries.filter(e => e.instance.id === debugEntry.instance.id);
                    debugLog(normalizeComponentId(debugEntry.instance.id), '💾', 'component-trace-column-commit', {
                        componentId: normalizeComponentId(debugEntry.instance.id),
                        runId,
                        regionKey: key,
                        page: page.pageNumber,
                        column: column.columnNumber,
                        componentCount: sameComponentEntries.length,
                        componentEntries: sameComponentEntries.map(e => ({
                            page: e.region?.page,
                            column: e.region?.column,
                            spanTop: e.span?.top,
                            spanBottom: e.span?.bottom,
                            spanHeight: e.span?.height,
                        })),
                        hasDuplicates: sameComponentEntries.length > 1,
                        duplicatesInThisRegion: sameComponentEntries.filter(e =>
                            e.region?.page === page.pageNumber &&
                            e.region?.column === column.columnNumber
                        ).length,
                        // Show position in columnEntries array
                        indices: columnEntries
                            .map((e, idx) => ({ idx, entry: e }))
                            .filter(({ entry }) => entry.instance.id === debugEntry.instance.id)
                            .map(({ idx }) => idx),
                    });
                });
            }

            // Debug: Log columnEntries before assignment to column.entries (gated behind plan-commit flag)
            if (isPaginationDebugEnabled() && isDebugEnabled('plan-commit') && columnEntries.some(e => e.instance.id === 'component-05' || e.instance.id === 'component-5')) {
                const component05InColumnEntries = columnEntries.find(e => e.instance.id === 'component-05' || e.instance.id === 'component-5');
                logPaginationDecision(runId, 'column-entries-before-assignment', {
                    regionKey: key,
                    page: page.pageNumber,
                    column: column.columnNumber,
                    columnEntriesCount: columnEntries.length,
                    component05Found: !!component05InColumnEntries,
                    component05Details: component05InColumnEntries ? {
                        id: component05InColumnEntries.instance.id,
                        spanTop: component05InColumnEntries.span?.top,
                        spanBottom: component05InColumnEntries.span?.bottom,
                        region: component05InColumnEntries.region,
                    } : null,
                    allEntryIds: columnEntries.map(e => e.instance.id),
                });
            }

            column.entries = columnEntries;


            const lastSpan = columnEntries.length > 0 ? columnEntries[columnEntries.length - 1].span ?? null : null;
            const usedHeight = lastSpan ? lastSpan.bottom : 0;
            const availableHeight = Math.max(regionHeightPx - usedHeight, 0);
            column.usedHeightPx = Number(usedHeight.toFixed(2));
            column.availableHeightPx = Number(availableHeight.toFixed(2));

            if (debugQueueEntry) {
                debugLog(debugQueueEntry.instance.id, '📊', 'column-settled', {
                    runId,
                    regionKey: key,
                    page: page.pageNumber,
                    column: column.columnNumber,
                    entryCount: columnEntries.length,
                    usedHeight: column.usedHeightPx,
                    availableHeight: column.availableHeightPx,
                    cursorOffset: Number(cursor.currentOffset.toFixed(2)),
                    regionHeightPx,
                });
            }
            processedBuckets.set(key, columnEntries);
        }
    }

    // Report stats for observability (development only)
    // Disabled by default - enable via debug flag (see debugFlags.ts)
    if (shouldLogPaginationDecisions() && paginationStats.componentsPlaced > 0) {
        const total = paginationStats.heightSources.measured +
            paginationStats.heightSources.proportional +
            paginationStats.heightSources.estimate;

        console.debug('[paginate] Stats:', {
            componentsPlaced: paginationStats.componentsPlaced,
            splitDecisions: paginationStats.splitDecisions,
            bottomZoneRejections: paginationStats.bottomZoneRejections,
            heightSources: {
                measured: paginationStats.heightSources.measured,
                proportional: paginationStats.heightSources.proportional,
                estimate: paginationStats.heightSources.estimate,
                percentMeasured: total > 0 ? ((paginationStats.heightSources.measured / total) * 100).toFixed(1) + '%' : 'N/A',
            },
        });
    }

    if (isPaginationDebugEnabled()) {
        const debugPlacements: Array<Record<string, unknown>> = [];
        pages.forEach((page) => {
            page.columns.forEach((column) => {
                column.entries.forEach((entry) => {
                    if (shouldDebugComponent(entry.instance.id)) {
                        debugPlacements.push({
                            componentId: entry.instance.id,
                            measurementKey: entry.measurementKey,
                            page: page.pageNumber,
                            column: column.columnNumber,
                            index: entry.region?.index ?? null,
                            overflow: entry.overflow ?? false,
                            overflowRouted: entry.overflowRouted ?? false,
                            continuation: entry.listContinuation?.isContinuation ?? false,
                            startIndex: entry.listContinuation?.startIndex,
                            totalCount: entry.listContinuation?.totalCount,
                        });
                    }
                });
            });
        });

        if (debugPlacements.length > 0) {
            logPaginationTrace('📄', 'placement summary', {
                runId,
                entries: debugPlacements,
            });
        }
    }

    // Reset stats for next run
    paginationStats.heightSources.measured = 0;
    paginationStats.heightSources.proportional = 0;
    paginationStats.heightSources.estimate = 0;
    paginationStats.bottomZoneRejections = 0;
    paginationStats.splitDecisions = 0;
    paginationStats.componentsPlaced = 0;

    return { pages, overflowWarnings };
};



