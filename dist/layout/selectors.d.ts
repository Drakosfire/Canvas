/**
 * State Selectors
 *
 * Phase 3.3: Derivable state as selectors
 *
 * These selectors compute values that were previously stored in state.
 * They replace the need for:
 * - requiredMeasurementKeys (derived from measurementEntries)
 * - missingMeasurementKeys (derived from required + measurements)
 * - allComponentsMeasured (derived from missing === 0)
 *
 * Benefits:
 * - Single source of truth (no sync bugs)
 * - Computed fresh on read (always accurate)
 * - Less state to manage
 */
import type { CanvasLayoutState, MeasurementKey } from './types';
/**
 * Compute required measurement keys from measurement entries
 *
 * This replaces `state.requiredMeasurementKeys`
 */
export declare const selectRequiredMeasurementKeys: (state: CanvasLayoutState) => Set<MeasurementKey>;
/**
 * Compute missing measurement keys
 *
 * This replaces `state.missingMeasurementKeys`
 *
 * @param state - Canvas layout state
 * @param requiredKeys - Optional precomputed required keys (for efficiency)
 */
export declare const selectMissingMeasurementKeys: (state: CanvasLayoutState, requiredKeys?: Set<MeasurementKey>) => Set<MeasurementKey>;
/**
 * Check if all components have been measured
 *
 * This replaces `state.allComponentsMeasured`
 */
export declare const selectAllComponentsMeasured: (state: CanvasLayoutState) => boolean;
/**
 * Get measurement completeness statistics
 *
 * Useful for debugging and progress tracking
 */
export declare const selectMeasurementStats: (state: CanvasLayoutState) => {
    required: number;
    measured: number;
    missing: number;
    complete: boolean;
    percentage: number;
};
/**
 * Check if layout needs recalculation
 *
 * Combines multiple state checks into a single selector
 */
export declare const selectNeedsRecalculation: (state: CanvasLayoutState) => boolean;
/**
 * Debug helper: Compare selector output with stored state
 *
 * Use this to verify selectors match state during migration
 */
export declare const verifySelectorsMatchState: (state: CanvasLayoutState) => {
    requiredKeysMatch: boolean;
    missingKeysMatch: boolean;
    allMeasuredMatch: boolean;
    issues: string[];
};
//# sourceMappingURL=selectors.d.ts.map