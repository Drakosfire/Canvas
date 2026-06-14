/**
 * Pagination cursor utilities — region placement, span calculation, fit checks.
 */
import type { RegionCursor, RegionSpan } from '../types';
export declare const BOTTOM_ZONE_SAFETY_BUFFER_PX = 20;
export declare const createCursor: (regionKey: string, maxHeight: number, initialOffset?: number) => RegionCursor;
export declare const computeSpan: (cursor: RegionCursor, estimatedHeight: number) => RegionSpan;
export declare const fitsInRegion: (span: RegionSpan, cursor: RegionCursor, _componentId?: string) => boolean;
export declare const advanceCursor: (cursor: RegionCursor, span: RegionSpan) => void;
//# sourceMappingURL=cursor.d.ts.map