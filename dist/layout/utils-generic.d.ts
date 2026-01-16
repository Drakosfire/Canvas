/**
 * Generic utility functions for region content creation
 * These replace statblock-specific utilities
 */
import type { RegionListContent } from '../types/canvas.types';
/**
 * Create region list content from items
 * Generic version - applications can provide domain-specific versions
 */
export declare function toRegionContent(kind: string, items: unknown[], startIndex: number, totalCount: number, isContinuation: boolean, metadata?: Record<string, unknown>): RegionListContent;
//# sourceMappingURL=utils-generic.d.ts.map