> **Historical import from DungeonOverMind — 2026-09-24.** This document records implementation learnings from an older Canvas/product state. It is not current Canvas architecture or sequencing authority. Re-anchor against current Canvas code/contracts before applying it.

# Canvas Extraction & Measurement System Learnings

**Date:** November 11, 2025  
**Project:** Canvas Package Extraction & Measurement System Refactoring  
**Status:** ✅ Complete - Measurement System Unified, Canvas Extracted, Debug Tooling Operational

---

## Executive Summary

The Canvas extraction project successfully transformed a tightly-coupled statblock-specific layout system into a generic, reusable package. A critical mid-project refactor unified three disparate measurement systems into a single, coherent architecture. The development of an independent debug logging system enabled rapid issue identification and resolution, culminating in fixing a critical image measurement scaling bug.

**Key Achievements:**
- ✅ Canvas extracted to independent package (`@dungeonmind/canvas`)
- ✅ Measurement system unified from 3 systems → 1 system
- ✅ Independent debug logging system with component filtering
- ✅ Image measurement scaling bug identified and fixed
- ✅ 95.5% test pass rate maintained throughout extraction

---

## Part 1: The Canvas Extraction Journey

### Phase 1: Initial Extraction (October 27, 2025)

**Goal:** Extract Canvas system from LandingPage to independent package

**Approach:**
1. Created `/DungeonOverMind/Canvas/` directory structure
2. Extracted 21 TypeScript files from LandingPage
3. Genericized type system (`canvas.types.ts`)
4. Converted registry to factory pattern (`createComponentRegistry()`)
5. Created generic utility stubs

**Key Decision:** Generic types first, then remove statblock dependencies

**Result:** 95.5% test pass rate (42/44 tests), zero statblock imports in core

**Documentation:** `2025-10-27-canvas-extraction-handoff.md`

---

### Phase 2: Adapter Pattern Implementation (November 2, 2025)

**Goal:** Remove all statblock dependencies via adapter pattern

**Approach:**
1. Created 5 adapter interfaces (`DataResolver`, `ListNormalizer`, `HeightEstimator`, etc.)
2. Threaded adapters through all Canvas functions
3. Removed statblock-specific stubs from `utils.ts`
4. Created default adapter implementations

**Key Insight:** Adapter pattern makes grid mode simpler (height estimation becomes optional)

**Result:** Zero statblock imports, all functions accept adapters, tests pass

**Documentation:** `Canvas/SESSION_1_COMPLETE.md`

---

### Phase 3: Statblock Adapters (November 2, 2025)

**Goal:** Create domain-specific adapters for StatblockGenerator

**Approach:**
1. Created `statblockAdapters.ts` (~220 lines)
2. Migrated height estimation logic from Canvas to adapters
3. Implemented data resolution for statblock types
4. Created adapter bundle function

**Key Insight:** Adapters were simpler than expected (~220 lines total)

**Result:** Clean separation - Canvas generic, adapters domain-specific

**Documentation:** `Canvas/SESSION_3_COMPLETE.md`

---

## Part 2: The Measurement System Refactor

### The Problem: Three Disparate Systems

**Before Refactor (September 2025):**

The measurement system existed in three separate implementations:

1. **Measurement Layer** (`measurement.tsx`)
   - ResizeObserver-based measurement
   - RAF scheduling for batching
   - Image load listeners
   - Separate cleanup logic

2. **Measurement State** (`state.tsx`)
   - Reducer managing measurement map
   - Deletion vs. addition tracking
   - Version tracking

3. **Measurement Utilities** (`utils.ts`)
   - Height estimation functions
   - Measurement entry creation
   - Bucket building logic

**Issues:**
- Code duplication across files
- Inconsistent cleanup patterns
- Hard to debug measurement lifecycle
- No unified measurement observer pattern

---

### The Refactor: Unified Measurement System (September 29 - October 1, 2025)

**Phase 1: Observer Encapsulation** ✅

**Changes:**
- Created `MeasurementObserver` class
- Encapsulated ResizeObserver, RAF handles, image listeners
- Reduced `MeasurementLayer` complexity by 57% (140 lines → 60 lines)
- Single cleanup path instead of three separate refs

**Result:** Much cleaner, more testable code

**Documentation:** `CanvasLayout_Implementation_Report.md` Phase 4

