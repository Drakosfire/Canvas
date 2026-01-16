import { toRegionContent } from './utils-generic';
export var PX_PER_INCH = 96;
export var MM_PER_INCH = 25.4;
export var MEASUREMENT_TOLERANCE_PX = 0.5;
export var MEASUREMENT_THROTTLE_MS = 150;
export var DEFAULT_PAGE_TOP_MARGIN_MM = 10;
export var DEFAULT_PAGE_BOTTOM_MARGIN_MM = 10;
export var COMPONENT_VERTICAL_SPACING_PX = 12; // Reduced from 18px for tighter layout
export var LIST_ITEM_SPACING_PX = 8; // Reduced from 12px for tighter layout
export var COLUMN_PADDING_PX = 8; // Matches CSS padding on .canvas-column
export var DEFAULT_COMPONENT_HEIGHT_PX = 200;
// Action-specific height constants removed - now provided by adapters
// Applications can implement their own height estimation in HeightEstimator adapter
export var regionKey = function (page, column) { return "".concat(page, ":").concat(column); };
export var convertToPixels = function (value, unit) {
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
export var computeBasePageDimensions = function (pageVariables, topMarginMm, bottomMarginMm) {
    var _a, _b, _c, _d;
    if (topMarginMm === void 0) { topMarginMm = DEFAULT_PAGE_TOP_MARGIN_MM; }
    if (bottomMarginMm === void 0) { bottomMarginMm = DEFAULT_PAGE_BOTTOM_MARGIN_MM; }
    var effectiveTopMarginMm = (_b = (_a = pageVariables.margins) === null || _a === void 0 ? void 0 : _a.topMm) !== null && _b !== void 0 ? _b : topMarginMm;
    var effectiveBottomMarginMm = (_d = (_c = pageVariables.margins) === null || _c === void 0 ? void 0 : _c.bottomMm) !== null && _d !== void 0 ? _d : bottomMarginMm;
    var widthPx = convertToPixels(pageVariables.dimensions.width, pageVariables.dimensions.unit);
    var heightPx = convertToPixels(pageVariables.dimensions.height, pageVariables.dimensions.unit);
    var topMarginPx = convertToPixels(effectiveTopMarginMm, 'mm');
    var bottomMarginPx = convertToPixels(effectiveBottomMarginMm, 'mm');
    var contentHeightPx = Math.max(0, heightPx - (topMarginPx + bottomMarginPx));
    return {
        widthPx: widthPx,
        heightPx: heightPx,
        contentHeightPx: contentHeightPx,
        topMarginPx: topMarginPx,
        bottomMarginPx: bottomMarginPx,
    };
};
/**
 * Compute all Canvas dimensions from a CanvasConfig.
 * This is the single source of truth for all layout dimensions.
 *
 * Consumer should NOT calculate these values - Canvas owns this calculation.
 *
 * @param config - The CanvasConfig provided by the consumer
 * @returns All calculated dimensions needed for layout and measurement
 */
export var computeCanvasDimensions = function (config) {
    var _a, _b, _c, _d, _e, _f;
    var pageVariables = config.pageVariables, frameConfig = config.frameConfig;
    // Base page dimensions from pageVariables
    var baseDims = computeBasePageDimensions(pageVariables);
    // Margins
    var leftMarginPx = convertToPixels((_b = (_a = pageVariables.margins) === null || _a === void 0 ? void 0 : _a.leftMm) !== null && _b !== void 0 ? _b : 0, 'mm');
    var rightMarginPx = convertToPixels((_d = (_c = pageVariables.margins) === null || _c === void 0 ? void 0 : _c.rightMm) !== null && _d !== void 0 ? _d : 0, 'mm');
    // Content width (page minus horizontal margins)
    var contentWidthPx = baseDims.widthPx - leftMarginPx - rightMarginPx;
    // Column calculations
    var columnCount = pageVariables.pagination.columnCount;
    var columnGapPx = convertToPixels(pageVariables.columns.gutter, pageVariables.columns.unit);
    var totalGaps = (columnCount - 1) * columnGapPx;
    var columnWidthPx = Math.max(0, (contentWidthPx - totalGaps) / columnCount);
    // Region height (content minus frame borders)
    var frameBorderPx = (_e = frameConfig === null || frameConfig === void 0 ? void 0 : frameConfig.verticalBorderPx) !== null && _e !== void 0 ? _e : 0;
    var regionHeightPx = Math.max(0, baseDims.contentHeightPx - frameBorderPx);
    // Entry width (column minus padding for measurement layer)
    var columnPaddingPx = (_f = frameConfig === null || frameConfig === void 0 ? void 0 : frameConfig.columnPaddingPx) !== null && _f !== void 0 ? _f : 0;
    var entryWidthPx = Math.max(0, columnWidthPx - columnPaddingPx);
    return {
        pageWidthPx: baseDims.widthPx,
        pageHeightPx: baseDims.heightPx,
        contentWidthPx: contentWidthPx,
        contentHeightPx: baseDims.contentHeightPx,
        columnWidthPx: columnWidthPx,
        columnGapPx: columnGapPx,
        regionHeightPx: regionHeightPx,
        entryWidthPx: entryWidthPx,
        leftMarginPx: leftMarginPx,
        rightMarginPx: rightMarginPx,
        topMarginPx: baseDims.topMarginPx,
        bottomMarginPx: baseDims.bottomMarginPx,
    };
};
/**
 * Create default FrameConfig with zero values.
 * Used when consumer doesn't provide frameConfig.
 */
export var createDefaultFrameConfig = function () { return ({
    verticalBorderPx: 0,
    horizontalBorderPx: 0,
    columnPaddingPx: 0,
    columnVerticalPaddingPx: 0,
    componentGapPx: COMPONENT_VERTICAL_SPACING_PX,
}); };
export var toColumnType = function (column) { return (column <= 1 ? 1 : 2); };
export var clamp = function (value, min, max) { return Math.min(Math.max(value, min), max); };
export var buildSlotOrder = function (template) {
    var order = new Map();
    template.slots.forEach(function (slot, index) {
        order.set(slot.id, index);
    });
    return order;
};
export var computeMeasurementKey = function (instanceId, regionContent) {
    if (!regionContent) {
        return "".concat(instanceId, ":block");
    }
    return "".concat(instanceId, ":").concat(regionContent.kind, ":").concat(regionContent.startIndex, ":").concat(regionContent.items.length, ":").concat(regionContent.totalCount, ":").concat(regionContent.isContinuation ? 'cont' : 'base');
};
export var inferColumnFromPosition = function (position, columnCount, pageWidthPx) {
    var _a, _b;
    if (!position || columnCount <= 1 || pageWidthPx <= 0) {
        return 1;
    }
    var columnWidth = pageWidthPx / columnCount;
    var x = (_a = position.x) !== null && _a !== void 0 ? _a : 0;
    var width = (_b = position.width) !== null && _b !== void 0 ? _b : columnWidth;
    var midpoint = x + width / 2;
    var columnIndex = Math.ceil(midpoint / columnWidth);
    var clampedColumn = clamp(columnIndex, 1, columnCount);
    return (clampedColumn === 1 ? 1 : 2);
};
export var resolveLocation = function (instance, template, columnCount, pageWidthPx) {
    var _a;
    var explicit = instance.layout.location;
    if (explicit) {
        return {
            page: Math.max(1, explicit.page),
            column: columnCount === 1 ? 1 : clamp(explicit.column, 1, columnCount),
        };
    }
    var slot = template.slots.find(function (slotEntry) { return slotEntry.id === instance.layout.slotId; });
    var inferredColumn = inferColumnFromPosition((_a = instance.layout.position) !== null && _a !== void 0 ? _a : slot === null || slot === void 0 ? void 0 : slot.position, columnCount, pageWidthPx);
    return { page: 1, column: columnCount === 1 ? 1 : inferredColumn };
};
export var buildBuckets = function (_a) {
    var instances = _a.instances, template = _a.template, columnCount = _a.columnCount, pageWidthPx = _a.pageWidthPx, dataSources = _a.dataSources, measurements = _a.measurements, assignedRegions = _a.assignedRegions, adapters = _a.adapters;
    var slotOrder = buildSlotOrder(template);
    var buckets = new Map();
    if (process.env.NODE_ENV !== 'production') {
        console.log('[buildBuckets] Building buckets:', {
            instanceCount: instances.length,
            dataSourceCount: dataSources.length,
            hasTemplate: !!template,
            columnCount: columnCount,
        });
    }
    instances.forEach(function (instance, index) {
        var _a, _b;
        var persisted = assignedRegions === null || assignedRegions === void 0 ? void 0 : assignedRegions.get(instance.id);
        var resolvedHomeRaw = resolveLocation(instance, template, columnCount, pageWidthPx);
        var resolvedHome = {
            page: Math.max(1, resolvedHomeRaw.page),
            column: columnCount === 1 ? 1 : clamp(resolvedHomeRaw.column, 1, columnCount),
        };
        var baseLocation = persisted ? persisted.homeRegion : resolvedHome;
        var slotIndex = instance.layout.slotId ? (_a = slotOrder.get(instance.layout.slotId)) !== null && _a !== void 0 ? _a : Number.MAX_SAFE_INTEGER : Number.MAX_SAFE_INTEGER;
        var slotDimensions = slotDimensionLookup(template, instance.layout.slotId);
        var homeKey = regionKey(resolvedHome.page, resolvedHome.column);
        var listKind = adapters.componentTypeMap[instance.type];
        if (listKind) {
            // Resolve data using adapter - fully generic, no statblock-specific logic
            var resolved = adapters.dataResolver.resolveDataReference(dataSources, instance.dataRef);
            // Normalize items using adapter
            // Adapter is responsible for:
            // - Handling nested structures (e.g., legendaryActions.actions)
            // - Combining multiple arrays (e.g., cantrips + knownSpells)
            // - Adding default IDs if missing
            var itemsSource = adapters.listNormalizer.normalizeListItems(resolved);
            if (itemsSource.length === 0) {
                // No data for this list component – skip adding a placeholder entry so the
                // pagination plan stays in sync with what React actually renders.
                return;
            }
            var totalCount_1 = itemsSource.length;
            var segments_1 = new Map();
            itemsSource.forEach(function (item, itemIndex) {
                if (!item || typeof item !== 'object')
                    return;
                var itemLocation = 'location' in item && typeof item.location === 'object' && item.location !== null
                    ? item.location
                    : undefined;
                var location = itemLocation && typeof itemLocation.page === 'number' && typeof itemLocation.column === 'number'
                    ? {
                        page: Math.max(1, itemLocation.page),
                        column: columnCount === 1 ? 1 : clamp(itemLocation.column, 1, columnCount),
                    }
                    : baseLocation;
                var key = regionKey(location.page, location.column);
                if (!segments_1.has(key)) {
                    segments_1.set(key, { items: [], startIndex: itemIndex });
                }
                segments_1.get(key).items.push(item);
            });
            // Extract summary metadata from resolved data (if present)
            // Adapter is responsible for including metadata in resolved data structure
            // Examples: { description: "...", actionsPerTurn: 3, actions: [...] }
            var summaryMetadata_1 = resolved && typeof resolved === 'object' && !Array.isArray(resolved)
                ? resolved
                : undefined;
            var hasSummaryMetadata_1 = !!summaryMetadata_1 && Object.keys(summaryMetadata_1).length > 0;
            var metadataKind_1 = "".concat(listKind, "-metadata");
            var metadataEntriesAdded_1 = new Set();
            segments_1.forEach(function (segment, key) {
                var _a, _b;
                var _c = key.split(':'), pagePart = _c[0], columnPart = _c[1];
                var parsedPage = Number.parseInt(pagePart, 10);
                var parsedColumn = Number.parseInt(columnPart, 10);
                var pageNumber = Number.isNaN(parsedPage) ? baseLocation.page : parsedPage;
                var columnNumber = Number.isNaN(parsedColumn) ? baseLocation.column : toColumnType(parsedColumn);
                if (hasSummaryMetadata_1 && segment.startIndex === 0 && !metadataEntriesAdded_1.has(key)) {
                    var metadataContent = toRegionContent(metadataKind_1, [], 0, totalCount_1, false, summaryMetadata_1);
                    var metadataMeasurementKey = computeMeasurementKey(instance.id, metadataContent);
                    var metadataRecord = measurements.get(metadataMeasurementKey);
                    var metadataEntry = {
                        instance: instance,
                        slotIndex: slotIndex,
                        orderIndex: index - 0.5,
                        sourceRegionKey: key,
                        region: {
                            page: pageNumber,
                            column: columnNumber,
                        },
                        homeRegion: resolvedHome,
                        homeRegionKey: homeKey,
                        regionContent: metadataContent,
                        estimatedHeight: (_a = metadataRecord === null || metadataRecord === void 0 ? void 0 : metadataRecord.height) !== null && _a !== void 0 ? _a : adapters.heightEstimator.estimateComponentHeight(summaryMetadata_1),
                        measurementKey: metadataMeasurementKey,
                        needsMeasurement: !metadataRecord,
                        span: metadataRecord ? { top: 0, bottom: metadataRecord.height, height: metadataRecord.height } : undefined,
                        slotDimensions: slotDimensions,
                    };
                    if (!buckets.has(key)) {
                        buckets.set(key, []);
                    }
                    buckets.get(key).push(metadataEntry);
                    metadataEntriesAdded_1.add(key);
                }
                var regionContent = toRegionContent(listKind, segment.items, segment.startIndex, totalCount_1, segment.startIndex > 0, undefined);
                var measurementKey = computeMeasurementKey(instance.id, regionContent);
                var record = measurements.get(measurementKey);
                var entry = {
                    instance: instance,
                    slotIndex: slotIndex,
                    orderIndex: index,
                    sourceRegionKey: key,
                    region: {
                        page: pageNumber,
                        column: columnNumber,
                    },
                    homeRegion: resolvedHome,
                    homeRegionKey: homeKey,
                    regionContent: regionContent,
                    estimatedHeight: (_b = record === null || record === void 0 ? void 0 : record.height) !== null && _b !== void 0 ? _b : adapters.heightEstimator.estimateListHeight(segment.items, segment.startIndex > 0),
                    measurementKey: measurementKey,
                    needsMeasurement: !record,
                    // CRITICAL FIX: Do NOT set span during creation
                    // span.top and span.bottom should only be set when entry is placed in a column (via computeSpan)
                    // Setting span.top = 0 causes overflow detection to fail because entryTop becomes 0
                    // Height is already stored in estimatedHeight, so we don't need span.height during creation
                    span: undefined,
                    slotDimensions: slotDimensions,
                    listContinuation: {
                        isContinuation: segment.startIndex > 0,
                        startIndex: segment.startIndex,
                        totalCount: totalCount_1,
                    },
                };
                if (!buckets.has(key)) {
                    buckets.set(key, []);
                }
                buckets.get(key).push(entry);
            });
            return;
        }
        var key = regionKey(baseLocation.page, baseLocation.column);
        var measurementKey = computeMeasurementKey(instance.id);
        var record = measurements.get(measurementKey);
        var entry = {
            instance: instance,
            slotIndex: slotIndex,
            orderIndex: index,
            sourceRegionKey: key,
            region: baseLocation,
            homeRegion: resolvedHome,
            homeRegionKey: homeKey,
            measurementKey: measurementKey,
            estimatedHeight: (_b = record === null || record === void 0 ? void 0 : record.height) !== null && _b !== void 0 ? _b : DEFAULT_COMPONENT_HEIGHT_PX,
            needsMeasurement: !record,
            // CRITICAL FIX: Do NOT set span during creation
            // span.top and span.bottom should only be set when entry is placed in a column (via computeSpan)
            // Setting span.top = 0 causes overflow detection to fail because entryTop becomes 0
            // Height is already stored in estimatedHeight, so we don't need span.height during creation
            span: undefined,
            slotDimensions: slotDimensions,
        };
        if (!buckets.has(key)) {
            buckets.set(key, []);
        }
        buckets.get(key).push(entry);
    });
    buckets.forEach(function (entries) {
        entries.sort(function (a, b) {
            if (a.slotIndex !== b.slotIndex)
                return a.slotIndex - b.slotIndex;
            return a.orderIndex - b.orderIndex;
        });
    });
    if (process.env.NODE_ENV !== 'production') {
        var bucketKeys = Array.from(buckets.keys());
        var bucketSizes = bucketKeys.map(function (key) {
            var _a, _b;
            return ({
                key: key,
                entryCount: (_b = (_a = buckets.get(key)) === null || _a === void 0 ? void 0 : _a.length) !== null && _b !== void 0 ? _b : 0,
            });
        });
        console.log('[buildBuckets] Built buckets:', {
            bucketCount: buckets.size,
            bucketSizes: bucketSizes,
            totalEntries: bucketSizes.reduce(function (sum, b) { return sum + b.entryCount; }, 0),
        });
    }
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
export var createInitialMeasurementEntries = function (_a) {
    var instances = _a.instances, template = _a.template, columnCount = _a.columnCount, pageWidthPx = _a.pageWidthPx, dataSources = _a.dataSources, adapters = _a.adapters;
    var entries = [];
    var slotOrder = buildSlotOrder(template);
    instances.forEach(function (instance, index) {
        var _a;
        var slotDimensions = slotDimensionLookup(template, instance.layout.slotId);
        var slotIndex = instance.layout.slotId
            ? (_a = slotOrder.get(instance.layout.slotId)) !== null && _a !== void 0 ? _a : Number.MAX_SAFE_INTEGER
            : Number.MAX_SAFE_INTEGER;
        // Determine home region for this component
        var resolvedHomeRaw = resolveLocation(instance, template, columnCount, pageWidthPx);
        var homeRegion = {
            page: Math.max(1, resolvedHomeRaw.page),
            column: toColumnType(resolvedHomeRaw.column),
        };
        var homeKey = regionKey(homeRegion.page, homeRegion.column);
        var listKind = adapters.componentTypeMap[instance.type];
        // For list components, generate split measurements (including full list)
        // For non-list components, create basic block measurement
        if (listKind) {
            // Resolve data using adapter - fully generic, no statblock-specific logic
            var resolved = adapters.dataResolver.resolveDataReference(dataSources, instance.dataRef);
            // Normalize items using adapter (same logic as buildBuckets)
            var itemsSource = adapters.listNormalizer.normalizeListItems(resolved);
            var totalCount = itemsSource.length;
            if (totalCount === 0) {
                return; // Skip this instance, move to next
            }
            // Generate summary metadata for first-segment measurements
            // Adapter is responsible for including metadata in resolved data structure
            var summaryMetadata = resolved && typeof resolved === 'object' && !Array.isArray(resolved)
                ? resolved
                : undefined;
            var hasSummaryMetadata = !!summaryMetadata && Object.keys(summaryMetadata).length > 0;
            var metadataKind = "".concat(listKind, "-metadata");
            if (hasSummaryMetadata) {
                var metadataContent = toRegionContent(metadataKind, [], 0, totalCount, false, summaryMetadata);
                var metadataMeasurementKey = computeMeasurementKey(instance.id, metadataContent);
                entries.push({
                    instance: instance,
                    slotIndex: slotIndex,
                    orderIndex: index - 0.5,
                    sourceRegionKey: homeKey,
                    region: homeRegion,
                    homeRegion: homeRegion,
                    homeRegionKey: homeKey,
                    regionContent: metadataContent,
                    estimatedHeight: adapters.heightEstimator.estimateComponentHeight(summaryMetadata),
                    measurementKey: metadataMeasurementKey,
                    needsMeasurement: true,
                    slotDimensions: slotDimensions,
                });
            }
            // Generate split measurements for each possible split point
            // Example: For 14 spells, generate measurements for 1, 2, 3, ..., 14 items
            // IMPORTANT: Generate ALL splits including the full list (splitAt === totalCount)
            // because pagination needs the full list measurement key (e.g., "component-12:spell-list:0:14:14")
            for (var splitAt = 1; splitAt <= totalCount; splitAt++) {
                var items = itemsSource.slice(0, splitAt);
                var isContinuation = false; // Initial splits are never continuations
                var regionContent = toRegionContent(listKind, items, 0, // startIndex
                totalCount, isContinuation, undefined);
                var splitMeasurementKey = computeMeasurementKey(instance.id, regionContent);
                entries.push({
                    instance: instance,
                    slotIndex: slotIndex,
                    orderIndex: index,
                    sourceRegionKey: homeKey,
                    region: homeRegion,
                    homeRegion: homeRegion,
                    homeRegionKey: homeKey,
                    regionContent: regionContent,
                    estimatedHeight: adapters.heightEstimator.estimateListHeight(items, isContinuation),
                    measurementKey: splitMeasurementKey,
                    needsMeasurement: true,
                    slotDimensions: slotDimensions,
                });
            }
            // Generate continuation measurements (Phase 1: Strategic Continuations)
            // For lists that span multiple columns, we need measurements for continuations
            // (segments that start at index > 0)
            // Strategy: Generate shallow continuations for common split patterns
            // - Covers startIndex 1-5 (most common continuation points)
            // - Generates all possible count values from each startIndex
            // Example: 14 spells with startIndex=1 generates: (1,1), (1,2), ..., (1,13)
            var MAX_CONTINUATION_START_INDEX = Math.min(5, totalCount - 1);
            for (var startIdx = 1; startIdx <= MAX_CONTINUATION_START_INDEX; startIdx++) {
                var remainingCount = totalCount - startIdx;
                // Generate measurements for all possible continuation lengths from this start point
                for (var count = 1; count <= remainingCount; count++) {
                    var items = itemsSource.slice(startIdx, startIdx + count);
                    var isContinuation = true; // These are continuations
                    // Continuations don't include summary metadata (no intro paragraphs)
                    var regionContent = toRegionContent(listKind, items, startIdx, // startIndex for continuation
                    totalCount, isContinuation, undefined // No metadata for continuations
                    );
                    var splitMeasurementKey = computeMeasurementKey(instance.id, regionContent);
                    entries.push({
                        instance: instance,
                        slotIndex: slotIndex,
                        orderIndex: index,
                        sourceRegionKey: homeKey,
                        region: homeRegion,
                        homeRegion: homeRegion,
                        homeRegionKey: homeKey,
                        regionContent: regionContent,
                        estimatedHeight: adapters.heightEstimator.estimateListHeight(items, isContinuation),
                        measurementKey: splitMeasurementKey,
                        needsMeasurement: true,
                        slotDimensions: slotDimensions,
                    });
                }
            }
            // Generate single-item continuations for remaining indices
            // These handle the "last few items" cases (e.g., spell 13/14, spell 14/14)
            // which are common when lists nearly fit but need 1-2 items to continue
            if (totalCount > MAX_CONTINUATION_START_INDEX + 1) {
                for (var startIdx = MAX_CONTINUATION_START_INDEX + 1; startIdx < totalCount; startIdx++) {
                    var items = itemsSource.slice(startIdx, startIdx + 1);
                    var isContinuation = true;
                    var regionContent = toRegionContent(listKind, items, startIdx, totalCount, isContinuation, undefined);
                    var splitMeasurementKey = computeMeasurementKey(instance.id, regionContent);
                    entries.push({
                        instance: instance,
                        slotIndex: slotIndex,
                        orderIndex: index,
                        sourceRegionKey: homeKey,
                        region: homeRegion,
                        homeRegion: homeRegion,
                        homeRegionKey: homeKey,
                        regionContent: regionContent,
                        estimatedHeight: adapters.heightEstimator.estimateListHeight(items, isContinuation),
                        measurementKey: splitMeasurementKey,
                        needsMeasurement: true,
                        slotDimensions: slotDimensions,
                    });
                }
            }
        }
        else {
            // Non-list component: create basic block measurement
            var measurementKey = computeMeasurementKey(instance.id);
            entries.push({
                instance: instance,
                slotIndex: slotIndex,
                orderIndex: index,
                sourceRegionKey: homeKey,
                region: homeRegion,
                homeRegion: homeRegion,
                homeRegionKey: homeKey,
                estimatedHeight: DEFAULT_COMPONENT_HEIGHT_PX,
                measurementKey: measurementKey,
                needsMeasurement: true,
                slotDimensions: slotDimensions,
            });
        }
    });
    return entries;
};
export var buildCanvasEntries = function (_a) {
    var instances = _a.instances, template = _a.template, columnCount = _a.columnCount, pageWidthPx = _a.pageWidthPx, dataSources = _a.dataSources, measurements = _a.measurements, assignedRegions = _a.assignedRegions, adapters = _a.adapters;
    var buckets = buildBuckets({ instances: instances, template: template, columnCount: columnCount, pageWidthPx: pageWidthPx, dataSources: dataSources, measurements: measurements, assignedRegions: assignedRegions, adapters: adapters });
    // CRITICAL: Always regenerate ALL split measurements, not just the ones used in pagination
    // This ensures all split variations remain available for future pagination runs
    // (e.g., after zoom, resize, or data updates)
    var allMeasurementEntries = createInitialMeasurementEntries({
        instances: instances,
        template: template,
        columnCount: columnCount,
        pageWidthPx: pageWidthPx,
        dataSources: dataSources,
        adapters: adapters,
    });
    return { buckets: buckets, measurementEntries: allMeasurementEntries };
};
var slotDimensionLookup = function (template, slotId) {
    if (!slotId) {
        return undefined;
    }
    var slot = template.slots.find(function (item) { return item.id === slotId; });
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
export var computeHomeRegions = function (_a) {
    var instances = _a.instances, template = _a.template, columnCount = _a.columnCount, pageWidthPx = _a.pageWidthPx;
    var slotOrder = buildSlotOrder(template);
    var homeRegions = new Map();
    instances.forEach(function (instance, index) {
        var _a;
        var resolvedHomeRaw = resolveLocation(instance, template, columnCount, pageWidthPx);
        var homeRegion = {
            page: Math.max(1, resolvedHomeRaw.page),
            column: columnCount === 1 ? 1 : clamp(resolvedHomeRaw.column, 1, columnCount),
        };
        var slotIndex = instance.layout.slotId
            ? (_a = slotOrder.get(instance.layout.slotId)) !== null && _a !== void 0 ? _a : Number.MAX_SAFE_INTEGER
            : Number.MAX_SAFE_INTEGER;
        homeRegions.set(instance.id, {
            homeRegion: homeRegion,
            slotIndex: slotIndex,
            orderIndex: index,
        });
    });
    return homeRegions;
};
