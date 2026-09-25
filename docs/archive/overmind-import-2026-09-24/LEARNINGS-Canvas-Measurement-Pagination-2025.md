> **Historical import from DungeonOverMind — 2026-09-24.** This document records implementation learnings from an older Canvas/product state. It is not current Canvas architecture or sequencing authority. Re-anchor against current Canvas code/contracts before applying it.

# Canvas Measurement & Pagination Learnings

**Project:** DungeonMind Canvas Engine  
**Date:** November 2025  
**Context:** Phase 4 debugging of persistent overflow issues

---

## Executive Summary

During Phase 4, we discovered and fixed multiple interrelated issues causing measurement-to-render height mismatches. Each fix revealed deeper problems. This document captures the root causes and solutions to prevent recurrence.

**Core Principle:** The measurement layer and visible layer must be *identical twins* - same CSS, same fonts, same box model, same spacing rules.

---

## Issue 1: Stale Measurement Cache (Critical)

### Symptom
Loading a different statblock reused measurements from the previous statblock, causing severe overflow.

### Root Cause
Measurement keys were structural (`instanceId:kind:startIndex:itemCount:totalCount:continuation`) but didn't include a content hash. Two different statblocks with similar structure generated identical keys.

When `SET_COMPONENTS` or `SET_DATA_SOURCES` dispatched, `recomputeEntries` only cleared measurements if there were *zero* components, not when content changed.

### Fix
Clear measurement cache on any data change:

```typescript
// state.tsx - SET_COMPONENTS handler
case 'SET_COMPONENTS': {
    return recomputeEntries({
        ...state,
        components: action.payload.instances,
        homeRegions,
        isLayoutDirty: true,
        measurements: new Map(),           // ← CLEAR
        measurementVersion: 0,             // ← RESET
        columnMeasurementCache: new Map(), // ← CLEAR
        measurementStatus: 'idle',         // ← RESET
    });
}
```

### Prevention Rule
**When in doubt, clear the cache.** Measurement cache is an optimization, not a source of truth. Fresh measurements are cheap compared to debugging stale data.

---

## Issue 2: Measurement Layer Class Name Mismatch

### Symptom
CSS rules targeting `.dm-canvas-measurement-layer` weren't applying to the measurement layer.

### Root Cause
The `MeasurementLayer` component used `className="dm-measurement-layer"` internally, but all CSS rules and the wrapper div expected `dm-canvas-measurement-layer`.

### Fix
```typescript
// measurement.tsx
return (
    <div className="dm-canvas-measurement-layer" style={containerStyle}>
        {/* ... */}
    </div>
);
```

### Prevention Rule
**Use grep before refactoring class names:**
```bash
grep -r "dm-measurement-layer" src/
grep -r "dm-canvas-measurement-layer" src/
```

Ensure all references match. Add a test that verifies the measurement layer exists with the expected class.

---

## Issue 3: `em` Units Cause Measurement Drift

### Symptom
Lair Actions section had ~33px measurement error despite all other fixes.

### Root Cause
Inline styles used `em` units:
```tsx
<p style={{ marginTop: '0.5em', marginBottom: '0.75em' }}>
```

`em` is relative to the computed `font-size`. If fonts load at different times or the measurement layer has different font metrics, the pixel conversion differs.

**Example:**
- Measurement layer: 16px font → 0.5em = 8px margin
- Visible layer: 18px font → 0.5em = 9px margin
- Result: 1px error per margin, compounding across items

### Fix
Use absolute `px` values for structural spacing:
```tsx
<p style={{ marginTop: '6px', marginBottom: '9px' }}>
```

### Prevention Rule
**Never use relative units (`em`, `rem`, `%`) for layout-critical spacing in components that get measured.** Use `px` for:
- Margins
- Padding
- Gap values
- Line height (use unitless for ratio, but avoid `em`)

Reserve `em`/`rem` for decorative typography that doesn't affect layout.

---

## Issue 4: CSS Flex Gap Not Accounted in Pagination

### Symptom
Components visually overflowed even when measurements were correct.

### Root Cause
The pagination cursor only tracked component heights:
```typescript
// OLD (broken)
cursor.currentOffset = span.bottom;
```

But CSS applied `gap: 12px` between flex children. Each component added 12px of invisible spacing not tracked by pagination.

**Example:** 5 components with 4 gaps = 48px unaccounted space.

