# Canvas Extraction Plan

**Date:** 2025-10-27  
**Status:** In Progress  
**Goal:** Extract Canvas system from LandingPage to independent package

---

## Overview

The Canvas system is being extracted from `LandingPage/src/canvas` to a new independent package `@dungeonmind/canvas`. This document tracks the extraction process.

---

## Extraction Phases

### Phase 1: Repository Setup ✅
- [x] Create Canvas directory structure
- [x] Create package.json with dependencies
- [x] Create tsconfig.json
- [x] Create README.md
- [x] Create .gitignore
- [ ] Initialize git repository
- [ ] Set up remote repository

### Phase 2: Core Extraction
- [ ] Copy core Canvas files from LandingPage
  - [ ] `src/canvas/layout/` → Core layout engine
  - [ ] `src/canvas/components/` → CanvasPage component
  - [ ] `src/canvas/hooks/` → useCanvasLayout hook
  - [ ] `src/canvas/registry/` → Component registry system
  - [ ] `src/canvas/data/` → PageDocumentBuilder
  - [ ] `src/canvas/export/` → HTML export utilities
- [ ] Extract and genericize type definitions
- [ ] Update imports to use package structure
- [ ] Remove statblock-specific dependencies

### Phase 3: Genericization
- [ ] Abstract ComponentDataSource (currently `statblock | custom`)
- [ ] Create generic ContentType interface
- [ ] Remove direct StatBlockDetails dependencies
- [ ] Make component props generic
- [ ] Extract component utilities to generic helpers

### Phase 4: Testing & Validation
- [ ] Copy test files from LandingPage
- [ ] Update test imports
- [ ] Ensure all tests pass
- [ ] Add integration tests for package API
- [ ] Test with statblock as reference implementation

### Phase 5: Documentation
- [ ] Update README with full API documentation
- [ ] Create examples directory with statblock reference
- [ ] Document migration guide from LandingPage usage
- [ ] Create component development guide

### Phase 6: LandingPage Integration Branch
- [ ] Create branch `feat/canvas-package-integration`
- [ ] Update LandingPage to use @dungeonmind/canvas package
- [ ] Update StatBlockGenerator to use new package
- [ ] Ensure statblock functionality unchanged
- [ ] Test end-to-end statblock generation

### Phase 7: Publication & Cleanup
- [ ] Publish package to npm (private initially)
- [ ] Remove canvas code from LandingPage
- [ ] Update all imports in LandingPage
- [ ] Merge integration branch
- [ ] Archive extraction documentation

---

## File Mapping

### Core Files to Extract

```
LandingPage/src/canvas/                    → Canvas/src/
├── layout/
│   ├── paginate.ts                         → layout/paginate.ts
│   ├── state.tsx                           → layout/state.tsx
│   ├── measurement.tsx                     → layout/measurement.tsx
│   ├── types.ts                            → layout/types.ts
│   ├── utils.ts                            → layout/utils.ts
│   └── __tests__/                          → layout/__tests__/
├── components/
│   └── CanvasPage.tsx                      → components/CanvasPage.tsx
├── hooks/
│   └── useCanvasLayout.ts                  → hooks/useCanvasLayout.ts
├── registry/
│   ├── ComponentRegistry.ts                → registry/ComponentRegistry.ts
│   └── index.ts                            → registry/index.ts
├── data/
│   ├── PageDocumentBuilder.ts              → data/PageDocumentBuilder.ts
│   └── index.ts                            → data/index.ts
├── export/
│   ├── htmlExport.ts                       → export/htmlExport.ts
│   └── index.ts                            → export/index.ts
└── index.ts                                → index.ts
```

### Type Files to Genericize

```
LandingPage/src/types/statblockCanvas.types.ts  → Canvas/src/types/canvas.types.ts
  - Remove StatBlockDetails dependencies
  - Genericize ComponentDataSource
  - Keep generic types
```

### Files to NOT Extract (Remain in LandingPage)

```
LandingPage/src/components/StatBlockGenerator/canvasComponents/
  - Component implementations (examples only)
LandingPage/src/components/StatBlockGenerator/StatblockPage.tsx
  - Integration wrapper (reference implementation)
LandingPage/src/components/StatBlockGenerator/shared/StatBlockCanvas.tsx
  - Statblock-specific UI wrapper
```

---

## Dependencies to Resolve

### External Dependencies (Keep)
- `react` - Required
- `react-dom` - Required

### Internal Dependencies to Remove
- `types/statblock.types.ts` (StatBlockDetails, Action) → Replace with generic types
- Statblock component implementations → Move to examples
- D&D CSS/styling → Make optional/configurable

### Dependencies to Make Optional
- Font loading (custom fonts) → Optional feature
- Measurement coordinator → Optional for edit mode

---

## Breaking Changes

### API Changes

**Before (LandingPage):**
```typescript
import { CANVAS_COMPONENT_REGISTRY } from '../../canvas/registry';
import { buildPageDocument } from '../../canvas/data';
```

**After (Package):**
```typescript
import { buildPageDocument } from '@dungeonmind/canvas';
import { createComponentRegistry } from '@dungeonmind/canvas/registry';
```

### Type Changes

**ComponentDataSource:**
```typescript
// Before
type ComponentDataSource = 
  | { type: 'statblock'; payload: StatBlockDetails }
  | { type: 'custom'; payload: Record<string, unknown> };

// After
type ComponentDataSource<T = unknown> = 
  | { type: 'statblock'; payload: T }
  | { type: 'custom'; payload: Record<string, unknown> };
```

---

## Migration Checklist for LandingPage

After extraction:
- [ ] Install `@dungeonmind/canvas` package
- [ ] Update all imports from `../../canvas` to `@dungeonmind/canvas`
- [ ] Update StatblockPage component to use package
- [ ] Update component registry to use package registry
- [ ] Update type imports
- [ ] Test statblock generation end-to-end
- [ ] Verify measurement system works
- [ ] Verify export functionality works

---

## Success Criteria

✅ **Extraction Complete When:**
1. All core Canvas code moved to package
2. Package builds successfully (`npm run build`)
3. All tests pass (`npm test`)
4. LandingPage can use package via npm install
5. Statblock generator works identically to before
6. Documentation complete
7. Examples provided

---

## Notes

- Using statblock as benchmark/reference implementation
- Component implementations will remain in LandingPage as examples
- Package will provide generic types, consumers implement domain-specific components
- Measurement system remains core feature (not optional)

---

**Last Updated:** 2025-10-27

