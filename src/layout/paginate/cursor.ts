/**
 * Pagination cursor utilities — region placement, span calculation, fit checks.
 */

import type { RegionCursor, RegionSpan } from '../types';
import { COMPONENT_VERTICAL_SPACING_PX } from '../utils';

export const BOTTOM_ZONE_SAFETY_BUFFER_PX = 20;

export const createCursor = (
    regionKey: string,
    maxHeight: number,
    initialOffset: number = 0
): RegionCursor => ({
    regionKey,
    currentOffset: initialOffset,
    maxHeight,
});

export const computeSpan = (cursor: RegionCursor, estimatedHeight: number): RegionSpan => ({
    top: cursor.currentOffset,
    bottom: cursor.currentOffset + estimatedHeight,
    height: estimatedHeight,
});

export const fitsInRegion = (span: RegionSpan, cursor: RegionCursor, _componentId?: string): boolean => {
    const cursorAfterPlacement = span.bottom;
    return cursorAfterPlacement <= (cursor.maxHeight - BOTTOM_ZONE_SAFETY_BUFFER_PX);
};

export const advanceCursor = (cursor: RegionCursor, span: RegionSpan): void => {
    cursor.currentOffset = span.bottom + COMPONENT_VERTICAL_SPACING_PX;
};
