import { isDebugEnabled } from '../debugFlags';
import type { SegmentDescriptor, SegmentIntent } from '../segmentTypes';

const isPlannerDebugEnabled = (): boolean => isDebugEnabled('planner-spellcasting');

export const logPlannerEvaluation = (
    emoji: string,
    label: string,
    context: Record<string, unknown> = {}
): void => {
    if (!isPlannerDebugEnabled()) {
        return;
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