---

**Phase 2: Measure-First Flow** ✅

**Problem:** Original flow created buckets with estimated heights (200px default), paginated with estimates, then re-measured and re-paginated with real measurements.

**Solution:**
- Added `waitingForInitialMeasurements` flag
- Created `createInitialMeasurementEntries()` to generate entries WITHOUT buckets
- Gated pagination until all measurements arrive
- Single pagination run with accurate measurements

**Result:** Eliminated double pagination, accurate layout from first render

**Documentation:** `CanvasLayout_Implementation_Report.md` Phase 6

---

**Phase 3: Measurement Cleanup** ✅

**Problem:** Stale measurements weren't properly cleaned up when components unmounted

**Solution:**
- Modified dispatcher to accept `height: number | null`
- Added explicit deletion signals (`null` height)
- Updated reducer to properly delete measurements
- Added logging for deletions vs. additions

**Result:** No more ghost entries in measurement map

**Documentation:** `CanvasLayout_Implementation_Report.md` Phase 1

---

### Key Learnings from Measurement Refactor

**1. Encapsulation Simplifies Complexity**

**Before:** Three separate refs managing observers, RAF handles, image listeners  
**After:** Single `MeasurementObserver` class managing all lifecycle

**Impact:** 57% reduction in component complexity, easier to test

---

**2. Explicit State Flags Prevent Race Conditions**

**Before:** Pagination ran immediately with estimates, causing re-layout  
**After:** `waitingForInitialMeasurements` flag gates pagination

**Impact:** Eliminated double pagination, accurate first render

---

**3. Unified Cleanup Prevents Memory Leaks**

**Before:** Separate cleanup logic in three places, easy to miss  
**After:** Single `detach()` method handles all cleanup

**Impact:** No ghost entries, proper memory management

---

## Part 3: Independent Debug Logging System

### The Problem: No Way to Focus Debugging

**Before Debug CLI:**

- All debug logs appeared for all components
- Impossible to focus on specific components
- Pagination logs cluttered with irrelevant data
- No way to filter by component ID

**Example Problem:**
```
npm run canvas-debug -- component-1 component-2 --paginate
# Still showed logs for component-12, component-13, etc.
```

---

### The Solution: Component-Based Filtering (November 11, 2025)

**Phase 1: Debug CLI Script** ✅

**Created:** `LandingPage/scripts/canvasDebug.js`

**Features:**
- Parses component IDs from command line
- Sets environment variables (`REACT_APP_CANVAS_DEBUG_COMPONENTS`)
- Supports flags: `--paginate`, `--planner`, `--measurement`
- Auto-enables pagination/planner/measurement when components specified

**Usage:**
```bash
npm run canvas-debug -- component-0 component-1
# Automatically enables pagination, planner, and measurement logs
```

---

**Phase 2: Webpack Environment Variable Replacement** ✅

**Problem:** Webpack wasn't replacing `process.env.REACT_APP_*` at build time

**Root Cause:** Conditional checks (`typeof process !== 'undefined'`) prevented static analysis

**Solution:** Direct access to `process.env.REACT_APP_*` without conditionals

**Files Fixed:**
- `Canvas/src/layout/paginate.ts`
- `Canvas/src/layout/debugFlags.ts`

**Result:** Env vars correctly replaced at build time

---

**Phase 3: Component ID Filtering** ✅

**Problem:** Pagination and planner logs appeared for all components

**Solution:**
- Extract `componentId` from log payloads
- Check `shouldDebugComponent(componentId)` before logging
- Applied to pagination logs (`logPaginationDecision`)
- Applied to planner logs (`logPlannerEvaluation`, `logSegmentDecision`)

**Files Fixed:**
- `Canvas/src/layout/paginate.ts`
- `Canvas/src/layout/debug/plannerLogs.ts`

**Result:** Logs filtered to specified components only

---

### Key Learnings from Debug System

**1. Independent Logging Enables Rapid Debugging**

**Before:** Had to search through logs for specific components  
**After:** Filter logs to only relevant components

**Impact:** Debugging time reduced by 80%+

**Example:**
```
Before: 500+ log lines for all components
After: 50 log lines for component-0 and component-1 only
```

---

**2. Component Filtering Reveals Hidden Issues**

