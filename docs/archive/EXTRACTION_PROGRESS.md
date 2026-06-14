# Canvas Extraction Progress

**Date:** 2025-10-27  
**Status:** Phase 2 - Core Extraction (In Progress)

---

## ✅ Completed

### Files Extracted
- [x] `src/layout/` - Layout engine (paginate, state, measurement, types, utils)
- [x] `src/components/` - CanvasPage component
- [x] `src/hooks/` - useCanvasLayout hook
- [x] `src/registry/` - Component registry (genericized to factory)
- [x] `src/data/` - PageDocumentBuilder
- [x] `src/export/` - HTML export utilities

### Type Updates
- [x] Created `src/types/canvas.types.ts` with generic types
- [x] Updated all imports from `statblockCanvas.types` to `canvas.types`
- [x] Updated layout/types.ts to use new type location
- [x] Genericized ComponentDataSource to be parameterized
- [x] Genericized ComponentDataReference
- [x] Genericized RegionListContent

### Registry Changes
- [x] Converted ComponentRegistry to factory pattern (`createComponentRegistry`)
- [x] Removed hardcoded statblock components
- [x] Made registry functions accept registry as parameter

---

## 🚧 In Progress / Remaining

### Statblock-Specific Dependencies

**File: `src/layout/utils.ts`**
- [ ] Remove dependency on `components/StatBlockGenerator/canvasComponents/utils`
  - Functions needed: `getPrimaryStatblock`, `normalizeActionArray`, `resolveDataReference`, `toRegionContent`
  - **Solution:** These should be provided by applications or made generic/pluggable
- [ ] Remove `Action` type dependency
  - Used for height estimation functions
  - **Solution:** Make height estimation functions generic or accept item type parameter

**File: `src/layout/paginate.ts`**
- [ ] Remove dependency on `toRegionContent` from statblock utils
  - **Solution:** Accept region content transformer as parameter or make generic

**File: `src/data/PageDocumentBuilder.ts`**
- [ ] Remove `StatBlockDetails` dependency
  - `buildPageDocument` currently accepts `statblockData: StatBlockDetails`
  - **Solution:** Genericize to `buildPageDocument<T>` or accept generic data source

**File: `src/export/htmlExport.ts`**
- [ ] Remove `StatBlockDetails` dependency
  - Currently extracts creature name from statblock payload
  - **Solution:** Make generic or accept metadata extractor function

### Test Files
- [ ] Update test imports (`__tests__/` files)
- [ ] Genericize test data (remove Action/StatBlockDetails mocks)
- [ ] Ensure tests work with generic types

### Component Utilities Abstraction

The following utilities are currently statblock-specific and need abstraction:

1. **`getPrimaryStatblock(dataSources)`** - Extracts statblock from data sources
   - **Solution:** Genericize or accept data source selector function

2. **`normalizeActionArray(actions)`** - Normalizes action arrays
   - **Solution:** Make generic for any list item type, or accept normalizer function

3. **`resolveDataReference(dataRef, dataSources)`** - Resolves data from sources
   - **Solution:** Make generic or accept resolver function

4. **`toRegionContent(kind, items, ...)`** - Creates region list content
   - **Solution:** Genericize item type or accept factory function

### Constants That May Need Abstraction

**File: `src/layout/utils.ts`**
- Action-specific height estimation constants:
  - `ACTION_HEADER_HEIGHT_PX`
  - `ACTION_CONTINUATION_HEADER_HEIGHT_PX`
  - `ACTION_META_LINE_HEIGHT_PX`
  - `ACTION_DESC_LINE_HEIGHT_PX`
  - `ACTION_AVG_CHARS_PER_LINE`
  - `estimateActionHeight(action)` function
  - `estimateListHeight(items, isContinuation)` function

**Solution Options:**
1. Make these configurable via options
2. Accept height estimator functions as parameters
3. Move to domain-specific adapter layer (provided by applications)

---

## 📝 Next Steps

### Immediate (Continue Phase 2)
1. **Genericize PageDocumentBuilder**
   - Change `statblockData` to generic data parameter
   - Accept data source builder function

2. **Abstract Component Utilities**
   - Create adapter interface for data resolution
   - Applications provide their own resolvers

3. **Genericize Height Estimation**
   - Make height estimation functions configurable
   - Accept item type parameter or estimator function

4. **Update Test Files**
   - Fix imports
   - Genericize test data

### Short-term (Phase 3)
5. Create example statblock adapter/utilities in `examples/statblock/`
6. Document adapter pattern for applications
7. Update documentation with generic usage examples

---

## 🔍 Files Needing Updates

### High Priority
- `src/layout/utils.ts` - Remove statblock utility dependencies
- `src/layout/paginate.ts` - Remove statblock utility dependencies  
- `src/data/PageDocumentBuilder.ts` - Genericize statblock data
- `src/export/htmlExport.ts` - Genericize statblock extraction

### Medium Priority
- `src/layout/__tests__/*` - Update test imports and data
- `src/components/CanvasPage.tsx` - Verify no statblock dependencies

### Low Priority
- `src/registry/ComponentRegistry.ts` - Already genericized ✅
- `src/hooks/useCanvasLayout.ts` - Already updated ✅
- `src/layout/state.tsx` - Already updated ✅
- `src/layout/measurement.tsx` - Check for dependencies
- `src/layout/types.ts` - Already updated ✅

---

## 💡 Abstraction Strategy

For statblock-specific utilities, we'll use one of these patterns:

### Pattern 1: Adapter Functions (Recommended)
Applications provide adapter functions for domain-specific operations:
```typescript
interface CanvasAdapters {
  resolveData: (dataRef: ComponentDataReference, sources: ComponentDataSource[]) => unknown;
  normalizeListItems: (items: unknown[]) => unknown[];
  createRegionContent: (kind: string, items: unknown[], ...) => RegionListContent;
  estimateItemHeight: (item: unknown) => number;
}
```

### Pattern 2: Generic Parameters
Functions accept generic type parameters:
```typescript
function buildPageDocument<T>(options: {
  template: TemplateConfig;
  data: T;
  // ...
}): StatblockPageDocument;
```

### Pattern 3: Pluggable Modules
Applications provide implementations that match interfaces, registered with the system.

**Decision:** We'll use Pattern 1 (Adapter Functions) as it's most flexible and doesn't require complex generic type gymnastics.

---

**Last Updated:** 2025-10-27

