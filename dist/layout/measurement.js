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
import { jsx as _jsx } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { MEASUREMENT_THROTTLE_MS, regionKey } from './utils';
import { isDebugEnabled } from './debugFlags';
import { isComponentDebugEnabled, normalizeComponentId } from './paginate';
import { createMeasurementLayerStyles, createMeasurementEntryStyles } from './structuralStyles';
/**
 * Measurement semantics
 *
 * Each entry in the measurement layer renders the full component at its canonical scale inside an
 * offscreen wrapper. We measure `node.getBoundingClientRect().height`, which returns the distance in
 * CSS pixels from the top border edge to the bottom border edge of the component’s margin box within
 * the measurement layer. Because the layer sits at the origin (0,0) and is not transformed, the
 * rect’s `height` corresponds to the true block height of the component as if it were placed at
 * (top-left) inside the unscaled statblock column.
 *
 * We do not track the component’s bottom-left absolute coordinates; pagination consumes these
 * heights as scalar magnitudes. The layout engine starts each region at `yOffset = 0` (top of the
 * column) and increments by `estimatedHeight + COMPONENT_VERTICAL_SPACING_PX` after placing each
 * component. This matches the top-down flow we get by measuring from the top-left reference frame.
 */
var shouldLogMeasurements = function () { return isDebugEnabled('measurement-spellcasting'); };
var MEASUREMENT_EPSILON = 0.25;
var LOOP_DETECTION_WINDOW_MS = 1500;
var LOOP_ALERT_THRESHOLD = 3;
var HEIGHT_LOG_EPSILON = 0.75;
var HEIGHT_LOG_COOLDOWN_MS = 1500;
// Resize/raf logs are very verbose - only log when measurement flag is enabled AND loop detected
var SUPPRESS_ANCILLARY_LOGS_BY_DEFAULT = true;
var measurementLoopHistory = new Map();
var measurementHeightHistory = new Map();
var buildMeasurementEntriesSignature = function (entries) {
    if (entries.length === 0) {
        return 'empty';
    }
    return entries
        .map(function (entry) {
        var _a, _b, _c, _d, _e;
        var region = entry.region;
        return [
            entry.measurementKey,
            entry.instance.id,
            entry.slotIndex,
            entry.orderIndex,
            (_a = region === null || region === void 0 ? void 0 : region.page) !== null && _a !== void 0 ? _a : 'x',
            (_b = region === null || region === void 0 ? void 0 : region.column) !== null && _b !== void 0 ? _b : 'x',
            (_c = entry.homeRegionKey) !== null && _c !== void 0 ? _c : 'none',
            (_e = (_d = entry.regionContent) === null || _d === void 0 ? void 0 : _d.kind) !== null && _e !== void 0 ? _e : 'none',
        ].join(':');
    })
        .join('|');
};
var evaluateLoopEvent = function (key, type) {
    var now = Date.now();
    var history = measurementLoopHistory.get(key);
    if (!history) {
        history = {
            events: [],
            firstAttachLogged: false,
            firstDetachLogged: false,
            loopNotifiedAt: null,
        };
        measurementLoopHistory.set(key, history);
    }
    history.events.push({ type: type, timestamp: now });
    var windowStart = now - LOOP_DETECTION_WINDOW_MS;
    history.events = history.events.filter(function (event) { return event.timestamp >= windowStart; });
    var shouldLog = false;
    var reason;
    var meta;
    if (type === 'attach' && !history.firstAttachLogged) {
        shouldLog = true;
        reason = 'first-attach';
        history.firstAttachLogged = true;
    }
    else if (type === 'detach' && !history.firstDetachLogged) {
        shouldLog = true;
        reason = 'first-detach';
        history.firstDetachLogged = true;
    }
    var attachCount = history.events.filter(function (event) { return event.type === 'attach'; }).length;
    var detachCount = history.events.filter(function (event) { return event.type === 'detach'; }).length;
    var transitions = history.events.reduce(function (count, event, index, arr) {
        if (index === 0) {
            return count;
        }
        return count + (arr[index - 1].type !== event.type ? 1 : 0);
    }, 0);
    if (attachCount >= LOOP_ALERT_THRESHOLD && detachCount >= LOOP_ALERT_THRESHOLD && transitions >= (LOOP_ALERT_THRESHOLD * 2 - 1)) {
        var shouldNotify = !history.loopNotifiedAt || now - history.loopNotifiedAt > LOOP_DETECTION_WINDOW_MS;
        if (shouldNotify) {
            shouldLog = true;
            reason = 'loop-detected';
            meta = {
                attachCount: attachCount,
                detachCount: detachCount,
                transitions: transitions,
                windowMs: LOOP_DETECTION_WINDOW_MS,
            };
            history.loopNotifiedAt = now;
        }
    }
    if (history.loopNotifiedAt && now - history.loopNotifiedAt > LOOP_DETECTION_WINDOW_MS * 2) {
        history.loopNotifiedAt = null;
        history.firstAttachLogged = false;
        history.firstDetachLogged = false;
    }
    return { shouldLog: shouldLog, reason: reason, meta: meta };
};
var evaluateHeightEvent = function (key, height) {
    var now = Date.now();
    if (height == null) {
        measurementHeightHistory.delete(key);
        return { shouldLog: true, reason: 'delete' };
    }
    var previous = measurementHeightHistory.get(key);
    if (!previous) {
        measurementHeightHistory.set(key, { lastHeight: height, lastLoggedAt: now });
        return { shouldLog: true, reason: 'first-measurement' };
    }
    if (Math.abs(previous.lastHeight - height) > HEIGHT_LOG_EPSILON || now - previous.lastLoggedAt >= HEIGHT_LOG_COOLDOWN_MS) {
        measurementHeightHistory.set(key, { lastHeight: height, lastLoggedAt: now });
        return { shouldLog: true, reason: 'height-change' };
    }
    return { shouldLog: false };
};
var shouldLogAncillaryEvent = function (key) {
    var history = measurementLoopHistory.get(key);
    if (!history) {
        return false;
    }
    if (!history.loopNotifiedAt) {
        return false;
    }
    return Date.now() - history.loopNotifiedAt <= LOOP_DETECTION_WINDOW_MS * 2;
};
var logSpellcastingEvent = function (key, type, emoji, label, payload, _a) {
    if (payload === void 0) { payload = {}; }
    var _b = _a === void 0 ? {} : _a, _c = _b.force, force = _c === void 0 ? false : _c;
    if (!shouldLogMeasurements()) {
        return;
    }
    // Extract component ID and check if it's debug-enabled
    var componentId = extractComponentId(key);
    var isDebugComponent = componentId ? isComponentDebugEnabled(componentId) : false;
    // Only log if component is debug-enabled (spellcasting measurements also require component filtering)
    if (!isDebugComponent) {
        return;
    }
    var shouldLog = force;
    var reason;
    var meta;
    if (!shouldLog) {
        if (type === 'attach' || type === 'detach') {
            var result = evaluateLoopEvent(key, type);
            shouldLog = result.shouldLog;
            reason = result.reason;
            meta = result.meta;
        }
        else if (type === 'measure' || type === 'enqueue') {
            var result = evaluateHeightEvent(key, typeof payload.height === 'number' ? payload.height : null);
            shouldLog = result.shouldLog;
            reason = result.reason;
        }
        else if (type === 'resize' || type === 'raf') {
            // Resize/raf logs are very verbose - only log when explicitly enabled AND loop detected
            // This prevents excessive logging when measurement flag is off
            shouldLog = shouldLogAncillaryEvent(key) && !SUPPRESS_ANCILLARY_LOGS_BY_DEFAULT;
        }
    }
    if (!shouldLog) {
        return;
    }
    console.log("".concat(emoji, " [Measurement][Spellcasting] ").concat(label), __assign(__assign(__assign({ key: key }, payload), (reason ? { reason: reason } : {})), (meta ? { meta: meta } : {})));
};
var scheduleFlush = function (flush, idleHandle) {
    if (typeof window === 'undefined') {
        idleHandle.current = setTimeout(function () {
            idleHandle.current = null;
            flush();
        }, MEASUREMENT_THROTTLE_MS);
        return;
    }
    if (typeof window.requestIdleCallback === 'function') {
        idleHandle.current = window.requestIdleCallback(function () {
            idleHandle.current = null;
            flush();
        });
        return;
    }
    idleHandle.current = window.setTimeout(function () {
        idleHandle.current = null;
        flush();
    }, MEASUREMENT_THROTTLE_MS);
};
var SPELLCASTING_MEASUREMENT_TAG = 'spellcasting-block';
var SPELLCASTING_REGION_KIND = ':spell-list';
/**
 * Extract component ID from measurement key
 * Format: "component-X:block" or "component-X:spell-list:..." or "component-X:..."
 */