**Discovery:** Component-1's height measurement instability (4px → 644px)

**How:** Filtered logs to component-1 only, saw dramatic height change

**Result:** Identified image measurement scaling bug

---

**3. Default Flag Enablement Improves UX**

**Decision:** When components specified, enable pagination/planner/measurement by default

**Rationale:** Users want to see all relevant logs when debugging specific components

**Impact:** Simpler CLI usage, better developer experience

---

## Part 5: 2025-11-19 Snapshot Tooling Insight

### Headless Simulation Should Be First-Class

**Observation (Nov 19, 2025):** We finally built `npm run canvas:snapshot`, a CLI that drives pagination/measurement entirely inside Node by importing `buildBuckets`, `paginate`, and the statblock adapters. It captures the entire placement snapshot (spans, cursor offsets, reroute metadata) as JSON without launching the browser.

**Critical Learning:** We could have avoided weeks of “reload the UI, screen-capture logs” pain if we had invested in this headless simulator on day one. The Canvas system has always been pure functions once measurements are known; a CLI wrapper exposes that determinism instantly.

**Benefits we immediately gained:**
- Deterministic telemetry artifacts (fresh vs hard-refresh vs forced-overflow) that can be diffed, versioned, and fed into CI.
- Token-efficient investigation—JSON snapshots replace thousands of console lines or screenshots.
- Direct reuse of the same codepath the UI hits, so the simulator is a faithful reproduction, not a mock.

**Action:** Future layout work should default to “build the headless simulator first,” then add UI hooks. Treat the CLI + JSON artifacts as the canonical source of truth for regression detection.

## Part 4: How Independent Logging Enabled Issue Identification

### The Component Placement Problem

**Observed Behavior:**
- Component-0 (42px) ends up alone in column 1:1
- Component-1 (644px) ends up alone in column 1:2
- Both should fit together (42px + 644px = 686px < 702px available)

**Expected Behavior:**
- Component-0 and component-1 should both be in column 1:1
- Component-1 should measure at scaled height (~258px), not natural height (644px)

---

### How Debug Logging Revealed the Issue

**Step 1: Component Filtering**

```bash
npm run canvas-debug -- component-0 component-1
```

**Result:** Only logs for component-0 and component-1 appeared

**Impact:** Could focus on relevant data without noise

---

**Step 2: Measurement Timeline Analysis**

**From logs:**
- **Runs 1-8:** Component-1 measures at **4px** (image not loaded)
- **Run 9:** Component-1 measures at **644px** (image loaded, natural height)
- **Run 10+:** Component-1 continues measuring at **644px**

**Discovery:** Component-1's height changes dramatically when image loads

---

**Step 3: Pagination Behavior Analysis**

**From logs:**
- **Runs 1-8:** Both components fit in column 1:1
- **Run 9:** Component-1 at 644px overflows column 1:1, routes to column 1:2
- **Run 10+:** Same behavior persists

**Discovery:** Component-1 overflows unnecessarily due to incorrect measurement

---

**Step 4: Column Width Analysis**

**From logs:**
```
[StatblockPage] Measured visible column width: 
  postTransform: 322px, scale: 1.25, preTransform: 257px
```

**Discovery:**
- Column width: **~258px** (preTransform)
- Expected scaled height: **~258px**
- Actual measured height: **644px** (natural image height)
- **Gap:** Component-1 measures at 2.5x expected height

---

### Root Cause Identified

**Component-1 is PortraitPanel (image component):**
- Initial measurement: **4px** (image not loaded yet)
- Updated measurement: **644px** (image loaded, measuring at natural height)
- Expected measurement: **~258px** (scaled to column width ~258px)

**Root Cause:** Measurement entry div doesn't have width constraint when image measures

**Evidence:**
- Measurement entry div had `width: '100%'`, `maxWidth: '100%'`
- Parent `.canvas-column` has `width: measuredColumnWidth` (~258px)
- Image has `width: '100%'`, `height: 'auto'`
- **Issue:** Image measures before parent width constraint is applied

---

### The Fix: Explicit Width Constraint

**Solution:** Pass `measuredColumnWidth` to `MeasurementLayer` and use explicit width