### Fix
```typescript
// NEW (correct)
const advanceCursor = (cursor: RegionCursor, span: RegionSpan) => {
    cursor.currentOffset = span.bottom + COMPONENT_VERTICAL_SPACING_PX;
};
```

### Prevention Rule
**Pagination must match CSS exactly.** If CSS adds spacing, padding, or gaps, the algorithm must account for them:
1. Document all spacing constants
2. Keep them in sync with CSS (or derive from CSS variables)
3. Test with visual inspection AND computed heights

---

## Issue 5: Column Padding Not Accounted

### Symptom
Even with gap fix, slight overflow persisted.

### Root Cause
Columns have padding (8px top, 8px bottom = 16px total). Pagination assumed `regionHeight = columnHeight`, but actual content area was `columnHeight - 16px`.

Also, cursor started at 0 instead of the padding offset.

### Fix
```typescript
// utils.ts
export const COLUMN_VERTICAL_PADDING_PX = 8;

// paginate.ts
const createCursor = (
    regionKey: string, 
    maxHeight: number, 
    initialOffset: number = COLUMN_VERTICAL_PADDING_PX  // ← Start after top padding
): RegionCursor => ({
    regionKey,
    currentOffset: initialOffset,
    maxHeight,
});

// Effective content height
const effectiveHeight = regionHeightPx - (2 * COLUMN_VERTICAL_PADDING_PX);
```

### Prevention Rule
**Content area ≠ container dimensions.** Always verify:
- Padding reduces available space
- Borders affect box model
- Cursor starts at content start, not container start

---

## Issue 6: Scale Factor Confusion

### Symptom
`getBoundingClientRect()` returned heights ~1.33x larger than measurements.