var extractComponentId = function (key) {
    var match = key.match(/^(component-\d+):/);
    return match ? match[1] : null;
};
var isSpellcastingMeasurementKey = function (key) {
    return key.includes(SPELLCASTING_MEASUREMENT_TAG) ||
        key.includes(SPELLCASTING_REGION_KIND);
};
export var useIdleMeasurementDispatcher = function (dispatch) {
    var pending = useRef(new Map());
    var idleHandle = useRef(null);
    var flush = useCallback(function () {
        if (pending.current.size === 0) {
            return;
        }
        var entries = Array.from(pending.current.values());
        pending.current.clear();
        // Filter and separate deletions from measurements
        var deletions = [];
        var measurements = [];
        entries.forEach(function (entry) {
            if (entry.deleted) {
                // Use negative height to signal explicit deletion
                deletions.push({ key: entry.key, height: -1, measuredAt: entry.measuredAt });
            }
            else {
                // Include zero-height measurements (e.g., metadata blocks) as present
                measurements.push(entry);
            }
        });
        var combined = __spreadArray(__spreadArray([], deletions, true), measurements, true);
        if (combined.length === 0) {
            return;
        }
        if (shouldLogMeasurements()) {
            var deletedKeys_1 = new Set(deletions.map(function (_a) {
                var key = _a.key;
                return key;
            }));
            // Filter to debug-enabled components only
            var targeted = combined.filter(function (entry) {
                var componentId = extractComponentId(entry.key);
                return componentId ? isComponentDebugEnabled(componentId) : false;
            });
            if (targeted.length > 0) {
                console.log('🧮 [Measurement][Spellcasting] dispatcher summary', {
                    pendingCount: combined.length,
                    entries: targeted.map(function (entry) { return ({
                        key: entry.key,
                        height: entry.height,
                        deleted: deletedKeys_1.has(entry.key),
                        measuredAt: entry.measuredAt,
                    }); }),
                });
            }
        }
        dispatch(combined);
    }, [dispatch]);
    return useCallback(function (key, height) {
        var measuredAt = Date.now();
        logSpellcastingEvent(key, 'enqueue', '📥', 'enqueue', {
            height: height,
            measuredAt: measuredAt,
            isDeletion: height === null || height <= 0,
        });
        // null height signals deletion
        if (height === null) {
            pending.current.set(key, { key: key, height: 0, measuredAt: measuredAt, deleted: true });
        }
        else {
            var previous = pending.current.get(key);
            if (previous && !previous.deleted && Math.abs(previous.height - height) < MEASUREMENT_EPSILON) {
                return;
            }
            pending.current.set(key, { key: key, height: height, measuredAt: measuredAt, deleted: false });
        }
        if (idleHandle.current != null) {
            return;
        }
        scheduleFlush(function () {
            flush();
        }, idleHandle);
    }, [flush]);
};
/**
 * Phase 1: Coordinator for managing measurement locks across multiple observers
 * Provides a central interface for components to lock/unlock their measurements
 */