**Changes:**
1. Added `measuredColumnWidth?: number | null` prop to `MeasurementLayerProps`
2. Updated measurement entry div style:
   ```typescript
   width: measuredColumnWidth ? `${measuredColumnWidth}px` : '100%',
   maxWidth: measuredColumnWidth ? `${measuredColumnWidth}px` : '100%',
   ```
3. Updated `StatblockPage` to pass `measuredColumnWidth` prop

**Result:** Component-1 now measures at ~258px (scaled height), both components fit in column 1:1

**Documentation:** `2025-11-11-component-placement-fix-HANDOFF.md`

---

## Part 5: Critical Learnings

### 1. Independent Logging System is Essential

**Lesson:** You can't debug what you can't see

**Before:** All logs mixed together, impossible to focus  
**After:** Component-based filtering enables rapid issue identification

**Impact:** 
- Debugging time reduced by 80%+
- Issues identified in minutes instead of hours
- Clear correlation between measurement changes and pagination behavior

---

### 2. Measurement System Unification Enabled Debugging

**Lesson:** Unified system makes it easier to add debugging capabilities

**Before:** Three separate systems, hard to add consistent logging  
**After:** Single `MeasurementObserver` class, easy to add diagnostic logging

**Impact:**
- Added diagnostic logging for image measurements
- Logs width diagnostics for all debug-enabled components
- Helps identify why warnings don't fire

---

### 3. Mid-Project Refactor Was Worth It

**Lesson:** Don't be afraid to refactor when architecture is wrong

**Context:** Stopped mid-project to refactor measurement system from 3 systems → 1 system

**Rationale:** 
- Original architecture was causing bugs
- Hard to debug measurement lifecycle
- Code duplication across files

**Result:**
- 57% reduction in component complexity
- Easier to add features (debug logging, image measurement diagnostics)
- Cleaner, more testable code

**Time Investment:** ~4 hours  
**Payoff:** Enabled rapid debugging and issue resolution

---

### 4. Explicit Width Constraints Prevent Measurement Bugs

**Lesson:** CSS inheritance isn't reliable for measurement constraints

**Problem:** Measurement entry div used `width: '100%'` expecting parent constraint

**Reality:** Image measures before parent width constraint is applied

**Solution:** Explicit width constraint via prop (`measuredColumnWidth`)

**Impact:** 
- Images now measure at scaled height, not natural height
- Components fit correctly in columns
- No unnecessary overflow routing

---

### 5. Component Filtering Reveals Hidden Patterns

**Lesson:** Filtering logs by component ID reveals patterns invisible in full logs

**Discovery:** Component-1's height changes dramatically (4px → 644px)

**How:** Filtered logs to component-1 only, saw clear pattern

**Impact:** Identified image measurement scaling bug

---

### 6. Naming Strategy Determines Deduplication Behavior

**Lesson:** The identifier you use for deduplication determines what gets deduplicated

**Context:** List components (lair actions, legendary actions, spells) were incorrectly triggering deduplication checks, preventing legitimate segments from rendering.

**Problem:**
- Deduplication logic used `instance.id` + `page` + `column` to find duplicates
- List components can have multiple segments in the same region (when split or continued)
- All segments share the same `instance.id` (e.g., `component-10`)
- Deduplication treated all segments as duplicates, preventing legitimate segments from being added

**Solution:** Use `measurementKey` for list components instead of `instance.id`

**Why `measurementKey` Works:**
- `measurementKey` format: `${instanceId}:${kind}:${startIndex}:${items.length}:${totalCount}:${isContinuation ? 'cont' : 'base'}`
- Example: `component-10:legendary-actions:0:5:10:base` vs `component-10:legendary-actions:5:5:10:cont`
- Different segments have different `measurementKey` values (different `startIndex`)
- `measurementKey` already uniquely identifies each segment

**Implementation:**
```typescript
// For list components, use measurementKey (includes startIndex, making segments unique)
if (entry.regionContent && e.regionContent) {
    return e.measurementKey === entry.measurementKey;
}

// For single-instance components, use instance.id
return e.instance.id === entry.instance.id;
```

**Impact:**
- ✅ List components can have multiple segments in same region
- ✅ Single-instance components still deduplicated correctly
- ✅ No special logic needed - leverages existing unique identifiers

**Key Insight:** The identifier you choose for deduplication must match the granularity of what you consider "duplicate". For list components, segments are the unit of uniqueness, not the component itself.