### Root Cause
The visible canvas applies `transform: scale(1.33)` for display sizing. `getBoundingClientRect()` returns *transformed* dimensions (what's painted on screen), not logical CSS dimensions.

The measurement layer had no transform, so comparisons were invalid.

### Fix
Use `offsetHeight` for unscaled dimensions:
```typescript
// Diagnostic script
const actualHeight = element.offsetHeight;  // ← Unscaled
const scaledHeight = element.getBoundingClientRect().height;  // ← Includes transform

// Measurements should match offsetHeight, not rect.height
```

### Prevention Rule
**Know which API you're using:**
- `offsetHeight` / `offsetWidth` → Layout dimensions (CSS box model)
- `getBoundingClientRect()` → Visual dimensions (includes transforms)
- `clientHeight` / `clientWidth` → Content area (excludes scrollbars)

For measurement comparison, always use `offsetHeight`.

---

## Issue 7: Font/Theme Loading Race Condition

### Symptom
First measurement on page load was wrong, subsequent measurements correct.

### Root Cause
Measurements started before fonts and theme CSS fully loaded:
1. Theme CSS sets margins, padding, line-height
2. Fonts affect text wrapping and line metrics
3. Browser reports initial measurements with fallback fonts
4. Real measurements differ once resources load

### Fix
Gate measurements on resource loading:
```typescript
// MeasurementLayer accepts ready prop
<MeasurementLayer
    ready={fontsReady && themeLoaded}  // ← Don't measure until ready
    // ...
/>

// Inside MeasurementLayer
useEffect(() => {
    if (!ready) {
        return;  // ← Skip measurement cycle
    }
    // ... normal measurement logic
}, [entries, ready]);
```

### Prevention Rule
**Never trust first-frame measurements.** Always wait for:
1. `document.fonts.ready` or explicit font loading
2. Theme CSS injected and parsed
3. At least one animation frame after both

Consider a "measurement ready" signal that aggregates all prerequisites.

---

## Issue 8: Theme CSS Not Applied to Measurement Layer

### Symptom
Measurement layer heights didn't include theme margins.

### Root Cause
CSS selectors were too specific to the visible layer:
```css
/* OLD - only matches visible layer */
.dm-action-term {
    margin: 0.6rem 0 0.15rem;
}
```

The measurement layer, despite having the same DOM structure, didn't match these selectors because it's in a different container.

### Fix
Duplicate selectors for measurement layer:
```css
/* NEW - matches both layers */
.dm-action-term,
.dm-canvas-measurement-layer .dm-action-term {
    margin: 0.6rem 0 0.15rem;
}
```

Or use a shared parent selector:
```css
.dm-action-term {
    margin: 0.6rem 0 0.15rem;
}
/* Measurement layer inherits this naturally if structured correctly */
```

### Prevention Rule
**Test CSS in measurement layer, not just visible.** Add a diagnostic that compares computed styles:
```typescript
const visibleStyle = getComputedStyle(visibleElement);
const measureStyle = getComputedStyle(measureElement);
if (visibleStyle.margin !== measureStyle.margin) {
    console.warn('Style mismatch!', { visible: visibleStyle.margin, measure: measureStyle.margin });
}
```

---

## Diagnostic Checklist

When debugging measurement issues, check in order:

### 1. Cache Freshness
```javascript
window.__CANVAS_STATE__.summary()
// measurementVersion should be 0 after data change
```

### 2. Class Names Match
```javascript
document.querySelector('.dm-canvas-measurement-layer')  // Should exist
```

### 3. Styles Match
```javascript
const vis = document.querySelector('.dm-canvas-visible .dm-action-term');
const meas = document.querySelector('.dm-canvas-measurement-layer .dm-action-term');
console.log(getComputedStyle(vis).margin, getComputedStyle(meas).margin);
```

### 4. Units Are Absolute
Search for `em` or `rem` in component inline styles.

### 5. Spacing Constants
```javascript
// In paginate.ts
console.log({ COMPONENT_VERTICAL_SPACING_PX, COLUMN_VERTICAL_PADDING_PX });
```

### 6. Scale Factor
```javascript
const el = document.querySelector('.canvas-column');
console.log({
    offsetHeight: el.offsetHeight,
    rectHeight: el.getBoundingClientRect().height,
    scaleFactor: el.getBoundingClientRect().height / el.offsetHeight
});
```

### 7. Resource Loading
```javascript
console.log({
    fontsReady: document.fonts.status,
    themeLoaded: !!document.getElementById('dm-theme-layer')
});
```

---

## Constants Reference

```typescript
// utils.ts - Keep these in sync with CSS
export const COMPONENT_VERTICAL_SPACING_PX = 12;  // CSS: gap: 12px
export const COLUMN_VERTICAL_PADDING_PX = 8;       // CSS: padding: 8px
export const LIST_ITEM_SPACING_PX = 8;             // CSS: margin-bottom on items
```

---

## Issue 9: Entry Width Mismatch (Column Padding Not in Measurement Layer)

### Symptom
Component-11 measured 316.5px but rendered at 350px (33.5px error).

### Root Cause
The measurement layer's entry width didn't account for column padding:

| Layer | Entry Width | Text Wrapping | Height |
|-------|-------------|---------------|--------|
| Measurement | 364.2px | Less wrapping | 316.5px |
| Visible | 354px (364 - 5 - 5 padding) | More wrapping | 350px |

The `measuredColumnWidth` passed to `MeasurementLayer` was the full column width (364px), not the content width (354px). The measurement layer column also lacked inline padding to match the visible layer's CSS.

### Fix
```typescript
// StatblockPage.tsx - Measurement layer column
<div className="canvas-column" style={{
    width: `${columnWidth}px`,
    padding: '8px 5px',  // ← ADDED: Match visible layer CSS
    gap: '12px',         // ← ADDED: Match visible layer CSS
    // ...
}}>
    <MeasurementLayer
        // FIX: Pass content width, not column width
        measuredColumnWidth={columnWidth != null ? columnWidth - 10 : undefined}
    />
</div>
```

### Prevention Rule
**Inline styles must override CSS defaults for structural properties.** The measurement layer cannot rely on CSS class rules because it may be in a different DOM context. All layout-affecting properties must be explicit inline styles.

---

## Issue 10: Unclear Responsibility Boundaries (Architectural)

### Symptom
Multiple bugs stemmed from unclear ownership of width/padding/spacing calculations. Fixes were applied in `StatblockPage.tsx` that should have been in `Canvas` or `MeasurementLayer`.

### Root Cause
**"Vibe coding"** - incremental changes made without clear architectural contracts. Each agent/session added checks and calculations where convenient, not where correct. Over time:
1. Canvas package assumed consumer would handle width calculations
2. StatblockPage assumed Canvas handled padding
3. MeasurementLayer assumed column styles were complete
4. **Nobody owned the invariant: measurement width === visible width**

### Fix
Establish and document explicit contracts between layers:

```
┌─────────────────────────────────────────────────────────────────┐
│  CANVAS PACKAGE                                                 │
│  ─────────────────                                              │
│  OWNS:                                                          │
│    - Measurement algorithm (getBoundingClientRect + margins)    │
│    - Pagination algorithm (heights + gaps + padding)            │
│    - Region/column abstraction                                  │
│                                                                 │
│  REQUIRES FROM CONSUMER:                                        │
│    - measuredColumnWidth: CONTENT width (not container width)   │
│    - ready: Boolean gate for fonts/theme                        │
│    - Components that render identically at any width            │
│                                                                 │
│  GUARANTEES:                                                    │
│    - Measured height accurate within 1px if inputs correct      │
│    - Pagination fits content within column bounds               │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  CONSUMER (StatblockPage)                                       │
│  ─────────────────────────                                      │
│  OWNS:                                                          │
│    - Page dimensions (width, height, margins)                   │
│    - Column count and gap calculations                          │
│    - Theme/font loading detection                               │
│    - Measurement layer DOM structure and styles                 │
│                                                                 │
│  MUST ENSURE:                                                   │
│    - Measurement layer column styles EXACTLY match visible      │
│    - measuredColumnWidth = columnWidth - horizontalPadding      │
│    - ready=false until fonts AND theme loaded                   │
│                                                                 │
│  INVARIANT TO VERIFY:                                           │
│    - Visible entry.offsetWidth === measuredColumnWidth          │
└─────────────────────────────────────────────────────────────────┘
```

### Prevention Rules

**1. Define Contracts Explicitly**
Before implementing, document:
- What inputs each layer requires
- What guarantees each layer provides
- What invariants must hold across layers

**2. Single Source of Truth for Spacing**
```typescript
// constants.ts - ALL spacing values
export const COLUMN_HORIZONTAL_PADDING_PX = 5;  // Each side
export const COLUMN_VERTICAL_PADDING_PX = 8;
export const COMPONENT_GAP_PX = 12;
export const COLUMN_GAP_PX = 14;
```
Both CSS and TypeScript derive from these. Never hardcode in both places.

**3. Continuous Verification**
Add runtime checks that fire in development:
```typescript
if (process.env.NODE_ENV === 'development') {
    const visibleWidth = visibleEntry.offsetWidth;
    const measurementWidth = measuredColumnWidth;
    if (Math.abs(visibleWidth - measurementWidth) > 1) {
        console.error(`🚨 WIDTH INVARIANT VIOLATED: visible=${visibleWidth} measured=${measurementWidth}`);
    }
}
```

**4. Resist "Quick Fixes"**
When debugging, ask:
- **Where SHOULD this logic live?** (not "where can I put it")
- **Does this fix violate a contract?**
- **Will another component need this same fix?** (extract if yes)

**5. Audit After Each Bug**
After fixing a measurement bug:
- [ ] Document which contract was violated
- [ ] Add invariant check to prevent recurrence
- [ ] Consider if responsibility should move to Canvas package

---

## Issue 11: Frame Border Not Subtracted from Region Height

### Symptom
Column 1 was 982px but frame only had 967.5px available. Column overflowed frame by 14.5px.

### Root Cause
`canonicalRegionHeightPx` used `baseContentHeightPx` directly (980.4px), but didn't account for the frame's CSS border (12.5px total vertical).

| Calculation | Value |
|-------------|-------|
| `baseContentHeightPx` | 980.4px |
| Frame border (top + bottom) | 12.5px |
| **Actual available space** | 967.9px |
| Column height used | 982px |
| **Overflow** | 14.5px |

### Fix
```typescript
// StatblockPage.tsx
// Theme-specific: .monster.frame has CSS border: 6.25px 5px
const FRAME_VERTICAL_BORDER_PX = 12.5;
const canonicalRegionHeightPx = Math.max(baseContentHeightPx - FRAME_VERTICAL_BORDER_PX, 0);
```

### Prevention Rule
**Theme CSS affects available space.** When using a themed container:
1. Measure the actual `clientHeight` (content area) not `offsetHeight` (includes border)
2. Or explicitly subtract known border/padding values
3. Document theme-specific constants where they're used

---

## Anti-Pattern: Vibe Coding

**Definition:** Making incremental changes without understanding the architectural boundaries, letting convenience dictate placement.

**Symptoms:**
- Same calculation appears in multiple places
- Bug fixes that "just add a check here"
- Unclear which layer owns a concern
- Tests pass but system is fragile to change

**Examples from this project:**
1. Column width calculated in StatblockPage but padding applied by CSS elsewhere
2. Gap spacing in CSS but not in pagination algorithm
3. Theme styles in global CSS but measurement layer in different DOM tree

**Prevention:**
- Write contracts BEFORE implementation
- Review: "Is this the right place for this code?"
- Refactor to proper home rather than patching in place

---

## Summary Table

| Issue | Symptom | Root Cause | Fix Pattern |
|-------|---------|------------|-------------|
| Stale cache | Wrong heights after data change | Keys don't include content | Clear cache on data change |
| Class mismatch | CSS not applied | Different class names | Audit and unify selectors |
| `em` units | Drift ~1-5px per margin | Font-size dependent | Use `px` for layout |
| Gap not counted | Cumulative overflow | Cursor ignores CSS gap | Add gap to cursor advance |
| Padding ignored | Slight overflow | Content area ≠ container | Reduce height by padding |
| Scale confusion | 1.33x height difference | Transform affects rect | Use offsetHeight |
| Load race | First measurement wrong | CSS/fonts not ready | Gate on ready signal |
| Theme missing | Measurement layer plain | Selectors too specific | Add measurement selectors |
| Entry width mismatch | 33px height error | Column padding not in measure layer | Pass content width, add inline padding |
| Frame border ignored | 14.5px column overflow | `contentHeightPx` doesn't include frame border | Pass `initialRegionHeightPx` to Canvas |
| Pagination timing | Uses stale height | regionHeight sent via SET_REGION_HEIGHT arrives after pagination | Pass initial value at Canvas init |
| **Unclear boundaries** | **Repeated bugs** | **No explicit contracts** | **Document ownership, add invariant checks** |

---

## Related Documents

- `PATTERNS-Canvas.mdc` - Component registry, measurement patterns
- `04-PHASE4-PAGINATION-AND-EXTRACTION.md` - Phase 4 roadmap
- `ISSUE-001-component-overflow-on-statblock-change.md` - Stale cache issue
- `ISSUE-002-component-12-spell-overflow.md` - Entry width mismatch issue
- `paginationDiagnostics.ts` - Runtime debugging API

---

## Future Work: Move to Canvas Package

Several responsibilities currently in `StatblockPage.tsx` should migrate to Canvas:

1. **Column content width calculation** - Canvas should accept `columnWidth` and `columnPadding`, derive content width internally
2. **Measurement layer DOM structure** - Canvas should own measurement layer column styling
3. **Invariant verification** - Canvas should verify width matches in development mode

This would change the contract from:
```typescript
// CURRENT: Consumer must calculate content width
<MeasurementLayer measuredColumnWidth={columnWidth - horizontalPadding} />
```

To:
```typescript
// FUTURE: Canvas calculates internally
<MeasurementLayer 
    columnWidth={columnWidth}
    columnPadding={{ horizontal: 5, vertical: 8 }}
/>
```

---

## Issue 13: Portal Font-Size Context Mismatch (ROOT CAUSE)

**Symptom:** Measurements consistently wrong by ~16.6px despite correct widths.

**Investigation Trail:**
1. ❌ Width mismatch (fixed earlier, not the issue)
2. ❌ Padding/gap differences (fixed earlier, not the issue)
3. ❌ regionHeightPx timing (fixed earlier, not the issue)
4. ✅ **Font-size inheritance context**

**Root Cause:**

The measurement portal is appended to `document.body`:
```typescript
document.body.appendChild(node);
setMeasurementPortalNode(node);
```

This places it **outside the React app tree**, which has different CSS cascade:

| Layer | .page.phb font-size | .monster.frame font-size |
|-------|---------------------|--------------------------|
| **Visible** | 12.8504px | 12.0189px |
| **Measurement** | 16px (body default) | 16px (inherited) |

The PHB theme uses `rem` and `em` units that compute differently based on parent font-size:
- `margin-bottom: 0.6rem` → 9.6px (visible) vs 9.6px (if 16px base = wrong)
- `font-size: 0.95rem` → 15.2px (if 16px base) vs 12.0px (if 12.85px base)

**Fix:** Explicitly set font-size on measurement layer elements to match visible layer:

```typescript
<div className="page phb" style={{
    // ... other styles ...
    // FIX: Match visible layer font-size for rem/em calculations
    fontSize: '12.8504px',
}}>
    <div className="monster frame wide" style={{
        // FIX: Match visible layer font-size
        fontSize: '12.0189px',
    }}>
```

**Why 12.8504px?**
PHB theme formula: `816px (page width) / 8.5in / 96ppi * 72dpi ≈ 12.8504px`

**Lesson Learned:**
When using React portals for measurement/offscreen rendering:
1. Check what CSS context the portal root has
2. If parent font-size affects `rem`/`em` units, explicitly set font-size
3. Use browser DevTools to compare computed styles between layers
4. Test with components that use relative font units

**Diagnostic Pattern:**
```javascript
// Check font-size inheritance chain
let el = targetElement;
while (el && el !== document.body) {
    console.log(el.className, '→', getComputedStyle(el).fontSize);
    el = el.parentElement;
}
```

---

## Issue 14: CSS Injection Timing (ACTUAL ROOT CAUSE)

**Symptom:** Measurements progressively decrease (471 → 381 → 333) but stop before reaching visible height (350).

**Investigation:** After fixing font-size context, measurements still wrong by 17px.

**Root Cause:**

In `useTheme.ts`, the `isLoaded` flag was set **synchronously** after CSS injection:

```typescript
// BUGGY CODE
ThemeLoader._injectLayeredCSS(combinedCSS, 'dm-theme-layer', baseUrl);
hasLoadedRef.current = true;
setIsLoaded(true);  // ← Immediate! Browser hasn't computed styles yet
```

But CSS injection is NOT the same as CSS application:
1. `_injectLayeredCSS` creates/updates a `<style>` element ✅
2. Browser must **parse** the CSS (async)
3. Browser must **match** selectors to DOM elements
4. Browser must **compute** cascaded values
5. Browser must **apply** styles and trigger reflow

Steps 2-5 happen in **subsequent render cycles**, not synchronously.

**Evidence:** Measurement heights decreased progressively:
- 471px (no theme CSS)
- 381px (partial CSS)
- 333px (more CSS, but not complete)
- **350px** (final, in visible layer)

**Fix:**

```typescript
// FIXED CODE
ThemeLoader._injectLayeredCSS(combinedCSS, 'dm-theme-layer', baseUrl);

// Wait for browser to compute/apply CSS
await new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            resolve();  // After 2 RAFs, styles are applied
        });
    });
});

hasLoadedRef.current = true;
setIsLoaded(true);  // Now safe to measure
```

**Why Double RAF?**
- First RAF: Queued after current JS execution, but before next paint
- Second RAF: Queued after the paint that applied the styles
- After second RAF: Computed styles are guaranteed to reflect injected CSS

**Lesson Learned:**
When injecting CSS dynamically, never assume styles are immediately applied:
1. CSS injection is synchronous (DOM update)
2. CSS computation is asynchronous (browser engine)
3. Use double RAF pattern to wait for style computation

**Diagnostic Pattern:**
```javascript
// Check if measurements are stable
// If they're changing, CSS is still loading
console.log('Height:', element.offsetHeight);
requestAnimationFrame(() => {
    console.log('After 1 RAF:', element.offsetHeight);
    requestAnimationFrame(() => {
        console.log('After 2 RAF:', element.offsetHeight);
        // If still changing, there's more CSS loading
    });
});
```

---

## Issue 15: Measurement Portal Function Identity Causes Infinite Loop

**Date:** December 7, 2025  
**Context:** Implementing lightweight measurement for PCG Features overflow

### Symptom
Measurements running in infinite loop:
```
📐 [FeaturesOverflow] Split decision: { measuredCount: 0 }
📐 [FeaturesOverflow] Split decision: { measuredCount: 0 }
📐 [FeaturesOverflow] Split decision: { measuredCount: 0 }
... forever
```

### Root Cause

The measurement portal was returned from a hook as a **component function** via `useCallback`:

```typescript
// ❌ WRONG: Returns a new function identity when dependencies change
const MeasurementPortal: React.FC = useCallback(() => {
    return createPortal(<div>...</div>, portalNode);
}, [items, cssContext, portalNode]); // ← dependencies cause recreation

// Usage (WRONG)
return <MeasurementPortal />;  // ← Each render creates new component
```

**The Loop:**
1. Hook returns new `MeasurementPortal` function on dependency change
2. React sees new component type → unmounts old portal
3. Portal unmount clears measurements from DOM
4. `heights` state resets to empty Map
5. `heights` change triggers component re-render
6. Re-render causes hook to re-run
7. Hook returns new `MeasurementPortal` function
8. **GOTO 1** (infinite loop)

### Fix

Return the **portal element** from `useMemo`, not a component function from `useCallback`:

```typescript
// ✅ CORRECT: Returns a stable element
const measurementPortal = useMemo<React.ReactNode>(() => {
    if (!enabled || !portalNode) return null;
    
    return (
        <MeasurementPortalContent
            items={items}
            renderItem={renderItem}
            onMeasure={queueMeasurement}
            portalNode={portalNode}
        />
    );
}, [enabled, portalNode, items, renderItem, queueMeasurement]);

// Usage (CORRECT)
return <>{measurementPortal}</>;  // ← Element, not component call
```

Key differences:
- `useMemo` returns the **element** (React node)
- `useCallback` returns a **function** (component)
- React reconciles elements by identity; functions create new component types

### Additional Fix: Stable Child Components

Use `React.memo` for items inside the portal:

```typescript
// ✅ Stable identity, prevents re-mount on parent re-render
const MeasurementItem: React.FC<Props> = React.memo(({ index, children, onMeasure }) => {
    const ref = useRef<HTMLDivElement>(null);
    
    useEffect(() => {
        // ResizeObserver setup
    }, [index, onMeasure]);
    
    return <div ref={ref}>{children}</div>;
});
```

### Prevention Rules

1. **Never return component functions from hooks** - Return elements or stable components
2. **Use `useMemo` for JSX elements** - Preserves element identity
3. **Use `React.memo` for measurement items** - Prevents re-mount cycles
4. **Log `measuredCount` with throttling** - Only log when measurements complete to detect loops early

### Diagnostic Pattern

```typescript
// Only log when measurements are COMPLETE, not during measurement
if (process.env.NODE_ENV !== 'production' && isMeasurementComplete) {
    console.log('📐 [Measurement] Complete:', { measuredCount: heights.size });
}
```

If you see logs with `measuredCount: 0` repeating infinitely, the portal is being remounted.

### Related Canvas Pattern

Canvas's `MeasurementPortal` avoids this by being a **proper component** rendered in JSX:

```typescript
// Canvas approach: Component with stable props
<MeasurementPortal
    config={config}
    entries={entries}
    onMeasurements={handleMeasurements}
/>
```

The consumer renders the component directly - Canvas doesn't return a component function from a hook.

---

## Issue 16: JSX in .ts Files Causes Syntax Errors

**Date:** December 7, 2025  
**Context:** Creating measurement hooks with inline JSX

### Symptom

```
SyntaxError: Unexpected token, expected "," (85:9)
> 85 |     <div className="overflow-feature-item">
     |          ^
```

TypeScript errors: `Cannot find name 'div'`, `'>' expected`

### Root Cause

Files with `.ts` extension cannot contain JSX. TypeScript only parses JSX in `.tsx` files.

```typescript
// useMeasureItems.ts  ← WRONG extension
const Item = () => (
    <div>...</div>  // ← Parser doesn't understand JSX
);
```

### Fix

Rename files to `.tsx`:

```bash
mv useMeasureItems.ts useMeasureItems.tsx
mv useFeaturesOverflow.ts useFeaturesOverflow.tsx
```

### Related: JSDoc Comments with JSX-like Syntax

In `.tsx` files, JSDoc comments containing `{/* */}` get parsed as JSX:

```typescript
// ❌ BROKEN: {/* */} parsed as JSX in .tsx file
/**
 * return (
 *     <>
 *         <MeasurementPortal />
 *         {/* rest of component */}  ← Parser chokes here
 *     </>
 * );
 */

// ✅ FIXED: Avoid JSX comment syntax in JSDoc
/**
 * return (
 *     <>
 *         <MeasurementPortal />
 *         ...rest of component...
 *     </>
 * );
 */
```

### Prevention Rule

When creating React hooks that render JSX:
1. Always use `.tsx` extension
2. Avoid `{/* */}` in JSDoc code examples
3. Clear ESLint cache after renaming: `rm -rf node_modules/.cache`

---

**Last Updated:** December 7, 2025  
**Author:** Canvas Phase 4 debugging session, PCG Pagination implementation

