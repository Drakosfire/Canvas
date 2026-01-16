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
import { COMPONENT_VERTICAL_SPACING_PX } from './utils';
import { SegmentRerouteCache } from './segmentTypes';
import { logPlannerEvaluation, logSegmentDecision } from './debug/plannerLogs';
var HEIGHT_EPSILON = 0.5;
var initializeRegionStates = function (regions) {
    var states = new Map();
    regions.forEach(function (region, index) {
        var _a;
        states.set(region.key, __assign(__assign({}, region), { cursorPx: (_a = region.cursorOffsetPx) !== null && _a !== void 0 ? _a : 0, orderIndex: index }));
    });
    return states;
};
var computeNextRegionLookup = function (regions) {
    var lookup = new Map();
    regions.forEach(function (region, index) {
        var nextRegion = regions[index + 1];
        lookup.set(region.key, nextRegion ? nextRegion.key : null);
    });
    return lookup;
};
var resolveTargetRegion = function (descriptor, regionStates, rerouteCache) {
    var cached = rerouteCache.resolveTarget(descriptor.componentId, descriptor.segmentId);
    if (cached) {
        var cachedRegion = regionStates.get(cached);
        if (cachedRegion) {
            return { region: cachedRegion, usedCachedRegion: true };
        }
        // Cached region missing – purge and fall back
        rerouteCache.clear(descriptor.componentId, descriptor.segmentId);
    }
    var preferred = regionStates.get(descriptor.regionKey);
    if (preferred) {
        return { region: preferred, usedCachedRegion: false };
    }
    return { region: null, usedCachedRegion: false };
};
var fitsInRegion = function (region, descriptor, spacingPx) {
    var _a;
    var topPx = region.cursorPx;
    var height = descriptor.heightPx;
    var bottomPx = topPx + height;
    var cursorAfterPx = bottomPx + ((_a = descriptor.spacingAfterPx) !== null && _a !== void 0 ? _a : spacingPx);
    var fits = cursorAfterPx <= region.maxHeightPx + HEIGHT_EPSILON;
    return { fits: fits, topPx: topPx, bottomPx: bottomPx, cursorAfterPx: cursorAfterPx };
};
var buildPlacementIntent = function (descriptor, region, usedCachedRegion, topPx, bottomPx, cursorAfterPx) { return ({
    type: 'place',
    regionKey: region.key,
    topPx: topPx,
    bottomPx: bottomPx,
    heightPx: descriptor.heightPx,
    cursorAfterPx: cursorAfterPx,
    usedCachedRegion: usedCachedRegion,
    reason: usedCachedRegion ? 'cached-region' : 'fits',
}); };
var buildDeferIntent = function (attemptedRegionKey, nextRegionKey, reason) { return ({
    type: 'defer',
    fromRegionKey: attemptedRegionKey,
    toRegionKey: nextRegionKey,
    reason: reason,
    attemptedRegionKey: attemptedRegionKey,
}); };
export var buildSegmentPlan = function (_a) {
    var segments = _a.segments, regions = _a.regions, _b = _a.rerouteCache, rerouteCache = _b === void 0 ? new SegmentRerouteCache() : _b, _c = _a.spacingPx, spacingPx = _c === void 0 ? COMPONENT_VERTICAL_SPACING_PX : _c;
    var regionStates = initializeRegionStates(regions);
    var nextRegionLookup = computeNextRegionLookup(regions);
    var entries = [];
    logPlannerEvaluation('🧮', 'planner-run-start', {
        segmentCount: segments.length,
        regionCount: regions.length,
        spacingPx: spacingPx,
    });
    segments.forEach(function (descriptor) {
        var _a;
        var _b = resolveTargetRegion(descriptor, regionStates, rerouteCache), region = _b.region, usedCachedRegion = _b.usedCachedRegion;
        if (!region) {
            var intent_1 = buildDeferIntent(descriptor.regionKey, null, 'missing-region');
            rerouteCache.rememberDefer(descriptor.componentId, descriptor.segmentId, null);
            entries.push({ descriptor: descriptor, intent: intent_1 });
            logSegmentDecision(descriptor, intent_1);
            return;
        }
        var _c = fitsInRegion(region, descriptor, spacingPx), fits = _c.fits, topPx = _c.topPx, bottomPx = _c.bottomPx, cursorAfterPx = _c.cursorAfterPx;
        if (fits) {
            region.cursorPx = cursorAfterPx;
            rerouteCache.clear(descriptor.componentId, descriptor.segmentId);
            var intent_2 = buildPlacementIntent(descriptor, region, usedCachedRegion, topPx, bottomPx, cursorAfterPx);
            entries.push({ descriptor: descriptor, intent: intent_2 });
            logSegmentDecision(descriptor, intent_2);
            return;
        }
        var nextRegionKey = (_a = nextRegionLookup.get(region.key)) !== null && _a !== void 0 ? _a : null;
        rerouteCache.rememberDefer(descriptor.componentId, descriptor.segmentId, nextRegionKey);
        var intent = buildDeferIntent(region.key, nextRegionKey, nextRegionKey ? 'insufficient-space' : 'no-next-region');
        entries.push({ descriptor: descriptor, intent: intent });
        logSegmentDecision(descriptor, intent);
    });
    var placed = entries.filter(function (entry) { return entry.intent.type === 'place'; }).length;
    var deferred = entries.length - placed;
    logPlannerEvaluation('🧾', 'planner-run-complete', {
        placed: placed,
        deferred: deferred,
    });
    return {
        entries: entries,
        metrics: {
            placed: placed,
            deferred: deferred,
        },
    };
};
export { SegmentRerouteCache };