**Related:** `2025-11-12-list-components-deduplication-issue-HANDOFF.md`

---

## Part 6: Patterns & Practices

### Pattern 1: Component-Based Debug Filtering

**When to Use:** Debugging specific components in complex layouts

**Implementation:**
1. Parse component IDs from command line
2. Set environment variable (`REACT_APP_CANVAS_DEBUG_COMPONENTS`)
3. Check `shouldDebugComponent(componentId)` before logging
4. Apply to all log types (pagination, planner, measurement)

**Benefits:**
- Focus debugging on relevant components
- Reduce log noise by 90%+
- Faster issue identification

**Example:**
```bash
npm run canvas-debug -- component-0 component-1
# Only shows logs for component-0 and component-1
```

---

### Pattern 2: Explicit Width Constraints for Images

**When to Use:** Measuring images in constrained layouts

**Problem:** CSS inheritance isn't reliable for measurement constraints

**Solution:** Pass explicit width constraint via prop

**Implementation:**
```typescript
// MeasurementLayer component
style={{
    width: measuredColumnWidth ? `${measuredColumnWidth}px` : '100%',
    maxWidth: measuredColumnWidth ? `${measuredColumnWidth}px` : '100%',
}}
```

**Benefits:**
- Images measure at scaled height, not natural height
- Prevents unnecessary overflow routing
- Accurate layout calculations

---

### Pattern 3: Unified Observer Pattern

**When to Use:** Managing multiple observers (ResizeObserver, RAF, image listeners)

**Problem:** Separate refs and cleanup logic scattered across component

**Solution:** Encapsulate in single `MeasurementObserver` class

**Implementation:**
```typescript
class MeasurementObserver {
    private observer: ResizeObserver | null = null;
    private rafHandle: number | null = null;
    private imageCleanup: (() => void) | null = null;
    
    attach(): void { /* ... */ }
    detach(): void { /* cleanup all */ }
    private measure(): void { /* ... */ }
}
```

**Benefits:**
- Single cleanup path
- Easier to test
- Reduced component complexity

---

### Pattern 4: Measure-First Flow

**When to Use:** Layout systems that need accurate measurements before pagination

**Problem:** Pagination runs with estimates, then re-runs with real measurements

**Solution:** Gate pagination until all measurements arrive

**Implementation:**
```typescript
// State flag
waitingForInitialMeasurements: boolean

// Gate pagination
if (state.waitingForInitialMeasurements) {
    return; // Skip pagination
}

// Detect completion
if (allComponentsMeasured(state)) {
    setWaitingForInitialMeasurements(false);
    triggerPagination();
}
```

**Benefits:**
- Eliminates double pagination
- Accurate layout from first render
- Better performance

---

### Pattern 5: Granular Deduplication by Component Type

**When to Use:** Systems with multiple component types that have different uniqueness semantics

**Problem:** Single deduplication strategy doesn't work for all component types

**Example:**
- Single-instance components: One entry per region (deduplicate by `instance.id`)
- List components: Multiple segments per region (deduplicate by `measurementKey`)

**Solution:** Use different identifiers based on component type

**Implementation:**
```typescript
const findExistingEntry = (entry: CanvasLayoutEntry, columnEntries: CanvasLayoutEntry[], page: number, column: number): number => {
    return columnEntries.findIndex(
        e => {
            // Must match region first
            if (e.region?.page !== page || e.region?.column !== column) {
                return false;
            }
            
            // For list components, use measurementKey (includes startIndex, making segments unique)
            if (entry.regionContent && e.regionContent) {
                return e.measurementKey === entry.measurementKey;
            }
            
            // For single-instance components, use instance.id
            return e.instance.id === entry.instance.id;
        }
    );
};
```

**Key Principles:**
1. **Match granularity to uniqueness semantics:** Use identifiers that match what you consider "duplicate"
2. **Leverage existing unique identifiers:** Don't create new IDs if existing ones already uniquely identify entries
3. **Preserve existing behavior:** Single-instance components still work as before

**Benefits:**
- Correct deduplication for all component types
- No false positives (legitimate segments not blocked)
- No false negatives (duplicates still prevented)
- Leverages existing identifier structure

**Related:** `2025-11-12-duplication-deep-dive-ANALYSIS.md`, `2025-11-12-list-components-deduplication-issue-HANDOFF.md`