var MeasurementCoordinator = /** @class */ (function () {
    function MeasurementCoordinator() {
        this.observers = new Map();
    }
    MeasurementCoordinator.prototype.registerObserver = function (key, observer) {
        this.observers.set(key, observer);
    };
    MeasurementCoordinator.prototype.unregisterObserver = function (key) {
        this.observers.delete(key);
    };
    MeasurementCoordinator.prototype.lockComponent = function (componentId) {
        // Lock all observers that match this component ID pattern
        // Component IDs like "action-section" should lock observers with keys starting with that pattern
        this.observers.forEach(function (observer, key) {
            if (key.includes(componentId)) {
                observer.lock();
            }
        });
        if (shouldLogMeasurements()) {
            console.log('🔒 [Measurement][Spellcasting] lock', {
                componentId: normalizeComponentId(componentId),
            });
        }
    };
    MeasurementCoordinator.prototype.unlockComponent = function (componentId) {
        // Unlock all observers that match this component ID pattern
        this.observers.forEach(function (observer, key) {
            if (key.includes(componentId)) {
                observer.unlock();
            }
        });
        if (shouldLogMeasurements()) {
            console.log('🔓 [Measurement][Spellcasting] unlock', {
                componentId: normalizeComponentId(componentId),
            });
        }
    };
    return MeasurementCoordinator;
}());
export { MeasurementCoordinator };
/**
 * Encapsulates DOM observation for a single measurement entry.
 * Manages ResizeObserver, requestAnimationFrame, and image load listeners.
 */
