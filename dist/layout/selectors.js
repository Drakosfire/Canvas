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
/**
 * Compute required measurement keys from measurement entries
 *
 * This replaces `state.requiredMeasurementKeys`
 */
export var selectRequiredMeasurementKeys = function (state) {
    return new Set(state.measurementEntries.map(function (entry) { return entry.measurementKey; }));
};
/**
 * Compute missing measurement keys
 *
 * This replaces `state.missingMeasurementKeys`
 *
 * @param state - Canvas layout state
 * @param requiredKeys - Optional precomputed required keys (for efficiency)
 */
export var selectMissingMeasurementKeys = function (state, requiredKeys) {
    var required = requiredKeys !== null && requiredKeys !== void 0 ? requiredKeys : selectRequiredMeasurementKeys(state);
    var missing = new Set();
    Array.from(required).forEach(function (key) {
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
export var selectAllComponentsMeasured = function (state) {
    var required = selectRequiredMeasurementKeys(state);
    if (required.size === 0) {
        return false; // No components to measure
    }
    // Check if all required keys have measurements
    return Array.from(required).every(function (key) { return state.measurements.has(key); });
};
/**
 * Get measurement completeness statistics
 *
 * Useful for debugging and progress tracking
 */
export var selectMeasurementStats = function (state) {
    var required = selectRequiredMeasurementKeys(state);
    var missing = selectMissingMeasurementKeys(state, required);
    var measured = required.size - missing.size;
    return {
        required: required.size,
        measured: measured,
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
export var selectNeedsRecalculation = function (state) {
    return state.isLayoutDirty && selectAllComponentsMeasured(state);
};
/**
 * Debug helper: Compare selector output with stored state
 *
 * Use this to verify selectors match state during migration
 */
export var verifySelectorsMatchState = function (state) {
    var issues = [];
    // Compare required keys
    var selectorRequired = selectRequiredMeasurementKeys(state);
    var stateRequired = state.requiredMeasurementKeys;
    var requiredKeysMatch = selectorRequired.size === stateRequired.size &&
        Array.from(selectorRequired).every(function (k) { return stateRequired.has(k); });
    if (!requiredKeysMatch) {
        issues.push("requiredMeasurementKeys mismatch: selector=".concat(selectorRequired.size, ", state=").concat(stateRequired.size));
    }
    // Compare missing keys
    var selectorMissing = selectMissingMeasurementKeys(state);
    var stateMissing = state.missingMeasurementKeys;
    var missingKeysMatch = selectorMissing.size === stateMissing.size &&
        Array.from(selectorMissing).every(function (k) { return stateMissing.has(k); });
    if (!missingKeysMatch) {
        issues.push("missingMeasurementKeys mismatch: selector=".concat(selectorMissing.size, ", state=").concat(stateMissing.size));
    }
    // Compare allComponentsMeasured
    var selectorAllMeasured = selectAllComponentsMeasured(state);
    var stateAllMeasured = state.allComponentsMeasured;
    var allMeasuredMatch = selectorAllMeasured === stateAllMeasured;
    if (!allMeasuredMatch) {
        issues.push("allComponentsMeasured mismatch: selector=".concat(selectorAllMeasured, ", state=").concat(stateAllMeasured));
    }
    return {
        requiredKeysMatch: requiredKeysMatch,
        missingKeysMatch: missingKeysMatch,
        allMeasuredMatch: allMeasuredMatch,
        issues: issues,
    };
};