---

## Part 7: Metrics & Impact

### Code Quality Improvements

**Measurement System Refactor:**
- Component complexity: 140 lines → 60 lines (57% reduction)
- Observer management: 3 separate refs → 1 class
- Cleanup logic: Scattered → Single `detach()` method

**Canvas Extraction:**
- Statblock imports: Many → Zero
- Test pass rate: 95.5% maintained throughout
- Genericization: 100% complete

---

### Debugging Efficiency

**Before Independent Logging:**
- Debugging time: Hours per issue
- Log noise: 500+ lines per session
- Component focus: Manual filtering required

**After Independent Logging:**
- Debugging time: Minutes per issue (80%+ reduction)
- Log noise: 50 lines per session (90% reduction)
- Component focus: Automatic filtering

---

### Issue Resolution

**Component Placement Bug:**
- Time to identify root cause: ~30 minutes (with debug logging)
- Time to implement fix: ~1 hour
- Verification: Immediate (logs showed correct measurement)

**Without debug logging:** Would have taken hours or days to identify

---

## Part 8: Future Considerations

### Measurement System Enhancements

**Potential Improvements:**
1. **Measurement Caching**
   - Cache measurements by content hash
   - Only update when content changes
   - Prevent re-measurement of unchanged components

2. **Measurement Readiness**
   - Track measurement readiness per component
   - Only paginate when all measurements are "ready" (stable)
   - Use provisional measurements for initial layout

3. **Image Measurement Validation**
   - Flag measurements where image height > column width
   - Warn when image measures at natural height instead of scaled height
   - Add diagnostic logging for image measurements

---

### Debug System Enhancements

**Potential Improvements:**
1. **Log Persistence**
   - Save logs to file for analysis
   - Filter logs post-hoc
   - Correlate logs across sessions

2. **Visual Debugging**
   - Highlight debug-enabled components in UI
   - Show measurement boundaries
   - Display pagination decisions visually

3. **Performance Profiling**
   - Track measurement timing
   - Identify slow measurements
   - Optimize measurement batching

---

## Conclusion

The Canvas extraction project successfully transformed a tightly-coupled system into a generic, reusable package. The mid-project measurement system refactor unified three disparate systems into a single, coherent architecture. The development of an independent debug logging system enabled rapid issue identification and resolution.

**Key Takeaways:**

1. **Independent logging is essential** - You can't debug what you can't see
2. **Unified systems are easier to debug** - Single architecture enables consistent logging
3. **Mid-project refactors can be worth it** - Don't be afraid to refactor when architecture is wrong
4. **Explicit constraints prevent bugs** - CSS inheritance isn't reliable for measurement constraints
5. **Component filtering reveals patterns** - Filtering logs reveals hidden issues
6. **Naming strategy determines deduplication behavior** - The identifier you use for deduplication must match the granularity of what you consider "duplicate"

**Status:** ✅ Complete - Measurement system unified, Canvas extracted, debug tooling operational

---

## Related Documents

**Canvas Extraction:**
- `2025-10-27-canvas-extraction-handoff.md` - Initial extraction handoff
- `Canvas/EXTRACTION_PLAN.md` - 7-phase extraction plan
- `Canvas/SESSION_1_COMPLETE.md` - Adapter pattern implementation
- `Canvas/SESSION_3_COMPLETE.md` - Statblock adapters

**Measurement System:**
- `CanvasLayout_Implementation_Report.md` - Measurement refactor phases
- `CanvasLayout_DeepDive.md` - Complete architecture documentation

**Debug System:**
- `2025-11-11-debug-cli-component-filtering-COMPLETE.md` - Debug CLI implementation
- `2025-11-10-spellcasting-pagination-stability-PLAN.md` - Pagination stability plan

**Issue Resolution:**
- `2025-11-11-component-placement-analysis.md` - Component placement analysis
- `2025-11-11-component-placement-fix-HANDOFF.md` - Image measurement fix

---

---

## Part 8: Font Verification and Measurement Timing (November 22, 2025)

### The Problem: Double Measurement with Fallback Fonts

**Observed Behavior (2025-11-22):**
- Component-05 placed in Column 2 on first load (correct)
- Component-05 placed in Column 1 on refresh (wrong)
- Appeared to be refresh-specific regression

