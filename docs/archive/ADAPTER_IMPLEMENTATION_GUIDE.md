# Canvas Adapter Implementation Guide

**Date:** 2025-11-02  
**Purpose:** Complete Phase 2-3 genericization using Adapter Pattern  
**Status:** Ready to Implement

---

## Overview

The Canvas package now uses an **Adapter Pattern** to decouple the generic layout engine from domain-specific logic (like statblocks, spells, character sheets, etc.).

**Key Principle:** The Canvas library provides layout, measurement, and pagination. Applications provide adapters that tell Canvas how to interpret their data.

---

## Architecture

```
┌──────────────────────────────────────────────┐
│ Application (StatblockGenerator)             │
│ - Implements CanvasAdapters                  │
│ - Provides domain-specific logic             │
└─────────────────┬────────────────────────────┘
                  ↓
        Passes adapters to Canvas
                  ↓
┌──────────────────────────────────────────────┐
│ @dungeonmind/canvas (Generic)                │
│ - Uses adapters for domain operations        │
│ - No hardcoded statblock knowledge           │
└──────────────────────────────────────────────┘
```

---

## What Adapters Solve

### Before (Hardcoded Statblock Logic)

```typescript
// ❌ Canvas knows about StatBlockDetails
import { StatBlockDetails, Action } from 'types/statblock';

function buildPageDocument(statblockData: StatBlockDetails) {
  // Hardcoded statblock structure
  const actions = statblockData.actions;
  const name = statblockData.name;
  // ...
}
```

### After (Generic with Adapters)

```typescript
// ✅ Canvas accepts any data type
function buildPageDocument<T>(options: {
  data: T;
  adapters: CanvasAdapters;
  // ...
}) {
  // Uses adapters to extract data
  const name = adapters.metadataExtractor.extractDisplayName(dataSources);
  // ...
}
```

---

## Adapter Interfaces

Canvas defines 5 adapter types (see `src/types/adapters.types.ts`):

### 1. DataResolver
Resolves data references from data sources.

```typescript
interface DataResolver {
  resolveDataReference<T>(
    dataSources: ComponentDataSource[],
    dataRef: ComponentDataReference
  ): T | undefined;

  getPrimarySource<T>(dataSources: ComponentDataSource[], type: string): T | undefined;
}
```

**Use Case:** Get specific fields from statblock (e.g., `legendaryActions`, `spells`)

### 2. ListNormalizer
Normalizes list items (ensures arrays, filters nulls).

```typescript
interface ListNormalizer {
  normalizeListItems<T>(items: T[] | undefined | null): T[];
}
```

**Use Case:** Handle optional/nullable lists in statblock data

### 3. RegionContentFactory
Creates region-specific list content.

```typescript
interface RegionContentFactory {
  createRegionContent<T>(
    kind: string,
    items: T[],
    startIndex: number,
    isContinuation: boolean
  ): RegionListContent;
}
```

**Use Case:** Split lists across pages (e.g., legendary actions, spells)

### 4. HeightEstimator
Estimates component heights before measurement.

```typescript
interface HeightEstimator {
  estimateItemHeight<T>(item: T): number;
  estimateListHeight<T>(items: T[], isContinuation: boolean): number;
  estimateComponentHeight<T>(component: T): number;
}
```

**Use Case:** Pagination needs height estimates for components not yet measured

### 5. MetadataExtractor
Extracts metadata for export/display.

```typescript
interface MetadataExtractor {
  extractDisplayName(dataSources: ComponentDataSource[]): string | undefined;
  extractExportMetadata(dataSources: ComponentDataSource[]): Record<string, unknown>;
}
```

**Use Case:** Export to HTML, get creature name for filename

---

## Implementation Steps

### Step 1: Create Statblock Adapters (in LandingPage)

**File:** `LandingPage/src/canvas/adapters/statblockAdapters.ts` (NEW)

