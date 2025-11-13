import { isDebugEnabled } from '../debugFlags';
import type { SegmentDescriptor, SegmentIntent } from '../segmentTypes';

const isPlannerDebugEnabled = (): boolean => isDebugEnabled('planner-spellcasting');

// Read component IDs from env (same logic as paginate.ts to avoid circular dependency)
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
    // React Scripts replaces process.env.REACT_APP_* at build time
    const reactAppValue = process.env.REACT_APP_CANVAS_DEBUG_COMPONENTS;
    if (reactAppValue) {
        return parseComponentIdList(reactAppValue);
    }
    return [];
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
    readComponentIdsFromEnv().forEach((id) => ids.add(id));
    readComponentIdsFromStorage().forEach((id) => ids.add(id));
    return ids;
};

const DEBUG_COMPONENT_IDS = buildDebugComponentSet();

// If "*" is in the set, debug all components; otherwise check if component ID is in set
const shouldDebugComponent = (componentId: string): boolean =>
    DEBUG_COMPONENT_IDS.has('*') || DEBUG_COMPONENT_IDS.has(componentId);

export const logPlannerEvaluation = (
    emoji: string,
    label: string,
    context: Record<string, unknown> = {}
): void => {
    if (!isPlannerDebugEnabled()) {
        return;
    }

    // Filter by component ID if present in context
    if (context.componentId && typeof context.componentId === 'string') {
        if (!shouldDebugComponent(context.componentId)) {
            return;
        }
    }

    const payload = Object.keys(context).length > 0 ? context : undefined;
    if (payload) {
        console.log(`${emoji} [planner] ${label}`, payload);
    } else {
        console.log(`${emoji} [planner] ${label}`);
    }
};

export const logSegmentDecision = (
    descriptor: SegmentDescriptor,
    intent: SegmentIntent
): void => {
    if (!isPlannerDebugEnabled()) {
        return;
    }

    // Filter by component ID
    if (!shouldDebugComponent(descriptor.componentId)) {
        return;
    }

    const base = {
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
        logPlannerEvaluation('✅', 'segment-placed', {
            ...base,
            regionKey: intent.regionKey,
            topPx: intent.topPx,
            bottomPx: intent.bottomPx,
            cursorAfterPx: intent.cursorAfterPx,
            usedCachedRegion: intent.usedCachedRegion,
            reason: intent.reason,
        });
    } else {
        logPlannerEvaluation('⏭️', 'segment-deferred', {
            ...base,
            fromRegionKey: intent.fromRegionKey,
            toRegionKey: intent.toRegionKey,
            reason: intent.reason,
            attemptedRegionKey: intent.attemptedRegionKey,
        });
    }
};



