# LandingPage Canvas Integration Guide

**Purpose:** Guide for creating a LandingPage branch to integrate the extracted Canvas package.

---

## Branch Setup

### Create Integration Branch

```bash
cd LandingPage
git checkout -b feat/canvas-package-integration
```

---

## Integration Steps

### 1. Install Canvas Package

**Option A: Local Development (Until Published)**
```bash
cd LandingPage
pnpm add file:../Canvas
# or for npm
npm install ../Canvas
```

**Option B: From Git Repository (Once Created)**
```bash
pnpm add git+https://github.com/dungeonmind/canvas.git#main
```

**Option C: From npm (Once Published)**
```bash
pnpm add @dungeonmind/canvas
```

### 2. Update Imports

**Find and Replace:**
```typescript
// OLD
import { CANVAS_COMPONENT_REGISTRY } from '../../canvas/registry';
import { buildPageDocument } from '../../canvas/data';
import { useCanvasLayout } from '../../canvas/hooks/useCanvasLayout';
import { CanvasPage } from '../../canvas/components/CanvasPage';
import { MeasurementLayer } from '../../canvas/layout/measurement';
import { CanvasLayoutProvider } from '../../canvas/layout/state';

// NEW
import { 
    createComponentRegistry,
    buildPageDocument,
    useCanvasLayout,
    CanvasPage,
    MeasurementLayer,
    CanvasLayoutProvider,
} from '@dungeonmind/canvas';
```

### 3. Update Component Registry

**Before:**
```typescript
import { CANVAS_COMPONENT_REGISTRY } from '../../../canvas/registry';
```

**After:**
```typescript
import { createComponentRegistry, type CanvasComponentType } from '@dungeonmind/canvas';
import { IdentityHeader, StatSummary, /* ... */ } from '../canvasComponents';

// Create registry with statblock components
const CANVAS_COMPONENT_REGISTRY = createComponentRegistry({
    'identity-header': {
        type: 'identity-header',
        displayName: 'Identity Header',
        component: IdentityHeader,
        defaults: {
            dataRef: { type: 'statblock', path: 'name' },
            layout: { isVisible: true },
        },
    },
    // ... more components
});
```

### 4. Update Type Imports

**Before:**
```typescript
import type { 
    StatblockPageDocument,
    ComponentInstance,
    ComponentDataSource,
} from '../../types/statblockCanvas.types';
```

**After:**
```typescript
import type { 
    StatblockPageDocument,
    ComponentInstance,
    ComponentDataSource,
} from '@dungeonmind/canvas';
```

### 5. Update StatblockPage Component

The `StatblockPage.tsx` component should work with minimal changes:

```typescript
// src/components/StatBlockGenerator/StatblockPage.tsx
import { 
    CanvasPage,
    useCanvasLayout,
    CanvasLayoutProvider,
    MeasurementLayer,
    type ComponentRegistryEntry,
    type StatblockPageDocument,
    type TemplateConfig,
} from '@dungeonmind/canvas';

// Rest of component remains the same
```

### 6. Update StatBlockCanvas Component

```typescript
// src/components/StatBlockGenerator/shared/StatBlockCanvas.tsx
import { buildPageDocument } from '@dungeonmind/canvas';
import type { StatblockPageDocument } from '@dungeonmind/canvas';

// Rest remains the same
```

### 7. Update Data Builder Usage

**Before:**
```typescript
import { buildPageDocument, extractCustomData } from '../../../canvas/data';
```

**After:**
```typescript
import { buildPageDocument } from '@dungeonmind/canvas';
import { extractCustomData } from '../canvasComponents/utils'; // Keep in LandingPage
```

### 8. Remove Old Canvas Code

After verifying everything works:

```bash
# Remove old canvas directory
rm -rf src/canvas

# Remove canvas types (if fully migrated)
# Keep statblock-specific types in types/statblock.types.ts
```

### 9. Update Type Definitions

Keep statblock-specific types in LandingPage:
- `types/statblock.types.ts` - StatBlockDetails, Action, etc.
- Update `statblockCanvas.types.ts` to re-export from package + statblock-specific additions

---

## Verification Checklist

After integration:

- [ ] Statblock generator loads without errors
- [ ] Components render correctly
- [ ] Measurement system works (no infinite loops)
- [ ] Pagination works correctly
- [ ] Export to HTML works
- [ ] Edit mode works (if applicable)
- [ ] No console errors
- [ ] TypeScript compiles without errors
- [ ] Tests pass (if any canvas-related tests)

---

## Rollback Plan

If issues arise:

```bash
git checkout main
git branch -D feat/canvas-package-integration
```

Or revert specific changes:
```bash
git checkout HEAD -- src/components/StatBlockGenerator/StatblockPage.tsx
```

---

## Testing Strategy

1. **Visual Testing:**
   - Generate a statblock
   - Verify all components render
   - Test pagination with long content
   - Test export to HTML

2. **Functional Testing:**
   - Test component data resolution
   - Test measurement system
   - Test layout recalculation
   - Test edit mode (if applicable)

3. **Regression Testing:**
   - Compare before/after screenshots
   - Verify all existing features work
   - Check for performance regressions

---

## Common Issues

### Issue: Module Not Found
**Solution:** Check package installation and import paths

### Issue: Type Errors
**Solution:** Ensure all types imported from `@dungeonmind/canvas`

### Issue: Component Registry Not Found
**Solution:** Use `createComponentRegistry()` instead of importing `CANVAS_COMPONENT_REGISTRY`

### Issue: Data Resolution Fails
**Solution:** Ensure `resolveDataReference` utility still in LandingPage or move to package

---

**Last Updated:** 2025-10-27

