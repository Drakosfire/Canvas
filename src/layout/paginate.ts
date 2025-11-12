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
    computeMeasurementKey,
    regionKey,
    toColumnType,
    DEFAULT_COMPONENT_HEIGHT_PX,
} from './utils';
import { isDebugEnabled } from './debugFlags';
import { buildSegmentPlan, SegmentRerouteCache } from './planner';
import type { PlannerRegionConfig, SegmentDescriptor } from './segmentTypes';

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
const isPaginationDebugEnabled = (): boolean => isDebugEnabled('paginate-spellcasting');
const isPlannerDebugEnabled = (): boolean => isDebugEnabled('planner-spellcasting');
// Only debug components explicitly specified via CLI/env vars
const shouldDebugComponent = (componentId: string): boolean =>
    DEBUG_COMPONENT_IDS.has(componentId);

// Export for use in other modules (e.g., StatblockPage.tsx)
export const isComponentDebugEnabled = (componentId: string): boolean =>
    shouldDebugComponent(componentId);

// Log debug configuration on module load (once per page load)
// Check in browser context (webpack replaces process.env.REACT_APP_* at build time)
if (typeof window !== 'undefined') {
    const enabledFlags: string[] = [];
    if (isPaginationDebugEnabled()) enabledFlags.push('paginate');
    if (isPlannerDebugEnabled()) enabledFlags.push('planner');
    if (isDebugEnabled('layout-plan-diff')) enabledFlags.push('plan-diff');
    if (isDebugEnabled('measurement-spellcasting')) enabledFlags.push('measurement');
    if (isDebugEnabled('layout-dirty')) enabledFlags.push('layout');
    if (isDebugEnabled('measure-first')) enabledFlags.push('measure-first');

    // Always log debug configuration in browser (removed conditional to ensure visibility)
    // eslint-disable-next-line no-console
    console.log('🎯 [Canvas Debug] Active configuration:', {
        componentIds: Array.from(DEBUG_COMPONENT_IDS),
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

    const basePayload: Record<string, unknown> = { componentId };
    if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
        Object.assign(basePayload, payload as Record<string, unknown>);
    } else if (payload !== undefined) {
        basePayload.value = payload;
    }

    logPaginationTrace(emoji, label, basePayload);
};

let debugRunId = 0;

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
    if (args.length >= 3 && typeof args[2] === 'object' && args[2] !== null) {
        const payload = args[2] as { componentId?: string };
        if (payload.componentId) {
            // Only log if this component is in the debug list
            shouldLog = shouldDebugComponent(payload.componentId);
        }
    }
    // For logs without componentId (like 'run-start'), always log if pagination debug is enabled

    if (!shouldLog) {
        return;
    }

    // eslint-disable-next-line no-console
    console.debug('[paginate]', ...args);
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

    sequence.forEach((region, index) => {
        if (seen.has(region.key)) {
            return;
        }
        seen.add(region.key);
        configs.push({
            key: region.key,
            maxHeightPx: regionHeightPx,
            cursorOffsetPx: 0,
        });
    });

    return configs;
};

