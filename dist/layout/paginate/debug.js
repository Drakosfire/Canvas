/**
 * Pagination debug helpers — component ID normalization, env-based debug flags, logging.
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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
import { isDebugEnabled } from '../debugFlags';
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
    var reactAppValue = process.env.REACT_APP_CANVAS_DEBUG_COMPONENTS;
    if (reactAppValue) {
        return parseComponentIdList(reactAppValue);
    }
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
export var normalizeComponentId = function (componentId) {
    var match = componentId.match(/^component-(\d+)$/);
    if (match) {
        var num = parseInt(match[1], 10);
        return "component-".concat(num.toString().padStart(2, '0'));
    }
    return componentId;
};
export var matchesDebugComponent = function (componentId, debugId) {
    var normalized = normalizeComponentId(componentId);
    var normalizedDebug = normalizeComponentId(debugId);
    return normalized === normalizedDebug;
};
export var isPaginationDebugEnabled = function () { return isDebugEnabled('paginate-spellcasting'); };
export var isPlannerDebugEnabled = function () { return isDebugEnabled('planner-spellcasting'); };
export var isCursorDebugEnabled = function () { return isDebugEnabled('cursor'); };
var shouldDebugComponent = function (componentId) {
    return DEBUG_COMPONENT_IDS.has('*') || DEBUG_COMPONENT_IDS.has(componentId);
};
export var isComponentDebugEnabled = function (componentId) {
    return shouldDebugComponent(componentId);
};
export var getDebugComponentIds = function () { return Array.from(DEBUG_COMPONENT_IDS); };
export var nextDebugRunId = function () {
    debugRunId += 1;
    return debugRunId;
};
export var recordLastPaginationInputs = function (inputs) {
    lastPaginationInputs = inputs;
};
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
export var logPaginationTrace = function (emoji, label, payload) {
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
export var debugLog = function (componentId, emoji, label, payload) {
    if (!shouldDebugComponent(componentId)) {
        return;
    }
    var normalizedId = normalizeComponentId(componentId);
    var basePayload = { componentId: normalizedId };
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
export var debugRunId = 0;
export var lastPaginationInputs = null;
export function hashMeasurements(measurements) {
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
export function areInputsIdentical(regionHeightPx, columnCount, requestedPageCount, bucketCount, measurementVersion, measurements) {
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
export var shouldLogPaginationDecisions = function () { return isPaginationDebugEnabled(); };
export var paginationStats = {
    heightSources: { measured: 0, proportional: 0, estimate: 0 },
    bottomZoneRejections: 0,
    splitDecisions: 0,
    componentsPlaced: 0,
};
export var logPaginationDecision = function () {
    var args = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        args[_i] = arguments[_i];
    }
    if (!shouldLogPaginationDecisions()) {
        return;
    }
    var shouldLog = true;
    var normalizedArgs = __spreadArray([], args, true);
    if (args.length >= 3 && typeof args[2] === 'object' && args[2] !== null) {
        var payload = args[2];
        if (payload.componentId) {
            shouldLog = shouldDebugComponent(payload.componentId);
            var normalizedPayload = __assign({}, payload);
            normalizedPayload.componentId = normalizeComponentId(payload.componentId);
            normalizedArgs = __spreadArray([args[0], args[1], normalizedPayload], args.slice(3), true);
        }
    }
    if (!shouldLog) {
        return;
    }
    // eslint-disable-next-line no-console
    console.debug.apply(console, __spreadArray(['[paginate]'], normalizedArgs, false));
};
