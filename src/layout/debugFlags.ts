type DebugChannel =
    | 'paginate-spellcasting'
    | 'measurement-spellcasting'
    | 'planner-spellcasting'
    | 'layout-dirty'
    | 'measure-first'
    | 'layout-plan-diff'
    | 'column-cache-disabled';

type DebugFlagSource = Partial<Record<DebugChannel, unknown>>;

interface CanvasDebugGlobal {
    __CANVAS_DEBUG_FLAGS?: DebugFlagSource;
}

const DEBUG_DEFAULTS: Record<DebugChannel, boolean> = {
    'paginate-spellcasting': false,
    'measurement-spellcasting': false,
    'planner-spellcasting': false,
    'layout-dirty': false,
    'measure-first': false,
    'layout-plan-diff': false,
    'column-cache-disabled': false,
};

const ENV_VAR_MAP: Partial<Record<DebugChannel, string>> = {
    'paginate-spellcasting': 'CANVAS_DEBUG_PAGINATE',
    'measurement-spellcasting': 'CANVAS_DEBUG_MEASUREMENT',
    'planner-spellcasting': 'CANVAS_DEBUG_PLANNER',
    'layout-dirty': 'CANVAS_DEBUG_LAYOUT',
    'measure-first': 'CANVAS_DEBUG_MEASURE_FIRST',
    'layout-plan-diff': 'CANVAS_DEBUG_PLAN_DIFF',
    'column-cache-disabled': 'CANVAS_DEBUG_COLUMN_CACHE_DISABLED',
};

const REACT_APP_ENV_VAR_MAP: Partial<Record<DebugChannel, string>> = {
    'paginate-spellcasting': 'REACT_APP_CANVAS_DEBUG_PAGINATE',
    'measurement-spellcasting': 'REACT_APP_CANVAS_DEBUG_MEASUREMENT',
    'planner-spellcasting': 'REACT_APP_CANVAS_DEBUG_PLANNER',
    'layout-dirty': 'REACT_APP_CANVAS_DEBUG_LAYOUT',
    'measure-first': 'REACT_APP_CANVAS_DEBUG_MEASURE_FIRST',
    'layout-plan-diff': 'REACT_APP_CANVAS_DEBUG_PLAN_DIFF',
    'column-cache-disabled': 'REACT_APP_CANVAS_DEBUG_COLUMN_CACHE_DISABLED',
};

const parseBoolean = (value: unknown): boolean | undefined => {
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
        const normalized = value.trim().toLowerCase();
        if (['1', 'true', 'yes', 'on'].includes(normalized)) {
            return true;
        }
        if (['0', 'false', 'no', 'off'].includes(normalized)) {
            return false;
        }
    }

    return undefined;
};

const readEnvFlag = (channel: DebugChannel): boolean | undefined => {
    // React Scripts replaces process.env.REACT_APP_* at build time
    // Must access each env var directly (not through variable) for webpack to replace it
    let reactAppValue: string | undefined;
    
    switch (channel) {
        case 'paginate-spellcasting':
            // React Scripts replaces process.env.REACT_APP_* at build time
            reactAppValue = process.env.REACT_APP_CANVAS_DEBUG_PAGINATE;
            break;
        case 'measurement-spellcasting':
            // React Scripts replaces process.env.REACT_APP_* at build time
            reactAppValue = process.env.REACT_APP_CANVAS_DEBUG_MEASUREMENT;
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
    }
    
    if (reactAppValue !== undefined) {
        const parsed = parseBoolean(reactAppValue);
        if (parsed !== undefined) {
            return parsed;
        }
    }

    // Fallback to non-prefixed vars (for Node.js/server-side)
    const envKey = ENV_VAR_MAP[channel];
    if (!envKey) {
        return undefined;
    }

    return parseBoolean(typeof process !== 'undefined' && process.env ? process.env[envKey] : undefined);
};

const readGlobalFlags = (): DebugFlagSource | undefined => {
    if (typeof globalThis === 'undefined') {
        return undefined;
    }

    const candidate = (globalThis as CanvasDebugGlobal).__CANVAS_DEBUG_FLAGS;
    if (candidate && typeof candidate === 'object') {
        return candidate;
    }

    return undefined;
};

const readGlobalFlag = (channel: DebugChannel): boolean | undefined => {
    const flags = readGlobalFlags();
    if (!flags) {
        return undefined;
    }
    return parseBoolean(flags[channel]);
};

const storageKeyFor = (channel: DebugChannel): string => `canvas-debug:${channel}`;

const readStorageFlag = (channel: DebugChannel): boolean | undefined => {
    if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
        return undefined;
    }

    try {
        const value = window.localStorage.getItem(storageKeyFor(channel));
        return parseBoolean(value);
    } catch {
        return undefined;
    }
};

const isProduction = (): boolean =>
    typeof process !== 'undefined' && typeof process.env !== 'undefined' && process.env.NODE_ENV === 'production';

export const isDebugEnabled = (channel: DebugChannel): boolean => {
    const envValue = readEnvFlag(channel);
    if (envValue !== undefined) {
        return envValue;
    }

    const globalValue = readGlobalFlag(channel);
    if (globalValue !== undefined) {
        return globalValue;
    }

    const storageValue = readStorageFlag(channel);
    if (storageValue !== undefined) {
        return storageValue;
    }

    if (isProduction()) {
        return false;
    }

    return DEBUG_DEFAULTS[channel];
};

export const setDebugPreference = (channel: DebugChannel, enabled: boolean): void => {
    if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
        return;
    }

    try {
        window.localStorage.setItem(storageKeyFor(channel), String(enabled));
    } catch {
        // Ignore storage failures (e.g. private browsing mode)
    }
};

export type { DebugChannel };

