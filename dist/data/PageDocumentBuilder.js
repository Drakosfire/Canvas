/**
 * Page Document Builder
 *
 * Utilities for building PageDocument instances from live data.
 * Handles data hydration and template instantiation.
 */
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
/**
 * Build a complete page document from a template and live data
 */
export function buildPageDocument(options) {
    var template = options.template, statblockData = options.statblockData, characterData = options.characterData, _a = options.customData, customData = _a === void 0 ? {} : _a, _b = options.projectId, projectId = _b === void 0 ? 'default-project' : _b, _c = options.ownerId, ownerId = _c === void 0 ? 'default-user' : _c;
    var now = new Date().toISOString();
    // Create data sources
    var dataSources = [];
    // Add statblock data source if provided
    if (statblockData !== undefined) {
        dataSources.push({
            id: 'statblock-main',
            type: 'statblock',
            payload: statblockData,
            updatedAt: now,
        });
    }
    // Add character data source if provided
    if (characterData !== undefined) {
        dataSources.push({
            id: 'character-main',
            type: 'character',
            payload: characterData,
            updatedAt: now,
        });
    }
    // Always add custom data source
    dataSources.push({
        id: 'custom-main',
        type: 'custom',
        payload: customData,
        updatedAt: now,
    });
    // Build component instances from template
    var componentInstances = template.defaultComponents.map(function (placement, index) {
        var slot = template.slots.find(function (s) { return s.id === placement.slotId; });
        return {
            id: "component-".concat(index),
            type: placement.componentType,
            dataRef: placement.defaultDataRef,
            layout: {
                slotId: placement.slotId,
                position: slot === null || slot === void 0 ? void 0 : slot.position,
                isVisible: true,
            },
            variables: placement.defaultVariables,
        };
    });
    // Build the page document
    return {
        id: "page-".concat(Date.now()),
        projectId: projectId,
        ownerId: ownerId,
        templateId: template.id,
        pageVariables: __assign(__assign({ mode: template.defaultMode }, template.defaultPageVariables), { templateId: template.id }),
        componentInstances: componentInstances,
        dataSources: dataSources,
        createdAt: now,
        updatedAt: now,
        history: [],
        metadata: {
            generatedBy: 'DungeonMind StatBlock Generator',
            version: '1.0.0',
        },
    };
}
/**
 * Update data sources in an existing page document
 */
export function updatePageDataSources(page, statblockData, characterData, customData) {
    var updatedSources = page.dataSources.map(function (source) {
        if (source.type === 'statblock' && statblockData) {
            return __assign(__assign({}, source), { payload: statblockData, updatedAt: new Date().toISOString() });
        }
        if (source.type === 'character' && characterData) {
            return __assign(__assign({}, source), { payload: characterData, updatedAt: new Date().toISOString() });
        }
        if (source.type === 'custom' && customData) {
            return __assign(__assign({}, source), { payload: __assign(__assign({}, source.payload), customData), updatedAt: new Date().toISOString() });
        }
        return source;
    });
    return __assign(__assign({}, page), { dataSources: updatedSources, updatedAt: new Date().toISOString() });
}
/**
 * Extract custom data object from selected assets
 */
export function extractCustomData(selectedAssets) {
    var _a;
    return {
        portraitUrl: selectedAssets.creatureImage,
        imageIndex: selectedAssets.selectedImageIndex,
        allImages: (_a = selectedAssets.generatedImages) !== null && _a !== void 0 ? _a : [],
        modelUrl: selectedAssets.modelFile,
    };
}
