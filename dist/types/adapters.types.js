/**
 * Adapter interfaces for Canvas system
 *
 * Applications implement these adapters to provide domain-specific behavior
 * to the generic Canvas layout engine.
 */
/**
 * Default implementations (basic, no domain knowledge)
 */
/**
 * Resolve a dot-separated path in an object.
 * e.g., resolvePath(obj, 'dnd5eData.abilityScores') -> obj.dnd5eData.abilityScores
 */
function resolvePath(obj, path) {
    return path.split('.').reduce(function (current, key) {
        if (current && typeof current === 'object' && key in current) {
            return current[key];
        }
        return undefined;
    }, obj);
}
export var createDefaultDataResolver = function () { return ({
    resolveDataReference: function (dataSources, dataRef) {
        var source = dataRef.sourceId
            ? dataSources.find(function (s) { return s.id === dataRef.sourceId; })
            : dataSources.find(function (s) { return s.type === dataRef.type; });
        if (!source || typeof source.payload !== 'object' || source.payload === null) {
            return undefined;
        }
        var payload = source.payload;
        if (dataRef.type === 'custom' && dataRef.key) {
            return payload[dataRef.key];
        }
        if (dataRef.path) {
            return resolvePath(payload, dataRef.path);
        }
        return undefined;
    },
    getPrimarySource: function (dataSources, type) {
        var source = dataSources.find(function (s) { return s.type === type; });
        return source === null || source === void 0 ? void 0 : source.payload;
    },
}); };
export var createDefaultListNormalizer = function () { return ({
    normalizeListItems: function (items) {
        return items ? (Array.isArray(items) ? items : []) : [];
    },
}); };
export var createDefaultHeightEstimator = function (defaultItemHeight, defaultComponentHeight) {
    if (defaultItemHeight === void 0) { defaultItemHeight = 50; }
    if (defaultComponentHeight === void 0) { defaultComponentHeight = 200; }
    return ({
        estimateItemHeight: function () { return defaultItemHeight; },
        estimateListHeight: function (items) { return items.length * defaultItemHeight; },
        estimateComponentHeight: function () { return defaultComponentHeight; },
    });
};
export var createDefaultMetadataExtractor = function () { return ({
    extractDisplayName: function () { return 'Untitled'; },
    extractExportMetadata: function () { return ({}); },
}); };
/**
 * Create default adapter bundle
 * @param options - Configuration options
 * @returns Complete adapter bundle with defaults
 */
export function createDefaultAdapters(options) {
    var _a;
    return {
        dataResolver: createDefaultDataResolver(),
        listNormalizer: createDefaultListNormalizer(),
        regionContentFactory: {
            createRegionContent: function (kind, items, startIndex, totalCount, isContinuation, metadata) { return ({
                kind: kind,
                items: items,
                startIndex: startIndex,
                totalCount: totalCount,
                isContinuation: isContinuation,
                metadata: metadata,
            }); },
        },
        heightEstimator: createDefaultHeightEstimator(options === null || options === void 0 ? void 0 : options.defaultItemHeight, options === null || options === void 0 ? void 0 : options.defaultComponentHeight),
        metadataExtractor: createDefaultMetadataExtractor(),
        componentTypeMap: (_a = options === null || options === void 0 ? void 0 : options.componentTypeMap) !== null && _a !== void 0 ? _a : {},
    };
}