```typescript
import type { CanvasAdapters, DataResolver, HeightEstimator, MetadataExtractor } from '@dungeonmind/canvas';
import type { StatBlockDetails, Action } from '../../types/statblock.types';

// Data Resolver for Statblocks
const statblockDataResolver: DataResolver = {
  resolveDataReference(dataSources, dataRef) {
    if (dataRef.type === 'statblock') {
      const source = dataSources.find((s) => s.type === 'statblock');
      if (source && typeof source.payload === 'object') {
        const statblock = source.payload as StatBlockDetails;
        return (statblock as any)[dataRef.path];
      }
    }
    // Fallback to default behavior for custom sources
    if (dataRef.type === 'custom') {
      const source = dataSources.find((s) => s.type === 'custom');
      if (source && typeof source.payload === 'object') {
        return (source.payload as any)[dataRef.key];
      }
    }
    return undefined;
  },

  getPrimarySource(dataSources, type) {
    const source = dataSources.find((s) => s.type === type);
    return source?.payload;
  },
};

// Height Estimator for Statblock Actions
const statblockHeightEstimator: HeightEstimator = {
  estimateItemHeight(item: unknown): number {
    const action = item as Action;
    
    // Header + name
    let height = 36; // ACTION_HEADER_HEIGHT_PX
    
    // Meta line (attack bonus, damage, DC, etc.)
    if (action.attackBonus || action.damage || action.saveDC) {
      height += 16; // ACTION_META_LINE_HEIGHT_PX
    }
    
    // Description (estimate based on length)
    if (action.description) {
      const lines = Math.ceil(action.description.length / 75); // ACTION_AVG_CHARS_PER_LINE
      height += lines * 18; // ACTION_DESC_LINE_HEIGHT_PX
    }
    
    return height;
  },

  estimateListHeight(items: unknown[], isContinuation: boolean): number {
    let height = isContinuation ? 28 : 36; // Header height
    items.forEach((item) => {
      height += this.estimateItemHeight(item);
      height += 8; // LIST_ITEM_SPACING_PX
    });
    return height;
  },

  estimateComponentHeight(): number {
    return 200; // DEFAULT_COMPONENT_HEIGHT_PX
  },
};

// Metadata Extractor for Statblocks
const statblockMetadataExtractor: MetadataExtractor = {
  extractDisplayName(dataSources) {
    const statblock = dataSources.find((s) => s.type === 'statblock')?.payload as StatBlockDetails;
    return statblock?.name || 'Untitled Statblock';
  },

  extractExportMetadata(dataSources) {
    const statblock = dataSources.find((s) => s.type === 'statblock')?.payload as StatBlockDetails;
    return {
      name: statblock?.name,
      type: statblock?.type,
      cr: statblock?.challengeRating,
    };
  },
};

// Complete Adapter Bundle for Statblocks
export const createStatblockAdapters = (): CanvasAdapters => {
  const defaults = createDefaultAdapters();
  
  return {
    dataResolver: statblockDataResolver,
    listNormalizer: defaults.listNormalizer, // Use default
    regionContentFactory: defaults.regionContentFactory, // Use default
    heightEstimator: statblockHeightEstimator,
    metadataExtractor: statblockMetadataExtractor,
  };
};
```

### Step 2: Update Canvas Functions to Accept Adapters

**File:** `Canvas/src/layout/utils.ts`

Replace the temporary stubs (lines 22-51) with adapter parameters:

```typescript
// ❌ REMOVE temporary stubs (lines 22-51)

// ✅ ADD adapter parameter to functions that need it
export function buildCanvasEntries(options: {
  instances: ComponentInstance[];
  template: TemplateConfig;
  columnCount: number;
  pageWidthPx: number;
  dataSources: ComponentDataSource[];
  measurements: Map<MeasurementKey, MeasurementRecord>;
  assignedRegions: Map<string, SlotAssignment>;
  adapters: CanvasAdapters; // NEW
}): CanvasEntriesResult {
  const { adapters } = options;
  
  // Use adapter instead of hardcoded function
  const resolved = adapters.dataResolver.resolveDataReference(
    options.dataSources,
    dataRef
  );
  
  // Use adapter for list normalization
  const items = adapters.listNormalizer.normalizeListItems(rawItems);
  
  // Use adapter for height estimation
  const estimatedHeight = adapters.heightEstimator.estimateListHeight(items, false);
  
  // ... rest of function
}
```

### Step 3: Update buildPageDocument

**File:** `Canvas/src/data/PageDocumentBuilder.ts`

```typescript
// Before (statblock-specific)
export function buildPageDocument(options: {
  template: TemplateConfig;
  statblockData: StatBlockDetails; // ❌ Hardcoded
  // ...
}): StatblockPageDocument {
  // ...
}

// After (generic)
export function buildPageDocument<T = unknown>(options: {
  template: TemplateConfig;
  data: T; // ✅ Generic
  adapters: CanvasAdapters; // ✅ NEW
  // ...
}): StatblockPageDocument {
  const dataSources: ComponentDataSource[] = [
    { type: 'statblock', payload: options.data },
  ];
  
  // Use adapters for data operations
  // ...
}
```

### Step 4: Update Export Functions

**File:** `Canvas/src/export/htmlExport.ts`

```typescript
export function exportToHTML(options: {
  page: StatblockPageDocument;
  template: TemplateConfig;
  adapters: CanvasAdapters; // ✅ NEW
}): string {
  // Use adapter to extract name
  const displayName = options.adapters.metadataExtractor.extractDisplayName(
    options.page.dataSources
  );
  
  // ... rest of export
}
```

