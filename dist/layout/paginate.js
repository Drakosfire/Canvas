var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
import { toRegionContent } from './utils-generic';
import { COMPONENT_VERTICAL_SPACING_PX, LIST_ITEM_SPACING_PX, COLUMN_PADDING_PX, computeMeasurementKey, regionKey, toColumnType, DEFAULT_COMPONENT_HEIGHT_PX, } from './utils';
import { isDebugEnabled } from './debugFlags';
import { buildSegmentPlan, SegmentRerouteCache } from './planner';
import { logRegionHeightEvent } from './regionHeightDebug';
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
var MAX_REGION_ITERATIONS = 400;
var MAX_PAGES = 10; // Circuit breaker to prevent infinite pagination loops
var MAX_PAGINATION_RUNS_PER_SIGNATURE = 10; // Prevent runaway pagination loops without layout changes
var paginationLoopGuardKey = null;
var paginationLoopGuardCount = 0;
var paginationLoopGuardTriggered = false;
var buildBucketSignature = function (buckets) {
    if (buckets.size === 0) {
        return 'empty';
    }
    return Array.from(buckets.entries())
        .map(function (_a) {
        var key = _a[0], entries = _a[1];
        return "".concat(key, ":").concat(entries.length);
    })
        .sort()
        .join('|');
};
var createEmptyPlan = function () { return ({
    pages: [],
    overflowWarnings: [],
}); };
// Entry removal threshold: Only remove entries if overflow exceeds this value (prevents aggressive removal for sub-pixel overflows)
var ENTRY_REMOVAL_OVERFLOW_THRESHOLD_PX = 5;
// Significant region height change threshold: Reset already-rerouted flag if region height changes by more than this
var SIGNIFICANT_REGION_HEIGHT_CHANGE_PX = 10;
// No default debug components - use CLI/env vars to specify: npm run canvas-debug -- component-1 component-2
var DEFAULT_DEBUG_COMPONENT_IDS = [];
var parseComponentIdList = function (value) {
    if (Array.isArray(value)) {
        return value
            .map(function (item) { return (typeof item === 'string' ? item.trim() : ''); })
            .filter(function (item) { return item.length > 0; });
    }
    if (typeof value === 'string') {
        return value
            .split(/[, ]+/)
            .map(function (item) { return item.trim(); })
            .filter(function (item) { return item.length > 0; });
    }
    if (value && typeof value === 'object') {
        return parseComponentIdList(value.ids);
    }
    return [];
};
var readComponentIdsFromEnv = function () {
    // React Scripts replaces process.env.REACT_APP_* at build time
    // Access directly - webpack will replace with literal string or undefined
    var reactAppValue = process.env.REACT_APP_CANVAS_DEBUG_COMPONENTS;
    if (reactAppValue) {
        return parseComponentIdList(reactAppValue);
    }
    // Fallback to non-prefixed var (for Node.js/server-side)
    var envValue = typeof process !== 'undefined' && process.env ? process.env.CANVAS_DEBUG_COMPONENTS : undefined;
    return parseComponentIdList(envValue);
};
var readComponentIdsFromGlobal = function () {
    if (typeof globalThis === 'undefined') {
        return [];
    }
    var globalValue = globalThis.__CANVAS_DEBUG_COMPONENTS;
    return parseComponentIdList(globalValue);
};
var readComponentIdsFromStorage = function () {
    if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
        return [];
    }
    try {
        var stored = window.localStorage.getItem('canvas-debug:components');
        return parseComponentIdList(stored);
    }
    catch (_a) {
        return [];
    }
};
var buildDebugComponentSet = function () {
    var ids = new Set();
    DEFAULT_DEBUG_COMPONENT_IDS.forEach(function (id) { return ids.add(id); });
    readComponentIdsFromEnv().forEach(function (id) { return ids.add(id); });
    readComponentIdsFromGlobal().forEach(function (id) { return ids.add(id); });
    readComponentIdsFromStorage().forEach(function (id) { return ids.add(id); });
    return ids;
};
var DEBUG_COMPONENT_IDS = buildDebugComponentSet();
/**
 * Normalize component IDs to zero-padded format for consistent logging.
 * Examples: "component-0" -> "component-00", "component-1" -> "component-01", "component-10" -> "component-10"
 *
 * @export
 * Exported for use in measurement.tsx and other modules
 */
export var normalizeComponentId = function (componentId) {
    var match = componentId.match(/^component-(\d+)$/);
    if (match) {
        var num = parseInt(match[1], 10);
        return "component-".concat(num.toString().padStart(2, '0'));
    }
    return componentId; // Return as-is if not in expected format
};
/**
 * Check if a component ID matches a normalized debug component ID.
 * This allows checking against zero-padded IDs (e.g., "component-01") even if the actual ID is "component-1".
 */
var matchesDebugComponent = function (componentId, debugId) {
    var normalized = normalizeComponentId(componentId);
    var normalizedDebug = normalizeComponentId(debugId);
    return normalized === normalizedDebug;
};
var isPaginationDebugEnabled = function () { return isDebugEnabled('paginate-spellcasting'); };
var isPlannerDebugEnabled = function () { return isDebugEnabled('planner-spellcasting'); };
var isCursorDebugEnabled = function () { return isDebugEnabled('cursor'); };
// Only debug components explicitly specified via CLI/env vars
// If "*" is in the set, debug all components; otherwise check if component ID is in set
var shouldDebugComponent = function (componentId) {
    return DEBUG_COMPONENT_IDS.has('*') || DEBUG_COMPONENT_IDS.has(componentId);
};
// Export for use in other modules (e.g., StatblockPage.tsx)
export var isComponentDebugEnabled = function (componentId) {
    return shouldDebugComponent(componentId);
};
// Log debug configuration on module load (once per page load)
// Check in browser context (webpack replaces process.env.REACT_APP_* at build time)
if (typeof window !== 'undefined') {
    var enabledFlags = [];
    if (isPaginationDebugEnabled())
        enabledFlags.push('paginate');
    if (isPlannerDebugEnabled())
        enabledFlags.push('planner');
    if (isCursorDebugEnabled())
        enabledFlags.push('cursor');
    if (isDebugEnabled('layout-plan-diff'))
        enabledFlags.push('plan-diff');
    if (isDebugEnabled('measurement-spellcasting'))
        enabledFlags.push('measurement');
    if (isDebugEnabled('layout-dirty'))
        enabledFlags.push('layout');
    if (isDebugEnabled('measure-first'))
        enabledFlags.push('measure-first');
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
var logPaginationTrace = function (emoji, label, payload) {
    if (!isPaginationDebugEnabled()) {
        return;
    }
    if (typeof payload !== 'undefined') {
        console.log("".concat(emoji, " [paginate][Debug] ").concat(label), payload);
    }
    else {
        console.log("".concat(emoji, " [paginate][Debug] ").concat(label));
    }
};
var debugLog = function (componentId, emoji, label, payload) {
    if (!shouldDebugComponent(componentId)) {
        return;
    }
    // Normalize componentId for consistent logging
    var normalizedId = normalizeComponentId(componentId);
    var basePayload = { componentId: normalizedId };
    // If payload has its own componentId, normalize it too
    if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
        var payloadObj = payload;
        var normalizedPayload = __assign({}, payloadObj);
        if (normalizedPayload.componentId && typeof normalizedPayload.componentId === 'string') {
            normalizedPayload.componentId = normalizeComponentId(normalizedPayload.componentId);
        }
        Object.assign(basePayload, normalizedPayload);
    }
    else if (payload !== undefined) {
        basePayload.value = payload;
    }
    logPaginationTrace(emoji, label, basePayload);
};
var debugRunId = 0;
var lastPaginationInputs = null;
/**
 * Create a hash of measurement keys and heights for comparison
 */
function hashMeasurements(measurements) {
    var entries = Array.from(measurements.entries())
        .sort(function (_a, _b) {
        var a = _a[0];
        var b = _b[0];
        return a.localeCompare(b);
    })
        .map(function (_a) {
        var key = _a[0], record = _a[1];
        return "".concat(key, ":").concat(record.height.toFixed(2));
    })
        .join('|');
    return entries;
}
/**
 * Check if pagination inputs are identical to last run
 */