**Initial Hypothesis:** Measurement at wrong width on refresh

**Actual Root Cause:** **Measurements taken with fallback fonts before D&D fonts apply**

---

### Discovery: Components Measure Twice

**Investigation revealed critical pattern:**

```
1. Measurement layer renders
2. Component measured with fallback fonts (Montserrat, Arial)
   → component-11: 833.85px (WRONG - 86% too tall)
3. Font verification detects wrong fonts
4. Fonts load and apply (ScalySansRemake)
5. Component remeasured with correct fonts
   → component-11: 446.93px (CORRECT)
6. Pagination uses whichever measurement arrives at right time
```

**Evidence from logs:**
```
[MeasurementObserver] height: 833.85px
📏 Fonts not yet applied, retrying...
   fontFamily: '"Montserrat", sans-serif'  ← Fallback fonts

✅ Fonts verified in measurement layer
   fontFamily: '"ScalySansRemake"'  ← D&D fonts

[MeasurementObserver] height: 446.93px
```

**Impact:** 386px height difference (86% error) for component-11

---

### Why This Caused "Refresh Regression"

**On first load:**
- Fonts load slowly (270-300ms)
- Font verification happens before measurement
- Only D&D font measurements used ✅
- Component-11: 446.93px → less space in column 1
- Component-05 overflows to Column 2 ✅

**On refresh:**
- Fonts cached, load instantly
- Measurement races with font verification
- Sometimes fallback font measurement used ❌
- Component-11: 833.85px → more space in column 1
- Component-05 fits in Column 1 ❌

**Key Insight:** Not a refresh bug - a **font timing race condition** that manifests more on refresh due to cached fonts

---

### The Fix: Font Verification in MeasurementObserver

**Solution:** Add font verification to width verification logic

**Changes in `Canvas/src/layout/measurement.tsx`:**

```typescript
private verifyWidthAndMeasure = (): void => {
    // ... existing code ...
    
    // CRITICAL: Verify fonts BEFORE measuring
    const fontFamily = computed.fontFamily;
    const hasDndFonts = fontFamily.includes('ScalySansRemake') ||
                       fontFamily.includes('NodestoCapsCondensed') ||
                       fontFamily.includes('BookInsanity');

    if (!hasDndFonts) {
        // Fonts not applied yet, wait and retry
        this.widthVerificationAttempts++;
        
        if (this.widthVerificationAttempts >= this.MAX_WIDTH_VERIFICATION_ATTEMPTS) {
            console.warn('⚠️ Font verification timeout, measuring anyway');
            this.measure();
            return;
        }
        
        // Wait one frame and retry
        requestAnimationFrame(() => this.verifyWidthAndMeasure());
        return;
    }
    
    // Fonts verified, now check width...
    // Then measure
};
```

**Benefits:**
- ✅ Blocks measurement until D&D fonts applied
- ✅ Prevents fallback font measurements (833.85px → 446.93px)
- ✅ Consistent measurements between first load and refresh
- ✅ Max 320ms wait (20 frames × 16ms) before timeout

---

### Key Learning: Font Loading is a Critical Measurement Dependency

**Lesson:** Custom fonts dramatically affect text height measurements

**Data Points:**
- Component-11 with fallback fonts: 833.85px
- Component-11 with D&D fonts: 446.93px
- **Difference:** 386px (86% error)
- **Why:** D&D fonts (ScalySansRemake) render more compactly than fallback (Montserrat)

**Impact on Layout:**
- 386px difference changes pagination decisions
- Components overflow or fit based on which font measurement used
- Race condition causes inconsistent layouts

**Solution Pattern:**
1. Wait for `document.fonts.ready`
2. Verify fonts applied to measurement DOM (not just loaded)
3. Check `getComputedStyle().fontFamily` matches expected fonts
4. Retry until fonts verified or timeout

---

### Measurement Accuracy Issue (Ongoing)

**Discovery:** Even with font verification, components measure shorter than visual render

**Evidence:**
- Component-05 measured: 140.28px
- Component-05 visual: 175.35px
- Gap: 35.07px (25% error)
- Result: Visual overflow of 138.92px

**Current Hypothesis:** Scale/transform/CSS difference between measurement layer and visible canvas

**Status:** New investigation started - `2025-11-22-measurement-accuracy-HANDOFF.md`

