/**
 * Generic utility functions for region content creation
 * These replace statblock-specific utilities
 */
/**
 * Create region list content from items
 * Generic version - applications can provide domain-specific versions
 */
export function toRegionContent(kind, items, startIndex, totalCount, isContinuation, metadata) {
    return {
        kind: kind,
        items: items,
        startIndex: startIndex,
        totalCount: totalCount,
        isContinuation: isContinuation,
        metadata: metadata,
    };
}