function areInputsIdentical(regionHeightPx, columnCount, requestedPageCount, bucketCount, measurementVersion, measurements) {
    if (!lastPaginationInputs) {
        return false;
    }
    var measurementKeysHash = hashMeasurements(measurements);
    return (Math.abs(lastPaginationInputs.regionHeightPx - regionHeightPx) < 0.01 &&
        lastPaginationInputs.columnCount === columnCount &&
        lastPaginationInputs.requestedPageCount === requestedPageCount &&
        lastPaginationInputs.bucketCount === bucketCount &&
        lastPaginationInputs.measurementVersion === measurementVersion &&
        lastPaginationInputs.measurementKeysHash === measurementKeysHash);
}
var shouldLogPaginationDecisions = function () { return isPaginationDebugEnabled(); };
var paginationStats = {
    heightSources: { measured: 0, proportional: 0, estimate: 0 },
    bottomZoneRejections: 0,
    splitDecisions: 0,
    componentsPlaced: 0,
};
var logPaginationDecision = function () {
    var args = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        args[_i] = arguments[_i];
    }
    if (!shouldLogPaginationDecisions()) {
        return;
    }
    // Extract componentId from payload if present
    // Format: logPaginationDecision(runId, 'label', { componentId: ..., ... })
    var shouldLog = true;
    var normalizedArgs = __spreadArray([], args, true);
    if (args.length >= 3 && typeof args[2] === 'object' && args[2] !== null) {
        var payload = args[2];
        if (payload.componentId) {
            // Only log if this component is in the debug list
            shouldLog = shouldDebugComponent(payload.componentId);
            // Normalize componentId in payload for consistent logging
            var normalizedPayload = __assign({}, payload);
            normalizedPayload.componentId = normalizeComponentId(payload.componentId);
            normalizedArgs = __spreadArray([args[0], args[1], normalizedPayload], args.slice(3), true);
        }
    }
    // For logs without componentId (like 'run-start'), always log if pagination debug is enabled
    if (!shouldLog) {
        return;
    }
    // eslint-disable-next-line no-console
    console.debug.apply(console, __spreadArray(['[paginate]'], normalizedArgs, false));
};
var isSpellcastingMeasurementKey = function (key) {
    return key.includes('spell-list');
};
var toSegmentDescriptor = function (entry, regionKey, measurements) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
    if (!isSpellcastingMeasurementKey(entry.measurementKey)) {
        return null;
    }
    var measurement = measurements.get(entry.measurementKey);
    var heightPx = (_b = (_a = measurement === null || measurement === void 0 ? void 0 : measurement.height) !== null && _a !== void 0 ? _a : entry.estimatedHeight) !== null && _b !== void 0 ? _b : DEFAULT_COMPONENT_HEIGHT_PX;
    var descriptor = {
        componentId: entry.instance.id,
        segmentId: entry.measurementKey,
        measurementKey: entry.measurementKey,
        regionKey: regionKey,
        heightPx: heightPx,
        estimatedHeightPx: measurement ? undefined : entry.estimatedHeight,
        spacingAfterPx: COMPONENT_VERTICAL_SPACING_PX,
        isMetadata: (_e = (_d = (_c = entry.regionContent) === null || _c === void 0 ? void 0 : _c.kind) === null || _d === void 0 ? void 0 : _d.includes('metadata')) !== null && _e !== void 0 ? _e : false,
        isContinuation: (_g = (_f = entry.regionContent) === null || _f === void 0 ? void 0 : _f.isContinuation) !== null && _g !== void 0 ? _g : false,
        startIndex: (_h = entry.regionContent) === null || _h === void 0 ? void 0 : _h.startIndex,
        itemCount: (_j = entry.regionContent) === null || _j === void 0 ? void 0 : _j.items.length,
        totalCount: (_k = entry.regionContent) === null || _k === void 0 ? void 0 : _k.totalCount,
    };
    return descriptor;
};
var buildPlannerRegions = function (pages, regionHeightPx) {
    var sequence = computeRegionSequence(pages);
    // Ensure unique keys in region order
    var seen = new Set();
    var configs = [];
    // Account for column padding: content area is reduced by top + bottom padding
    var contentMaxHeightPx = regionHeightPx - (2 * COLUMN_PADDING_PX);
    sequence.forEach(function (region, index) {
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
var ensurePage = function (pages, pageNumber, columnCount, pendingQueues, runId, reason) {
    while (pages.length < pageNumber) {
        var nextPageNumber = pages.length + 1;
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
        var columns = [];
        for (var columnIndex = 1; columnIndex <= columnCount; columnIndex += 1) {
            var key = regionKey(nextPageNumber, columnIndex);
            columns.push({ columnNumber: toColumnType(columnIndex), key: key, entries: [] });
            if (!pendingQueues.has(key)) {
                pendingQueues.set(key, []);
            }
        }
        pages.push({ pageNumber: nextPageNumber, columns: columns });
        // Log page creation for debugging
        if (isCursorDebugEnabled() || isPaginationDebugEnabled()) {
            logPaginationDecision(runId !== null && runId !== void 0 ? runId : 0, 'page-created', {
                pageNumber: nextPageNumber,
                totalPages: pages.length,
                requestedPage: pageNumber,
                reason: reason !== null && reason !== void 0 ? reason : 'unknown',
                columnCount: columnCount,
            });
        }
    }
    return true; // Successfully created pages
};
var computeRegionSequence = function (pages) {
    return pages.flatMap(function (page) {
        return page.columns.map(function (column) { return ({
            pageNumber: page.pageNumber,
            columnNumber: column.columnNumber,
            key: column.key,
        }); });
    });
};
var findNextRegion = function (pages, currentKey) {
    var _a;
    var sequence = computeRegionSequence(pages);
    var currentIndex = sequence.findIndex(function (region) { return region.key === currentKey; });
    if (currentIndex === -1) {
        return null;
    }
    return (_a = sequence[currentIndex + 1]) !== null && _a !== void 0 ? _a : null;
};
/**
 * Find the other column on the same page as the current region.
 * For 2-column layouts, returns column 2 if current is column 1, and vice versa.
 * Returns null if there's no other column (single-column layout or invalid region).
 */
var findOtherColumnOnSamePage = function (pages, currentKey) {
    for (var _i = 0, pages_1 = pages; _i < pages_1.length; _i++) {
        var page = pages_1[_i];
        for (var _a = 0, _b = page.columns; _a < _b.length; _a++) {
            var column = _b[_a];
            if (column.key === currentKey) {
                // Found the current region, now find the other column on the same page
                var otherColumn = page.columns.find(function (col) { return col.key !== currentKey; });
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
var createCursor = function (regionKey, maxHeight, initialOffset) {
    if (initialOffset === void 0) { initialOffset = 0; }
    return ({
        regionKey: regionKey,
        currentOffset: initialOffset,
        maxHeight: maxHeight,
    });
};
var computeSpan = function (cursor, estimatedHeight) {
    var span = {
        top: cursor.currentOffset,
        bottom: cursor.currentOffset + estimatedHeight,
        height: estimatedHeight,
    };
    return span;
};
var fitsInRegion = function (span, cursor, componentId) {
    // Add safety buffer to account for measurement/rendering micro-differences
    // Sub-pixel rendering and margin collapse can cause ~10-15px variations
    var BOTTOM_ZONE_SAFETY_BUFFER_PX = 20;
    // Check if component + safety buffer fits in region
    // CSS gap handles spacing between entries, so we only check entry bottom
    var cursorAfterPlacement = span.bottom;
    var fits = cursorAfterPlacement <= (cursor.maxHeight - BOTTOM_ZONE_SAFETY_BUFFER_PX);
    // CRITICAL: Log component-5 fitsInRegion checks
    if (isPaginationDebugEnabled() && componentId && (componentId === 'component-5' || componentId.includes('component-5'))) {
        debugLog('component-5', '🔍', 'fitsInRegion-check', {
            spanTop: span.top,
            spanBottom: span.bottom,
            spanHeight: span.height,
            cursorAfterPlacement: cursorAfterPlacement,
            cursorMaxHeight: cursor.maxHeight,
            safetyBuffer: BOTTOM_ZONE_SAFETY_BUFFER_PX,
            effectiveMaxHeight: cursor.maxHeight - BOTTOM_ZONE_SAFETY_BUFFER_PX,
            fits: fits,
            reason: fits ? 'FITS' : 'OVERFLOWS',
            overflowAmount: cursorAfterPlacement - (cursor.maxHeight - BOTTOM_ZONE_SAFETY_BUFFER_PX),
        });
    }
    return fits;
};
var advanceCursor = function (cursor, span) {
    // Add gap after entry to match CSS flex gap between entries
    // This ensures pagination accounts for the 12px spacing CSS applies
    cursor.currentOffset = span.bottom + COMPONENT_VERTICAL_SPACING_PX;
};
var detachFromSource = function (entry, key, buckets) {
    if (entry.sourceRegionKey === key) {
        return;
    }
    var original = buckets.get(entry.sourceRegionKey);
    if (!original) {
        return;
    }
    var index = original.indexOf(entry);
    if (index !== -1) {
        original.splice(index, 1);
    }
};
// Track previous regionHeight to detect feedback loops
var lastRegionHeightPx = null;
var lastNormalizedHeight = null;
var DEFAULT_SMART_SPLIT_CONFIG = {
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
var findBestListSplit = function (entry, cursor, regionHeight, measurements, adapters, smartSplitConfig) {
    var _a, _b, _c;
    var config = __assign(__assign({}, DEFAULT_SMART_SPLIT_CONFIG), smartSplitConfig);
    var items = entry.regionContent.items;
    var BOTTOM_THRESHOLD = 1; // Cannot start in bottom 20%
    var currentOffset = cursor.currentOffset;
    var hasIntroMetadata = !!entry.regionContent.metadata &&
        entry.regionContent.startIndex === 0 &&
        !entry.regionContent.isContinuation;
    var minimumSplit = hasIntroMetadata ? 0 : 1;
    // Phase 4 A2: With measurement perfection (Phase 1 & 2), we no longer need
    // artificial chunk size limits. Let the split algorithm find the natural break point.
    var maxSplit = items.length;
    // Phase 4 A2: Smart split decision - check if moving is better than splitting
    // Get full component height to check if it would fit in next region
    var remainingSpaceInCurrent = regionHeight - currentOffset;
    if (config.nextRegionCapacity !== undefined && items.length > 1) {
        // Calculate full list height
        var fullRegionContent = toRegionContent(entry.regionContent.kind, items, entry.regionContent.startIndex, entry.regionContent.totalCount, entry.regionContent.isContinuation, entry.regionContent.metadata);
        var fullMeasurementKey = computeMeasurementKey(entry.instance.id, fullRegionContent);
        var fullMeasured = measurements.get(fullMeasurementKey);
        var fullEstimated = adapters.heightEstimator.estimateListHeight(items, entry.regionContent.isContinuation);
        var fullHeight = (_a = fullMeasured === null || fullMeasured === void 0 ? void 0 : fullMeasured.height) !== null && _a !== void 0 ? _a : fullEstimated;
        // Estimate how many items would fit in current region (rough estimate)
        var avgItemHeight = fullHeight / items.length;
        var itemsThatWouldFit = Math.floor(remainingSpaceInCurrent / avgItemHeight);
        // Check if moving whole list is better than splitting
        var wholeListFitsInNextRegion = fullHeight <= config.nextRegionCapacity;
        var tooFewItemsToJustifySplit = itemsThatWouldFit < config.preferMoveThreshold;
        if (wholeListFitsInNextRegion && tooFewItemsToJustifySplit && !hasIntroMetadata) {
            paginationStats.splitDecisions++;
            debugLog(entry.instance.id, '🚚', 'prefer-move-over-split', {
                reason: 'Too few items to justify split - whole list fits in next region',
                itemsThatWouldFit: itemsThatWouldFit,
                totalItems: items.length,
                remainingSpaceInCurrent: remainingSpaceInCurrent,
                fullHeight: fullHeight,
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
                reason: "Prefer move: only ".concat(itemsThatWouldFit, " items would fit, whole list (").concat(items.length, ") fits in next region"),
                preferMove: true,
            };
        }
    }
    // Try splits from largest to smallest (greedy: maximize items in current region)
    for (var splitAt = maxSplit; splitAt >= minimumSplit; splitAt--) {
        var firstSegment = items.slice(0, splitAt);
        var secondSegment = items.slice(splitAt);
        // MEASURE where this split would place
        // Try to use actual measurement first, fallback to estimate
        var splitRegionContent = toRegionContent(entry.regionContent.kind, firstSegment, entry.regionContent.startIndex, entry.regionContent.totalCount, entry.regionContent.isContinuation, entry.regionContent.metadata);
        var splitMeasurementKey = computeMeasurementKey(entry.instance.id, splitRegionContent);
        var measured = measurements.get(splitMeasurementKey);
        var isContinuation = entry.regionContent.isContinuation;
        var estimated = adapters.heightEstimator.estimateListHeight(firstSegment, isContinuation);
        // If split measurement doesn't exist, try proportional calculation from full measurement
        var proportionalHeight = void 0;
        if (!measured && splitAt < items.length) {
            // Look up full component measurement
            var fullRegionContent = toRegionContent(entry.regionContent.kind, items, entry.regionContent.startIndex, entry.regionContent.totalCount, entry.regionContent.isContinuation, entry.regionContent.metadata);
            var fullMeasurementKey = computeMeasurementKey(entry.instance.id, fullRegionContent);
            var fullMeasured = measurements.get(fullMeasurementKey);
            if (fullMeasured) {
                // Calculate proportionally: (fullHeight / totalItems) * splitItems
                // Note: This is a fallback. Ideally all split variations should be pre-measured.
                proportionalHeight = (fullMeasured.height / items.length) * splitAt;
            }
        }
        var firstSegmentHeight = (_c = (_b = measured === null || measured === void 0 ? void 0 : measured.height) !== null && _b !== void 0 ? _b : proportionalHeight) !== null && _c !== void 0 ? _c : estimated;
        var firstSegmentTop = currentOffset;
        // CSS gap handles spacing, so cursor tracks entry bottom directly
        var firstSegmentBottom = firstSegmentTop + firstSegmentHeight;
        // Track which height calculation path was used
        var heightSource = measured ? 'measured' : proportionalHeight ? 'proportional' : 'estimate';
        if (measured) {
            paginationStats.heightSources.measured++;
        }
        else if (proportionalHeight) {
            paginationStats.heightSources.proportional++;
            // Warn about fallback usage - with measure-first, this should be rare
            console.warn('[paginate] Using proportional height fallback:', {
                component: entry.instance.id,
                splitKey: splitMeasurementKey,
                reason: 'Split measurement not found - using proportional calculation from full measurement',
                splitAt: splitAt,
                totalItems: items.length,
            });
        }
        else {
            paginationStats.heightSources.estimate++;
        }
        // CHECK constraint: Does it start in bottom 20%?
        var startsInBottomZone = firstSegmentTop > (regionHeight * BOTTOM_THRESHOLD);
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
                        ? "Place intro metadata despite starting at ".concat(((firstSegmentTop / regionHeight) * 100).toFixed(1), "% (metadata only)")
                        : "Minimum rule: Place 1 item despite starting at ".concat(((firstSegmentTop / regionHeight) * 100).toFixed(1), "% (in bottom 20%)"),
                    metadataOnly: splitAt === 0,
                };
            }
            // Try fewer items
            continue;
        }
        // CHECK constraint: Does it exceed region boundary?
        var exceedsRegion = firstSegmentBottom > regionHeight;
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
                reason: "Fits completely: ".concat(splitAt, " item(s) at ").concat(((firstSegmentTop / regionHeight) * 100).toFixed(1), "%-").concat(((firstSegmentBottom / regionHeight) * 100).toFixed(1), "%"),
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
export var paginate = function (_a) {
    var _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1, _2, _3, _4, _5, _6, _7, _8, _9, _10, _11, _12, _13, _14, _15, _16, _17, _18, _19, _20, _21, _22, _23, _24, _25, _26, _27, _28, _29, _30, _31, _32, _33, _34, _35, _36, _37, _38, _39, _40, _41, _42, _43, _44, _45, _46, _47, _48, _49, _50, _51, _52, _53, _54, _55, _56, _57, _58, _59, _60, _61, _62, _63, _64, _65, _66, _67, _68, _69, _70, _71, _72, _73, _74, _75, _76, _77, _78, _79, _80, _81, _82, _83, _84, _85, _86, _87, _88, _89, _90, _91;
    var buckets = _a.buckets, columnCount = _a.columnCount, regionHeightPx = _a.regionHeightPx, requestedPageCount = _a.requestedPageCount, baseDimensions = _a.baseDimensions, measurementVersion = _a.measurementVersion, measurements = _a.measurements, adapters = _a.adapters, segmentRerouteCache = _a.segmentRerouteCache, previousPlan = _a.previousPlan;
    var runId = ++debugRunId;
    var rerouteCache = segmentRerouteCache !== null && segmentRerouteCache !== void 0 ? segmentRerouteCache : new SegmentRerouteCache();
    var plannerDiagnosticsEnabled = isPlannerDebugEnabled();
    // NOTE: regionHeightPx is the measured column height from DOM, which already
    // accounts for all rendered content (headers, etc). We use it directly without adjustment.
    // CRITICAL: Check if inputs are identical to last run
    // If so, return previousPlan without running pagination (prevents duplicate runs)
    var bucketCount = buckets.size;
    var bucketSignature = buildBucketSignature(buckets);
    var loopGuardKey = [
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
            console.error('⛔ [paginate] Loop guard triggered - more than %d runs without layout changes (key=%s). Returning previous plan.', MAX_PAGINATION_RUNS_PER_SIGNATURE, loopGuardKey);
        }
        else if (isPaginationDebugEnabled()) {
            logPaginationDecision(runId, 'loop-guard-short-circuit', {
                loopGuardKey: loopGuardKey,
                loopGuardCount: paginationLoopGuardCount,
                regionHeightPx: regionHeightPx,
                requestedPageCount: requestedPageCount,
                bucketCount: bucketCount,
            });
        }
        lastRegionHeightPx = regionHeightPx;
        lastNormalizedHeight = regionHeightPx;
        return previousPlan !== null && previousPlan !== void 0 ? previousPlan : createEmptyPlan();
    }
    logRegionHeightEvent('paginate-run-start', {
        runId: runId,
        regionHeightPx: regionHeightPx,
        previousRegionHeight: lastRegionHeightPx,
        heightDiff: lastRegionHeightPx != null ? regionHeightPx - lastRegionHeightPx : null,
        requestedPageCount: requestedPageCount,
        columnCount: columnCount,
        bucketCount: bucketCount,
    });
    var inputsIdentical = areInputsIdentical(regionHeightPx, columnCount, requestedPageCount, bucketCount, measurementVersion, measurements);
    // CRITICAL: Only skip if previousPlan exists AND has pages
    // If previousPlan is null or empty, we must run pagination to create the plan
    if (inputsIdentical && previousPlan && previousPlan.pages.length > 0) {
        if (isPaginationDebugEnabled()) {
            logPaginationDecision(runId, 'run-skipped-identical-inputs', {
                regionHeightPx: regionHeightPx,
                columnCount: columnCount,
                requestedPageCount: requestedPageCount,
                bucketCount: bucketCount,
                measurementVersion: measurementVersion !== null && measurementVersion !== void 0 ? measurementVersion : 'unknown',
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
    var measurementKeysHash = hashMeasurements(measurements);
    lastPaginationInputs = {
        regionHeightPx: regionHeightPx,
        columnCount: columnCount,
        requestedPageCount: requestedPageCount,
        bucketCount: bucketCount,
        measurementVersion: measurementVersion,
        measurementKeysHash: measurementKeysHash,
    };
    // Detect regionHeight changes (feedback loop indicator)
    var regionHeightChanged = lastRegionHeightPx !== null && Math.abs(lastRegionHeightPx - regionHeightPx) > 1;
    var normalizedHeightChanged = lastNormalizedHeight !== null && Math.abs(lastNormalizedHeight - regionHeightPx) > 1;
    if (regionHeightChanged) {
        logRegionHeightEvent('paginate-region-height-change', {
            runId: runId,
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
            runId: runId,
            regionHeightPx: regionHeightPx,
            previousRegionHeight: lastRegionHeightPx,
            heightChanged: lastRegionHeightPx !== null && lastRegionHeightPx !== regionHeightPx,
            heightDiff: lastRegionHeightPx !== null ? regionHeightPx - lastRegionHeightPx : 0,
        });
    }
    logPaginationDecision(runId, 'run-start', {
        columnCount: columnCount,
        regionHeightPx: regionHeightPx,
        requestedPageCount: requestedPageCount,
        bucketCount: buckets.size,
        measurementVersion: measurementVersion !== null && measurementVersion !== void 0 ? measurementVersion : 'unknown',
        debugComponents: Array.from(DEBUG_COMPONENT_IDS),
        heightChanges: regionHeightChanged ? {
            previousRaw: lastRegionHeightPx,
            currentRaw: regionHeightPx,
            rawDelta: regionHeightPx - (lastRegionHeightPx !== null && lastRegionHeightPx !== void 0 ? lastRegionHeightPx : 0),
            previousNormalized: lastNormalizedHeight,
            currentNormalized: regionHeightPx,
            normalizedDelta: regionHeightPx - (lastNormalizedHeight !== null && lastNormalizedHeight !== void 0 ? lastNormalizedHeight : 0),
            warningFeedbackLoop: normalizedHeightChanged,
        } : null,
    });
    lastRegionHeightPx = regionHeightPx;
    lastNormalizedHeight = regionHeightPx;
    // Initialize pages from previous plan if available, preserving column.entries for cursor initialization
    // CRITICAL: Ensure all pages have columnCount columns, even if previousPlan didn't have them all
    var pages = (previousPlan === null || previousPlan === void 0 ? void 0 : previousPlan.pages)
        ? previousPlan.pages.map(function (prevPage) {
            var columns = [];
            var _loop_2 = function (columnIndex) {
                var key = regionKey(prevPage.pageNumber, columnIndex);
                var prevColumn = prevPage.columns.find(function (col) { return col.columnNumber === columnIndex; });
                columns.push({
                    columnNumber: toColumnType(columnIndex),
                    key: key,
                    entries: prevColumn ? __spreadArray([], prevColumn.entries, true) : [], // Preserve entries from previous run if they exist
                });
            };
            for (var columnIndex = 1; columnIndex <= columnCount; columnIndex += 1) {
                _loop_2(columnIndex);
            }
            return {
                pageNumber: prevPage.pageNumber,
                columns: columns,
            };
        })
        : [];
    var overflowWarnings = [];
    var pendingQueues = new Map();
    var routedInRegion = new Set();
    var processedBuckets = new Map(Array.from(buckets.entries(), function (_a) {
        var key = _a[0], entries = _a[1];
        return [key, entries];
    }));
    var homeBuckets = new Map();
    processedBuckets.forEach(function (entries, key) {
        entries.forEach(function (entry) {
            if (!homeBuckets.has(entry.homeRegionKey)) {
                homeBuckets.set(entry.homeRegionKey, []);
            }
            homeBuckets.get(entry.homeRegionKey).push(entry);
        });
        entries.sort(function (a, b) {
            if (a.slotIndex !== b.slotIndex)
                return a.slotIndex - b.slotIndex;
            return a.orderIndex - b.orderIndex;
        });
    });
    homeBuckets.forEach(function (entries) {
        entries.sort(function (a, b) {
            if (a.slotIndex !== b.slotIndex)
                return a.slotIndex - b.slotIndex;
            return a.orderIndex - b.orderIndex;
        });
    });
    var maxBucketPage = Array.from(buckets.keys()).reduce(function (max, key) {
        var pagePart = key.split(':')[0];
        var parsed = Number.parseInt(pagePart, 10);
        return Number.isNaN(parsed) ? max : Math.max(max, parsed);
    }, 1);
    var initialPageCount = Math.max(1, requestedPageCount, maxBucketPage);
    if (!ensurePage(pages, initialPageCount, columnCount, pendingQueues, runId, 'initial-page-count')) {
        // Hit MAX_PAGES limit during initial setup
        return { pages: pages, overflowWarnings: [] };
    }
    var getPendingQueue = function (key) {
        if (!pendingQueues.has(key)) {
            pendingQueues.set(key, []);
        }
        return pendingQueues.get(key);
    };
    pages.forEach(function (page) {
        page.columns.forEach(function (column) {
            if (!processedBuckets.has(column.key)) {
                processedBuckets.set(column.key, []);
            }
        });
    });
    var allPages = function () { return pages; }; // helper to use latest pages within closures
    var _loop_1 = function (pageIndex) {
        var page = pages[pageIndex];
        var _loop_3 = function (columnIndex) {
            var column = page.columns[columnIndex];
            var key = column.key;
            // Phase 0.5: Region Processing Start Tracking
            if (isPaginationDebugEnabled() && key === '2:2') {
                var debugEntries = column.entries.filter(function (e) { return shouldDebugComponent(e.instance.id); });
                debugEntries.forEach(function (debugEntry) {
                    debugLog(normalizeComponentId(debugEntry.instance.id), '🚀', 'component-trace-region-processing-start', {
                        componentId: normalizeComponentId(debugEntry.instance.id),
                        runId: runId,
                        regionKey: key,
                        page: page.pageNumber,
                        column: column.columnNumber,
                        columnEntriesCount: column.entries.length,
                        debugComponentInColumnEntries: column.entries.filter(function (e) { return e.instance.id === debugEntry.instance.id; }).length,
                    });
                });
            }
            var sourceEntries = (_b = processedBuckets.get(key)) !== null && _b !== void 0 ? _b : [];
            var pendingEntries = getPendingQueue(key);
            // Log pending queue state before processing
            if (isPaginationDebugEnabled() && pendingEntries.length > 0) {
                debugLog('pending-queue', '📋', 'pending-queue-processing', {
                    runId: runId,
                    regionKey: key,
                    page: page.pageNumber,
                    column: column.columnNumber,
                    pendingCount: pendingEntries.length,
                    pendingEntries: pendingEntries.map(function (e) { return ({
                        id: e.instance.id,
                        overflow: e.overflow,
                        overflowRouted: e.overflowRouted,
                        sourceRegionKey: e.sourceRegionKey,
                    }); }),
                });
            }
            // Phase 1: Entry Source Tracking - pendingQueue
            if (isPaginationDebugEnabled()) {
                var debugEntries = pendingEntries.filter(function (e) { return shouldDebugComponent(e.instance.id); });
                debugEntries.forEach(function (debugEntry) {
                    debugLog(normalizeComponentId(debugEntry.instance.id), '🎯', 'component-trace-pending-queue-entry', {
                        componentId: normalizeComponentId(debugEntry.instance.id),
                        runId: runId,
                        regionKey: key,
                        page: page.pageNumber,
                        column: column.columnNumber,
                        source: 'pendingQueue',
                        pendingCount: pendingEntries.filter(function (e) { return e.instance.id === debugEntry.instance.id; }).length,
                        entries: pendingEntries.filter(function (e) { return e.instance.id === debugEntry.instance.id; }).map(function (e) {
                            var _a, _b;
                            return ({
                                entryRegion: e.region,
                                entrySpanTop: (_a = e.span) === null || _a === void 0 ? void 0 : _a.top,
                                entrySpanBottom: (_b = e.span) === null || _b === void 0 ? void 0 : _b.bottom,
                                entryOverflow: e.overflow,
                                entryOverflowRouted: e.overflowRouted,
                                sourceRegionKey: e.sourceRegionKey,
                            });
                        }),
                        columnEntriesCount: column.entries.length,
                        alreadyInColumnEntries: column.entries.some(function (e) { var _a, _b; return e.instance.id === debugEntry.instance.id && ((_a = e.region) === null || _a === void 0 ? void 0 : _a.page) === page.pageNumber && ((_b = e.region) === null || _b === void 0 ? void 0 : _b.column) === column.columnNumber; }),
                    });
                });
            }
            var homeEntries = ((_c = homeBuckets.get(key)) !== null && _c !== void 0 ? _c : []).filter(function (entry) { return entry.sourceRegionKey !== key; });
            var regionQueue = __spreadArray(__spreadArray([], pendingEntries, true), sourceEntries, true);
            var debugQueueEntry = regionQueue.find(function (entry) { return shouldDebugComponent(entry.instance.id); });
            homeEntries.forEach(function (candidate) {
                if (!regionQueue.includes(candidate)) {
                    regionQueue.push(candidate);
                }
            });
            regionQueue.sort(function (a, b) {
                if (a.slotIndex !== b.slotIndex)
                    return a.slotIndex - b.slotIndex;
                return a.orderIndex - b.orderIndex;
            });
            if (regionQueue.length > 0 && debugQueueEntry) {
                debugLog(debugQueueEntry.instance.id, '📬', 'region-queue-init', {
                    runId: runId,
                    regionKey: key,
                    page: page.pageNumber,
                    column: column.columnNumber,
                    pendingCount: pendingEntries.length,
                    sourceCount: sourceEntries.length,
                    homeCount: homeEntries.length,
                    queueSnapshot: regionQueue.map(function (queued) {
                        var _a, _b;
                        return ({
                            componentId: queued.instance.id,
                            overflow: (_a = queued.overflow) !== null && _a !== void 0 ? _a : false,
                            overflowRouted: (_b = queued.overflowRouted) !== null && _b !== void 0 ? _b : false,
                            sourceRegionKey: queued.sourceRegionKey,
                            homeRegionKey: queued.homeRegionKey,
                        });
                    }),
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
            var seenSingleInstanceInRegion = new Set();
            var seenListSegmentsInRegion = new Set(); // measurementKey
            var columnEntries = column.entries.filter(function (entry) {
                var _a, _b;
                // Only deduplicate entries that are in THIS region
                var isInThisRegion = ((_a = entry.region) === null || _a === void 0 ? void 0 : _a.page) === page.pageNumber && ((_b = entry.region) === null || _b === void 0 ? void 0 : _b.column) === column.columnNumber;
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
            var beforeCount = column.entries.length;
            // Track removed entry IDs so we can remove them from the queue
            var removedEntryIds = new Set();
            columnEntries = columnEntries.filter(function (entry) {
                var _a;
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
                var currentMeasurement = measurements.get(entry.measurementKey);
                var currentHeight = (_a = currentMeasurement === null || currentMeasurement === void 0 ? void 0 : currentMeasurement.height) !== null && _a !== void 0 ? _a : entry.span.height;
                var entryTop = entry.span.top;
                var entryBottom = entryTop + currentHeight;
                // Only remove if the component actually overflows the region with its current measurement
                // Use threshold to avoid aggressive removal for sub-pixel overflows
                var overflowAmount = entryBottom - regionHeightPx;
                var overflows = overflowAmount > ENTRY_REMOVAL_OVERFLOW_THRESHOLD_PX;
                // Log small overflows that we're keeping (for debugging)
                if (overflowAmount > 0 && overflowAmount <= ENTRY_REMOVAL_OVERFLOW_THRESHOLD_PX && isPaginationDebugEnabled()) {
                    logPaginationDecision(runId, 'entry-kept-despite-small-overflow', {
                        componentId: entry.instance.id,
                        regionKey: key,
                        calculatedBottom: entryBottom,
                        newRegionHeight: regionHeightPx,
                        overflowAmount: overflowAmount,
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
                            currentMeasurementHeight: currentMeasurement === null || currentMeasurement === void 0 ? void 0 : currentMeasurement.height,
                            calculatedBottom: entryBottom,
                            newRegionHeight: regionHeightPx,
                            overflowAmount: overflowAmount,
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
                    beforeCount: beforeCount,
                    afterCount: columnEntries.length,
                    removedCount: beforeCount - columnEntries.length,
                    regionHeightPx: regionHeightPx,
                    previousRegionHeight: lastRegionHeightPx,
                    heightChanged: regionHeightChanged,
                });
            }
            // CRITICAL FIX: Remove entries from queue that were removed from columnEntries
            // This prevents cascading routing when entries are removed due to overflow
            // See: 2025-11-16-component-04-cascading-routing-fix-HANDOFF.md
            if (removedEntryIds.size > 0) {
                var queueBeforeCount = regionQueue.length;
                // Filter out removed entries from the queue
                var filteredQueue = regionQueue.filter(function (entry) { return !removedEntryIds.has(entry.instance.id); });
                regionQueue.length = 0;
                regionQueue.push.apply(regionQueue, filteredQueue);
                var queueAfterCount = regionQueue.length;
                var removedFromQueue = queueBeforeCount - queueAfterCount;
                if (isPaginationDebugEnabled()) {
                    logPaginationDecision(runId, 'queue-entries-removed-after-columnEntries-filter', {
                        regionKey: key,
                        removedEntryIds: Array.from(removedEntryIds),
                        queueBeforeCount: queueBeforeCount,
                        queueAfterCount: queueAfterCount,
                        removedFromQueue: removedFromQueue,
                        reason: 'Entries removed from columnEntries due to overflow, also removed from queue to prevent cascading routing',
                    });
                }
            }
            // Fix 1: Helper function to find existing entry in columnEntries to prevent duplication
            // Strategy: Use measurementKey for list components (includes startIndex, making segments unique)
            //           Use instance.id for single-instance components (GLOBAL deduplication - only one per component)
            var findExistingEntry = function (entry, columnEntries, page, column) {
                return columnEntries.findIndex(function (e) {
                    var _a, _b;
                    // For list components, use measurementKey (includes startIndex, making segments unique)
                    // measurementKey format: `${instanceId}:${kind}:${startIndex}:${items.length}:${totalCount}:${isContinuation ? 'cont' : 'base'}`
                    // List components CAN exist in multiple regions (different segments)
                    if (entry.regionContent && e.regionContent) {
                        // Both are list components - match by measurementKey AND region
                        // Different segments of same list can exist in different regions
                        return e.measurementKey === entry.measurementKey &&
                            ((_a = e.region) === null || _a === void 0 ? void 0 : _a.page) === page &&
                            ((_b = e.region) === null || _b === void 0 ? void 0 : _b.column) === column;
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
                });
            };
            // Phase 0: Column Entries Initialization Tracking
            if (isPaginationDebugEnabled()) {
                var debugEntries = column.entries.filter(function (e) { return shouldDebugComponent(e.instance.id); });
                debugEntries.forEach(function (debugEntry) {
                    var sameComponentEntries = column.entries.filter(function (e) { return e.instance.id === debugEntry.instance.id; });
                    debugLog(normalizeComponentId(debugEntry.instance.id), '🏁', 'component-trace-column-entries-init', {
                        componentId: normalizeComponentId(debugEntry.instance.id),
                        runId: runId,
                        regionKey: key,
                        page: page.pageNumber,
                        column: column.columnNumber,
                        componentCount: sameComponentEntries.length,
                        componentEntries: sameComponentEntries.map(function (e) {
                            var _a, _b, _c, _d;
                            return ({
                                page: (_a = e.region) === null || _a === void 0 ? void 0 : _a.page,
                                column: (_b = e.region) === null || _b === void 0 ? void 0 : _b.column,
                                spanTop: (_c = e.span) === null || _c === void 0 ? void 0 : _c.top,
                                spanBottom: (_d = e.span) === null || _d === void 0 ? void 0 : _d.bottom,
                                sourceRegionKey: e.sourceRegionKey,
                            });
                        }),
                        totalEntriesCount: column.entries.length,
                        fromPreviousPlan: true,
                    });
                });
            }
            // Use measured column height directly, but account for column padding
            // The regionHeightPx is the measured column height from the DOM.
            // We reduce by padding and start cursor after top padding.
            var effectiveMaxHeight = regionHeightPx - (2 * COLUMN_PADDING_PX);
            var cursor = createCursor(key, effectiveMaxHeight, COLUMN_PADDING_PX);
            var safetyCounter = 0;
            // Cursor debug: Log cursor creation
            if (isCursorDebugEnabled()) {
                logPaginationDecision(runId, 'cursor-created', {
                    regionKey: key,
                    cursorOffset: cursor.currentOffset,
                    cursorMaxHeight: cursor.maxHeight,
                    regionHeightPx: regionHeightPx,
                });
            }
            // CRITICAL FIX: Initialize cursor from already-placed entries in THIS column
            // Use columnEntries (filtered from previousPlan) instead of filtering regionQueue,
            // because regionQueue contains entries ASSIGNED to this region, not entries
            // ACTUALLY PLACED in this column. Entries may have been moved to other columns.
            // Note: columnEntries is already filtered to remove overflow entries when height changes
            var alreadyPlacedEntries = columnEntries.filter(function (entry) {
                return entry.span &&
                    entry.region &&
                    entry.region.page === page.pageNumber &&
                    entry.region.column === column.columnNumber;
            });
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
                        regionPage: (_d = column.entries[0].region) === null || _d === void 0 ? void 0 : _d.page,
                        regionColumn: (_e = column.entries[0].region) === null || _e === void 0 ? void 0 : _e.column,
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
                alreadyPlacedEntries.sort(function (a, b) {
                    var _a, _b, _c, _d;
                    var aBottom = (_b = (_a = a.span) === null || _a === void 0 ? void 0 : _a.bottom) !== null && _b !== void 0 ? _b : 0;
                    var bBottom = (_d = (_c = b.span) === null || _c === void 0 ? void 0 : _c.bottom) !== null && _d !== void 0 ? _d : 0;
                    if (aBottom !== bBottom)
                        return aBottom - bBottom;
                    // Tiebreaker: use orderIndex for deterministic sorting when spans are equal
                    return a.orderIndex - b.orderIndex;
                });
                var lastPlacedEntry = alreadyPlacedEntries[alreadyPlacedEntries.length - 1];
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
                    }
                    else {
                        if (isPaginationDebugEnabled() || isCursorDebugEnabled()) {
                            logPaginationDecision(runId, 'cursor-initialized-from-column-entries', {
                                regionKey: key,
                                alreadyPlacedCount: alreadyPlacedEntries.length,
                                lastPlacedEntryId: lastPlacedEntry.instance.id,
                                lastPlacedSpanBottom: lastPlacedEntry.span.bottom,
                                cursorInitializedTo: cursor.currentOffset,
                                regionHeightPx: regionHeightPx,
                            });
                        }
                    }
                }
            }
            else if (column.entries.length > 0 && isPaginationDebugEnabled()) {
                // Debug: Why didn't we find already-placed entries?
                logPaginationDecision(runId, 'cursor-init-failed-no-matches', {
                    regionKey: key,
                    columnEntriesCount: column.entries.length,
                    sampleEntries: column.entries.slice(0, 3).map(function (e) {
                        var _a, _b;
                        return ({
                            id: e.instance.id,
                            hasSpan: !!e.span,
                            hasRegion: !!e.region,
                            regionPage: (_a = e.region) === null || _a === void 0 ? void 0 : _a.page,
                            regionColumn: (_b = e.region) === null || _b === void 0 ? void 0 : _b.column,
                            expectedPage: page.pageNumber,
                            expectedColumn: column.columnNumber,
                        });
                    }),
                });
            }
            if (plannerDiagnosticsEnabled) {
                var segmentDescriptors = regionQueue
                    .map(function (entry) { return toSegmentDescriptor(entry, key, measurements); })
                    .filter(function (descriptor) { return descriptor !== null; });
                if (segmentDescriptors.length > 0) {
                    var plannerRegions = buildPlannerRegions(allPages(), regionHeightPx);
                    if (plannerRegions.length > 0) {
                        buildSegmentPlan({
                            segments: segmentDescriptors,
                            regions: plannerRegions,
                            rerouteCache: rerouteCache,
                            spacingPx: COMPONENT_VERTICAL_SPACING_PX,
                        });
                    }
                }
            }
            var _loop_4 = function () {
                safetyCounter += 1;
                // Cursor debug: Log cursor position at start of loop iteration
                if (isCursorDebugEnabled() && regionQueue.length > 0) {
                    logPaginationDecision(runId, 'cursor-at-loop-start', {
                        regionKey: key,
                        loopIteration: safetyCounter,
                        cursorOffset: cursor.currentOffset,
                        cursorMaxHeight: cursor.maxHeight,
                        queueLength: regionQueue.length,
                        nextComponentId: (_f = regionQueue[0]) === null || _f === void 0 ? void 0 : _f.instance.id,
                    });
                }
                // Peek at next entry without removing it
                var peekedEntry = regionQueue[0];
                if (!peekedEntry) {
                    return "break";
                }
                // OPTIMIZATION: Check if entry is already correctly placed before dequeuing
                // This prevents unnecessary processing and logging for settled components
                // LOGGING REDUCTION: Skipped entries don't log 'dequeued-entry' or other processing logs
                // Only entries that need reprocessing will be logged, reducing noise for debugging
                var alreadyPlacedEntry = columnEntries.find(function (e) {
                    var _a, _b, _c, _d;
                    // For list components, match by measurementKey AND region
                    if (peekedEntry.regionContent && e.regionContent) {
                        return e.measurementKey === peekedEntry.measurementKey &&
                            ((_a = e.region) === null || _a === void 0 ? void 0 : _a.page) === page.pageNumber &&
                            ((_b = e.region) === null || _b === void 0 ? void 0 : _b.column) === column.columnNumber;
                    }
                    // For single-instance components, match by instance.id AND region
                    if (!peekedEntry.regionContent && !e.regionContent) {
                        return e.instance.id === peekedEntry.instance.id &&
                            ((_c = e.region) === null || _c === void 0 ? void 0 : _c.page) === page.pageNumber &&
                            ((_d = e.region) === null || _d === void 0 ? void 0 : _d.column) === column.columnNumber;
                    }
                    return false;
                });
                // Check if entry is already correctly placed and doesn't need reprocessing
                var isAlreadyCorrectlyPlaced = alreadyPlacedEntry &&
                    alreadyPlacedEntry.span &&
                    alreadyPlacedEntry.region &&
                    alreadyPlacedEntry.region.page === page.pageNumber &&
                    alreadyPlacedEntry.region.column === column.columnNumber;
                if (isAlreadyCorrectlyPlaced && alreadyPlacedEntry.span) {
                    // TypeScript guard: span is guaranteed to exist here
                    var placedSpan = alreadyPlacedEntry.span;
                    // Check if measurements changed (would require reprocessing)
                    var currentMeasurement = measurements.get(peekedEntry.measurementKey);
                    var currentHeight = (_h = (_g = currentMeasurement === null || currentMeasurement === void 0 ? void 0 : currentMeasurement.height) !== null && _g !== void 0 ? _g : peekedEntry.estimatedHeight) !== null && _h !== void 0 ? _h : DEFAULT_COMPONENT_HEIGHT_PX;
                    var storedHeight = placedSpan.height;
                    var heightChanged = Math.abs(currentHeight - storedHeight) > 0.01;
                    // Check if entry would overflow with current height
                    var entryTop = placedSpan.top;
                    var entryBottom = entryTop + currentHeight;
                    var wouldOverflow = entryBottom > regionHeightPx;
                    // Skip if height hasn't changed AND it doesn't overflow
                    // CRITICAL FIX: Advance cursor when skipping entries to ensure correct positioning
                    // Even though cursor is initialized from columnEntries, we need to advance it past
                    // skipped entries to handle cases where entries are processed out of order or
                    // cursor initialization doesn't account for all skipped entries
                    if (!heightChanged && !wouldOverflow) {
                        // Advance cursor to bottom of skipped entry (CSS gap handles spacing)
                        var entryBottom_1 = entryTop + currentHeight;
                        var prevCursorOffset = cursor.currentOffset;
                        // Only advance if skipped entry extends beyond current cursor position
                        if (entryBottom_1 > cursor.currentOffset) {
                            cursor.currentOffset = entryBottom_1;
                            if (isCursorDebugEnabled()) {
                                // Cursor debug: Always log cursor advancement when cursor flag enabled
                                logPaginationDecision(runId, 'cursor-advanced-for-skipped-entry', {
                                    regionKey: key,
                                    componentId: peekedEntry.instance.id,
                                    entrySpanBottom: entryBottom_1,
                                    cursorBefore: prevCursorOffset,
                                    cursorAfter: cursor.currentOffset,
                                    cursorAdvance: cursor.currentOffset - prevCursorOffset,
                                });
                            }
                            else if (isPaginationDebugEnabled() && shouldDebugComponent(peekedEntry.instance.id)) {
                                debugLog(peekedEntry.instance.id, '🔧', 'cursor-advanced-for-skipped-entry', {
                                    runId: runId,
                                    regionKey: key,
                                    componentId: peekedEntry.instance.id,
                                    entrySpanBottom: entryBottom_1,
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
                                    runId: runId,
                                    regionKey: key,
                                    componentId: peekedEntry.instance.id,
                                    spanBottom: placedSpan.bottom,
                                    cursorBefore: prevCursorOffset,
                                    cursorAfter: cursor.currentOffset,
                                    reason: 'Entry skipped but cursor advanced to maintain position consistency',
                                });
                            }
                        }
                        else if (isPaginationDebugEnabled() && shouldDebugComponent(peekedEntry.instance.id)) {
                            debugLog(peekedEntry.instance.id, '⏭️', 'entry-skipped-already-correctly-placed', {
                                runId: runId,
                                regionKey: key,
                                componentId: peekedEntry.instance.id,
                                spanTop: placedSpan.top,
                                spanBottom: placedSpan.bottom,
                                storedHeight: storedHeight,
                                currentHeight: currentHeight,
                                heightChanged: heightChanged,
                                wouldOverflow: wouldOverflow,
                                cursorBefore: prevCursorOffset,
                                cursorAfter: cursor.currentOffset,
                                reason: 'Entry already correctly placed, measurements unchanged, no overflow',
                            });
                        }
                        // Remove from queue without processing
                        regionQueue.shift();
                        return "continue";
                    }
                }
                // Entry needs processing - dequeue it now
                var entry = regionQueue.shift();
                if (!entry) {
                    return "break";
                }
                // Phase 1: Entry Source Tracking - regionQueue
                if (isPaginationDebugEnabled() && shouldDebugComponent(entry.instance.id)) {
                    debugLog(normalizeComponentId(entry.instance.id), '🎯', 'component-trace-region-queue-entry', {
                        componentId: normalizeComponentId(entry.instance.id),
                        runId: runId,
                        regionKey: key,
                        page: page.pageNumber,
                        column: column.columnNumber,
                        source: 'regionQueue',
                        queueIndex: regionQueue.findIndex(function (e) { return e.instance.id === entry.instance.id; }),
                        entryRegion: entry.region,
                        entrySpanTop: (_j = entry.span) === null || _j === void 0 ? void 0 : _j.top,
                        entrySpanBottom: (_k = entry.span) === null || _k === void 0 ? void 0 : _k.bottom,
                        entryOverflow: entry.overflow,
                        entryOverflowRouted: entry.overflowRouted,
                        sourceRegionKey: entry.sourceRegionKey,
                        columnEntriesCount: columnEntries.length,
                        alreadyInColumnEntries: columnEntries.some(function (e) { var _a, _b; return e.instance.id === entry.instance.id && ((_a = e.region) === null || _a === void 0 ? void 0 : _a.page) === page.pageNumber && ((_b = e.region) === null || _b === void 0 ? void 0 : _b.column) === column.columnNumber; }),
                    });
                }
                debugLog(entry.instance.id, '📥', 'dequeued-entry', {
                    runId: runId,
                    regionKey: key,
                    queueRemaining: regionQueue.length,
                    pendingQueueSize: getPendingQueue(key).length,
                    overflow: (_l = entry.overflow) !== null && _l !== void 0 ? _l : false,
                    overflowRouted: (_m = entry.overflowRouted) !== null && _m !== void 0 ? _m : false,
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
                    debugLog(entry.instance.id, '🎯', "".concat(entry.instance.id, "-dequeued"), {
                        runId: runId,
                        regionKey: key,
                        cursorOffset: cursor.currentOffset,
                        cursorMaxHeight: cursor.maxHeight,
                        regionHeightPx: regionHeightPx,
                        entryHeight: entry.estimatedHeight,
                        measurementKey: entry.measurementKey,
                        hasMeasurement: measurements.has(entry.measurementKey),
                        measurementHeight: (_o = measurements.get(entry.measurementKey)) === null || _o === void 0 ? void 0 : _o.height,
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
                        runId: runId,
                        regionKey: key,
                        page: page.pageNumber,
                        column: column.columnNumber,
                        hasSpan: !!entry.span,
                        hasRegion: !!entry.region,
                        entryRegionPage: (_p = entry.region) === null || _p === void 0 ? void 0 : _p.page,
                        entryRegionColumn: (_q = entry.region) === null || _q === void 0 ? void 0 : _q.column,
                        targetPage: page.pageNumber,
                        targetColumn: column.columnNumber,
                        willEnterConditional: !!(entry.span && entry.region && entry.region.page === page.pageNumber && entry.region.column === column.columnNumber),
                    });
                }
                // Fix 2: Check if entry is already in columnEntries before conditional check
                // This prevents bypass of conditional check when entry loses span but still exists in columnEntries
                // Use same logic as findExistingEntry: measurementKey for list components, instance.id for single-instance (GLOBAL)
                var alreadyInColumnEntries = columnEntries.some(function (e) {
                    var _a, _b;
                    // For list components, use measurementKey AND region (segments can exist in multiple regions)
                    if (entry.regionContent && e.regionContent) {
                        return e.measurementKey === entry.measurementKey &&
                            ((_a = e.region) === null || _a === void 0 ? void 0 : _a.page) === page.pageNumber &&
                            ((_b = e.region) === null || _b === void 0 ? void 0 : _b.column) === column.columnNumber;
                    }
                    // For single-instance components (no regionContent), use instance.id GLOBALLY
                    // CRITICAL FIX: Single-instance components should only exist ONCE total
                    if (!entry.regionContent && !e.regionContent) {
                        return e.instance.id === entry.instance.id;
                    }
                    // Mixed case: one is list, one is single-instance - not a match
                    return false;
                });
                // Skip entries that already have a valid span for this region
                // This prevents re-processing entries from previous pagination runs
                if (entry.span && entry.region && entry.region.page === page.pageNumber && entry.region.column === column.columnNumber) {
                    // Entry already placed - process overflow/routing logic
                    // Entry already placed in this region - check if it overflows
                    var prevCursorOffset = cursor.currentOffset;
                    // CRITICAL FIX: Look up placed entry from columnEntries first (entries already processed),
                    // then fallback to column.entries (entries from previousPlan)
                    // This prevents duplication when entries are processed multiple times
                    var placedEntryInColumnEntries = columnEntries.find(function (e) {
                        var _a, _b;
                        return e.instance.id === entry.instance.id &&
                            ((_a = e.region) === null || _a === void 0 ? void 0 : _a.page) === page.pageNumber &&
                            ((_b = e.region) === null || _b === void 0 ? void 0 : _b.column) === column.columnNumber;
                    });
                    // Fallback to column.entries (entries from previousPlan)
                    var placedEntryFromPrevious = column.entries.find(function (e) {
                        var _a, _b;
                        return e.instance.id === entry.instance.id &&
                            ((_a = e.region) === null || _a === void 0 ? void 0 : _a.page) === page.pageNumber &&
                            ((_b = e.region) === null || _b === void 0 ? void 0 : _b.column) === column.columnNumber;
                    });
                    var placedEntry_1 = placedEntryInColumnEntries !== null && placedEntryInColumnEntries !== void 0 ? placedEntryInColumnEntries : placedEntryFromPrevious;
                    var actualSpan = (_r = placedEntry_1 === null || placedEntry_1 === void 0 ? void 0 : placedEntry_1.span) !== null && _r !== void 0 ? _r : entry.span;
                    // CRITICAL: If actualSpan.top is 0, this means the entry was placed with span.top = 0
                    // This should NOT happen - entries should have non-zero top when placed
                    // For overflow detection, we need the ACTUAL top position, not 0
                    // If span.top is 0, we can't reliably detect overflow
                    var entryTop = actualSpan.top || 0; // Use 0 as fallback, but this is a bug indicator
                    // Phase 2: PlacedEntry Lookup Tracking
                    if (isPaginationDebugEnabled() && shouldDebugComponent(entry.instance.id)) {
                        debugLog(normalizeComponentId(entry.instance.id), '🔍', 'component-trace-placed-entry-lookup', {
                            componentId: normalizeComponentId(entry.instance.id),
                            runId: runId,
                            regionKey: key,
                            page: page.pageNumber,
                            column: column.columnNumber,
                            foundInColumnEntries: !!placedEntryInColumnEntries,
                            foundInPrevious: !!placedEntryFromPrevious,
                            placedEntryFound: !!placedEntry_1,
                            placedEntryRegion: placedEntry_1 === null || placedEntry_1 === void 0 ? void 0 : placedEntry_1.region,
                            placedEntrySpanTop: (_s = placedEntry_1 === null || placedEntry_1 === void 0 ? void 0 : placedEntry_1.span) === null || _s === void 0 ? void 0 : _s.top,
                            placedEntrySpanBottom: (_t = placedEntry_1 === null || placedEntry_1 === void 0 ? void 0 : placedEntry_1.span) === null || _t === void 0 ? void 0 : _t.bottom,
                            actualSpanTop: actualSpan.top,
                            actualSpanBottom: actualSpan.bottom,
                            entryTop: entryTop,
                            // Check columnEntries for this component
                            componentInColumnEntries: columnEntries.filter(function (e) { return e.instance.id === entry.instance.id; }).map(function (e) {
                                var _a, _b, _c, _d;
                                return ({
                                    page: (_a = e.region) === null || _a === void 0 ? void 0 : _a.page,
                                    column: (_b = e.region) === null || _b === void 0 ? void 0 : _b.column,
                                    spanTop: (_c = e.span) === null || _c === void 0 ? void 0 : _c.top,
                                    spanBottom: (_d = e.span) === null || _d === void 0 ? void 0 : _d.bottom,
                                });
                            }),
                            // Check column.entries for this component
                            componentInPreviousEntries: column.entries.filter(function (e) { return e.instance.id === entry.instance.id; }).map(function (e) {
                                var _a, _b, _c, _d;
                                return ({
                                    page: (_a = e.region) === null || _a === void 0 ? void 0 : _a.page,
                                    column: (_b = e.region) === null || _b === void 0 ? void 0 : _b.column,
                                    spanTop: (_c = e.span) === null || _c === void 0 ? void 0 : _c.top,
                                    spanBottom: (_d = e.span) === null || _d === void 0 ? void 0 : _d.bottom,
                                });
                            }),
                        });
                    }
                    // Debug: Log what we found in column.entries
                    if (isPaginationDebugEnabled()) {
                        debugLog(entry.instance.id, '🔍', 'found-placed-entry', {
                            runId: runId,
                            regionKey: key,
                            foundInColumnEntries: !!placedEntryInColumnEntries,
                            foundInPrevious: !!placedEntryFromPrevious,
                            found: !!placedEntry_1,
                            placedEntrySpanTop: (_u = placedEntry_1 === null || placedEntry_1 === void 0 ? void 0 : placedEntry_1.span) === null || _u === void 0 ? void 0 : _u.top,
                            placedEntrySpanBottom: (_v = placedEntry_1 === null || placedEntry_1 === void 0 ? void 0 : placedEntry_1.span) === null || _v === void 0 ? void 0 : _v.bottom,
                            entrySpanTop: (_w = entry.span) === null || _w === void 0 ? void 0 : _w.top,
                            entrySpanBottom: (_x = entry.span) === null || _x === void 0 ? void 0 : _x.bottom,
                            actualSpanTop: actualSpan.top,
                            actualSpanBottom: actualSpan.bottom,
                            entryTop: entryTop,
                            cursorOffset: cursor.currentOffset,
                            columnEntriesCount: column.entries.length,
                            columnEntriesSpans: column.entries.slice(0, 5).map(function (e) {
                                var _a, _b, _c, _d, _e;
                                return ({
                                    id: e.instance.id,
                                    spanTop: (_a = e.span) === null || _a === void 0 ? void 0 : _a.top,
                                    spanBottom: (_b = e.span) === null || _b === void 0 ? void 0 : _b.bottom,
                                    spanHeight: (_c = e.span) === null || _c === void 0 ? void 0 : _c.height,
                                    regionPage: (_d = e.region) === null || _d === void 0 ? void 0 : _d.page,
                                    regionColumn: (_e = e.region) === null || _e === void 0 ? void 0 : _e.column,
                                });
                            }),
                            // CRITICAL DEBUG: Check if ALL entries have span.top = 0
                            allEntriesHaveZeroTop: column.entries.every(function (e) { return !e.span || e.span.top === 0; }),
                            entriesWithZeroTop: column.entries.filter(function (e) { return !e.span || e.span.top === 0; }).length,
                            entriesWithNonZeroTop: column.entries.filter(function (e) { return e.span && e.span.top !== 0; }).length,
                            // WARNING: If entryTop is 0, overflow detection will be wrong
                            entryTopIsZero: entryTop === 0,
                        });
                    }
                    // CRITICAL: Use CURRENT measured height, not stored span.bottom
                    // The stored span might be outdated if measurements changed
                    var currentMeasurement = measurements.get(entry.measurementKey);
                    var currentHeight = (_0 = (_z = (_y = currentMeasurement === null || currentMeasurement === void 0 ? void 0 : currentMeasurement.height) !== null && _y !== void 0 ? _y : actualSpan.height) !== null && _z !== void 0 ? _z : entry.estimatedHeight) !== null && _0 !== void 0 ? _0 : DEFAULT_COMPONENT_HEIGHT_PX;
                    // entryTop is set above (line ~980) from actualSpan.top
                    // If entryTop is 0, this is a bug - entries should have non-zero top when placed
                    // Recalculate bottom using current height (measurements may have changed)
                    // This ensures we detect overflow even if the entry's height increased
                    var entryBottom = entryTop + currentHeight;
                    // CSS gap handles spacing, so we check entry bottom directly
                    // CRITICAL: Check if already-placed entry overflows its region
                    // Use the RECALCULATED bottom (with current height) to detect overflow
                    // This catches cases where measurements changed and the entry now overflows
                    var entryOverflows = entryBottom > regionHeightPx;
                    // Detailed overflow detection logging
                    if (isPaginationDebugEnabled()) {
                        var rawOverflowAmount = entryBottom - regionHeightPx;
                        // overflowAmount: positive = overflow, negative = fits, zero = exactly fits
                        debugLog(entry.instance.id, '🔍', 'overflow-check', {
                            runId: runId,
                            regionKey: key,
                            entryTop: entryTop,
                            entryBottom: entryBottom,
                            regionHeightPx: regionHeightPx,
                            entryOverflows: entryOverflows,
                            overflowAmount: rawOverflowAmount,
                            overflowAmountInterpretation: rawOverflowAmount > 0 ? 'OVERFLOWS' : rawOverflowAmount < 0 ? 'FITS' : 'EXACTLY_FITS',
                            cursorOffset: cursor.currentOffset,
                            currentHeight: currentHeight,
                            actualSpanHeight: actualSpan.height,
                            // WARNING: If entryTop is 0, overflow detection is unreliable
                            entryTopIsZero: entryTop === 0,
                            warning: entryTop === 0 ? 'entryTop is 0 - overflow detection may be incorrect!' : undefined,
                        });
                    }
                    if (entryOverflows && !entry.overflowRouted) {
                        // Entry overflows - route to next region
                        var nextRegion_1 = findNextRegion(pages, key);
                        if (isPaginationDebugEnabled()) {
                            debugLog(entry.instance.id, '🔀', 'routing-attempt', {
                                runId: runId,
                                currentRegion: key,
                                currentPage: page.pageNumber,
                                currentColumn: column.columnNumber,
                                nextRegion: nextRegion_1 === null || nextRegion_1 === void 0 ? void 0 : nextRegion_1.key,
                                nextPage: nextRegion_1 === null || nextRegion_1 === void 0 ? void 0 : nextRegion_1.pageNumber,
                                nextColumn: nextRegion_1 === null || nextRegion_1 === void 0 ? void 0 : nextRegion_1.columnNumber,
                                routeKey: nextRegion_1 ? "".concat(entry.instance.id, ":").concat(nextRegion_1.key) : null,
                                alreadyRouted: nextRegion_1 ? routedInRegion.has("".concat(entry.instance.id, ":").concat(nextRegion_1.key)) : false,
                            });
                        }
                        if (nextRegion_1 && ensurePage(pages, nextRegion_1.pageNumber, columnCount, pendingQueues, runId, 'route-overflow-already-placed')) {
                            var routeKey = "".concat(entry.instance.id, ":").concat(nextRegion_1.key);
                            if (!routedInRegion.has(routeKey)) {
                                var followUp = __assign(__assign({}, entry), { region: {
                                        page: nextRegion_1.pageNumber,
                                        column: nextRegion_1.columnNumber,
                                    }, span: undefined, overflow: true, overflowRouted: true, sourceRegionKey: nextRegion_1.key });
                                var pendingQueue = getPendingQueue(nextRegion_1.key);
                                pendingQueue.push(followUp);
                                routedInRegion.add(routeKey);
                                debugLog(entry.instance.id, '➡️', 'route-overflow-enqueued-from-already-placed', {
                                    runId: runId,
                                    from: key,
                                    to: nextRegion_1.key,
                                    targetPage: nextRegion_1.pageNumber,
                                    targetColumn: nextRegion_1.columnNumber,
                                    entryTop: entryTop,
                                    entryBottom: entryBottom,
                                    currentHeight: currentHeight,
                                    storedSpanBottom: actualSpan.bottom,
                                    queueEntrySpanTop: entry.span.top,
                                    regionHeightPx: regionHeightPx,
                                    overflowAmount: entryBottom - regionHeightPx,
                                    pendingCount: pendingQueue.length,
                                });
                                logPaginationDecision(runId, 'entry-reroute-overflow-already-placed', {
                                    componentId: entry.instance.id,
                                    from: key,
                                    to: nextRegion_1.key,
                                    entryTop: entryTop,
                                    entryBottom: entryBottom,
                                    currentHeight: currentHeight,
                                    storedSpanBottom: actualSpan.bottom,
                                    queueEntrySpanTop: entry.span.top,
                                    regionHeightPx: regionHeightPx,
                                    overflowAmount: entryBottom - regionHeightPx,
                                });
                                return "continue";
                            }
                            else {
                                // Entry already routed to this region
                                if (isPaginationDebugEnabled()) {
                                    debugLog(entry.instance.id, '⚠️', 'routing-already-routed', {
                                        runId: runId,
                                        targetRegion: nextRegion_1.key,
                                        routeKey: routeKey,
                                    });
                                }
                            }
                        }
                        else {
                            // Routing failed - nextRegion is null or ensurePage failed
                            if (isPaginationDebugEnabled()) {
                                debugLog(entry.instance.id, '❌', 'routing-failed', {
                                    runId: runId,
                                    nextRegionFound: !!nextRegion_1,
                                    nextRegionKey: nextRegion_1 === null || nextRegion_1 === void 0 ? void 0 : nextRegion_1.key,
                                    nextPageNumber: nextRegion_1 === null || nextRegion_1 === void 0 ? void 0 : nextRegion_1.pageNumber,
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
                        }
                        else if (isPaginationDebugEnabled() && shouldDebugComponent(entry.instance.id)) {
                            debugLog(entry.instance.id, '🔧', 'cursor-advanced-for-skipped-entry', {
                                runId: runId,
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
                        var componentBeforeSearch = columnEntries.filter(function (e) { return e.instance.id === entry.instance.id; });
                        debugLog(normalizeComponentId(entry.instance.id), '🔎', 'component-trace-before-existing-index-search', {
                            componentId: normalizeComponentId(entry.instance.id),
                            runId: runId,
                            regionKey: key,
                            page: page.pageNumber,
                            column: column.columnNumber,
                            componentCount: componentBeforeSearch.length,
                            componentEntries: componentBeforeSearch.map(function (e) {
                                var _a, _b, _c, _d;
                                return ({
                                    page: (_a = e.region) === null || _a === void 0 ? void 0 : _a.page,
                                    column: (_b = e.region) === null || _b === void 0 ? void 0 : _b.column,
                                    spanTop: (_c = e.span) === null || _c === void 0 ? void 0 : _c.top,
                                    spanBottom: (_d = e.span) === null || _d === void 0 ? void 0 : _d.bottom,
                                });
                            }),
                            searchCriteria: {
                                instanceId: entry.instance.id,
                                targetPage: page.pageNumber,
                                targetColumn: column.columnNumber,
                            },
                        });
                    }
                    var existingIndex = columnEntries.findIndex(function (e) {
                        var _a, _b;
                        return e.instance.id === entry.instance.id &&
                            ((_a = e.region) === null || _a === void 0 ? void 0 : _a.page) === page.pageNumber &&
                            ((_b = e.region) === null || _b === void 0 ? void 0 : _b.column) === column.columnNumber;
                    });
                    // Phase 3: ExistingIndex Search Tracking - After search
                    if (isPaginationDebugEnabled() && shouldDebugComponent(entry.instance.id)) {
                        debugLog(normalizeComponentId(entry.instance.id), '🔎', 'component-trace-existing-index-result', {
                            componentId: normalizeComponentId(entry.instance.id),
                            runId: runId,
                            regionKey: key,
                            page: page.pageNumber,
                            column: column.columnNumber,
                            existingIndex: existingIndex,
                            found: existingIndex >= 0,
                            // Show what the search found
                            foundEntry: existingIndex >= 0 ? {
                                page: (_1 = columnEntries[existingIndex].region) === null || _1 === void 0 ? void 0 : _1.page,
                                column: (_2 = columnEntries[existingIndex].region) === null || _2 === void 0 ? void 0 : _2.column,
                                spanTop: (_3 = columnEntries[existingIndex].span) === null || _3 === void 0 ? void 0 : _3.top,
                                spanBottom: (_4 = columnEntries[existingIndex].span) === null || _4 === void 0 ? void 0 : _4.bottom,
                            } : null,
                            // Show all entries for this component in columnEntries
                            allComponentEntries: columnEntries
                                .map(function (e, idx) { return ({ idx: idx, entry: e }); })
                                .filter(function (_a) {
                                var e = _a.entry;
                                return e.instance.id === entry.instance.id;
                            })
                                .map(function (_a) {
                                var _b, _c, _d, _e, _f, _g;
                                var idx = _a.idx, e = _a.entry;
                                return ({
                                    index: idx,
                                    page: (_b = e.region) === null || _b === void 0 ? void 0 : _b.page,
                                    column: (_c = e.region) === null || _c === void 0 ? void 0 : _c.column,
                                    spanTop: (_d = e.span) === null || _d === void 0 ? void 0 : _d.top,
                                    spanBottom: (_e = e.span) === null || _e === void 0 ? void 0 : _e.bottom,
                                    matchesSearch: e.instance.id === entry.instance.id &&
                                        ((_f = e.region) === null || _f === void 0 ? void 0 : _f.page) === page.pageNumber &&
                                        ((_g = e.region) === null || _g === void 0 ? void 0 : _g.column) === column.columnNumber,
                                });
                            }),
                        });
                    }
                    if (existingIndex >= 0) {
                        // Phase 4: Update/Add Tracking - Update branch
                        if (isPaginationDebugEnabled() && shouldDebugComponent(entry.instance.id)) {
                            debugLog(normalizeComponentId(entry.instance.id), '✏️', 'component-trace-updating-entry', {
                                componentId: normalizeComponentId(entry.instance.id),
                                runId: runId,
                                regionKey: key,
                                page: page.pageNumber,
                                column: column.columnNumber,
                                existingIndex: existingIndex,
                                beforeUpdate: {
                                    page: (_5 = columnEntries[existingIndex].region) === null || _5 === void 0 ? void 0 : _5.page,
                                    column: (_6 = columnEntries[existingIndex].region) === null || _6 === void 0 ? void 0 : _6.column,
                                    spanTop: (_7 = columnEntries[existingIndex].span) === null || _7 === void 0 ? void 0 : _7.top,
                                    spanBottom: (_8 = columnEntries[existingIndex].span) === null || _8 === void 0 ? void 0 : _8.bottom,
                                },
                                afterUpdate: {
                                    page: page.pageNumber,
                                    column: column.columnNumber,
                                    spanTop: actualSpan.top,
                                    spanBottom: actualSpan.bottom,
                                },
                                componentCountBefore: columnEntries.filter(function (e) { return e.instance.id === entry.instance.id; }).length,
                            });
                        }
                        // Update existing entry with current span (preserves span.top from previousPlan)
                        columnEntries[existingIndex] = __assign(__assign({}, columnEntries[existingIndex]), { span: actualSpan });
                    }
                    else {
                        // Phase 4: Update/Add Tracking - Add branch
                        if (isPaginationDebugEnabled() && shouldDebugComponent(entry.instance.id)) {
                            debugLog(normalizeComponentId(entry.instance.id), '➕', 'component-trace-adding-entry', {
                                componentId: normalizeComponentId(entry.instance.id),
                                runId: runId,
                                regionKey: key,
                                page: page.pageNumber,
                                column: column.columnNumber,
                                existingIndex: existingIndex,
                                whyNotFound: 'existingIndex search returned -1',
                                componentCountBefore: columnEntries.filter(function (e) { return e.instance.id === entry.instance.id; }).length,
                                entryToAdd: {
                                    page: page.pageNumber,
                                    column: column.columnNumber,
                                    spanTop: actualSpan.top,
                                    spanBottom: actualSpan.bottom,
                                    fromPlacedEntry: !!placedEntry_1,
                                    placedEntryRegion: placedEntry_1 === null || placedEntry_1 === void 0 ? void 0 : placedEntry_1.region,
                                },
                                // Check if this component already exists with different region
                                componentWithDifferentRegion: columnEntries
                                    .filter(function (e) { return e.instance.id === entry.instance.id; })
                                    .map(function (e) {
                                    var _a, _b, _c, _d;
                                    return ({
                                        page: (_a = e.region) === null || _a === void 0 ? void 0 : _a.page,
                                        column: (_b = e.region) === null || _b === void 0 ? void 0 : _b.column,
                                        spanTop: (_c = e.span) === null || _c === void 0 ? void 0 : _c.top,
                                        spanBottom: (_d = e.span) === null || _d === void 0 ? void 0 : _d.bottom,
                                    });
                                }),
                            });
                        }
                        // Entry not found in columnEntries - add it
                        // Use placedEntry if available (has correct span from previousPlan),
                        // otherwise use entry with actualSpan
                        var entryToAdd = placedEntry_1
                            ? __assign(__assign({}, placedEntry_1), { span: actualSpan }) : __assign(__assign({}, entry), { span: actualSpan });
                        // Fix 1: Check for duplicate before adding (Path 1: Already-placed entry add branch)
                        // Note: This path already has existingIndex check above, but this is a safety net
                        var existingIndexPath1Add = findExistingEntry(entry, columnEntries, page.pageNumber, column.columnNumber);
                        if (existingIndexPath1Add >= 0) {
                            // Update existing entry instead of adding duplicate
                            columnEntries[existingIndexPath1Add] = __assign(__assign({}, columnEntries[existingIndexPath1Add]), { span: entryToAdd.span });
                            if (isPaginationDebugEnabled() && shouldDebugComponent(entry.instance.id)) {
                                debugLog(normalizeComponentId(entry.instance.id), '🔄', 'component-trace-updated-instead-of-duplicate-path1-add', {
                                    componentId: normalizeComponentId(entry.instance.id),
                                    runId: runId,
                                    regionKey: key,
                                    page: page.pageNumber,
                                    column: column.columnNumber,
                                    existingIndex: existingIndexPath1Add,
                                });
                            }
                        }
                        else {
                            columnEntries.push(entryToAdd);
                        }
                    }
                    // Phase 4: Update/Add Tracking - After update/add
                    if (isPaginationDebugEnabled() && shouldDebugComponent(entry.instance.id)) {
                        var componentAfter = columnEntries.filter(function (e) { return e.instance.id === entry.instance.id; });
                        debugLog(normalizeComponentId(entry.instance.id), '📊', 'component-trace-after-update-add', {
                            componentId: normalizeComponentId(entry.instance.id),
                            runId: runId,
                            regionKey: key,
                            page: page.pageNumber,
                            column: column.columnNumber,
                            componentCount: componentAfter.length,
                            componentEntries: componentAfter.map(function (e) {
                                var _a, _b, _c, _d;
                                return ({
                                    page: (_a = e.region) === null || _a === void 0 ? void 0 : _a.page,
                                    column: (_b = e.region) === null || _b === void 0 ? void 0 : _b.column,
                                    spanTop: (_c = e.span) === null || _c === void 0 ? void 0 : _c.top,
                                    spanBottom: (_d = e.span) === null || _d === void 0 ? void 0 : _d.bottom,
                                });
                            }),
                            hasDuplicates: componentAfter.length > 1,
                            duplicatesInSameRegion: componentAfter.filter(function (e) {
                                var _a, _b;
                                return ((_a = e.region) === null || _a === void 0 ? void 0 : _a.page) === page.pageNumber &&
                                    ((_b = e.region) === null || _b === void 0 ? void 0 : _b.column) === column.columnNumber;
                            }).length,
                        });
                    }
                    // Detect duplicates after update/add
                    if (isPaginationDebugEnabled()) {
                        var duplicateEntries = columnEntries.filter(function (e) { return e.instance.id === entry.instance.id; });
                        if (duplicateEntries.length > 1) {
                            console.warn('⚠️ [DUPLICATE] Entry found multiple times in columnEntries:', {
                                componentId: entry.instance.id,
                                duplicateCount: duplicateEntries.length,
                                locations: duplicateEntries.map(function (e) {
                                    var _a, _b, _c;
                                    return ({
                                        page: (_a = e.region) === null || _a === void 0 ? void 0 : _a.page,
                                        column: (_b = e.region) === null || _b === void 0 ? void 0 : _b.column,
                                        spanTop: (_c = e.span) === null || _c === void 0 ? void 0 : _c.top,
                                    });
                                }),
                                currentRegion: key,
                                placedEntryFound: !!placedEntry_1,
                                existingIndexFound: existingIndex >= 0,
                            });
                        }
                        // Phase 5: Duplication Detection Tracking
                        if (shouldDebugComponent(entry.instance.id)) {
                            var componentDuplicates = columnEntries.filter(function (e) { return e.instance.id === entry.instance.id; });
                            if (componentDuplicates.length > 1) {
                                debugLog(normalizeComponentId(entry.instance.id), '⚠️', 'component-trace-duplicate-detected', {
                                    componentId: normalizeComponentId(entry.instance.id),
                                    runId: runId,
                                    regionKey: key,
                                    page: page.pageNumber,
                                    column: column.columnNumber,
                                    duplicateCount: componentDuplicates.length,
                                    duplicates: componentDuplicates.map(function (e, idx) {
                                        var _a, _b, _c, _d, _e, _f;
                                        return ({
                                            index: idx,
                                            page: (_a = e.region) === null || _a === void 0 ? void 0 : _a.page,
                                            column: (_b = e.region) === null || _b === void 0 ? void 0 : _b.column,
                                            spanTop: (_c = e.span) === null || _c === void 0 ? void 0 : _c.top,
                                            spanBottom: (_d = e.span) === null || _d === void 0 ? void 0 : _d.bottom,
                                            isInTargetRegion: ((_e = e.region) === null || _e === void 0 ? void 0 : _e.page) === page.pageNumber && ((_f = e.region) === null || _f === void 0 ? void 0 : _f.column) === column.columnNumber,
                                        });
                                    }),
                                    duplicatesInTargetRegion: componentDuplicates.filter(function (e) {
                                        var _a, _b;
                                        return ((_a = e.region) === null || _a === void 0 ? void 0 : _a.page) === page.pageNumber &&
                                            ((_b = e.region) === null || _b === void 0 ? void 0 : _b.column) === column.columnNumber;
                                    }).length,
                                    placedEntryFound: !!placedEntry_1,
                                    existingIndexFound: existingIndex >= 0,
                                    // Show when each duplicate was added (approximate)
                                    columnEntriesIndices: columnEntries
                                        .map(function (e, idx) { return ({ idx: idx, entry: e }); })
                                        .filter(function (_a) {
                                        var e = _a.entry;
                                        return e.instance.id === entry.instance.id;
                                    })
                                        .map(function (_a) {
                                        var idx = _a.idx;
                                        return idx;
                                    }),
                                });
                            }
                        }
                    }
                    // Get the entry that was added/updated for logging
                    var finalEntry = placedEntry_1
                        ? (_9 = columnEntries.find(function (e) {
                            var _a, _b;
                            return e.instance.id === placedEntry_1.instance.id &&
                                ((_a = e.region) === null || _a === void 0 ? void 0 : _a.page) === page.pageNumber &&
                                ((_b = e.region) === null || _b === void 0 ? void 0 : _b.column) === column.columnNumber;
                        })) !== null && _9 !== void 0 ? _9 : placedEntry_1
                        : columnEntries[columnEntries.length - 1]; // Last added entry
                    logPaginationDecision(runId, 'entry-skip-already-placed', {
                        componentId: entry.instance.id,
                        regionKey: key,
                        existingSpan: entry.span,
                        usedPlacedEntry: !!placedEntry_1,
                        addedEntrySpanTop: (_10 = finalEntry === null || finalEntry === void 0 ? void 0 : finalEntry.span) === null || _10 === void 0 ? void 0 : _10.top,
                        addedEntrySpanBottom: (_11 = finalEntry === null || finalEntry === void 0 ? void 0 : finalEntry.span) === null || _11 === void 0 ? void 0 : _11.bottom,
                        actualSpan: actualSpan,
                        existingRegion: entry.region,
                        entryTop: entryTop,
                        entryBottom: entryBottom,
                        currentHeight: currentHeight,
                        storedSpanBottom: actualSpan.bottom,
                        queueEntrySpanTop: entry.span.top,
                        regionHeightPx: regionHeightPx,
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
                    return "continue";
                }
                // Fix 2: Skip entry if already in columnEntries but doesn't match conditional check
                // This prevents duplicate processing when entry loses span but still exists in columnEntries
                if (alreadyInColumnEntries && !(entry.span && entry.region && entry.region.page === page.pageNumber && entry.region.column === column.columnNumber)) {
                    if (isPaginationDebugEnabled() && shouldDebugComponent(entry.instance.id)) {
                        debugLog(normalizeComponentId(entry.instance.id), '⏭️', 'component-trace-skipped-already-in-column-entries', {
                            componentId: normalizeComponentId(entry.instance.id),
                            runId: runId,
                            regionKey: key,
                            page: page.pageNumber,
                            column: column.columnNumber,
                            reason: 'Entry already in columnEntries but conditional check failed (span missing or region mismatch)',
                        });
                    }
                    return "continue";
                }
                // Use measurement height if available, otherwise fall back to estimatedHeight
                var measurement = measurements.get(entry.measurementKey);
                var estimatedHeight = (_13 = (_12 = measurement === null || measurement === void 0 ? void 0 : measurement.height) !== null && _12 !== void 0 ? _12 : entry.estimatedHeight) !== null && _13 !== void 0 ? _13 : DEFAULT_COMPONENT_HEIGHT_PX;
                var span = computeSpan(cursor, estimatedHeight);
                // Component-5 span calculation logging
                if (isPaginationDebugEnabled() && entry.instance.id === 'component-5') {
                    debugLog('component-5', '📐', 'span-calculation', {
                        runId: runId,
                        regionKey: key,
                        cursorOffset: cursor.currentOffset,
                        estimatedHeight: estimatedHeight,
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
                        runId: runId,
                        regionKey: key,
                        cursorOffset: cursor.currentOffset,
                        estimatedHeight: estimatedHeight,
                        spanTop: span.top,
                        spanBottom: span.bottom,
                        spanHeight: span.height,
                        cursorAfterAdvance: span.bottom,
                        regionHeightPx: cursor.maxHeight,
                        willFit: span.bottom <= cursor.maxHeight,
                        previousEntryId: (_14 = columnEntries[columnEntries.length - 1]) === null || _14 === void 0 ? void 0 : _14.instance.id,
                        previousEntryBottom: (_16 = (_15 = columnEntries[columnEntries.length - 1]) === null || _15 === void 0 ? void 0 : _15.span) === null || _16 === void 0 ? void 0 : _16.bottom,
                    });
                }
                var fits = fitsInRegion(span, cursor, entry.instance.id);
                // Calculate available space for debugging
                var availableSpace = cursor.maxHeight - cursor.currentOffset;
                var spaceNeeded = estimatedHeight;
                var spaceDeficit = fits ? 0 : spaceNeeded - availableSpace;
                var utilizationPercent = ((cursor.currentOffset / cursor.maxHeight) * 100).toFixed(1);
                logPaginationDecision(runId, 'entry-check', {
                    componentId: entry.instance.id,
                    regionKey: key,
                    page: page.pageNumber,
                    column: column.columnNumber,
                    top: span.top,
                    bottom: span.bottom,
                    estimatedHeight: estimatedHeight,
                    measurementKey: entry.measurementKey,
                    needsMeasurement: entry.needsMeasurement,
                    hasEstimateOnly: estimatedHeight === DEFAULT_COMPONENT_HEIGHT_PX,
                    regionHeightPx: regionHeightPx,
                    fits: fits,
                    spaceAnalysis: {
                        cursorOffset: cursor.currentOffset,
                        availableSpace: availableSpace,
                        spaceNeeded: spaceNeeded,
                        spaceDeficit: spaceDeficit,
                        utilizationPercent: "".concat(utilizationPercent, "%"),
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
                    var isMetadataEntry_1 = (_19 = (_18 = (_17 = entry.regionContent) === null || _17 === void 0 ? void 0 : _17.kind) === null || _18 === void 0 ? void 0 : _18.includes('metadata')) !== null && _19 !== void 0 ? _19 : false;
                    var hasZeroItems = entry.regionContent && entry.regionContent.items.length === 0;
                    var hasZeroHeight = span.height === 0 || (hasZeroItems && !isMetadataEntry_1);
                    if (hasZeroHeight) {
                        debugLog(entry.instance.id, '⏭️', 'skipping-zero-height-fits-path', {
                            runId: runId,
                            regionKey: key,
                            reason: 'Entry has 0 height or 0 items (not metadata)',
                            spanHeight: span.height,
                            itemCount: (_21 = (_20 = entry.regionContent) === null || _20 === void 0 ? void 0 : _20.items.length) !== null && _21 !== void 0 ? _21 : 'N/A',
                            kind: (_23 = (_22 = entry.regionContent) === null || _22 === void 0 ? void 0 : _22.kind) !== null && _23 !== void 0 ? _23 : 'N/A',
                            isMetadata: isMetadataEntry_1,
                        });
                        return "continue";
                    }
                    paginationStats.componentsPlaced++;
                    var committedEntry = __assign(__assign({}, entry), { region: {
                            page: page.pageNumber,
                            column: column.columnNumber,
                            index: columnEntries.length,
                        }, span: span, overflow: (_24 = entry.overflow) !== null && _24 !== void 0 ? _24 : false, listContinuation: entry.regionContent
                            ? {
                                isContinuation: entry.regionContent.isContinuation,
                                startIndex: entry.regionContent.startIndex,
                                totalCount: entry.regionContent.totalCount,
                            }
                            : undefined, sourceRegionKey: column.key });
                    // Phase 4.5: New Entry Placement Tracking - Fits path
                    if (isPaginationDebugEnabled() && shouldDebugComponent(entry.instance.id)) {
                        debugLog(normalizeComponentId(entry.instance.id), '✅', 'component-trace-new-entry-fits', {
                            componentId: normalizeComponentId(entry.instance.id),
                            runId: runId,
                            regionKey: key,
                            page: page.pageNumber,
                            column: column.columnNumber,
                            spanTop: span.top,
                            spanBottom: span.bottom,
                            componentCountBefore: columnEntries.filter(function (e) { return e.instance.id === entry.instance.id; }).length,
                            committedEntryRegion: committedEntry.region,
                        });
                    }
                    // Fix 1: Check for duplicate before adding (Path 2: New entry fits)
                    var existingIndexPath2 = findExistingEntry(entry, columnEntries, page.pageNumber, column.columnNumber);
                    if (existingIndexPath2 >= 0) {
                        // Update existing entry instead of adding duplicate
                        columnEntries[existingIndexPath2] = __assign(__assign({}, columnEntries[existingIndexPath2]), { span: committedEntry.span, region: committedEntry.region });
                        if (isPaginationDebugEnabled() && shouldDebugComponent(entry.instance.id)) {
                            debugLog(normalizeComponentId(entry.instance.id), '🔄', 'component-trace-updated-instead-of-duplicate-path2', {
                                componentId: normalizeComponentId(entry.instance.id),
                                runId: runId,
                                regionKey: key,
                                page: page.pageNumber,
                                column: column.columnNumber,
                                existingIndex: existingIndexPath2,
                            });
                        }
                    }
                    else {
                        columnEntries.push(committedEntry);
                    }
                    var prevOffset = cursor.currentOffset;
                    advanceCursor(cursor, span);
                    // Component-5 placement logging
                    if (isPaginationDebugEnabled() && entry.instance.id === 'component-5') {
                        var spanBottom = (_26 = (_25 = entry.span) === null || _25 === void 0 ? void 0 : _25.bottom) !== null && _26 !== void 0 ? _26 : span.bottom;
                        var actuallyOverflows = spanBottom > regionHeightPx;
                        debugLog('component-5', '✅', 'component-5-placed', {
                            runId: runId,
                            regionKey: key,
                            page: page.pageNumber,
                            column: column.columnNumber,
                            spanTop: (_28 = (_27 = entry.span) === null || _27 === void 0 ? void 0 : _27.top) !== null && _28 !== void 0 ? _28 : span.top,
                            spanBottom: spanBottom,
                            spanHeight: (_30 = (_29 = entry.span) === null || _29 === void 0 ? void 0 : _29.height) !== null && _30 !== void 0 ? _30 : span.height,
                            cursorBefore: prevOffset,
                            cursorAfter: cursor.currentOffset,
                            regionHeightPx: regionHeightPx,
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
                            runId: runId,
                            regionKey: key,
                            page: page.pageNumber,
                            column: column.columnNumber,
                            spanTop: (_32 = (_31 = entry.span) === null || _31 === void 0 ? void 0 : _31.top) !== null && _32 !== void 0 ? _32 : span.top,
                            spanBottom: (_34 = (_33 = entry.span) === null || _33 === void 0 ? void 0 : _33.bottom) !== null && _34 !== void 0 ? _34 : span.bottom,
                            spanHeight: (_36 = (_35 = entry.span) === null || _35 === void 0 ? void 0 : _35.height) !== null && _36 !== void 0 ? _36 : span.height,
                            cursorBefore: prevOffset,
                            cursorAfter: cursor.currentOffset,
                            regionHeightPx: regionHeightPx,
                            overflows: ((_38 = (_37 = entry.span) === null || _37 === void 0 ? void 0 : _37.bottom) !== null && _38 !== void 0 ? _38 : span.bottom) > regionHeightPx,
                            overflowAmount: ((_40 = (_39 = entry.span) === null || _39 === void 0 ? void 0 : _39.bottom) !== null && _40 !== void 0 ? _40 : span.bottom) - regionHeightPx,
                            previousEntryId: (_41 = columnEntries[columnEntries.length - 1]) === null || _41 === void 0 ? void 0 : _41.instance.id,
                            previousEntryBottom: (_43 = (_42 = columnEntries[columnEntries.length - 1]) === null || _42 === void 0 ? void 0 : _42.span) === null || _43 === void 0 ? void 0 : _43.bottom,
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
                    return "continue";
                }
                overflowWarnings.push({ componentId: entry.instance.id, page: page.pageNumber, column: column.columnNumber });
                debugLog(entry.instance.id, '📛', 'component overflow', {
                    runId: runId,
                    regionKey: key,
                    page: page.pageNumber,
                    column: column.columnNumber,
                    estimatedHeight: estimatedHeight,
                    cursorOffset: cursor.currentOffset,
                    regionHeightPx: regionHeightPx,
                    span: span,
                    hasRegionContent: !!entry.regionContent,
                    itemCount: (_45 = (_44 = entry.regionContent) === null || _44 === void 0 ? void 0 : _44.items.length) !== null && _45 !== void 0 ? _45 : 0,
                });
                // Component-5/6 overflow routing logging
                if (isPaginationDebugEnabled() && (entry.instance.id === 'component-5' || entry.instance.id === 'component-6')) {
                    var nextRegion_2 = findNextRegion(pages, key);
                    debugLog(entry.instance.id, '⏭️', "".concat(entry.instance.id, "-routed-to-next-column"), {
                        reason: 'does-not-fit',
                        runId: runId,
                        regionKey: key,
                        nextRegionKey: (_46 = nextRegion_2 === null || nextRegion_2 === void 0 ? void 0 : nextRegion_2.key) !== null && _46 !== void 0 ? _46 : null,
                        nextPage: (_47 = nextRegion_2 === null || nextRegion_2 === void 0 ? void 0 : nextRegion_2.pageNumber) !== null && _47 !== void 0 ? _47 : null,
                        nextColumn: (_48 = nextRegion_2 === null || nextRegion_2 === void 0 ? void 0 : nextRegion_2.columnNumber) !== null && _48 !== void 0 ? _48 : null,
                        spanTop: span.top,
                        spanBottom: span.bottom,
                        spanHeight: span.height,
                        cursorOffset: cursor.currentOffset,
                        regionHeightPx: regionHeightPx,
                        overflowAmount: span.bottom - regionHeightPx,
                    });
                }
                logPaginationDecision(runId, 'entry-overflow', {
                    componentId: entry.instance.id,
                    regionKey: key,
                    page: page.pageNumber,
                    column: column.columnNumber,
                    span: span,
                    estimatedHeight: estimatedHeight,
                    regionHeightPx: regionHeightPx,
                    hasRegionContent: !!entry.regionContent,
                    itemCount: (_50 = (_49 = entry.regionContent) === null || _49 === void 0 ? void 0 : _49.items.length) !== null && _50 !== void 0 ? _50 : 0,
                });
                // Measurement-based split evaluation for list components
                // For list components with multiple items, use concrete measurements to determine
                // the best split point. For block components, use simple threshold check.
                var startsInBottomFifth = span.top > (regionHeightPx * 0.8);
                var shouldAvoidSplit = startsInBottomFifth; // Default: simple threshold for blocks
                var splitDecision = null;
                // Phase 4 A2: Find next region FIRST so we can use its capacity for smart split decisions
                var nextRegion = findNextRegion(pages, key);
                // Assume next region is empty (full capacity available) - reasonable approximation
                var nextRegionCapacity = nextRegion ? regionHeightPx : undefined;
                debugLog(entry.instance.id, '🪓', 'evaluating split', {
                    runId: runId,
                    items: (_53 = (_52 = (_51 = entry.regionContent) === null || _51 === void 0 ? void 0 : _51.items) === null || _52 === void 0 ? void 0 : _52.length) !== null && _53 !== void 0 ? _53 : 0,
                    cursorOffset: cursor.currentOffset,
                    regionHeightPx: regionHeightPx,
                    nextRegionKey: (_54 = nextRegion === null || nextRegion === void 0 ? void 0 : nextRegion.key) !== null && _54 !== void 0 ? _54 : null,
                    nextRegionCapacity: nextRegionCapacity,
                });
                // For list components with multiple items, use measurement-based evaluation
                if (entry.regionContent &&
                    (entry.regionContent.items.length > 1 ||
                        (entry.regionContent.items.length === 1 &&
                            entry.regionContent.metadata &&
                            entry.regionContent.startIndex === 0 &&
                            !entry.regionContent.isContinuation))) {
                    // Phase 4 A2: Pass nextRegionCapacity for smarter split vs move decisions
                    splitDecision = findBestListSplit(entry, cursor, regionHeightPx, measurements, adapters, { nextRegionCapacity: nextRegionCapacity });
                    // If split evaluation says we can't place, treat like shouldAvoidSplit
                    if (!splitDecision.canPlace) {
                        shouldAvoidSplit = true;
                    }
                    // Phase 4 A2: Log when smart split prefers moving
                    if (splitDecision.preferMove) {
                        debugLog(entry.instance.id, '🚚', 'smart-split-prefers-move', {
                            runId: runId,
                            regionKey: key,
                            reason: splitDecision.reason,
                            nextRegionKey: (_55 = nextRegion === null || nextRegion === void 0 ? void 0 : nextRegion.key) !== null && _55 !== void 0 ? _55 : null,
                        });
                    }
                }
                // nextRegion already computed above for smart split decisions
                if (debugQueueEntry) {
                    // FIX: Log next-region-snapshot with context that this is informational,
                    // not indicating where the current component was placed
                    debugLog(debugQueueEntry.instance.id, '🧮', 'next-region-snapshot', {
                        runId: runId,
                        from: key,
                        nextRegionKey: (_56 = nextRegion === null || nextRegion === void 0 ? void 0 : nextRegion.key) !== null && _56 !== void 0 ? _56 : null,
                        nextRegionPage: (_57 = nextRegion === null || nextRegion === void 0 ? void 0 : nextRegion.pageNumber) !== null && _57 !== void 0 ? _57 : null,
                        nextRegionColumn: (_58 = nextRegion === null || nextRegion === void 0 ? void 0 : nextRegion.columnNumber) !== null && _58 !== void 0 ? _58 : null,
                        totalPages: pages.length,
                        note: 'Informational: shows next region if overflow occurs, not actual placement',
                    });
                }
                var moveRemainingToRegion = function (targetKey) {
                    if (!targetKey) {
                        return false;
                    }
                    var pendingQueue = getPendingQueue(targetKey);
                    if (regionQueue.length > 0) {
                        var debugEntry = regionQueue.find(function (queued) { return shouldDebugComponent(queued.instance.id); });
                        if (debugEntry) {
                            debugLog(debugEntry.instance.id, '🚚', 'move-remaining-to-region', {
                                runId: runId,
                                from: key,
                                to: targetKey,
                                movingIds: regionQueue.map(function (queued) { return queued.instance.id; }),
                                pendingBefore: pendingQueue.length,
                            });
                        }
                    }
                    if (regionQueue.length > 0) {
                        pendingQueue.push.apply(pendingQueue, regionQueue);
                        regionQueue.length = 0;
                        var debugEntry = pendingQueue.find(function (queued) { return shouldDebugComponent(queued.instance.id); });
                        if (debugEntry) {
                            debugLog(debugEntry.instance.id, '📦', 'moved-remaining-enqueued', {
                                runId: runId,
                                targetKey: targetKey,
                                pendingAfter: pendingQueue.length,
                                reroutedIds: pendingQueue.map(function (queued) { return queued.instance.id; }),
                            });
                        }
                    }
                    return true;
                };
                if (!entry.regionContent || entry.regionContent.items.length <= 1 || shouldAvoidSplit) {
                    // For block entries we only want to enqueue a follow-up copy once; without this guard
                    // the overflow version gets re-enqueued forever and the paginator never advances.
                    // Keep this note because removing it caused an infinite loop earlier.
                    var routeOverflowToNextRegion = function (_a) {
                        var _b, _c;
                        var _d = _a === void 0 ? {} : _a, _e = _d.allowOverflowReroute, allowOverflowReroute = _e === void 0 ? false : _e, _f = _d.forceAdvance, forceAdvance = _f === void 0 ? false : _f;
                        var alreadyRerouted = (_b = entry.overflowRouted) !== null && _b !== void 0 ? _b : false;
                        var isOverflowingFromHomeRegion = entry.homeRegionKey === key;
                        // CRITICAL FIX: Reset already-rerouted flag if region height changed significantly
                        // This allows re-routing when region height drops (e.g., component-10 split segment invalidation)
                        var regionHeightChanged = lastRegionHeightPx !== null && Math.abs(lastRegionHeightPx - regionHeightPx) > SIGNIFICANT_REGION_HEIGHT_CHANGE_PX;
                        if (alreadyRerouted && regionHeightChanged) {
                            if (isPaginationDebugEnabled()) {
                                debugLog(entry.instance.id, '🔄', 'already-rerouted-reset-region-height-changed', {
                                    runId: runId,
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
                            runId: runId,
                            regionKey: key,
                            homeRegionKey: entry.homeRegionKey,
                            isOverflowingFromHomeRegion: isOverflowingFromHomeRegion,
                            allowOverflowReroute: allowOverflowReroute,
                            forceAdvance: forceAdvance,
                            alreadyRerouted: alreadyRerouted,
                            regionHeightChanged: regionHeightChanged,
                        });
                        // CRITICAL: If component is overflowing from its home region, prefer the other column
                        // on the same page instead of advancing to the next page. This prevents components
                        // from being incorrectly routed to page 2 when they should be in column 2 of page 1.
                        var candidateRegion = null;
                        if (isOverflowingFromHomeRegion && columnCount > 1) {
                            candidateRegion = findOtherColumnOnSamePage(pages, key);
                            if (candidateRegion && process.env.NODE_ENV !== 'production') {
                                debugLog(entry.instance.id, '🏠', 'route-overflow-prefer-home-page-column', {
                                    runId: runId,
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
                            var newPageNumber = pages.length + 1;
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
                                runId: runId,
                                regionKey: key,
                                pagesCount: pages.length,
                            });
                            return null;
                        }
                        if (!ensurePage(pages, candidateRegion.pageNumber, columnCount, pendingQueues, runId, 'route-overflow-to-next-region')) {
                            // Hit MAX_PAGES limit, stop pagination
                            return null;
                        }
                        var previousRegion = (_c = entry.region) !== null && _c !== void 0 ? _c : { page: page.pageNumber, column: page.columns[columnIndex].columnNumber };
                        if (alreadyRerouted && !allowOverflowReroute) {
                            var advancesPage = candidateRegion.pageNumber > previousRegion.page;
                            if (!advancesPage) {
                                logPaginationDecision(runId, 'route-blocked-already-rerouted', {
                                    componentId: entry.instance.id,
                                    regionKey: key,
                                    allowOverflowReroute: allowOverflowReroute,
                                    candidateRegion: candidateRegion,
                                    previousRegion: previousRegion,
                                });
                                debugLog(entry.instance.id, '⛔', 'route-overflow-blocked-already-rerouted', {
                                    runId: runId,
                                    regionKey: key,
                                    allowOverflowReroute: allowOverflowReroute,
                                    candidateRegion: candidateRegion,
                                    previousRegion: previousRegion,
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
                            var sameRegion = candidateRegion.pageNumber === previousRegion.page && candidateRegion.columnNumber === previousRegion.column;
                            if (sameRegion) {
                                logPaginationDecision(runId, 'route-blocked-same-region', {
                                    componentId: entry.instance.id,
                                    regionKey: key,
                                    candidateKey: candidateRegion.key,
                                    previousRegion: previousRegion,
                                    candidateRegion: candidateRegion,
                                });
                                debugLog(entry.instance.id, '⛔', 'route-overflow-same-region', {
                                    runId: runId,
                                    regionKey: key,
                                    candidateRegion: candidateRegion,
                                    previousRegion: previousRegion,
                                });
                                return null;
                            }
                        }
                        var routeKey = "".concat(entry.instance.id, ":").concat(candidateRegion.key);
                        if (routedInRegion.has(routeKey)) {
                            logPaginationDecision(runId, 'route-blocked-already-routed-to-region', {
                                componentId: entry.instance.id,
                                routeKey: routeKey,
                            });
                            debugLog(entry.instance.id, '⛔', 'route-overflow-duplicate-route', {
                                runId: runId,
                                routeKey: routeKey,
                            });
                            return null;
                        }
                        var followUp = __assign(__assign({}, entry), { region: {
                                page: candidateRegion.pageNumber,
                                column: candidateRegion.columnNumber,
                            }, span: undefined, overflow: true, overflowRouted: true, sourceRegionKey: candidateRegion.key, orderIndex: entry.orderIndex });
                        var pendingQueue = getPendingQueue(candidateRegion.key);
                        pendingQueue.push(followUp);
                        routedInRegion.add(routeKey);
                        debugLog(entry.instance.id, '➡️', 'route-overflow-enqueued', {
                            runId: runId,
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
                        var columnHasOverflow = columnEntries.some(function (existing) { return existing.overflow || existing.overflowRouted; });
                        var rerouteKey = routeOverflowToNextRegion({
                            allowOverflowReroute: !((_59 = entry.overflowRouted) !== null && _59 !== void 0 ? _59 : false),
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
                            return "break";
                        }
                        // Filter out zero-height entries (overflow path 1)
                        // EXCEPTION: Metadata entries have 0 items but render real content
                        var isMetadataEntry_2 = (_62 = (_61 = (_60 = entry.regionContent) === null || _60 === void 0 ? void 0 : _60.kind) === null || _61 === void 0 ? void 0 : _61.includes('metadata')) !== null && _62 !== void 0 ? _62 : false;
                        var hasZeroItems = entry.regionContent && entry.regionContent.items.length === 0;
                        var hasZeroHeight = span.height === 0 || (hasZeroItems && !isMetadataEntry_2);
                        if (hasZeroHeight) {
                            debugLog(entry.instance.id, '⏭️', 'skipping-zero-height-overflow-path1', {
                                runId: runId,
                                regionKey: key,
                                reason: 'Entry has 0 height or 0 items (not metadata)',
                                spanHeight: span.height,
                                itemCount: (_64 = (_63 = entry.regionContent) === null || _63 === void 0 ? void 0 : _63.items.length) !== null && _64 !== void 0 ? _64 : 'N/A',
                                kind: (_66 = (_65 = entry.regionContent) === null || _65 === void 0 ? void 0 : _65.kind) !== null && _66 !== void 0 ? _66 : 'N/A',
                                isMetadata: isMetadataEntry_2,
                            });
                            return "continue";
                        }
                        var committedEntry = __assign(__assign({}, entry), { region: {
                                page: page.pageNumber,
                                column: column.columnNumber,
                                index: columnEntries.length,
                            }, span: span, overflow: true, listContinuation: entry.regionContent
                                ? {
                                    isContinuation: entry.regionContent.isContinuation,
                                    startIndex: entry.regionContent.startIndex,
                                    totalCount: entry.regionContent.totalCount,
                                }
                                : undefined, sourceRegionKey: column.key });
                        // Phase 4.6: Split Entry Placement Tracking - Overflow path 1
                        if (isPaginationDebugEnabled() && shouldDebugComponent(entry.instance.id)) {
                            debugLog(normalizeComponentId(entry.instance.id), '🔄', 'component-trace-split-entry-overflow-1', {
                                componentId: normalizeComponentId(entry.instance.id),
                                runId: runId,
                                regionKey: key,
                                page: page.pageNumber,
                                column: column.columnNumber,
                                spanTop: span.top,
                                spanBottom: span.bottom,
                                componentCountBefore: columnEntries.filter(function (e) { return e.instance.id === entry.instance.id; }).length,
                                committedEntryRegion: committedEntry.region,
                            });
                        }
                        // Fix 1: Check for duplicate before adding (Path 3: Split entry - first segment)
                        var existingIndexPath3 = findExistingEntry(entry, columnEntries, page.pageNumber, column.columnNumber);
                        if (existingIndexPath3 >= 0) {
                            // Update existing entry instead of adding duplicate
                            columnEntries[existingIndexPath3] = __assign(__assign({}, columnEntries[existingIndexPath3]), { span: committedEntry.span, region: committedEntry.region });
                            if (isPaginationDebugEnabled() && shouldDebugComponent(entry.instance.id)) {
                                debugLog(normalizeComponentId(entry.instance.id), '🔄', 'component-trace-updated-instead-of-duplicate-path3', {
                                    componentId: normalizeComponentId(entry.instance.id),
                                    runId: runId,
                                    regionKey: key,
                                    page: page.pageNumber,
                                    column: column.columnNumber,
                                    existingIndex: existingIndexPath3,
                                });
                            }
                        }
                        else {
                            columnEntries.push(committedEntry);
                        }
                        // Mark the column as full so subsequent entries route elsewhere
                        cursor.currentOffset = regionHeightPx;
                        var forcedRouteKey = routeOverflowToNextRegion({ forceAdvance: true });
                        var movedRemainingToRegion = moveRemainingToRegion(forcedRouteKey !== null && forcedRouteKey !== void 0 ? forcedRouteKey : null);
                        logPaginationDecision(runId, 'force-route', {
                            componentId: entry.instance.id,
                            from: key,
                            to: forcedRouteKey,
                            movedRemaining: movedRemainingToRegion,
                        });
                        if (movedRemainingToRegion) {
                            return "break";
                        }
                        return "continue";
                    }
                    if (!nextRegion) {
                        var newPageNumber = pages.length + 1;
                        if (!ensurePage(pages, newPageNumber, columnCount, pendingQueues, runId, 'overflow-no-next-region')) {
                            return "break";
                        }
                    }
                    var updatedNextRegion = findNextRegion(pages, key);
                    if (!updatedNextRegion) {
                        // Phase 4.10: Fallback Entry Placement Tracking - No next region
                        if (isPaginationDebugEnabled() && shouldDebugComponent(entry.instance.id)) {
                            debugLog(normalizeComponentId(entry.instance.id), '⚠️', 'component-trace-fallback-no-next-region', {
                                componentId: normalizeComponentId(entry.instance.id),
                                runId: runId,
                                regionKey: key,
                                page: page.pageNumber,
                                column: column.columnNumber,
                                spanTop: span.top,
                                spanBottom: span.bottom,
                                componentCountBefore: columnEntries.filter(function (e) { return e.instance.id === entry.instance.id; }).length,
                            });
                        }
                        // Filter out zero-height entries (overflow path 2)
                        // EXCEPTION: Metadata entries have 0 items but render real content
                        var isMetadataEntry_3 = (_69 = (_68 = (_67 = entry.regionContent) === null || _67 === void 0 ? void 0 : _67.kind) === null || _68 === void 0 ? void 0 : _68.includes('metadata')) !== null && _69 !== void 0 ? _69 : false;
                        var hasZeroItems = entry.regionContent && entry.regionContent.items.length === 0;
                        var hasZeroHeight = span.height === 0 || (hasZeroItems && !isMetadataEntry_3);
                        if (hasZeroHeight) {
                            debugLog(entry.instance.id, '⏭️', 'skipping-zero-height-overflow-path2', {
                                runId: runId,
                                regionKey: key,
                                reason: 'Entry has 0 height or 0 items (not metadata)',
                                spanHeight: span.height,
                                itemCount: (_71 = (_70 = entry.regionContent) === null || _70 === void 0 ? void 0 : _70.items.length) !== null && _71 !== void 0 ? _71 : 'N/A',
                                kind: (_73 = (_72 = entry.regionContent) === null || _72 === void 0 ? void 0 : _72.kind) !== null && _73 !== void 0 ? _73 : 'N/A',
                                isMetadata: isMetadataEntry_3,
                            });
                            return "continue";
                        }
                        var committedEntry = __assign(__assign({}, entry), { region: {
                                page: page.pageNumber,
                                column: column.columnNumber,
                                index: columnEntries.length,
                            }, span: span, overflow: true, listContinuation: entry.regionContent
                                ? {
                                    isContinuation: entry.regionContent.isContinuation,
                                    startIndex: entry.regionContent.startIndex,
                                    totalCount: entry.regionContent.totalCount,
                                }
                                : undefined, sourceRegionKey: column.key });
                        // Phase 4.7: Split Entry Placement Tracking - Overflow path 2
                        if (isPaginationDebugEnabled() && shouldDebugComponent(entry.instance.id)) {
                            debugLog(normalizeComponentId(entry.instance.id), '🔄', 'component-trace-split-entry-overflow-2', {
                                componentId: normalizeComponentId(entry.instance.id),
                                runId: runId,
                                regionKey: key,
                                page: page.pageNumber,
                                column: column.columnNumber,
                                spanTop: span.top,
                                spanBottom: span.bottom,
                                componentCountBefore: columnEntries.filter(function (e) { return e.instance.id === entry.instance.id; }).length,
                                committedEntryRegion: committedEntry.region,
                            });
                        }
                        // Fix 1: Check for duplicate before adding (Path 4: Split entry - overflow segment)
                        var existingIndexPath4 = findExistingEntry(entry, columnEntries, page.pageNumber, column.columnNumber);
                        if (existingIndexPath4 >= 0) {
                            // Update existing entry instead of adding duplicate
                            columnEntries[existingIndexPath4] = __assign(__assign({}, columnEntries[existingIndexPath4]), { span: committedEntry.span, region: committedEntry.region });
                            if (isPaginationDebugEnabled() && shouldDebugComponent(entry.instance.id)) {
                                debugLog(normalizeComponentId(entry.instance.id), '🔄', 'component-trace-updated-instead-of-duplicate-path4', {
                                    componentId: normalizeComponentId(entry.instance.id),
                                    runId: runId,
                                    regionKey: key,
                                    page: page.pageNumber,
                                    column: column.columnNumber,
                                    existingIndex: existingIndexPath4,
                                });
                            }
                        }
                        else {
                            columnEntries.push(committedEntry);
                        }
                        // Mark region as full to prevent subsequent entries from overlapping
                        cursor.currentOffset = regionHeightPx;
                        logPaginationDecision(runId, 'region-full-no-next', {
                            componentId: entry.instance.id,
                            regionKey: key,
                        });
                        return "continue";
                    }
                    if (!ensurePage(pages, updatedNextRegion.pageNumber, columnCount, pendingQueues, runId, 'route-remaining-after-overflow')) {
                        return "break";
                    }
                    var routedNextKey = routeOverflowToNextRegion();
                    var movedRemaining = moveRemainingToRegion(routedNextKey !== null && routedNextKey !== void 0 ? routedNextKey : null);
                    logPaginationDecision(runId, 'route-remaining', {
                        componentId: entry.instance.id,
                        from: key,
                        to: routedNextKey,
                        movedRemaining: movedRemaining,
                    });
                    if (movedRemaining) {
                        return "break";
                    }
                    return "continue";
                }
                // Use splitDecision if available (has accurate measurements)
                // Otherwise fall back to estimate-based splitting
                var items = entry.regionContent.items;
                var remainingItems = [];
                var placedItems = [];
                var placedHeight = 0;
                var metadataOnlyPlacement = (_74 = splitDecision === null || splitDecision === void 0 ? void 0 : splitDecision.metadataOnly) !== null && _74 !== void 0 ? _74 : false;
                if (splitDecision && splitDecision.canPlace) {
                    // Use measured split decision
                    placedItems = splitDecision.placedItems;
                    remainingItems = splitDecision.remainingItems;
                    placedHeight = splitDecision.placedHeight;
                    debugLog(entry.instance.id, '🧮', 'split decision', {
                        runId: runId,
                        placedCount: placedItems.length,
                        remainingCount: remainingItems.length,
                        placedHeight: placedHeight,
                        reason: splitDecision.reason,
                    });
                    logPaginationDecision(runId, 'split-using-measurements', {
                        componentId: entry.instance.id,
                        regionKey: key,
                        placedCount: placedItems.length,
                        remainingCount: remainingItems.length,
                        placedHeight: placedHeight,
                        reason: splitDecision.reason,
                    });
                }
                else {
                    // Fallback: estimate-based splitting (legacy path)
                    var cumulativeHeight_1 = 0;
                    var availableHeight_1 = Math.max(regionHeightPx - cursor.currentOffset, 0);
                    items.forEach(function (item, itemIndex) {
                        var itemHeight = adapters.heightEstimator.estimateItemHeight(item) + (itemIndex > 0 ? LIST_ITEM_SPACING_PX : 0);
                        if (cumulativeHeight_1 + itemHeight <= availableHeight_1 || placedItems.length === 0) {
                            placedItems.push(item);
                            cumulativeHeight_1 += itemHeight;
                        }
                        else {
                            remainingItems.push(item);
                        }
                    });
                    placedHeight = cumulativeHeight_1;
                    logPaginationDecision(runId, 'split-using-estimates', {
                        componentId: entry.instance.id,
                        regionKey: key,
                        placedCount: placedItems.length,
                        remainingCount: remainingItems.length,
                        placedHeight: placedHeight,
                        reason: 'No split decision available',
                    });
                    debugLog(entry.instance.id, '📐', 'estimate split', {
                        runId: runId,
                        placedCount: placedItems.length,
                        remainingCount: remainingItems.length,
                        placedHeight: placedHeight,
                        availableHeight: availableHeight_1,
                    });
                }
                if (placedItems.length === 0 && !metadataOnlyPlacement) {
                    var rerouteKey = (function () {
                        var _a, _b;
                        var candidate = findNextRegion(pages, key);
                        if (!candidate) {
                            var newPageNumber = pages.length + 1;
                            if (!ensurePage(pages, newPageNumber, columnCount, pendingQueues, runId, 'reroute-empty-split')) {
                                return null;
                            }
                            return (_b = (_a = findNextRegion(pages, key)) === null || _a === void 0 ? void 0 : _a.key) !== null && _b !== void 0 ? _b : null;
                        }
                        return candidate.key;
                    })();
                    debugLog(entry.instance.id, '🚚', 'rerouting empty split', {
                        runId: runId,
                        regionKey: key,
                        cursorOffset: cursor.currentOffset,
                        regionHeightPx: regionHeightPx,
                        rerouteKey: rerouteKey,
                    });
                    if (rerouteKey) {
                        var pendingQueue = getPendingQueue(rerouteKey);
                        pendingQueue.push(__assign(__assign({}, entry), { overflow: true, overflowRouted: true, sourceRegionKey: rerouteKey }));
                        routedInRegion.add("".concat(entry.instance.id, ":").concat(rerouteKey));
                    }
                    else {
                        // Phase 4.8: Empty Split Placement Tracking
                        if (isPaginationDebugEnabled() && shouldDebugComponent(entry.instance.id)) {
                            debugLog(normalizeComponentId(entry.instance.id), '📦', 'component-trace-empty-split-place', {
                                componentId: normalizeComponentId(entry.instance.id),
                                runId: runId,
                                regionKey: key,
                                page: page.pageNumber,
                                column: column.columnNumber,
                                spanTop: span.top,
                                spanBottom: span.bottom,
                                componentCountBefore: columnEntries.filter(function (e) { return e.instance.id === entry.instance.id; }).length,
                            });
                        }
                        // Fix 1: Check for duplicate before adding (Path 5: Fallback entry placement)
                        var fallbackEntry = __assign(__assign({}, entry), { region: {
                                page: page.pageNumber,
                                column: column.columnNumber,
                                index: columnEntries.length,
                            }, span: span });
                        var existingIndexPath5 = findExistingEntry(entry, columnEntries, page.pageNumber, column.columnNumber);
                        if (existingIndexPath5 >= 0) {
                            // Update existing entry instead of adding duplicate
                            columnEntries[existingIndexPath5] = __assign(__assign({}, columnEntries[existingIndexPath5]), { span: fallbackEntry.span, region: fallbackEntry.region });
                            if (isPaginationDebugEnabled() && shouldDebugComponent(entry.instance.id)) {
                                debugLog(normalizeComponentId(entry.instance.id), '🔄', 'component-trace-updated-instead-of-duplicate-path5', {
                                    componentId: normalizeComponentId(entry.instance.id),
                                    runId: runId,
                                    regionKey: key,
                                    page: page.pageNumber,
                                    column: column.columnNumber,
                                    existingIndex: existingIndexPath5,
                                });
                            }
                        }
                        else {
                            columnEntries.push(fallbackEntry);
                        }
                        logPaginationDecision(runId, 'region-full-no-next', {
                            componentId: entry.instance.id,
                            regionKey: key,
                            overflow: true,
                        });
                        cursor.currentOffset = regionHeightPx;
                    }
                    return "continue";
                }
                var placedContent = toRegionContent(entry.regionContent.kind, placedItems, entry.regionContent.startIndex, entry.regionContent.totalCount, entry.regionContent.isContinuation, entry.regionContent.metadata);
                var hasContinuation = remainingItems.length > 0;
                var hadOverflow = (_75 = entry.overflow) !== null && _75 !== void 0 ? _75 : false;
                var willClearOverflow = hadOverflow && !hasContinuation;
                var placedEntry = __assign(__assign({}, entry), { regionContent: placedContent, measurementKey: computeMeasurementKey(entry.instance.id, placedContent), region: {
                        page: page.pageNumber,
                        column: column.columnNumber,
                        index: columnEntries.length,
                    }, estimatedHeight: placedHeight, span: computeSpan(cursor, placedHeight), overflow: hasContinuation ? true : false, overflowRouted: hasContinuation ? (_76 = entry.overflowRouted) !== null && _76 !== void 0 ? _76 : false : false, listContinuation: {
                        isContinuation: placedContent.isContinuation,
                        startIndex: placedContent.startIndex,
                        totalCount: placedContent.totalCount,
                    }, sourceRegionKey: column.key });
                // Phase 4.9: Placed Entry from Split Tracking
                if (isPaginationDebugEnabled() && shouldDebugComponent(entry.instance.id)) {
                    debugLog(normalizeComponentId(entry.instance.id), '📋', 'component-trace-placed-entry-from-split', {
                        componentId: normalizeComponentId(entry.instance.id),
                        runId: runId,
                        regionKey: key,
                        page: page.pageNumber,
                        column: column.columnNumber,
                        spanTop: (_77 = placedEntry.span) === null || _77 === void 0 ? void 0 : _77.top,
                        spanBottom: (_78 = placedEntry.span) === null || _78 === void 0 ? void 0 : _78.bottom,
                        componentCountBefore: columnEntries.filter(function (e) { return e.instance.id === entry.instance.id; }).length,
                        placedEntryRegion: placedEntry.region,
                    });
                }
                // Filter out entries with 0 items - components return null for empty items
                // EXCEPTION: Metadata entries (spell-list-metadata, etc.) render title/description without items
                var isMetadataEntry = (_81 = (_80 = (_79 = entry.regionContent) === null || _79 === void 0 ? void 0 : _79.kind) === null || _80 === void 0 ? void 0 : _80.includes('metadata')) !== null && _81 !== void 0 ? _81 : false;
                if (placedItems.length === 0 && !isMetadataEntry) {
                    debugLog(entry.instance.id, '⏭️', 'skipping empty entry', {
                        runId: runId,
                        regionKey: key,
                        reason: 'Component returns null for empty items - would create zero-height entry',
                        metadataOnly: metadataOnlyPlacement,
                        kind: (_83 = (_82 = entry.regionContent) === null || _82 === void 0 ? void 0 : _82.kind) !== null && _83 !== void 0 ? _83 : 'N/A',
                    });
                    // Don't create entry, but still advance cursor if metadata was placed (CSS gap handles spacing)
                    if (metadataOnlyPlacement && placedHeight > 0) {
                        cursor.currentOffset += placedHeight;
                    }
                    return "continue";
                }
                // Allow metadata entries to proceed even with 0 items
                if (placedItems.length === 0 && isMetadataEntry) {
                    debugLog(entry.instance.id, '✅', 'metadata-entry-with-zero-items', {
                        runId: runId,
                        regionKey: key,
                        reason: 'Metadata renders without items (title/description)',
                        kind: (_84 = entry.regionContent) === null || _84 === void 0 ? void 0 : _84.kind,
                        placedHeight: placedHeight,
                    });
                }
                // Fix 1: Check for duplicate before adding (Path 6: Placed entry from split)
                var existingIndexPath6 = findExistingEntry(entry, columnEntries, page.pageNumber, column.columnNumber);
                if (existingIndexPath6 >= 0) {
                    // Update existing entry instead of adding duplicate
                    columnEntries[existingIndexPath6] = __assign(__assign({}, columnEntries[existingIndexPath6]), { span: placedEntry.span, region: placedEntry.region });
                    if (isPaginationDebugEnabled() && shouldDebugComponent(entry.instance.id)) {
                        debugLog(normalizeComponentId(entry.instance.id), '🔄', 'component-trace-updated-instead-of-duplicate-path6', {
                            componentId: normalizeComponentId(entry.instance.id),
                            runId: runId,
                            regionKey: key,
                            page: page.pageNumber,
                            column: column.columnNumber,
                            existingIndex: existingIndexPath6,
                        });
                    }
                }
                else {
                    columnEntries.push(placedEntry);
                }
                advanceCursor(cursor, placedEntry.span);
                debugLog(entry.instance.id, '📦', 'placed segment', {
                    runId: runId,
                    regionKey: key,
                    measurementKey: placedEntry.measurementKey,
                    span: placedEntry.span,
                    cursorOffset: cursor.currentOffset,
                    remainingItems: remainingItems.length,
                    overflow: (_85 = placedEntry.overflow) !== null && _85 !== void 0 ? _85 : false,
                    overflowRouted: (_86 = placedEntry.overflowRouted) !== null && _86 !== void 0 ? _86 : false,
                    clearedOverflow: willClearOverflow,
                });
                if (remainingItems.length > 0) {
                    if (!nextRegion) {
                        var newPageNumber = pages.length + 1;
                        if (!ensurePage(pages, newPageNumber, columnCount, pendingQueues, runId, 'split-remaining-no-next-region')) {
                            // Hit MAX_PAGES limit, mark as overflow and stop
                            columnEntries[columnEntries.length - 1] = __assign(__assign({}, columnEntries[columnEntries.length - 1]), { overflow: true });
                            debugLog(entry.instance.id, '🚨', 'forced overflow on placed segment (no next region)', {
                                runId: runId,
                                regionKey: key,
                                columnLength: columnEntries.length,
                            });
                            return "continue";
                        }
                    }
                    var updatedNextRegion = findNextRegion(pages, key);
                    if (!updatedNextRegion) {
                        columnEntries[columnEntries.length - 1] = __assign(__assign({}, columnEntries[columnEntries.length - 1]), { overflow: true });
                        debugLog(entry.instance.id, '🚨', 'forced overflow on placed segment (missing updated region)', {
                            runId: runId,
                            regionKey: key,
                            columnLength: columnEntries.length,
                        });
                        return "continue";
                    }
                    if (!ensurePage(pages, updatedNextRegion.pageNumber, columnCount, pendingQueues, runId, 'split-remaining-route-to-next')) {
                        // Hit MAX_PAGES limit, mark as overflow and stop
                        columnEntries[columnEntries.length - 1] = __assign(__assign({}, columnEntries[columnEntries.length - 1]), { overflow: true });
                        debugLog(entry.instance.id, '🚨', 'forced overflow on placed segment (ensurePage failed)', {
                            runId: runId,
                            regionKey: key,
                            columnLength: columnEntries.length,
                        });
                        return "continue";
                    }
                    var followUpContent = toRegionContent(entry.regionContent.kind, remainingItems, entry.regionContent.startIndex + placedItems.length, entry.regionContent.totalCount, true, metadataOnlyPlacement ? undefined : entry.regionContent.metadata);
                    var followUpEntry = __assign(__assign({}, entry), { regionContent: followUpContent, measurementKey: computeMeasurementKey(entry.instance.id, followUpContent), estimatedHeight: adapters.heightEstimator.estimateListHeight(remainingItems, true), span: undefined, overflow: true, overflowRouted: true, region: {
                            page: updatedNextRegion.pageNumber,
                            column: updatedNextRegion.columnNumber,
                        }, sourceRegionKey: updatedNextRegion.key, listContinuation: {
                            isContinuation: followUpContent.isContinuation,
                            startIndex: followUpContent.startIndex,
                            totalCount: followUpContent.totalCount,
                        } });
                    var pendingQueue = getPendingQueue(updatedNextRegion.key);
                    pendingQueue.push(followUpEntry);
                    debugLog(entry.instance.id, '📬', 'queued continuation segment', {
                        runId: runId,
                        fromRegion: key,
                        toRegion: updatedNextRegion.key,
                        remainingCount: remainingItems.length,
                        estimatedHeight: followUpEntry.estimatedHeight,
                        overflow: (_87 = followUpEntry.overflow) !== null && _87 !== void 0 ? _87 : false,
                        overflowRouted: (_88 = followUpEntry.overflowRouted) !== null && _88 !== void 0 ? _88 : false,
                    });
                }
            };
            while (regionQueue.length > 0 && safetyCounter < MAX_REGION_ITERATIONS) {
                var state_1 = _loop_4();
                if (state_1 === "break")
                    break;
            }
            // Phase 6: Column Commit Tracking
            if (isPaginationDebugEnabled()) {
                var debugEntries = columnEntries.filter(function (e) { return shouldDebugComponent(e.instance.id); });
                debugEntries.forEach(function (debugEntry) {
                    var sameComponentEntries = columnEntries.filter(function (e) { return e.instance.id === debugEntry.instance.id; });
                    debugLog(normalizeComponentId(debugEntry.instance.id), '💾', 'component-trace-column-commit', {
                        componentId: normalizeComponentId(debugEntry.instance.id),
                        runId: runId,
                        regionKey: key,
                        page: page.pageNumber,
                        column: column.columnNumber,
                        componentCount: sameComponentEntries.length,
                        componentEntries: sameComponentEntries.map(function (e) {
                            var _a, _b, _c, _d, _e;
                            return ({
                                page: (_a = e.region) === null || _a === void 0 ? void 0 : _a.page,
                                column: (_b = e.region) === null || _b === void 0 ? void 0 : _b.column,
                                spanTop: (_c = e.span) === null || _c === void 0 ? void 0 : _c.top,
                                spanBottom: (_d = e.span) === null || _d === void 0 ? void 0 : _d.bottom,
                                spanHeight: (_e = e.span) === null || _e === void 0 ? void 0 : _e.height,
                            });
                        }),
                        hasDuplicates: sameComponentEntries.length > 1,
                        duplicatesInThisRegion: sameComponentEntries.filter(function (e) {
                            var _a, _b;
                            return ((_a = e.region) === null || _a === void 0 ? void 0 : _a.page) === page.pageNumber &&
                                ((_b = e.region) === null || _b === void 0 ? void 0 : _b.column) === column.columnNumber;
                        }).length,
                        // Show position in columnEntries array
                        indices: columnEntries
                            .map(function (e, idx) { return ({ idx: idx, entry: e }); })
                            .filter(function (_a) {
                            var entry = _a.entry;
                            return entry.instance.id === debugEntry.instance.id;
                        })
                            .map(function (_a) {
                            var idx = _a.idx;
                            return idx;
                        }),
                    });
                });
            }
            // Debug: Log columnEntries before assignment to column.entries (gated behind plan-commit flag)
            if (isPaginationDebugEnabled() && isDebugEnabled('plan-commit') && columnEntries.some(function (e) { return e.instance.id === 'component-05' || e.instance.id === 'component-5'; })) {
                var component05InColumnEntries = columnEntries.find(function (e) { return e.instance.id === 'component-05' || e.instance.id === 'component-5'; });
                logPaginationDecision(runId, 'column-entries-before-assignment', {
                    regionKey: key,
                    page: page.pageNumber,
                    column: column.columnNumber,
                    columnEntriesCount: columnEntries.length,
                    component05Found: !!component05InColumnEntries,
                    component05Details: component05InColumnEntries ? {
                        id: component05InColumnEntries.instance.id,
                        spanTop: (_89 = component05InColumnEntries.span) === null || _89 === void 0 ? void 0 : _89.top,
                        spanBottom: (_90 = component05InColumnEntries.span) === null || _90 === void 0 ? void 0 : _90.bottom,
                        region: component05InColumnEntries.region,
                    } : null,
                    allEntryIds: columnEntries.map(function (e) { return e.instance.id; }),
                });
            }
            column.entries = columnEntries;
            var lastSpan = columnEntries.length > 0 ? (_91 = columnEntries[columnEntries.length - 1].span) !== null && _91 !== void 0 ? _91 : null : null;
            var usedHeight = lastSpan ? lastSpan.bottom : 0;
            var availableHeight = Math.max(regionHeightPx - usedHeight, 0);
            column.usedHeightPx = Number(usedHeight.toFixed(2));
            column.availableHeightPx = Number(availableHeight.toFixed(2));
            if (debugQueueEntry) {
                debugLog(debugQueueEntry.instance.id, '📊', 'column-settled', {
                    runId: runId,
                    regionKey: key,
                    page: page.pageNumber,
                    column: column.columnNumber,
                    entryCount: columnEntries.length,
                    usedHeight: column.usedHeightPx,
                    availableHeight: column.availableHeightPx,
                    cursorOffset: Number(cursor.currentOffset.toFixed(2)),
                    regionHeightPx: regionHeightPx,
                });
            }
            processedBuckets.set(key, columnEntries);
        };
        for (var columnIndex = 0; columnIndex < page.columns.length; columnIndex += 1) {
            _loop_3(columnIndex);
        }
    };
    for (var pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
        _loop_1(pageIndex);
    }
    // Report stats for observability (development only)
    // Disabled by default - enable via debug flag (see debugFlags.ts)
    if (shouldLogPaginationDecisions() && paginationStats.componentsPlaced > 0) {
        var total = paginationStats.heightSources.measured +
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
        var debugPlacements_1 = [];
        pages.forEach(function (page) {
            page.columns.forEach(function (column) {
                column.entries.forEach(function (entry) {
                    var _a, _b, _c, _d, _e, _f, _g, _h;
                    if (shouldDebugComponent(entry.instance.id)) {
                        debugPlacements_1.push({
                            componentId: entry.instance.id,
                            measurementKey: entry.measurementKey,
                            page: page.pageNumber,
                            column: column.columnNumber,
                            index: (_b = (_a = entry.region) === null || _a === void 0 ? void 0 : _a.index) !== null && _b !== void 0 ? _b : null,
                            overflow: (_c = entry.overflow) !== null && _c !== void 0 ? _c : false,
                            overflowRouted: (_d = entry.overflowRouted) !== null && _d !== void 0 ? _d : false,
                            continuation: (_f = (_e = entry.listContinuation) === null || _e === void 0 ? void 0 : _e.isContinuation) !== null && _f !== void 0 ? _f : false,
                            startIndex: (_g = entry.listContinuation) === null || _g === void 0 ? void 0 : _g.startIndex,
                            totalCount: (_h = entry.listContinuation) === null || _h === void 0 ? void 0 : _h.totalCount,
                        });
                    }
                });
            });
        });
        if (debugPlacements_1.length > 0) {
            logPaginationTrace('📄', 'placement summary', {
                runId: runId,
                entries: debugPlacements_1,
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
    return { pages: pages, overflowWarnings: overflowWarnings };
};
