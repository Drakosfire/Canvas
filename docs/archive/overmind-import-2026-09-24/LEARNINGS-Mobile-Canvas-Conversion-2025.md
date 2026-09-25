> **Historical import from DungeonOverMind — 2026-09-24.** This document records implementation learnings from an older Canvas/product state. It is not current Canvas architecture or sequencing authority. Re-anchor against current Canvas code/contracts before applying it.

# Mobile Canvas Conversion - Learnings & Patterns
**Project:** DungeonMind - Player Character Generator  
**Date:** December 7, 2025  
**Status:** Active - Patterns validated in production

---

## Overview

This document captures learnings from converting a **fixed-dimension, print-optimized desktop canvas** (816×1056px US Letter format with PHB styling) to a **fluid, mobile-responsive vertical scroll layout**.

**Key Insight:** Desktop print layouts are fundamentally incompatible with mobile. Don't try to "make them fit" - decompose into mobile-native components.

---

## Table of Contents

1. [Critical Discoveries](#critical-discoveries)
2. [Architecture Patterns](#architecture-patterns)
3. [CSS Override Strategy](#css-override-strategy)
4. [Portal Components (Modals)](#portal-components-modals)
5. [Debugging Checklist](#debugging-checklist)
6. [File Structure](#file-structure)
7. [Code Examples](#code-examples)

---

## Critical Discoveries

### 1. The Global PHB CSS Trap

**Problem:** Global CSS applies fixed print dimensions to all `.page.phb` elements.

```css
/* Global PHB CSS - public/dnd-static/style.css */
.page.phb {
    width: 215.9mm;      /* Fixed US Letter width */
    height: 279.4mm;     /* Fixed US Letter height */
    overflow: hidden;    /* CLIPS all content! */
    position: relative;  /* Breaks flex stacking */
    column-count: 2;     /* Forces 2-column layout */
}
```

**Symptoms:**
- Components rendered but only title visible
- Content was there in DOM but clipped by `overflow: hidden`
- Pages overlapped instead of stacking vertically

**Solution:** Override ALL FIVE properties with `!important`:

```css
.mobile-character-canvas.character-sheet .page.phb {
    width: 100% !important;
    height: auto !important;
    overflow: visible !important;      /* CRITICAL: Stop clipping */
    position: static !important;       /* CRITICAL: Enable flex stacking */
    column-count: 1 !important;        /* CRITICAL: Single column */
    columns: unset !important;
    column-gap: 0 !important;
}
```

**Lesson:** When content is "there but invisible", check for `overflow: hidden` in ancestor elements.

---

### 2. The min-height Overlap Bug

**Problem:** `CharacterSheetPage` applies `.character-sheet` class with fixed min-height:

```css
.character-sheet {
    min-height: var(--page-height);  /* = 1056px! */
}
```

**Symptom:** Multiple pages visually overlapped - Inventory page rendered in same visual space as Spell page.

**Solution:**

```css
.mobile-character-canvas.character-sheet .page.phb.character-sheet {
    min-height: unset !important;
    height: auto !important;
}
```

**Lesson:** Fixed `min-height` on flex children prevents natural content flow. Override to `unset` for flexible layouts.

---

### 3. Wrapper Classes Don't Exist on Mobile

**Problem:** Desktop CSS uses parent selectors that don't exist in mobile DOM:

```css
/* Desktop CSS */
.inventory-sheet .item-row { display: grid; ... }
.spell-sheet .spell-item { display: flex; ... }
```

But mobile renders sub-components **directly** without parent wrappers:

```tsx
// Mobile: InventoryBlock rendered directly, NOT wrapped in InventorySheet
<section className="mobile-section">
    <InventoryBlock title="Weapons" items={weapons} />
</section>
```

**Symptom:** Grid layout rules not applying - items displayed in single column despite CSS.

**Solution:** Target the component class directly:

```css
/* ❌ WRONG - .inventory-sheet doesn't exist in mobile DOM */
.mobile-character-canvas .inventory-sheet .item-row { ... }

/* ✅ CORRECT - Target the actual component class */
.mobile-character-canvas .inventory-block .item-row { 
    display: grid !important;
    grid-template-columns: 28px 1fr 50px 55px !important;
}
```

**Lesson:** Always verify CSS selectors match the **actual DOM structure** on mobile, not the desktop structure.

---

### 4. Global Section Padding

**Problem:** App-level CSS applies to all `<section>` elements:

```css
section:not(.dm-canvas-responsive section):not(.dm-canvas-measurement-layer section) {
    padding: 3rem 0;  /* = 48px top/bottom! */
}
```

**Symptom:** Sections had 48px mystery padding that stacked with component padding.

**Solution:**

```css
.mobile-section {
    padding: 4px !important;  /* Override global section padding */
}
```

**Lesson:** Inspect computed styles in browser DevTools to find inherited padding from global rules.

---

### 5. Window Width vs Container Width for Breakpoints

**Problem:** Using `ResizeObserver` on the container element to detect mobile breakpoints doesn't work when content has fixed width.

```tsx
// ❌ WRONG: Container width doesn't shrink when content is fixed-width
const [viewportWidth, setViewportWidth] = useState(0);

useEffect(() => {
    const observer = new ResizeObserver(entries => {
        setViewportWidth(entries[0].contentRect.width);  // Stays at 816px!
    });
    observer.observe(containerRef.current);
}, []);

// Browser at 375px, but viewportWidth = 816 (fixed canvas width)
const isMobile = viewportWidth < 800;  // Always false!
```

**Symptom:** Mobile canvas never renders even when browser is resized to phone width.

**Root Cause:** `ResizeObserver` reports the **content size**, not the viewport. A fixed-width container (816px) reports 816px regardless of window size.

**Solution:** Use `window.innerWidth` for breakpoint detection:

```tsx
// ✅ CORRECT: Window width reflects actual viewport
const [windowWidth, setWindowWidth] = useState(window.innerWidth);

useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
}, []);

// Now correctly switches at 800px
const isMobile = windowWidth < 800;
```

**When to Use Each:**
- **`window.innerWidth`** - Breakpoint detection (mobile vs desktop layout)
- **`ResizeObserver`** - Container scaling (how much to transform: scale())

**Lesson:** Viewport detection and container scaling are different concerns requiring different measurement approaches.

---

### 6. Padding Stacking Problem

**Problem:** Multiple layers of padding accumulate invisibly:

```
.mobile-character-canvas (padding: 12px)
  └── .mobile-section (padding: 12px)  /* was 12px, now 4px */
        └── .inventory-block
              └── .item-list (padding: 8px)  /* was 8px, now 4px 6px */
```

**Result:** 12 + 12 + 8 = 32px+ of nested padding!

**Solution:** Minimize nested padding:
- Main container: 12px (provides edge spacing)
- Sections: 4px (minimal)
- Inner content: 4px 6px (tight)

**Lesson:** Use DevTools box model view to visualize stacking padding.

---

### 7. TypeScript Strict Checks with Optional Arrays

**Problem:** TypeScript strict mode rejects `arr?.length > 0` when array might be undefined:

```tsx
// ❌ TypeScript Error: 'arr.length' is possibly 'undefined'
{dnd5e.personality.traits?.length > 0 && (
    <section>...</section>
)}
```

**Solution:** Explicit existence check before length:

```tsx
// ✅ CORRECT: Check existence first
{dnd5e.personality.traits && dnd5e.personality.traits.length > 0 && (
    <section>...</section>
)}
```

**Lesson:** Optional chaining (`?.`) doesn't satisfy TypeScript for comparisons - use explicit existence checks.

---

## Architecture Patterns

### Component Decomposition for Mobile

**Desktop Approach:** Full-page components with internal layout:

```tsx
<InventorySheet>  {/* Single component handles entire page */}
    <Header />
    <WeaponsBlock />
    <ArmorBlock />
    <GearBlock />
</InventorySheet>
```

**Mobile Approach:** Individual sub-components, each in its own section:

```tsx
{/* Each block is independent, wrapped in mobile-section */}
<section className="mobile-section">
    <InventoryBlock title="Weapons" items={weapons} />
</section>
<section className="mobile-section">
    <InventoryBlock title="Armor" items={armor} />
</section>
<section className="mobile-section">
    <InventoryBlock title="Gear" items={gear} />
</section>
```

**Benefits:**
1. **Natural stacking** - Flexbox handles vertical flow
2. **Independent scrolling** - No fixed heights
3. **Granular control** - Style each section independently
4. **Conditional rendering** - Show only populated sections

---

### Viewport-Based Rendering

```tsx
// In CharacterCanvas.tsx
const isMobile = viewportWidth < 800;

return isMobile ? (
    <MobileCharacterCanvas character={character} />
) : (
    <DesktopCharacterCanvas character={character} />
);
```

**Key Decision:** Separate components rather than CSS-only responsive design because:
- DOM structure is fundamentally different
- Desktop uses full-page components; mobile uses sub-components
- CSS overrides would be too complex and fragile

---

## Portal Components (Modals)

### The Problem

Mantine modals render to `document.body` via React portal - they're **outside** the mobile canvas DOM tree:

```tsx
<body>
    <div id="root">
        <div class="mobile-character-canvas">
            <!-- Mobile canvas content -->
        </div>
    </div>
    <div class="mantine-Modal-root">  <!-- Portal target! -->
        <!-- Modal content is HERE, OUTSIDE mobile canvas -->
    </div>
</body>
```

### The Symptom

Mobile-scoped CSS selectors don't apply to modals:

```css
/* ❌ This NEVER matches - modal is outside .mobile-character-canvas */
.mobile-character-canvas .detail-modal { ... }
```

### The Solution

Use **media queries** instead of parent selectors:

```css
/* ✅ Media query applies regardless of DOM position */
@media (max-width: 800px) {
    .detail-modal .mantine-Modal-content {
        max-width: calc(100vw - 16px) !important;
        max-height: 85vh !important;
    }
    
    .detail-modal .detail-modal-header {
        flex-direction: column !important;
        text-align: center;
    }
}
```

### Public Assets in Modals

**Problem:** CSS files in `src/` are processed by bundler. URLs resolve at build time:

```css
/* ❌ FAILS - bundler can't resolve public asset path */
.modal-content {
    background-image: url('/dnd-static/themes/assets/parchment.jpg');
}
/* Error: Module not found */
```

**Solution:** Use inline styles in the component:

```tsx
<Modal
    styles={{
        content: {
            backgroundImage: 'url(/dnd-static/themes/assets/parchment.jpg)'
        }
    }}
>
```

**Lesson:** Public folder assets must be referenced via inline styles, not via `url()` in bundled CSS.

---

## CSS Override Strategy

### Quick Reference Table

| Problem | Override Property | Value |
|---------|------------------|-------|
| Fixed dimensions | `width`, `height` | `100% !important`, `auto !important` |
| Content clipping | `overflow` | `visible !important` |
| Overlap instead of stack | `position` | `static !important` |
| Two-column layout | `column-count`, `columns` | `1 !important`, `unset !important` |
| Fixed minimum height | `min-height` | `unset !important` |
| Global section padding | `padding` | `4px !important` |

### Selector Specificity Pattern

```css
/* Pattern: .mobile-container.parent-class .target-class */
.mobile-character-canvas.character-sheet .inventory-block .item-row {
    /* High specificity to override desktop styles */
    display: grid !important;
}
```

---

## Debugging Checklist

### Content Invisible but in DOM?
- [ ] Check `overflow: hidden` on ancestors
- [ ] Check `height: 0` or collapsed containers
- [ ] Check `display: none` inherited from media queries

### Elements Overlapping?
- [ ] Check `position: relative/absolute` on siblings
- [ ] Check `min-height` forcing fixed dimensions
- [ ] Check `column-count > 1`

### CSS Not Applying?
- [ ] Verify selector matches **actual mobile DOM** structure
- [ ] Check for wrapper classes that don't exist on mobile
- [ ] Use browser DevTools to inspect computed styles
- [ ] Check selector specificity (may need `!important`)

### Mystery Padding/Margins?
- [ ] Inspect for global `section`, `div`, `*` rules
- [ ] Check CSS reset styles
- [ ] Look for inherited spacing from parent components
- [ ] Use DevTools "Computed" tab → filter by "padding"

### Modals/Portals Not Styled?
- [ ] Use media queries, not parent selectors
- [ ] Portals render outside your component tree
- [ ] Check if styles are scoped incorrectly

---

## File Structure

```
shared/
├── MobileCharacterCanvas.tsx    # Viewport-based mobile component
├── MobileCharacterCanvas.css    # Mobile-specific overrides (~720 lines)
└── CharacterCanvas.tsx          # Desktop canvas + viewport switching
```

### CSS File Organization

```css
/* MobileCharacterCanvas.css structure */

/* 1. Main Container - Override fixed dimensions */
.mobile-character-canvas.character-sheet { ... }

/* 2. Section Containers - Override global section padding */
.mobile-section { ... }

/* 3. Component-Specific Overrides */
/* 3a. Inventory blocks */
.mobile-character-canvas .inventory-block .item-row { ... }

/* 3b. Spell blocks */  
.mobile-character-canvas .spell-level-block .spell-item { ... }

/* 4. Page wrapper overrides (.page.phb) */
.mobile-character-canvas.character-sheet .page.phb { ... }

/* 5. Modal styles (media query - portals!) */
@media (max-width: 800px) {
    .detail-modal { ... }
}
```

---

## Code Examples

### Mobile Section Pattern

```tsx
// Conditional rendering with mobile-section wrapper
{(weapons?.length ?? 0) > 0 && (
    <section className="mobile-section">
        <InventoryBlock
            title="Weapons"
            items={weapons.map(w => ({
                id: w.id,
                name: w.name,
                quantity: 1,
                weight: w.weight,
                // ... map fields
            }))}
            onItemInfoClick={openItemModal}
        />
    </section>
)}
```

### Detail Modal with Mobile Support

```tsx
<Modal
    opened={isOpen}
    onClose={onClose}
    title={null}
    size="md"
    centered
    withCloseButton
    className="detail-modal"
    classNames={{
        body: 'detail-modal-body',
        header: 'detail-modal-mantine-header',
        close: 'detail-modal-close-btn'
    }}
    styles={{
        content: {
            // Inline style for public asset (can't use url() in bundled CSS)
            backgroundImage: 'url(/dnd-static/themes/assets/parchmentBackground.jpg)'
        }
    }}
>
    {/* Modal content */}
</Modal>
```

### CSS Grid for Item Rows

```css
/* Preserve 4-column grid on mobile */
.mobile-character-canvas .inventory-block .item-row {
    display: grid !important;
    grid-template-columns: 28px 1fr 50px 55px !important;
    /* Qty | Item Name | Weight | Value */
    gap: 6px !important;
    align-items: center !important;
}

/* Variant grids for different block types */
.mobile-character-canvas .inventory-block.magic-items-block .item-row {
    grid-template-columns: 28px 1fr 45px 65px !important;
    /* Wider rarity column */
}

.mobile-character-canvas .inventory-block.treasure-block .item-row {
    grid-template-columns: 1fr 65px !important;
    /* 2-column: Item | Value */
}
```

---

## Key Takeaways

1. **Desktop print layouts are fundamentally incompatible with mobile** - Decompose into mobile-native components

2. **Global CSS is the enemy** - PHB/print styles will fight you; override with `!important`

3. **Verify selectors against actual DOM** - Mobile renders differently; parent wrappers may not exist

4. **Portals break parent-scoped CSS** - Modals need media queries

5. **Inspect computed styles religiously** - Browser DevTools "Computed" tab reveals inherited rules

6. **Padding stacks invisibly** - Container + section + component padding adds up fast

7. **Public assets can't use url() in bundled CSS** - Use inline styles for backgrounds

8. **Window width ≠ container width** - Use `window.innerWidth` for breakpoints, `ResizeObserver` for scaling

9. **TypeScript strict checks need explicit guards** - `arr?.length > 0` fails; use `arr && arr.length > 0`

---

## Related Documents

- `HANDOFF-Mobile-Responsiveness.md` - Original spec/handoff document
- `PATTERNS-Canvas.mdc` - Desktop canvas patterns
- `LEARNINGS-Canvas-Measurement-Pagination-2025.md` - Measurement system

---

**Last Updated:** December 7, 2025 (Session 2 - Added viewport detection & TypeScript patterns)  
**Next Review:** When adding new mobile components or encountering new patterns

