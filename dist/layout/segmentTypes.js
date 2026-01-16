var DEFAULT_CACHE_TTL_MS = 1000 * 60 * 10; // 10 minutes – prevents stale reroutes after long idle
var buildCacheKey = function (componentId, segmentId) { return "".concat(componentId, "::").concat(segmentId); };
var SegmentRerouteCache = /** @class */ (function () {
    function SegmentRerouteCache(initial) {
        var _this = this;
        this.cache = new Map();
        if (!initial) {
            return;
        }
        Array.from(initial).forEach(function (_a) {
            var key = _a[0], record = _a[1];
            _this.cache.set(key, record);
        });
    }
    SegmentRerouteCache.prototype.resolveTarget = function (componentId, segmentId) {
        var key = buildCacheKey(componentId, segmentId);
        var record = this.cache.get(key);
        if (!record) {
            return null;
        }
        if (Date.now() - record.updatedAt > DEFAULT_CACHE_TTL_MS) {
            this.cache.delete(key);
            return null;
        }
        return record.targetRegionKey;
    };
    SegmentRerouteCache.prototype.rememberDefer = function (componentId, segmentId, targetRegionKey) {
        var key = buildCacheKey(componentId, segmentId);
        if (!targetRegionKey) {
            this.cache.delete(key);
            return;
        }
        this.cache.set(key, {
            targetRegionKey: targetRegionKey,
            updatedAt: Date.now(),
        });
    };
    SegmentRerouteCache.prototype.clear = function (componentId, segmentId) {
        var key = buildCacheKey(componentId, segmentId);
        this.cache.delete(key);
    };
    SegmentRerouteCache.prototype.has = function (componentId, segmentId) {
        var key = buildCacheKey(componentId, segmentId);
        return this.cache.has(key);
    };
    SegmentRerouteCache.prototype.snapshot = function () {
        var entries = [];
        this.cache.forEach(function (record, key) {
            var _a = key.split('::'), componentId = _a[0], segmentId = _a[1];
            entries.push({
                componentId: componentId,
                segmentId: segmentId,
                targetRegionKey: record.targetRegionKey,
                updatedAt: record.updatedAt,
            });
        });
        return entries;
    };
    return SegmentRerouteCache;
}());
export { SegmentRerouteCache };