// Track measurement history to detect inconsistencies
var measurementHistoryTracker = new Map();
var MeasurementObserver = /** @class */ (function () {
    function MeasurementObserver(key, node, onMeasure) {
        var _this = this;
        this.key = key;
        this.node = node;
        this.onMeasure = onMeasure;
        this.observer = null;
        this.rafHandle = null;
        this.imageCleanup = null;
        this.hasLogged = false; // Track if we've logged this component
        // Phase 1: Dynamic Component Locking
        this.isLocked = false;
        this.pendingMeasurement = null;
        this.measure = function () {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w;
            var rect = _this.node.getBoundingClientRect();
            // Extract component ID once for all debug checks
            var componentId = extractComponentId(_this.key);
            var isDebugComponent = componentId ? isComponentDebugEnabled(componentId) : false;
            // WIDTH GATE: Skip measurement if actual width doesn't match expected (CSS not applied yet)
            // The entry has inline style width set; check if rendered width matches
            var styleWidth = _this.node.style.width;
            var expectedWidth = styleWidth && styleWidth !== 'auto' && !styleWidth.includes('%')
                ? parseFloat(styleWidth)
                : null;
            if (expectedWidth != null && !Number.isNaN(expectedWidth) && rect.width > 0) {
                var widthDiff = Math.abs(rect.width - expectedWidth);
                // Allow 5px tolerance for subpixel rendering
                if (widthDiff > 5) {
                    if (shouldLogMeasurements() && isDebugComponent) {
                        console.log('⏳ [MeasurementObserver] Skipping measurement - width not stable:', {
                            key: _this.key,
                            expectedWidth: expectedWidth.toFixed(2),
                            actualWidth: rect.width.toFixed(2),
                            widthDiff: widthDiff.toFixed(2),
                        });
                    }
                    // Schedule retry via RAF
                    if (_this.rafHandle === null) {
                        _this.rafHandle = requestAnimationFrame(function () {
                            _this.rafHandle = null;
                            _this.measure();
                        });
                    }
                    return;
                }
            }
            var height = rect.height > 0 ? rect.height : 0;
            var computed = typeof window !== 'undefined' ? window.getComputedStyle(_this.node) : null;
            // DIAGNOSTIC: Log DOM structure for debug components to track heading presence
            if (shouldLogMeasurements() && isDebugComponent) {
                var section = _this.node.querySelector('section');
                var heading = _this.node.querySelector('h4, h3, .dm-section-heading');
                var headingRect = heading === null || heading === void 0 ? void 0 : heading.getBoundingClientRect();
                var sectionRect = section === null || section === void 0 ? void 0 : section.getBoundingClientRect();
                console.log('[MeasurementObserver] 🔬 DOM STRUCTURE:', {
                    key: _this.key,
                    componentId: componentId,
                    wrapperHeight: height.toFixed(2),
                    hasSection: !!section,
                    sectionHeight: (_b = (_a = sectionRect === null || sectionRect === void 0 ? void 0 : sectionRect.height) === null || _a === void 0 ? void 0 : _a.toFixed(2)) !== null && _b !== void 0 ? _b : 'N/A',
                    hasHeading: !!heading,
                    headingTag: (_c = heading === null || heading === void 0 ? void 0 : heading.tagName) !== null && _c !== void 0 ? _c : 'none',
                    headingText: (_e = (_d = heading === null || heading === void 0 ? void 0 : heading.textContent) === null || _d === void 0 ? void 0 : _d.substring(0, 20)) !== null && _e !== void 0 ? _e : 'none',
                    headingHeight: (_g = (_f = headingRect === null || headingRect === void 0 ? void 0 : headingRect.height) === null || _f === void 0 ? void 0 : _f.toFixed(2)) !== null && _g !== void 0 ? _g : 'N/A',
                    childCount: _this.node.children.length,
                    firstChildTag: (_j = (_h = _this.node.children[0]) === null || _h === void 0 ? void 0 : _h.tagName) !== null && _j !== void 0 ? _j : 'none',
                    fontFamily: (_k = computed === null || computed === void 0 ? void 0 : computed.fontFamily) === null || _k === void 0 ? void 0 : _k.substring(0, 25),
                });
            }
            // DIAGNOSTIC: Log font-size context for component-11 to debug measurement discrepancy
            // This captures the CSS context that affects rem/em calculations
            if (_this.key.includes('component-11') && _this.key.includes('lair-action-list:0:3:3:base')) {
                var parent_1 = _this.node.parentElement;
                var grandparent = parent_1 === null || parent_1 === void 0 ? void 0 : parent_1.parentElement;
                var greatGrandparent = grandparent === null || grandparent === void 0 ? void 0 : grandparent.parentElement;
                var entryFontSize = (_l = computed === null || computed === void 0 ? void 0 : computed.fontSize) !== null && _l !== void 0 ? _l : 'N/A';
                var parentFontSize = parent_1 ? window.getComputedStyle(parent_1).fontSize : 'N/A';
                var grandparentFontSize = grandparent ? window.getComputedStyle(grandparent).fontSize : 'N/A';
                var greatGrandparentFontSize = greatGrandparent ? window.getComputedStyle(greatGrandparent).fontSize : 'N/A';
                // Deep dive: check section styles
                var section = _this.node.querySelector('.dm-lair-section');
                var sectionComputed = section ? window.getComputedStyle(section) : null;
                console.log('🔍 [MeasurementObserver] FULL DIAGNOSTIC for component-11:', {
                    key: _this.key,
                    // Heights
                    entryBoundingHeight: rect.height.toFixed(2),
                    entryOffsetHeight: _this.node.offsetHeight,
                    sectionOffsetHeight: (_m = section === null || section === void 0 ? void 0 : section.offsetHeight) !== null && _m !== void 0 ? _m : 'N/A',
                    // Widths
                    entryWidth: rect.width.toFixed(2),
                    entryOffsetWidth: _this.node.offsetWidth,
                    // Entry styles
                    entryFontSize: entryFontSize,
                    entryPadding: (_o = computed === null || computed === void 0 ? void 0 : computed.padding) !== null && _o !== void 0 ? _o : 'N/A',
                    entryMargin: (_p = computed === null || computed === void 0 ? void 0 : computed.margin) !== null && _p !== void 0 ? _p : 'N/A',
                    // Section styles (the actual content)
                    sectionPadding: (_q = sectionComputed === null || sectionComputed === void 0 ? void 0 : sectionComputed.padding) !== null && _q !== void 0 ? _q : 'N/A',
                    sectionMargin: (_r = sectionComputed === null || sectionComputed === void 0 ? void 0 : sectionComputed.margin) !== null && _r !== void 0 ? _r : 'N/A',
                    sectionLineHeight: (_s = sectionComputed === null || sectionComputed === void 0 ? void 0 : sectionComputed.lineHeight) !== null && _s !== void 0 ? _s : 'N/A',
                    sectionBackground: (_u = (_t = sectionComputed === null || sectionComputed === void 0 ? void 0 : sectionComputed.background) === null || _t === void 0 ? void 0 : _t.substring(0, 30)) !== null && _u !== void 0 ? _u : 'N/A',
                    // Font context
                    parentClass: (_v = parent_1 === null || parent_1 === void 0 ? void 0 : parent_1.className) !== null && _v !== void 0 ? _v : 'none',
                    parentFontSize: parentFontSize,
                    grandparentClass: (_w = grandparent === null || grandparent === void 0 ? void 0 : grandparent.className) !== null && _w !== void 0 ? _w : 'none',
                    grandparentFontSize: grandparentFontSize,
                    // Ancestry check
                    hasPagePhb: !!_this.node.closest('.page.phb'),
                    hasMonsterFrame: !!_this.node.closest('.monster.frame'),
                    hasCanvasColumn: !!_this.node.closest('.canvas-column'),
                });
            }
            // Add child margin spacing for accurate measurements
            // getBoundingClientRect() includes padding/border but NOT child margins
            // Child margins can "escape" parent's bounding box due to margin collapse
            if (height > 0 && _this.node.children.length > 0 && typeof window !== 'undefined') {
                var firstChild = _this.node.children[0];
                var lastChild = _this.node.children[_this.node.children.length - 1];
                var firstChildStyle = window.getComputedStyle(firstChild);
                var lastChildStyle = window.getComputedStyle(lastChild);
                // Get parent's padding AND border to determine if margins collapse
                // Margins only escape if parent has NEITHER padding NOR border
                var paddingTop = computed ? parseFloat(computed.paddingTop) : 0;
                var paddingBottom = computed ? parseFloat(computed.paddingBottom) : 0;
                var borderTop = computed ? parseFloat(computed.borderTopWidth) : 0;
                var borderBottom = computed ? parseFloat(computed.borderBottomWidth) : 0;
                // First child's top margin only escapes if parent has no top padding AND no top border
                var firstMarginTop = parseFloat(firstChildStyle.marginTop);
                var effectiveFirstMargin = (paddingTop > 0 || borderTop > 0) ? 0 : Math.max(0, firstMarginTop);
                // Last child's bottom margin only escapes if parent has no bottom padding AND no bottom border
                var lastMarginBottom = parseFloat(lastChildStyle.marginBottom);
                var effectiveLastMargin = (paddingBottom > 0 || borderBottom > 0) ? 0 : Math.max(0, lastMarginBottom);
                var additionalHeight = effectiveFirstMargin + effectiveLastMargin;
                if (additionalHeight > 0) {
                    if (shouldLogMeasurements() && isDebugComponent) {
                        console.log('[MeasurementObserver] 📐 Adding child margins:', {
                            key: _this.key,
                            baseHeight: height.toFixed(2),
                            firstMarginTop: firstMarginTop.toFixed(2),
                            lastMarginBottom: lastMarginBottom.toFixed(2),
                            effectiveFirstMargin: effectiveFirstMargin.toFixed(2),
                            effectiveLastMargin: effectiveLastMargin.toFixed(2),
                            additionalHeight: additionalHeight.toFixed(2),
                            newHeight: (height + additionalHeight).toFixed(2),
                            paddingTop: paddingTop.toFixed(2),
                            paddingBottom: paddingBottom.toFixed(2),
                            borderTop: borderTop.toFixed(2),
                            borderBottom: borderBottom.toFixed(2),
                        });
                    }
                    height += additionalHeight;
                }
            }
            // Debug: Check width constraints for image components
            var hasImages = _this.node.querySelectorAll('img').length > 0;
            // Debug logging for image measurements (always log for debug components, even if warning doesn't fire)
            if (shouldLogMeasurements() && isDebugComponent && hasImages) {
                var parent_2 = _this.node.parentElement;
                var parentRect = parent_2 === null || parent_2 === void 0 ? void 0 : parent_2.getBoundingClientRect();
                var parentComputed = parent_2 ? window.getComputedStyle(parent_2) : null;
                var image = _this.node.querySelector('img');
                // Log width diagnostics for image components
                console.log('[MeasurementObserver] 🔍 Image measurement diagnostics:', {
                    key: _this.key,
                    componentId: componentId ? normalizeComponentId(componentId) : componentId,
                    height: height,
                    nodeWidth: rect.width,
                    nodeComputedWidth: computed === null || computed === void 0 ? void 0 : computed.width,
                    nodeMaxWidth: computed === null || computed === void 0 ? void 0 : computed.maxWidth,
                    parentWidth: parentRect === null || parentRect === void 0 ? void 0 : parentRect.width,
                    parentComputedWidth: parentComputed === null || parentComputed === void 0 ? void 0 : parentComputed.width,
                    parentMaxWidth: parentComputed === null || parentComputed === void 0 ? void 0 : parentComputed.maxWidth,
                    imageCount: _this.node.querySelectorAll('img').length,
                    image: image ? {
                        naturalWidth: image.naturalWidth,
                        naturalHeight: image.naturalHeight,
                        width: image.width,
                        height: image.height,
                        computedWidth: window.getComputedStyle(image).width,
                        computedHeight: window.getComputedStyle(image).height,
                    } : null,
                });
            }
            if (hasImages && height > 500) {
                var parent_3 = _this.node.parentElement;
                var parentRect = parent_3 === null || parent_3 === void 0 ? void 0 : parent_3.getBoundingClientRect();
                var parentComputed = parent_3 ? window.getComputedStyle(parent_3) : null;
                // Only warn for debug-enabled components when measurement logging is enabled
                if (shouldLogMeasurements() && isDebugComponent) {
                    console.warn('[MeasurementObserver] ⚠️ LARGE IMAGE MEASUREMENT:', {
                        key: _this.key,
                        componentId: componentId ? normalizeComponentId(componentId) : componentId,
                        height: height,
                        nodeWidth: rect.width,
                        nodeComputedWidth: computed === null || computed === void 0 ? void 0 : computed.width,
                        nodeMaxWidth: computed === null || computed === void 0 ? void 0 : computed.maxWidth,
                        parentWidth: parentRect === null || parentRect === void 0 ? void 0 : parentRect.width,
                        parentComputedWidth: parentComputed === null || parentComputed === void 0 ? void 0 : parentComputed.width,
                        parentMaxWidth: parentComputed === null || parentComputed === void 0 ? void 0 : parentComputed.maxWidth,
                        imageCount: _this.node.querySelectorAll('img').length,
                        images: Array.from(_this.node.querySelectorAll('img')).map(function (img) { return ({
                            naturalWidth: img.naturalWidth,
                            naturalHeight: img.naturalHeight,
                            width: img.width,
                            height: img.height,
                            computedWidth: window.getComputedStyle(img).width,
                            computedHeight: window.getComputedStyle(img).height,
                        }); }),
                    });
                }
            }
            logSpellcastingEvent(_this.key, 'measure', '📏', 'measure', {
                height: height,
                offsetHeight: _this.node.offsetHeight,
                scrollHeight: _this.node.scrollHeight,
                clientHeight: _this.node.clientHeight,
                className: _this.node.className,
                isLocked: _this.isLocked,
                pendingMeasurement: _this.pendingMeasurement,
                display: computed === null || computed === void 0 ? void 0 : computed.display,
                position: computed === null || computed === void 0 ? void 0 : computed.position,
                flexGrow: computed === null || computed === void 0 ? void 0 : computed.flexGrow,
                flexShrink: computed === null || computed === void 0 ? void 0 : computed.flexShrink,
            });
            // Warn about abnormally large measurements (>4000px)
            if (process.env.NODE_ENV !== 'production' && height > 4000) {
                var computed_1 = window.getComputedStyle(_this.node);
                console.warn('[MeasurementObserver] ⚠️ ABNORMAL HEIGHT:', {
                    key: _this.key,
                    height: height,
                    likelyCauses: {
                        hasHeightPercent: computed_1.height.includes('%'),
                        hasFlexGrow: computed_1.flexGrow !== '0',
                    },
                });
            }
            // Track measurement consistency before dispatching
            _this.trackMeasurementConsistency(height);
            // Phase 1: Check lock state before dispatching
            if (_this.isLocked) {
                // Store but don't dispatch yet
                _this.pendingMeasurement = height;
            }
            else {
                // Dispatch immediately
                _this.onMeasure(_this.key, height);
            }
        };
    }
    // Track measurement consistency
    MeasurementObserver.prototype.trackMeasurementConsistency = function (height) {
        var existing = measurementHistoryTracker.get(this.key);
        var componentId = extractComponentId(this.key);
        var isDebugComponent = componentId ? isComponentDebugEnabled(componentId) : false;
        if (!existing) {
            measurementHistoryTracker.set(this.key, { firstHeight: height, measureCount: 1 });
            return;
        }
        existing.measureCount++;
        var diff = Math.abs(height - existing.firstHeight);
        // Alert if measurement differs by more than 5px from first measurement
        if (diff > 5 && shouldLogMeasurements() && isDebugComponent) {
            console.warn('⚠️ [Measurement] HEIGHT INCONSISTENCY DETECTED:', {
                key: this.key,
                componentId: componentId,
                firstHeight: existing.firstHeight.toFixed(2),
                currentHeight: height.toFixed(2),
                difference: diff.toFixed(2),
                measureCount: existing.measureCount,
                likelyCause: diff > 30 ? 'HEADING_MISSING' : 'MINOR_REFLOW',
            });
        }
    };
    /**
     * Lock this observer - measurements will be stored but not dispatched
     * Used during component editing to prevent layout thrashing
     */
    MeasurementObserver.prototype.lock = function () {
        this.isLocked = true;
        var componentId = extractComponentId(this.key);
        var isDebugComponent = componentId ? isComponentDebugEnabled(componentId) : false;
        if (shouldLogMeasurements() && isDebugComponent) {
            console.log('🔒 [Measurement][Spellcasting] lock', {
                key: this.key,
            });
        }
    };
    /**
     * Unlock this observer - dispatch any pending measurement
     * Called after editing completes to trigger layout update
     */
    MeasurementObserver.prototype.unlock = function () {
        this.isLocked = false;
        var componentId = extractComponentId(this.key);
        var isDebugComponent = componentId ? isComponentDebugEnabled(componentId) : false;
        if (shouldLogMeasurements() && isDebugComponent) {
            console.log('🔓 [Measurement][Spellcasting] unlock', {
                key: this.key,
                hasPendingMeasurement: this.pendingMeasurement != null,
            });
        }
        // Dispatch pending measurement if it changed while locked
        if (this.pendingMeasurement !== null) {
            this.onMeasure(this.key, this.pendingMeasurement);
            this.pendingMeasurement = null;
        }
    };
    MeasurementObserver.prototype.attach = function () {
        this.measure();
        this.attachImageListeners();
        this.attachResizeObserver();
    };
    MeasurementObserver.prototype.detach = function () {
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }
        if (this.rafHandle !== null) {
            if (typeof cancelAnimationFrame === 'function') {
                cancelAnimationFrame(this.rafHandle);
            }
            this.rafHandle = null;
        }
        if (this.imageCleanup) {
            this.imageCleanup();
            this.imageCleanup = null;
        }
    };
    MeasurementObserver.prototype.attachResizeObserver = function () {
        var _this = this;
        if (typeof window === 'undefined' || typeof window.ResizeObserver !== 'function') {
            return;
        }
        this.observer = new window.ResizeObserver(function () {
            logSpellcastingEvent(_this.key, 'resize', '🔁', 'resize observed');
            _this.scheduleRAF();
        });
        this.observer.observe(this.node);
    };
    MeasurementObserver.prototype.attachImageListeners = function () {
        var _this = this;
        var images = Array.from(this.node.querySelectorAll('img'));
        if (images.length === 0) {
            return;
        }
        var handleImageEvent = function () {
            _this.scheduleRAF();
        };
        images.forEach(function (img) {
            img.addEventListener('load', handleImageEvent);
            img.addEventListener('error', handleImageEvent);
            if (img.complete && img.naturalHeight > 0) {
                handleImageEvent();
            }
        });
        this.imageCleanup = function () {
            images.forEach(function (img) {
                img.removeEventListener('load', handleImageEvent);
                img.removeEventListener('error', handleImageEvent);
            });
            var componentId = extractComponentId(_this.key);
            var isDebugComponent = componentId ? isComponentDebugEnabled(componentId) : false;
            if (shouldLogMeasurements() && isDebugComponent) {
                console.log('🧹 [Measurement][Spellcasting] image listeners cleaned', {
                    key: _this.key,
                });
            }
        };
    };
    MeasurementObserver.prototype.scheduleRAF = function () {
        var _this = this;
        if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') {
            setTimeout(function () {
                _this.measure();
            }, MEASUREMENT_THROTTLE_MS);
            return;
        }
        if (this.rafHandle !== null) {
            return; // Already scheduled
        }
        this.rafHandle = window.requestAnimationFrame(function () {
            _this.rafHandle = null;
            _this.measure();
        });
        logSpellcastingEvent(this.key, 'raf', '🎯', 'raf scheduled');
    };
    return MeasurementObserver;
}());
export var createMeasurementEntry = function (overrides) {
    if (overrides === void 0) { overrides = {}; }
    return (__assign({ instance: {
            id: 'mock-component',
            type: 'trait-list',
            dataRef: { type: 'statblock', path: 'specialAbilities' },
            layout: { isVisible: true },
        }, slotIndex: 0, orderIndex: 0, sourceRegionKey: '1:1', region: { page: 1, column: 1 }, homeRegion: { page: 1, column: 1 }, homeRegionKey: regionKey(1, 1), estimatedHeight: 100, measurementKey: 'mock-component:block', needsMeasurement: true }, overrides));
};
var readPublishOnceEnv = function () {
    try {
        var v = (process.env.REACT_APP_CANVAS_PUBLISH_ONCE || '').toLowerCase();
        return v === '1' || v === 'true' || v === 'yes' || v === 'on';
    }
    catch (_a) {
        return false; // Default to false for backward compatibility
    }
};
export var MeasurementLayer = function (_a) {
    var entries = _a.entries, renderComponent = _a.renderComponent, onMeasurements = _a.onMeasurements, onMeasurementComplete = _a.onMeasurementComplete, coordinator = _a.coordinator, measuredColumnWidth = _a.measuredColumnWidth, publishOnce = _a.publishOnce, _b = _a.stagingMode, stagingMode = _b === void 0 ? 'fixed-offscreen' : _b, _c = _a.ready, ready = _c === void 0 ? true : _c;
    var effectivePublishOnce = typeof publishOnce === 'boolean' ? publishOnce : readPublishOnceEnv();
    var cumulativeRef = useRef(new Map());
    var publishedRef = useRef(false);
    var measurementVersionRef = useRef(0); // Track measurement version for proper incrementing
    var previousEntriesSignatureRef = useRef(null);
    var previousPublishModeRef = useRef(effectivePublishOnce);
    // Phase 4 A2: Track ready state in ref so dispatcher callback can access current value
    var readyRef = useRef(ready);
    useEffect(function () {
        readyRef.current = ready;
    }, [ready]);
    var requiredKeysRef = useRef(new Set());
    var measurementEntriesSignature = useMemo(function () { return buildMeasurementEntriesSignature(entries); }, [entries]);
    useEffect(function () {
        // Phase 4 A2: Gate measurements until host confirms CSS/fonts are loaded
        if (!ready) {
            // Clear any accumulated measurements - we'll get fresh ones when ready
            requiredKeysRef.current = new Set();
            cumulativeRef.current.clear();
            publishedRef.current = false;
            previousEntriesSignatureRef.current = null; // Force re-init when ready becomes true
            if (shouldLogMeasurements()) {
                console.log('⏸️ [Measurement] waiting for ready signal (CSS/fonts not loaded)', {
                    ready: ready,
                    entryCount: entries.length,
                });
            }
            return;
        }
        // Defer resets when there are no entries to measure yet (e.g., pre-refresh initialization)
        if (entries.length === 0) {
            requiredKeysRef.current = new Set();
            cumulativeRef.current.clear();
            publishedRef.current = false;
            previousEntriesSignatureRef.current = measurementEntriesSignature;
            previousPublishModeRef.current = effectivePublishOnce;
            if (shouldLogMeasurements()) {
                console.log('⏸️ [Measurement] no entries to measure, waiting for components', {
                    publishOnce: effectivePublishOnce,
                });
            }
            return;
        }
        var signatureChanged = previousEntriesSignatureRef.current !== measurementEntriesSignature;
        var publishModeChanged = previousPublishModeRef.current !== effectivePublishOnce;
        if (!signatureChanged && !publishModeChanged) {
            if (shouldLogMeasurements()) {
                console.log('📭 [Measurement] entries unchanged, skipping reset', {
                    signature: measurementEntriesSignature || 'empty',
                });
            }
            return;
        }
        previousEntriesSignatureRef.current = measurementEntriesSignature;
        previousPublishModeRef.current = effectivePublishOnce;
        var required = new Set();
        entries.forEach(function (e) { return required.add(e.measurementKey); });
        requiredKeysRef.current = required;
        // Reset for new cycle
        cumulativeRef.current.clear();
        publishedRef.current = false;
        // Clear measurement history tracker so "first" measurement is from this cycle
        // (not from early attach before CSS was applied)
        measurementHistoryTracker.clear();
        // Note: measurementStatus will be set to 'measuring' by MEASUREMENTS_UPDATED action
        // when first measurements arrive, so we don't need to dispatch MEASUREMENT_START here
        if (shouldLogMeasurements()) {
            console.log('📐 [Measurement] start', {
                requiredCount: required.size,
                publishOnce: effectivePublishOnce,
                ready: ready,
            });
        }
    }, [entries, measurementEntriesSignature, effectivePublishOnce, ready]);
    var checkAndSignalCompletion = useCallback(function (mode) {
        if (publishedRef.current) {
            return null;
        }
        var required = requiredKeysRef.current;
        if (required.size === 0) {
            return null;
        }
        var allPresent = true;
        required.forEach(function (key) {
            if (!cumulativeRef.current.has(key)) {
                allPresent = false;
            }
        });
        if (!allPresent) {
            return null;
        }
        publishedRef.current = true;
        var version = measurementVersionRef.current + 1;
        measurementVersionRef.current = version;
        if (shouldLogMeasurements()) {
            var logPayload = {
                publishedCount: cumulativeRef.current.size,
                requiredCount: required.size,
                measurementVersion: version,
            };
            if (mode === 'publish-once') {
                console.log('✅ [Measurement] publish-complete', logPayload);
            }
            else {
                console.log('✅ [Measurement] measurement-complete (incremental)', logPayload);
            }
        }
        if (onMeasurementComplete) {
            onMeasurementComplete(version);
        }
        return version;
    }, [onMeasurementComplete]);
    var dispatcher = useIdleMeasurementDispatcher(function (updates) {
        // Phase 4 A2: Don't record measurements until CSS/fonts are ready
        // This prevents capturing incorrect heights before theme CSS is applied
        if (!readyRef.current) {
            if (shouldLogMeasurements()) {
                console.log('⏸️ [Measurement] ignoring measurements - not ready', {
                    updateCount: updates.length,
                    keys: updates.map(function (u) { return u.key; }).slice(0, 3), // First 3 keys for debugging
                });
            }
            return;
        }
        // Hard-stop: if we've already published (publish-once mode), ignore all further updates
        if (effectivePublishOnce && publishedRef.current) {
            return;
        }
        updates.forEach(function (u) {
            // Treat zero-height metadata as present; only remove on explicit delete (negative height)
            if (u.height >= 0) {
                cumulativeRef.current.set(u.key, u);
            }
            else {
                cumulativeRef.current.delete(u.key);
            }
        });
        if (!effectivePublishOnce) {
            onMeasurements(updates);
            checkAndSignalCompletion('incremental');
            return;
        }
        // Check if all measurements are present (but don't signal completion yet)
        var required = requiredKeysRef.current;
        if (required.size === 0) {
            return;
        }
        var allPresent = true;
        required.forEach(function (key) {
            if (!cumulativeRef.current.has(key)) {
                allPresent = false;
            }
        });
        if (!allPresent) {
            return;
        }
        // CRITICAL FIX: Publish measurements to state BEFORE signaling completion
        // This ensures MEASUREMENT_COMPLETE handler has access to measurements
        onMeasurements(Array.from(cumulativeRef.current.values()));
        // NOW signal completion (this fires MEASUREMENT_COMPLETE action)
        var completionVersion = checkAndSignalCompletion('publish-once');
        if (completionVersion == null) {
            // Already published by another call, skip cleanup
            return;
        }
        // Immediately detach all observers to prevent post-publish churn
        try {
            observers.current.forEach(function (observer, key) {
                logSpellcastingEvent(key, 'detach', '🧹', 'detach-after-publish', {}, { force: true });
                observer.detach();
                coordinator === null || coordinator === void 0 ? void 0 : coordinator.unregisterObserver(key);
            });
            observers.current.clear();
        }
        catch (_a) {
            // best-effort cleanup
        }
    });
    var observers = useRef(new Map());
    var handleRef = useCallback(function (entry) { return function (node) {
        var _a;
        var key = entry.measurementKey;
        var existingObserver = observers.current.get(key);
        if (!node) {
            if (existingObserver) {
                logSpellcastingEvent(key, 'detach', '👋', 'detach');
                existingObserver.detach();
                observers.current.delete(key);
                coordinator === null || coordinator === void 0 ? void 0 : coordinator.unregisterObserver(key);
                // In publish-once mode (pre-initial publish), suppress deletion dispatches.
                // Detach/attach churn during React StrictMode and initial measurement can
                // cause required keys to be removed, preventing the first publish.
                if (!effectivePublishOnce || !publishedRef.current) {
                    dispatcher(key, null);
                }
            }
            return;
        }
        if (existingObserver) {
            return;
        }
        var componentId = extractComponentId(key);
        var isDebugComponent = componentId ? isComponentDebugEnabled(componentId) : false;
        var isEntryDebugComponent = isComponentDebugEnabled(entry.instance.id);
        if (isDebugComponent || isEntryDebugComponent) {
            logSpellcastingEvent(key, 'attach', '➕', 'attach', {
                entryId: normalizeComponentId(entry.instance.id),
                slotIndex: entry.slotIndex,
                orderIndex: entry.orderIndex,
                regionContentKind: (_a = entry.regionContent) === null || _a === void 0 ? void 0 : _a.kind,
            }, { force: isEntryDebugComponent && !isDebugComponent });
        }
        var observer = new MeasurementObserver(key, node, dispatcher);
        observer.attach();
        observers.current.set(key, observer);
        coordinator === null || coordinator === void 0 ? void 0 : coordinator.registerObserver(key, observer);
    }; }, [dispatcher, coordinator, effectivePublishOnce]);
    useEffect(function () { return function () {
        observers.current.forEach(function (observer, key) {
            logSpellcastingEvent(key, 'detach', '🧨', 'cleanup', {}, { force: true });
            observer.detach();
            coordinator === null || coordinator === void 0 ? void 0 : coordinator.unregisterObserver(key);
        });
        observers.current.clear();
    }; }, [coordinator]);
    // Use structural styles from the shared module to guarantee
    // measurement layer width === visible layer width (Phase 1: Measurement Perfection)
    var baseContainerStyle = createMeasurementLayerStyles(measuredColumnWidth !== null && measuredColumnWidth !== void 0 ? measuredColumnWidth : null, stagingMode);
    // CRITICAL: Add gap to match visible layer's flex gap
    // The visible layer gets `gap: var(--dm-column-gap, 12px)` from CSS
    // Measurement must include same gap or heights won't account for spacing
    var containerStyle = __assign(__assign({}, baseContainerStyle), { gap: '12px' });
    // Entry styles are also centralized to ensure consistency
    var entryStyles = measuredColumnWidth != null
        ? createMeasurementEntryStyles(measuredColumnWidth)
        : {
            width: '100%',
            maxWidth: '100%',
            boxSizing: 'border-box',
            height: 'auto',
            minHeight: 0,
            flexShrink: 0,
            flexGrow: 0,
            overflow: 'hidden',
            transform: 'none',
        };
    return (_jsx("div", __assign({ className: "dm-canvas-measurement-layer", style: containerStyle }, { children: entries.map(function (entry) { return (_jsx("div", __assign({ ref: handleRef(entry), className: "dm-measurement-entry", "data-measurement-key": entry.measurementKey, style: entryStyles }, { children: renderComponent(entry) }), entry.measurementKey)); }) })));
};
