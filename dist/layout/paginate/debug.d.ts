/**
 * Pagination debug helpers — component ID normalization, env-based debug flags, logging.
 */
import type { MeasurementKey, MeasurementRecord } from '../types';
export declare const normalizeComponentId: (componentId: string) => string;
export declare const matchesDebugComponent: (componentId: string, debugId: string) => boolean;
export declare const isPaginationDebugEnabled: () => boolean;
export declare const isPlannerDebugEnabled: () => boolean;
export declare const isCursorDebugEnabled: () => boolean;
export declare const isComponentDebugEnabled: (componentId: string) => boolean;
export declare const getDebugComponentIds: () => string[];
export declare const nextDebugRunId: () => number;
export declare const recordLastPaginationInputs: (inputs: LastPaginationInputs) => void;
export declare const logPaginationTrace: (emoji: string, label: string, payload?: unknown) => void;
export declare const debugLog: (componentId: string, emoji: string, label: string, payload?: unknown) => void;
export declare let debugRunId: number;
export interface LastPaginationInputs {
    regionHeightPx: number;
    columnCount: number;
    requestedPageCount: number;
    bucketCount: number;
    measurementVersion: number | undefined;
    measurementKeysHash: string;
}
export declare let lastPaginationInputs: LastPaginationInputs | null;
export declare function hashMeasurements(measurements: Map<MeasurementKey, MeasurementRecord>): string;
export declare function areInputsIdentical(regionHeightPx: number, columnCount: number, requestedPageCount: number, bucketCount: number, measurementVersion: number | undefined, measurements: Map<MeasurementKey, MeasurementRecord>): boolean;
export declare const shouldLogPaginationDecisions: () => boolean;
export interface PaginationStats {
    heightSources: {
        measured: number;
        proportional: number;
        estimate: number;
    };
    bottomZoneRejections: number;
    splitDecisions: number;
    componentsPlaced: number;
}
export declare const paginationStats: PaginationStats;
export declare const logPaginationDecision: (...args: unknown[]) => void;
//# sourceMappingURL=debug.d.ts.map