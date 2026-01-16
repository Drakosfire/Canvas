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
import { isDebugEnabled } from '../debugFlags';
var isPlannerDebugEnabled = function () { return isDebugEnabled('planner-spellcasting'); };
// Read component IDs from env (same logic as paginate.ts to avoid circular dependency)
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
    var reactAppValue = process.env.REACT_APP_CANVAS_DEBUG_COMPONENTS;
    if (reactAppValue) {
        return parseComponentIdList(reactAppValue);
    }
    return [];
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
    readComponentIdsFromEnv().forEach(function (id) { return ids.add(id); });
    readComponentIdsFromStorage().forEach(function (id) { return ids.add(id); });
    return ids;
};
var DEBUG_COMPONENT_IDS = buildDebugComponentSet();
// If "*" is in the set, debug all components; otherwise check if component ID is in set
var shouldDebugComponent = function (componentId) {
    return DEBUG_COMPONENT_IDS.has('*') || DEBUG_COMPONENT_IDS.has(componentId);
};
export var logPlannerEvaluation = function (emoji, label, context) {
    if (context === void 0) { context = {}; }
    if (!isPlannerDebugEnabled()) {
        return;
    }
    // Filter by component ID if present in context
    if (context.componentId && typeof context.componentId === 'string') {
        if (!shouldDebugComponent(context.componentId)) {
            return;
        }
    }
    var payload = Object.keys(context).length > 0 ? context : undefined;
    if (payload) {
        console.log("".concat(emoji, " [planner] ").concat(label), payload);
    }
    else {
        console.log("".concat(emoji, " [planner] ").concat(label));
    }
};
export var logSegmentDecision = function (descriptor, intent) {
    if (!isPlannerDebugEnabled()) {
        return;
    }
    // Filter by component ID
    if (!shouldDebugComponent(descriptor.componentId)) {
        return;
    }
    var base = {
        componentId: descriptor.componentId,
        segmentId: descriptor.segmentId,
        measurementKey: descriptor.measurementKey,
        regionKey: descriptor.regionKey,
        heightPx: descriptor.heightPx,
        isMetadata: !!descriptor.isMetadata,
        isContinuation: !!descriptor.isContinuation,
        startIndex: descriptor.startIndex,
        itemCount: descriptor.itemCount,
        totalCount: descriptor.totalCount,
    };
    if (intent.type === 'place') {
        logPlannerEvaluation('✅', 'segment-placed', __assign(__assign({}, base), { regionKey: intent.regionKey, topPx: intent.topPx, bottomPx: intent.bottomPx, cursorAfterPx: intent.cursorAfterPx, usedCachedRegion: intent.usedCachedRegion, reason: intent.reason }));
    }
    else {
        logPlannerEvaluation('⏭️', 'segment-deferred', __assign(__assign({}, base), { fromRegionKey: intent.fromRegionKey, toRegionKey: intent.toRegionKey, reason: intent.reason, attemptedRegionKey: intent.attemptedRegionKey }));
    }
};
