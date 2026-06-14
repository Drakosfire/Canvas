/**
 * Pagination debug helpers — component ID normalization, env-based debug flags, logging.
 */

import type { MeasurementKey, MeasurementRecord } from '../types';
import { isDebugEnabled } from '../debugFlags';

const DEFAULT_DEBUG_COMPONENT_IDS: string[] = [];

const parseComponentIdList = (value: unknown): string[] => {
    if (Array.isArray(value)) {
        return value
            .map((item) => (typeof item === 'string' ? item.trim() : ''))
            .filter((item): item is string => item.length > 0);
    }

    if (typeof value === 'string') {
        return value
            .split(/[, ]+/)
            .map((item) => item.trim())
            .filter((item) => item.length > 0);
    }

    if (value && typeof value === 'object') {
        return parseComponentIdList((value as { ids?: unknown }).ids);
    }

    return [];
};

const readComponentIdsFromEnv = (): string[] => {
    const reactAppValue = process.env.REACT_APP_CANVAS_DEBUG_COMPONENTS;
    if (reactAppValue) {
        return parseComponentIdList(reactAppValue);
    }
    const envValue = typeof process !== 'undefined' && process.env ? process.env.CANVAS_DEBUG_COMPONENTS : undefined;
    return parseComponentIdList(envValue);
};

const readComponentIdsFromGlobal = (): string[] => {
    if (typeof globalThis === 'undefined') {
        return [];
    }
    const globalValue = (globalThis as { __CANVAS_DEBUG_COMPONENTS?: unknown }).__CANVAS_DEBUG_COMPONENTS;
    return parseComponentIdList(globalValue);
};

const readComponentIdsFromStorage = (): string[] => {
    if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
        return [];
    }
    try {
        const stored = window.localStorage.getItem('canvas-debug:components');
        return parseComponentIdList(stored);
    } catch {
        return [];
    }
};

const buildDebugComponentSet = (): Set<string> => {
    const ids = new Set<string>();
    DEFAULT_DEBUG_COMPONENT_IDS.forEach((id) => ids.add(id));
    readComponentIdsFromEnv().forEach((id) => ids.add(id));
    readComponentIdsFromGlobal().forEach((id) => ids.add(id));
    readComponentIdsFromStorage().forEach((id) => ids.add(id));
    return ids;
};

const DEBUG_COMPONENT_IDS = buildDebugComponentSet();

export const normalizeComponentId = (componentId: string): string => {
    const match = componentId.match(/^component-(\d+)$/);
    if (match) {
        const num = parseInt(match[1], 10);
        return `component-${num.toString().padStart(2, '0')}`;
    }
    return componentId;
};

export const matchesDebugComponent = (componentId: string, debugId: string): boolean => {
    const normalized = normalizeComponentId(componentId);
    const normalizedDebug = normalizeComponentId(debugId);
    return normalized === normalizedDebug;
};

export const isPaginationDebugEnabled = (): boolean => isDebugEnabled('paginate-spellcasting');
export const isPlannerDebugEnabled = (): boolean => isDebugEnabled('planner-spellcasting');
export const isCursorDebugEnabled = (): boolean => isDebugEnabled('cursor');

const shouldDebugComponent = (componentId: string): boolean =>
    DEBUG_COMPONENT_IDS.has('*') || DEBUG_COMPONENT_IDS.has(componentId);

export const isComponentDebugEnabled = (componentId: string): boolean =>
    shouldDebugComponent(componentId);

export const getDebugComponentIds = (): string[] => Array.from(DEBUG_COMPONENT_IDS);

export const nextDebugRunId = (): number => {
    debugRunId += 1;
    return debugRunId;
};

export const recordLastPaginationInputs = (inputs: LastPaginationInputs): void => {
    lastPaginationInputs = inputs;
};