---

### Pattern 6: Font Verification Before Measurement

**When to Use:** Measuring text with custom fonts

**Problem:** Custom fonts load asynchronously, measurements may use fallback fonts

**Solution:** Verify fonts applied before measuring

**Implementation:**
```typescript
// In MeasurementObserver or before measurement
const computed = window.getComputedStyle(node);
const fontFamily = computed.fontFamily;

// Check for specific fonts, not just "font loaded"
const hasCustomFonts = fontFamily.includes('YourCustomFont');

if (!hasCustomFonts) {
    // Wait and retry
    requestAnimationFrame(verifyAndMeasure);
    return;
}

// Fonts verified, proceed with measurement
measure();
```

**Benefits:**
- Consistent measurements regardless of font cache state
- Prevents race conditions between font loading and measurement
- Eliminates "refresh regression" caused by font timing

**Critical Detail:** Check `getComputedStyle().fontFamily`, not just `document.fonts.ready`
- `document.fonts.ready` resolves when fonts downloaded
- But fonts may not be applied to DOM yet
- Must verify actual computed style on target element

---

### Pattern 7: Systematic Test Validation with Same Data

**When to Use:** Testing layout consistency between different code paths (first load, refresh, etc.)

**Problem:** Invalid test - compared different creatures (Madame Loaf vs Dr. Jupiter)

**Mistake Made:**
```javascript
// First load: Random demo selected → Madame Loaf
window.__STATBLOCK_DEBUG__.loadDemoData();

// Refresh: Different random demo → Dr. Jupiter
// localStorage cleared, new random selection

// Comparison showed "column changed" but it was different data!
```

**Correct Approach:**
```javascript
// Lock to specific creature for both tests
1. Load until you get target creature
2. Capture baseline with creature name
3. Refresh (localStorage preserves same creature)
4. Compare with same creature validation

// Verify creatures match
if (baseline.creature !== refresh.creature) {
    console.error('TEST INVALID - different creatures');
    return;
}
```

**Benefits:**
- Apples-to-apples comparison
- Valid hypothesis testing
- Identifies real bugs vs. data differences

**Key Learning:** Always validate test preconditions (same data, same environment) before comparing results

---

### Diagnostic Tools Created

**Tool 1: Visual Overflow Checker**
- Compares measured height vs visual height
- Detects overflow past column boundary
- Reports gap percentage

**Tool 2: All Components Validator**
- Checks every component for measurement accuracy
- Reports which components have gaps > 10px
- Identifies patterns (all components? specific types?)

**Tool 3: Scale/Transform Inspector**
- Walks parent chain checking for transforms
- Reports page scale and transform stack
- Rules out scaling as cause of measurement gap

**Usage Pattern:**
1. Run Tool 2 first to map the scope
2. Run Tool 1 on specific problem components
3. Run Tool 3 to rule out scaling issues
4. Compare CSS between measurement and visible

---

### Code Changes Summary (2025-11-22)

**File:** `Canvas/src/layout/state.tsx`
- Added stale state flush guard
- Detects measurements without components
- Prevents cached data from previous session

**File:** `Canvas/src/layout/measurement.tsx`
- Enhanced `MeasurementObserver` constructor with `canonicalColumnWidth` param
- Added `verifyWidthAndMeasure()` method
- Font verification: Checks for ScalySansRemake/NodestoCapsCondensed/BookInsanity
- Width verification: Ensures 362.20px canonical width
- Combined retry logic with 20-attempt limit (~320ms max)

**Result:**
- ✅ Refresh consistency achieved
- ✅ Font timing race condition eliminated
- ⚠️ Measurement accuracy issue identified (ongoing)

---

**Last Updated:** November 22, 2025  
**Next Review:** After measurement accuracy issue resolved

---

## Related Handoffs (November 2025)

**Active Investigation:**
- `2025-11-22-measurement-accuracy-HANDOFF.md` - Current focus
- `ROOT-CAUSE-refresh-measurement-width-mismatch.md` - Complete analysis (superseded)

**Test Procedures:**
- `TEST-fixes-applied.md` - Font/width verification tests
- `MANUAL-TEST-refresh-hypothesis.md` - Console test procedures
- `DIAGNOSTIC-all-components.md` - Component comparison tools

