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
export const selectRequiredMeasurementKeys = (state: CanvasLayoutState): Set<MeasurementKey> => {
    return new Set(state.measurementEntries.map(entry => entry.measurementKey));
};

/**
 * Compute missing measurement keys
 * 
 * This replaces `state.missingMeasurementKeys`
 * 
 * @param state - Canvas layout state
 * @param requiredKeys - Optional precomputed required keys (for efficiency)
 */
export const selectMissingMeasurementKeys = (
    state: CanvasLayoutState,
    requiredKeys?: Set<MeasurementKey>
): Set<MeasurementKey> => {
    const required = requiredKeys ?? selectRequiredMeasurementKeys(state);
    const missing = new Set<MeasurementKey>();

    Array.from(required).forEach(key => {
        if (!state.measurements.has(key)) {
            missing.add(key);
        }
    });

    return missing;
};

/**
 * Check if all components have been measured
 * 
 * This replaces `state.allComponentsMeasured`
 */
export const selectAllComponentsMeasured = (state: CanvasLayoutState): boolean => {
    const required = selectRequiredMeasurementKeys(state);

    if (required.size === 0) {
        return false; // No components to measure
    }

    // Check if all required keys have measurements
    return Array.from(required).every(key => state.measurements.has(key));
};

/**
 * Get measurement completeness statistics
 * 
 * Useful for debugging and progress tracking
 */
export const selectMeasurementStats = (state: CanvasLayoutState): {
    required: number;
    measured: number;
    missing: number;
    complete: boolean;
    percentage: number;
} => {
    const required = selectRequiredMeasurementKeys(state);
    const missing = selectMissingMeasurementKeys(state, required);
    const measured = required.size - missing.size;

    return {
        required: required.size,
        measured,
        missing: missing.size,
        complete: required.size > 0 && missing.size === 0,
        percentage: required.size > 0 ? Math.round((measured / required.size) * 100) : 0,
    };
};

/**
 * Check if layout needs recalculation
 * 
 * Combines multiple state checks into a single selector
 */
export const selectNeedsRecalculation = (state: CanvasLayoutState): boolean => {
    return state.isLayoutDirty && selectAllComponentsMeasured(state);
};

/**
 * Debug helper: Compare selector output with stored state
 * 
 * Use this to verify selectors match state during migration
 */
export const verifySelectorsMatchState = (state: CanvasLayoutState): {
    requiredKeysMatch: boolean;
    missingKeysMatch: boolean;
    allMeasuredMatch: boolean;
    issues: string[];
} => {
    const issues: string[] = [];

    // Compare required keys
    const selectorRequired = selectRequiredMeasurementKeys(state);
    const stateRequired = state.requiredMeasurementKeys;
    const requiredKeysMatch = selectorRequired.size === stateRequired.size &&
        Array.from(selectorRequired).every(k => stateRequired.has(k));
    if (!requiredKeysMatch) {
        issues.push(`requiredMeasurementKeys mismatch: selector=${selectorRequired.size}, state=${stateRequired.size}`);
    }

    // Compare missing keys
    const selectorMissing = selectMissingMeasurementKeys(state);
    const stateMissing = state.missingMeasurementKeys;
    const missingKeysMatch = selectorMissing.size === stateMissing.size &&
        Array.from(selectorMissing).every(k => stateMissing.has(k));
    if (!missingKeysMatch) {
        issues.push(`missingMeasurementKeys mismatch: selector=${selectorMissing.size}, state=${stateMissing.size}`);
    }

    // Compare allComponentsMeasured
    const selectorAllMeasured = selectAllComponentsMeasured(state);
    const stateAllMeasured = state.allComponentsMeasured;
    const allMeasuredMatch = selectorAllMeasured === stateAllMeasured;
    if (!allMeasuredMatch) {
        issues.push(`allComponentsMeasured mismatch: selector=${selectorAllMeasured}, state=${stateAllMeasured}`);
    }

    return {
        requiredKeysMatch,
        missingKeysMatch,
        allMeasuredMatch,
        issues,
    };
};

