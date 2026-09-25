> **Historical import from DungeonOverMind — 2026-09-24.** This document records implementation learnings from an older Canvas/product state. It is not current Canvas architecture or sequencing authority. Re-anchor against current Canvas code/contracts before applying it.

# Learnings: ThemeLoader Singleton & React StrictMode

**Date:** November 30, 2025  
**Context:** Debugging the persistent 9.9px spellcasting overflow bug  
**Outcome:** ThemeLoader singleton pattern, contract amendment

---

## 📋 Executive Summary

A persistent measurement inconsistency bug (9.9px overflow) led to a deep investigation that revealed:

1. **Defining contracts is critical** - but contracts must specify *guarantees*, not just *values*
2. **React StrictMode creates race conditions** when state lives in component-local refs
3. **Singleton pattern** is the correct solution for state that must survive remounts
4. **"Loaded" vs "Applied"** - CSS can be in the DOM but not yet computed by the browser

---

## 🎯 The Bug

**Symptom:** Spellcasting component overflows by exactly 9.9px on some page refreshes.

**Pattern:**
- Fresh load → Works ✅
- First refresh → Works ✅  
- Second refresh → **9.9px overflow** ❌

**Measurement evidence:**
```
📏 [Measurement] measure { height: 227.63 }  ← First measurement
⚠️ HEIGHT INCONSISTENCY DETECTED:
   firstHeight: "227.63", currentHeight: "196.38"
   difference: "31.25"
```

The same component measured **31.25px taller** on first measurement vs subsequent measurements.

---

## 🔍 Root Cause Analysis

### The Race Condition

React StrictMode mounts components twice in development:

```
🟢 [Provider] MOUNTED at 00:53:42.466Z
🔴 [Provider] UNMOUNTED at 00:53:42.468Z   ← 2ms later!
🟢 [Provider] MOUNTED at 00:53:42.469Z     ← New instance
```

Each mount created a new `useTheme()` hook instance with **fresh local refs**:

```typescript
// BEFORE: Local ref dies on unmount
const hasLoadedRef = useRef(false);  // ← Dies when component unmounts!
```

### The Sequence

1. **Mount 1:** `loadTheme()` starts, `hasLoadedRef = false`
2. **Unmount:** Ref is garbage collected (local state lost)
3. **Mount 2:** NEW ref created, `hasLoadedRef = false` again
4. **Mount 1's async completes:** CSS injected, `setIsLoaded(true)`
5. **Measurements start:** 227.63px captured (CSS may still be computing)
6. **Mount 2's async completes:** CSS **re-injected** (or recomputed)
7. **Styles stabilize:** Heights become 196.38px
8. **HEIGHT INCONSISTENCY:** Pagination used stale 227.63px value

### Key Insight

The problem wasn't that measurements happened "before CSS loaded" - the CSS WAS loaded. The problem was that **CSS was being re-injected** during the measurement cycle, causing styles to recompute.

---

## 📜 Contract Lesson: Guarantees vs Values

### Original Contract (Insufficient)

```typescript
interface CanvasConfig {
    /**
     * Ready signal: Consumer confirms CSS and fonts are loaded.
     * Canvas will NOT measure until ready=true.
     */
    ready: boolean;
}
```

This contract specifies **what the value means** but not **what guarantees the consumer must provide**.

### Amended Contract (Sufficient)

```typescript
interface CanvasConfig {
    /**
     * Ready signal: Consumer GUARANTEES:
     * 
     * 1. All CSS files are fetched, parsed, AND computed by browser
     * 2. CSS will NOT change during measurement cycle
     * 3. Fonts are fully loaded and rendered
     * 4. Multiple component mounts (React StrictMode) will NOT
     *    cause CSS re-injection or state inconsistency
     * 
     * Implementation requirement:
     * - Theme loading state MUST be singleton (survive remounts)
     * - CSS injection MUST be idempotent (safe to call multiple times)
     */
    ready: boolean;
}
```

### The Lesson

**A contract must specify:**
1. What the value means
2. What guarantees the provider must uphold
3. What invariants must hold during the contract's validity
4. What implementation constraints exist

---

## 🏗️ Solution: Singleton Pattern

### When to Use Singleton for React State

Use a **module-level singleton** (not `useRef` or `useState`) when:

1. **State must survive component unmount/remount**
2. **Multiple component instances must share the same state**
3. **Async operations started by one instance should be visible to another**
4. **React StrictMode double-mount would cause problems**

### Implementation Pattern

```typescript
// ═══════════════════════════════════════════════════════════════
// SINGLETON STATE - Module level, survives React remounts
// ═══════════════════════════════════════════════════════════════

let _state: ThemeLoadingState = 'idle';
let _loadingPromise: Promise<void> | null = null;  // Same promise for all callers!
const _subscribers = new Set<StateChangeCallback>();

export const ThemeLoader = {
    /**
     * IDEMPOTENT: Safe to call multiple times.
     * Returns same promise if already loading.
     */
    async ensureLoaded(urls: string[], baseUrl: string): Promise<void> {
        // Already loaded - return immediately
        if (_state === 'loaded') {
            return Promise.resolve();
        }

        // Already loading - return SAME promise (prevents race!)
        if (_state === 'loading' && _loadingPromise) {
            return _loadingPromise;
        }

        // Start loading
        _state = 'loading';
        _loadingPromise = doLoad(urls, baseUrl);
        // ...
    },

    /**
     * Subscribe to state changes (for React hooks).
     */
    subscribe(callback: StateChangeCallback): () => void {
        _subscribers.add(callback);
        callback(_state);  // Immediate notification
        return () => _subscribers.delete(callback);
    },
};
```

