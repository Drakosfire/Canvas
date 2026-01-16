var DEBUG_DEFAULTS = {
    'paginate-spellcasting': false,
    'measurement-spellcasting': false,
    'measurement': false,
    'planner-spellcasting': false,
    'layout-dirty': false,
    'measure-first': false,
    'layout-plan-diff': false,
    'column-cache-disabled': false,
    'cursor': false,
    'plan-commit': false,
    'region-height': false,
};
var ENV_VAR_MAP = {
    'paginate-spellcasting': 'CANVAS_DEBUG_PAGINATE',
    'measurement-spellcasting': 'CANVAS_DEBUG_MEASUREMENT',
    'measurement': 'CANVAS_DEBUG_MEASUREMENT_GENERAL',
    'planner-spellcasting': 'CANVAS_DEBUG_PLANNER',
    'layout-dirty': 'CANVAS_DEBUG_LAYOUT',
    'measure-first': 'CANVAS_DEBUG_MEASURE_FIRST',
    'layout-plan-diff': 'CANVAS_DEBUG_PLAN_DIFF',
    'column-cache-disabled': 'CANVAS_DEBUG_COLUMN_CACHE_DISABLED',
    'cursor': 'CANVAS_DEBUG_CURSOR',
    'plan-commit': 'CANVAS_DEBUG_PLAN_COMMIT',
    'region-height': 'CANVAS_DEBUG_REGION_HEIGHT',
};
var REACT_APP_ENV_VAR_MAP = {
    'paginate-spellcasting': 'REACT_APP_CANVAS_DEBUG_PAGINATE',
    'measurement-spellcasting': 'REACT_APP_CANVAS_DEBUG_MEASUREMENT',
    'measurement': 'REACT_APP_CANVAS_DEBUG_MEASUREMENT_GENERAL',
    'planner-spellcasting': 'REACT_APP_CANVAS_DEBUG_PLANNER',
    'layout-dirty': 'REACT_APP_CANVAS_DEBUG_LAYOUT',
    'measure-first': 'REACT_APP_CANVAS_DEBUG_MEASURE_FIRST',
    'layout-plan-diff': 'REACT_APP_CANVAS_DEBUG_PLAN_DIFF',
    'column-cache-disabled': 'REACT_APP_CANVAS_DEBUG_COLUMN_CACHE_DISABLED',
    'cursor': 'REACT_APP_CANVAS_DEBUG_CURSOR',
    'plan-commit': 'REACT_APP_CANVAS_DEBUG_PLAN_COMMIT',
    'region-height': 'REACT_APP_CANVAS_DEBUG_REGION_HEIGHT',
};
var parseBoolean = function (value) {
    if (typeof value === 'boolean') {
        return value;
    }
    if (typeof value === 'number') {
        if (value === 1) {
            return true;
        }
        if (value === 0) {
            return false;
        }
    }
    if (typeof value === 'string') {
        var normalized = value.trim().toLowerCase();
        if (['1', 'true', 'yes', 'on'].includes(normalized)) {
            return true;
        }
        if (['0', 'false', 'no', 'off'].includes(normalized)) {
            return false;
        }
    }
    return undefined;
};
var readEnvFlag = function (channel) {
    // React Scripts replaces process.env.REACT_APP_* at build time
    // Must access each env var directly (not through variable) for webpack to replace it
    var reactAppValue;
    switch (channel) {
        case 'paginate-spellcasting':
            // React Scripts replaces process.env.REACT_APP_* at build time
            reactAppValue = process.env.REACT_APP_CANVAS_DEBUG_PAGINATE;
            break;
        case 'measurement-spellcasting':
            // React Scripts replaces process.env.REACT_APP_* at build time
            reactAppValue = process.env.REACT_APP_CANVAS_DEBUG_MEASUREMENT;
            break;
        case 'measurement':
            reactAppValue = process.env.REACT_APP_CANVAS_DEBUG_MEASUREMENT_GENERAL;
            break;
        case 'planner-spellcasting':
            // React Scripts replaces process.env.REACT_APP_* at build time
            reactAppValue = process.env.REACT_APP_CANVAS_DEBUG_PLANNER;
            break;
        case 'layout-dirty':
            // React Scripts replaces process.env.REACT_APP_* at build time
            reactAppValue = process.env.REACT_APP_CANVAS_DEBUG_LAYOUT;
            break;
        case 'measure-first':
            // React Scripts replaces process.env.REACT_APP_* at build time
            reactAppValue = process.env.REACT_APP_CANVAS_DEBUG_MEASURE_FIRST;
            break;
        case 'layout-plan-diff':
            // React Scripts replaces process.env.REACT_APP_* at build time
            reactAppValue = process.env.REACT_APP_CANVAS_DEBUG_PLAN_DIFF;
            break;
        case 'column-cache-disabled':
            reactAppValue = process.env.REACT_APP_CANVAS_DEBUG_COLUMN_CACHE_DISABLED;
            break;
        case 'cursor':
            reactAppValue = process.env.REACT_APP_CANVAS_DEBUG_CURSOR;
            break;
        case 'plan-commit':
            reactAppValue = process.env.REACT_APP_CANVAS_DEBUG_PLAN_COMMIT;
            break;
        case 'region-height':
            reactAppValue = process.env.REACT_APP_CANVAS_DEBUG_REGION_HEIGHT;
            break;
    }
    if (reactAppValue !== undefined) {
        var parsed = parseBoolean(reactAppValue);
        if (parsed !== undefined) {
            return parsed;
        }
    }
    // Fallback to non-prefixed vars (for Node.js/server-side)
    var envKey = ENV_VAR_MAP[channel];
    if (!envKey) {
        return undefined;
    }
    return parseBoolean(typeof process !== 'undefined' && process.env ? process.env[envKey] : undefined);
};
var readGlobalFlags = function () {
    if (typeof globalThis === 'undefined') {
        return undefined;
    }
    var candidate = globalThis.__CANVAS_DEBUG_FLAGS;
    if (candidate && typeof candidate === 'object') {
        return candidate;
    }
    return undefined;
};
var readGlobalFlag = function (channel) {
    var flags = readGlobalFlags();
    if (!flags) {
        return undefined;
    }
    return parseBoolean(flags[channel]);
};
var storageKeyFor = function (channel) { return "canvas-debug:".concat(channel); };
var readStorageFlag = function (channel) {
    if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
        return undefined;
    }
    try {
        var value = window.localStorage.getItem(storageKeyFor(channel));
        return parseBoolean(value);
    }
    catch (_a) {
        return undefined;
    }
};
var isProduction = function () {
    return typeof process !== 'undefined' && typeof process.env !== 'undefined' && process.env.NODE_ENV === 'production';
};
export var isDebugEnabled = function (channel) {
    var envValue = readEnvFlag(channel);
    if (envValue !== undefined) {
        return envValue;
    }
    var globalValue = readGlobalFlag(channel);
    if (globalValue !== undefined) {
        return globalValue;
    }
    var storageValue = readStorageFlag(channel);
    if (storageValue !== undefined) {
        return storageValue;
    }
    if (isProduction()) {
        return false;
    }
    return DEBUG_DEFAULTS[channel];
};
export var setDebugPreference = function (channel, enabled) {
    if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
        return;
    }
    try {
        window.localStorage.setItem(storageKeyFor(channel), String(enabled));
    }
    catch (_a) {
        // Ignore storage failures (e.g. private browsing mode)
    }
};