if (typeof window !== 'undefined') {
    const enabledFlags: string[] = [];
    if (isPaginationDebugEnabled()) enabledFlags.push('paginate');
    if (isPlannerDebugEnabled()) enabledFlags.push('planner');
    if (isCursorDebugEnabled()) enabledFlags.push('cursor');
    if (isDebugEnabled('layout-plan-diff')) enabledFlags.push('plan-diff');
    if (isDebugEnabled('measurement-spellcasting')) enabledFlags.push('measurement');
    if (isDebugEnabled('layout-dirty')) enabledFlags.push('layout');
    if (isDebugEnabled('measure-first')) enabledFlags.push('measure-first');

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

export const logPaginationTrace = (emoji: string, label: string, payload?: unknown) => {
    if (!isPaginationDebugEnabled()) {
        return;
    }

    if (typeof payload !== 'undefined') {
        console.log(`${emoji} [paginate][Debug] ${label}`, payload);
    } else {
        console.log(`${emoji} [paginate][Debug] ${label}`);
    }
};

export const debugLog = (componentId: string, emoji: string, label: string, payload?: unknown) => {
    if (!shouldDebugComponent(componentId)) {
        return;
    }

    const normalizedId = normalizeComponentId(componentId);
    const basePayload: Record<string, unknown> = { componentId: normalizedId };

    if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
        const payloadObj = payload as Record<string, unknown>;
        const normalizedPayload = { ...payloadObj };
        if (normalizedPayload.componentId && typeof normalizedPayload.componentId === 'string') {
            normalizedPayload.componentId = normalizeComponentId(normalizedPayload.componentId);
        }
        Object.assign(basePayload, normalizedPayload);
    } else if (payload !== undefined) {
        basePayload.value = payload;
    }

    logPaginationTrace(emoji, label, basePayload);
};

export let debugRunId = 0;

export interface LastPaginationInputs {
    regionHeightPx: number;
    columnCount: number;
    requestedPageCount: number;
    bucketCount: number;
    measurementVersion: number | undefined;
    measurementKeysHash: string;
}

export let lastPaginationInputs: LastPaginationInputs | null = null;

export function hashMeasurements(measurements: Map<MeasurementKey, MeasurementRecord>): string {
    const entries = Array.from(measurements.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, record]) => `${key}:${record.height.toFixed(2)}`)
        .join('|');
    return entries;
}

export function areInputsIdentical(
    regionHeightPx: number,
    columnCount: number,
    requestedPageCount: number,
    bucketCount: number,
    measurementVersion: number | undefined,
    measurements: Map<MeasurementKey, MeasurementRecord>
): boolean {
    if (!lastPaginationInputs) {
        return false;
    }

    const measurementKeysHash = hashMeasurements(measurements);

    return (
        Math.abs(lastPaginationInputs.regionHeightPx - regionHeightPx) < 0.01 &&
        lastPaginationInputs.columnCount === columnCount &&
        lastPaginationInputs.requestedPageCount === requestedPageCount &&
        lastPaginationInputs.bucketCount === bucketCount &&
        lastPaginationInputs.measurementVersion === measurementVersion &&
        lastPaginationInputs.measurementKeysHash === measurementKeysHash
    );
}

export const shouldLogPaginationDecisions = (): boolean => isPaginationDebugEnabled();

export interface PaginationStats {
    heightSources: { measured: number; proportional: number; estimate: number };
    bottomZoneRejections: number;
    splitDecisions: number;
    componentsPlaced: number;
}

export const paginationStats: PaginationStats = {
    heightSources: { measured: 0, proportional: 0, estimate: 0 },
    bottomZoneRejections: 0,
    splitDecisions: 0,
    componentsPlaced: 0,
};

export const logPaginationDecision = (...args: unknown[]) => {
    if (!shouldLogPaginationDecisions()) {
        return;
    }

    let shouldLog = true;
    let normalizedArgs = [...args];

    if (args.length >= 3 && typeof args[2] === 'object' && args[2] !== null) {
        const payload = args[2] as { componentId?: string; [key: string]: unknown };
        if (payload.componentId) {
            shouldLog = shouldDebugComponent(payload.componentId);

            const normalizedPayload = { ...payload };
            normalizedPayload.componentId = normalizeComponentId(payload.componentId);
            normalizedArgs = [args[0], args[1], normalizedPayload, ...args.slice(3)];
        }
    }

    if (!shouldLog) {
        return;
    }

    // eslint-disable-next-line no-console
    console.debug('[paginate]', ...normalizedArgs);
};