### Step 5: Update useCanvasLayout Hook

**File:** `Canvas/src/hooks/useCanvasLayout.ts`

```typescript
export function useCanvasLayout(options: {
  componentInstances: ComponentInstance[];
  template: TemplateConfig;
  dataSources: ComponentDataSource[];
  componentRegistry: Map<CanvasComponentType, ComponentRegistryEntry>;
  pageVariables: PageVariables;
  adapters: CanvasAdapters; // ✅ NEW
}) {
  // Pass adapters through to layout functions
  // ...
}
```

### Step 6: Update LandingPage Usage

**File:** `LandingPage/src/components/StatBlockGenerator/StatblockPage.tsx`

```typescript
import { createStatblockAdapters } from '../../canvas/adapters/statblockAdapters';

function StatblockPage() {
  const adapters = useMemo(() => createStatblockAdapters(), []);
  
  const layout = useCanvasLayout({
    componentInstances,
    template,
    dataSources,
    componentRegistry,
    pageVariables,
    adapters, // ✅ Pass adapters
  });
  
  // ...
}
```

---

## Benefits of This Approach

### ✅ Generic Canvas Package
- No statblock imports in Canvas code
- Can support any document type (spells, character sheets, items, etc.)
- Easy to unit test with mock adapters

### ✅ Domain Logic Stays in Application
- Statblock-specific logic in StatblockGenerator
- Spell-specific logic in future SpellGenerator
- Each application implements its own adapters

### ✅ Default Adapters Provided
- Canvas provides `createDefaultAdapters()` for simple use cases
- Applications can use defaults + override specific adapters

### ✅ Gradual Migration
- Can start with default adapters
- Override one adapter at a time
- Incrementally improve height estimation, etc.

---

## Testing Strategy

### Test Canvas with Mock Adapters

```typescript
// Canvas tests don't need statblock types
it('paginates with custom adapter', () => {
  const mockAdapters: CanvasAdapters = {
    heightEstimator: {
      estimateItemHeight: () => 50,
      estimateListHeight: (items) => items.length * 50,
      estimateComponentHeight: () => 200,
    },
    // ... other adapters
  };
  
  const result = buildCanvasEntries({ ..., adapters: mockAdapters });
  expect(result.buckets.size).toBeGreaterThan(0);
});
```

### Test Statblock Adapters Separately (in LandingPage)

```typescript
it('estimates action height correctly', () => {
  const adapters = createStatblockAdapters();
  const action: Action = {
    name: 'Fireball',
    description: 'A bright streak...',
    damage: '8d6',
  };
  
  const height = adapters.heightEstimator.estimateItemHeight(action);
  expect(height).toBeGreaterThan(50);
});
```

---

## Migration Checklist

### In Canvas Package (Phase 2 Completion)
- [x] Create `src/types/adapters.types.ts`
- [x] Export adapter types from `src/index.ts`
- [ ] Update `buildCanvasEntries()` to accept `adapters` parameter
- [ ] Update `buildPageDocument()` to be generic with `adapters`
- [ ] Update `exportToHTML()` to accept `adapters`
- [ ] Update `useCanvasLayout()` to accept and pass `adapters`
- [ ] Remove temporary stubs from `utils.ts`
- [ ] Update all tests to use mock adapters

### In LandingPage (Phase 3)
- [ ] Create `src/canvas/adapters/statblockAdapters.ts`
- [ ] Implement `createStatblockAdapters()`
- [ ] Update `StatblockPage.tsx` to use adapters
- [ ] Test statblock generation still works
- [ ] Verify export to HTML still works

---

## Success Criteria

✅ **Phase 2 Complete When:**
- [ ] Canvas has zero statblock imports
- [ ] All Canvas tests pass (100%)
- [ ] `buildPageDocument()` is generic
- [ ] Default adapters work for simple cases

✅ **Phase 3 Complete When:**
- [ ] Statblock adapters implemented in LandingPage
- [ ] StatblockGenerator uses Canvas with adapters
- [ ] Statblock generation works identically to before
- [ ] Export functionality works with adapter pattern

---

## Next Steps

1. **Update Canvas Functions** (2-3 hours)
   - Add `adapters` parameter to all functions that need it
   - Replace stubs with adapter calls

2. **Update Canvas Tests** (1-2 hours)
   - Use mock adapters instead of statblock data
   - Ensure 100% test pass rate

3. **Create Statblock Adapters** (2-3 hours)
   - Implement in LandingPage
   - Test with real statblock data

4. **Integration Testing** (1-2 hours)
   - Verify StatblockGenerator works
   - Test export, pagination, measurement

**Total Time:** 6-10 hours

---

**Last Updated:** 2025-11-02  
**Status:** Ready to implement


