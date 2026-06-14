/**
 * Pagination cursor utilities — region placement, span calculation, fit checks.
 */
import { COMPONENT_VERTICAL_SPACING_PX } from '../utils';
export var BOTTOM_ZONE_SAFETY_BUFFER_PX = 20;
export var createCursor = function (regionKey, maxHeight, initialOffset) {
    if (initialOffset === void 0) { initialOffset = 0; }
    return ({
        regionKey: regionKey,
        currentOffset: initialOffset,
        maxHeight: maxHeight,
    });
};
export var computeSpan = function (cursor, estimatedHeight) { return ({
    top: cursor.currentOffset,
    bottom: cursor.currentOffset + estimatedHeight,
    height: estimatedHeight,
}); };
export var fitsInRegion = function (span, cursor, _componentId) {
    var cursorAfterPlacement = span.bottom;
    return cursorAfterPlacement <= (cursor.maxHeight - BOTTOM_ZONE_SAFETY_BUFFER_PX);
};
export var advanceCursor = function (cursor, span) {
    cursor.currentOffset = span.bottom + COMPONENT_VERTICAL_SPACING_PX;
};