const ensurePage = (
    pages: PageLayout[],
    pageNumber: number,
    columnCount: number,
    pendingQueues: Map<string, CanvasLayoutEntry[]>
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

const createCursor = (regionKey: string, maxHeight: number): RegionCursor => ({
    regionKey,
    currentOffset: 0,
    maxHeight,
});

const computeSpan = (cursor: RegionCursor, estimatedHeight: number): RegionSpan => ({
    top: cursor.currentOffset,
    bottom: cursor.currentOffset + estimatedHeight,
    height: estimatedHeight,
});

const fitsInRegion = (span: RegionSpan, cursor: RegionCursor): boolean => {
    // Check if component + spacing buffer fits in region
    // (cursor advances by span.bottom + COMPONENT_VERTICAL_SPACING_PX)
    const cursorAfterPlacement = span.bottom + COMPONENT_VERTICAL_SPACING_PX;
    return cursorAfterPlacement <= cursor.maxHeight;
};

const advanceCursor = (cursor: RegionCursor, span: RegionSpan) => {
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
}

/**
 * Find best split point for list component using measurement-based evaluation.
 * 
 * Algorithm:
 * 1. Try splits from largest to smallest (greedy: maximize items in current region)
 * 2. For each split option, MEASURE where it would be placed
 * 3. Check constraints:
 *    - Top: Does it start in bottom 20%? (invalid except minimum-1-item rule)
 *    - Bottom: Does it exceed region boundary? (try fewer items)
 * 4. Return first split that satisfies constraints
 * 
 * @param entry - Layout entry with regionContent
 * @param cursor - Current position in region
 * @param regionHeight - Total region height
 * @param measurements - Measurement map to look up actual heights
 * @returns Split decision with placement details
 */
const findBestListSplit = (
    entry: CanvasLayoutEntry,
    cursor: RegionCursor,
    regionHeight: number,
    measurements: Map<MeasurementKey, MeasurementRecord>,
    adapters: CanvasAdapters
): SplitDecision => {
    const items = entry.regionContent!.items;
    const BOTTOM_THRESHOLD = 1; // Cannot start in bottom 20%
    const currentOffset = cursor.currentOffset;
    const hasIntroMetadata =
        !!entry.regionContent!.metadata &&
        entry.regionContent!.startIndex === 0 &&
        !entry.regionContent!.isContinuation;
    const minimumSplit = hasIntroMetadata ? 0 : 1;

    // Try splits from largest to smallest (greedy: maximize items in current region)
    for (let splitAt = items.length; splitAt >= minimumSplit; splitAt--) {
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
        // Account for spacing buffer that gets added after component placement
        // (cursor advances by height + spacing, not just height)
        const firstSegmentBottom = firstSegmentTop + firstSegmentHeight + COMPONENT_VERTICAL_SPACING_PX;

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
}: PaginateArgs): LayoutPlan => {
    const runId = ++debugRunId;
    const rerouteCache = segmentRerouteCache ?? new SegmentRerouteCache();
    const plannerDiagnosticsEnabled = isPlannerDebugEnabled();

    // NOTE: regionHeightPx is the measured column height from DOM, which already
    // accounts for all rendered content (headers, etc). We use it directly without adjustment.

    // Detect regionHeight changes (feedback loop indicator)
    const regionHeightChanged = lastRegionHeightPx !== null && Math.abs(lastRegionHeightPx - regionHeightPx) > 1;
    const normalizedHeightChanged = lastNormalizedHeight !== null && Math.abs(lastNormalizedHeight - regionHeightPx) > 1;

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

    const pages: PageLayout[] = [];
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
    if (!ensurePage(pages, initialPageCount, columnCount, pendingQueues)) {
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
            const sourceEntries = processedBuckets.get(key) ?? [];
            const pendingEntries = getPendingQueue(key);
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

            const columnEntries: CanvasLayoutEntry[] = [];
            // Use measured column height directly (no normalization needed)
            // The regionHeightPx is ALREADY the measured column height from the DOM,
            // which already accounts for any header space.
            const cursor = createCursor(key, regionHeightPx);
            let safetyCounter = 0;

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
                const entry = regionQueue.shift();
                if (!entry) {
                    break;
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

                if (safetyCounter >= MAX_REGION_ITERATIONS) {
                    logPaginationDecision(runId, 'safety-cap-hit', {
                        regionKey: key,
                        regionQueueLength: regionQueue.length,
                    });
                }

                detachFromSource(entry, key, processedBuckets);

                const estimatedHeight = entry.estimatedHeight ?? DEFAULT_COMPONENT_HEIGHT_PX;
                const span = computeSpan(cursor, estimatedHeight);
                const fits = fitsInRegion(span, cursor);

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

                if (fits) {
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

                    columnEntries.push(committedEntry);
                    const prevOffset = cursor.currentOffset;
                    advanceCursor(cursor, span);

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
                const startsInBottomFifth = span.top > (regionHeightPx * 1);
                let shouldAvoidSplit = startsInBottomFifth; // Default: simple threshold for blocks
                let splitDecision: SplitDecision | null = null;

                debugLog(entry.instance.id, '🪓', 'evaluating split', {
                    runId,
                    items: entry.regionContent?.items?.length ?? 0,
                    cursorOffset: cursor.currentOffset,
                    regionHeightPx,
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
                    splitDecision = findBestListSplit(entry, cursor, regionHeightPx, measurements, adapters);

                    // If split evaluation says we can't place, treat like shouldAvoidSplit
                    if (!splitDecision.canPlace) {
                        shouldAvoidSplit = true;
                    }
                }

                const nextRegion = findNextRegion(pages, key);
                if (debugQueueEntry) {
                    debugLog(debugQueueEntry.instance.id, '🧮', 'next-region-snapshot', {
                        runId,
                        from: key,
                        nextRegionKey: nextRegion?.key ?? null,
                        nextRegionPage: nextRegion?.pageNumber ?? null,
                        nextRegionColumn: nextRegion?.columnNumber ?? null,
                        totalPages: pages.length,
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
                        const alreadyRerouted = entry.overflowRouted ?? false;

                        debugLog(entry.instance.id, '🧭', 'route-overflow-start', {
                            runId,
                            regionKey: key,
                            allowOverflowReroute,
                            forceAdvance,
                            alreadyRerouted,
                        });

                        let candidateRegion = findNextRegion(pages, key);

                        if (!candidateRegion && forceAdvance) {
                            const newPageNumber = pages.length + 1;
                            if (!ensurePage(pages, newPageNumber, columnCount, pendingQueues)) {
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

                        if (!ensurePage(pages, candidateRegion.pageNumber, columnCount, pendingQueues)) {
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

                        columnEntries.push(committedEntry);

                        // Mark the column as full so subsequent entries route elsewhere
                        cursor.currentOffset = regionHeightPx + COMPONENT_VERTICAL_SPACING_PX;
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
                        if (!ensurePage(pages, newPageNumber, columnCount, pendingQueues)) {
                            // Hit MAX_PAGES limit, stop pagination
                            break;
                        }
                    }

                    const updatedNextRegion = findNextRegion(pages, key);
                    if (!updatedNextRegion) {
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

                        columnEntries.push(committedEntry);
                        // Mark region as full to prevent subsequent entries from overlapping
                        cursor.currentOffset = regionHeightPx + COMPONENT_VERTICAL_SPACING_PX;
                        logPaginationDecision(runId, 'region-full-no-next', {
                            componentId: entry.instance.id,
                            regionKey: key,
                        });
                        continue;
                    }

                    if (!ensurePage(pages, updatedNextRegion.pageNumber, columnCount, pendingQueues)) {
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
                            if (!ensurePage(pages, newPageNumber, columnCount, pendingQueues)) {
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
                        columnEntries.push({
                            ...entry,
                            region: {
                                page: page.pageNumber,
                                column: column.columnNumber,
                                index: columnEntries.length,
                            },
                            span,
                            overflow: true,
                        });
                        cursor.currentOffset = regionHeightPx + COMPONENT_VERTICAL_SPACING_PX;
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

                columnEntries.push(placedEntry);
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
                        if (!ensurePage(pages, newPageNumber, columnCount, pendingQueues)) {
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

                    if (!ensurePage(pages, updatedNextRegion.pageNumber, columnCount, pendingQueues)) {
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