### Hook Becomes an Observer

```typescript
// useTheme.ts - Now just observes the singleton
export function useTheme(baseUrl: string, cssFiles: string[]): UseThemeResult {
    const [state, setState] = useState(ThemeLoader.getState());

    useEffect(() => {
        // Subscribe to singleton - survives remount!
        const unsubscribe = ThemeLoader.subscribe(setState);
        
        // Trigger load (idempotent - safe to call multiple times)
        ThemeLoader.ensureLoaded(urls, baseUrl).catch(console.error);
        
        return unsubscribe;
    }, [baseUrl, cssFiles]);

    return { isLoaded: state === 'loaded', ... };
}
```

---

## 🔬 Debugging Methodology

### Timeline Analysis

The key to finding this bug was **reconstructing the exact timeline** from logs:

```
00:53:42.466Z  🟢 Mount 1
00:53:42.468Z  🔴 Unmount (2ms!)
00:53:42.469Z  🟢 Mount 2
...
00:53:42.626Z  📏 First measurement: 227.63px
...
00:53:42.718Z  ⚠️ HEIGHT INCONSISTENCY: 196.38px
```

### Questions That Led to the Answer

1. **"When exactly does the measurement happen relative to CSS load?"**
   - Answer: After CSS is "loaded" but during CSS re-injection race

2. **"Why does the same component measure differently?"**
   - Answer: CSS is being modified between measurements

3. **"What survives component remount?"**
   - Answer: Module-level variables. NOT `useRef` or `useState`.

4. **"What changes between Mount 1 and Mount 2?"**
   - Answer: Local refs are recreated. Async operations are duplicated.

### The "HEADING_MISSING" Red Herring

The measurement system flagged `likelyCause: "HEADING_MISSING"` but the heading WAS present. The 31.25px difference happened to approximate heading height, but the actual cause was CSS reflow from re-injection.

**Lesson:** Automated diagnostics can mislead. Trust the timeline, not the suggested cause.

---

## 📐 CSS Loading: "Loaded" vs "Applied"

### The Problem

```typescript
// This is NOT enough!
const response = await fetch(cssUrl);
const cssText = await response.text();
document.head.appendChild(styleElement);
setIsLoaded(true);  // ❌ CSS may not be computed yet!
```

When you inject CSS into the DOM:
1. ✅ CSS text is in a `<style>` element
2. ❌ Browser may not have parsed it yet
3. ❌ Browser may not have applied it to matching elements
4. ❌ Layout/reflow may not have completed

### The Solution: Double RAF

```typescript
// Wait for browser to actually compute/apply styles
await new Promise<void>(resolve => {
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            resolve();  // Now CSS is truly applied
        });
    });
});
setIsLoaded(true);  // ✅ Safe to measure
```

**Why double RAF?**
- First RAF: Browser commits pending style changes
- Second RAF: Browser completes layout/paint cycle
- After both: Computed styles are stable

---

## ✅ Checklist: Avoiding This Class of Bug

### When Building Async Loading Hooks

- [ ] **Does state survive component remount?** (Use singleton if needed)
- [ ] **Are multiple async operations deduplicated?** (Return same promise)
- [ ] **Is the operation idempotent?** (Safe to call multiple times)
- [ ] **Do I wait for side effects to complete?** (Not just "loaded" but "applied")

### When Defining Contracts

- [ ] **What guarantees does the provider make?**
- [ ] **What invariants must hold during the contract?**
- [ ] **What implementation constraints exist?**
- [ ] **What happens during React StrictMode?**

### When Debugging Timing Issues

- [ ] **Reconstruct the exact timeline from logs**
- [ ] **Identify what state changes between "works" and "fails"**
- [ ] **Question automated diagnostic suggestions**
- [ ] **Look for state that doesn't survive remount**

---

## 📚 Related Documents

- [Phase 5 Contract Amendment](../../roadmaps/Canvas/phase5-contract-amendment-theme-stability.md) - The formal contract update
- [Phase 5 Contract Design](../../roadmaps/Canvas/phase5-contract-design.md) - Original contract
- [ISSUE-002](../../roadmaps/Canvas/issues/ISSUE-002-component-12-spell-overflow.md) - The bug tracker entry

---

## 🎓 Key Takeaways

1. **Contracts must specify guarantees, not just values**
   - "CSS is loaded" is ambiguous
   - "CSS is loaded, applied, and will not change during measurement" is a guarantee

2. **React StrictMode exposes state management bugs**
   - If it works in production but fails in dev, you have a state lifecycle bug
   - Local refs (`useRef`) do NOT survive remount

3. **Singleton pattern for cross-instance state**
   - Module-level variables survive React lifecycle
   - Idempotent APIs prevent race conditions
   - Subscribe pattern integrates with React hooks

4. **"Loaded" ≠ "Applied" for CSS**
   - DOM insertion is synchronous
   - Style computation is asynchronous
   - Double RAF ensures styles are applied

5. **Timeline analysis beats automated diagnostics**
   - Reconstruct exact sequence of events
   - Don't trust "likely cause" suggestions blindly
   - The answer is in the timestamps

---

**Author:** Canvas Measurement Debugging Session  
**Status:** Complete - Bug Fixed  
**Total Investigation Time:** ~3 hours

