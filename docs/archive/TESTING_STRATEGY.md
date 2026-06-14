# Canvas Testing Strategy

**Date:** 2025-10-27  
**Purpose:** Define testing approach for Canvas package before manual testing

---

## Testing Philosophy

**Test Early, Test Often:** Establish automated tests before manual testing to catch regressions and verify extraction correctness.

**Layered Testing:**
1. **Type Checking** - Compile-time verification
2. **Unit Tests** - Pure function and component tests
3. **Integration Tests** - Multi-component interactions
4. **Smoke Tests** - End-to-end functionality with mocks
5. **Manual Testing** - Full statblock integration (after package completion)

---

## Test Categories We Can Write Now

### ✅ 1. Type Export Tests

**What:** Verify all expected types and functions are exported from package  
**Why:** Ensures API contract is maintained  
**Status:** ✅ Created (`src/__tests__/type-exports.test.ts`)

```typescript
// Verifies exports exist
expect(typeof Canvas.createComponentRegistry).toBe('function');
```

### ✅ 2. Pure Function Tests

**What:** Test functions with no side effects (no statblock dependencies)  
**Why:** Core functionality that doesn't need domain data  
**Status:** ✅ Created (`src/__tests__/utils.test.ts`)

**Functions Tested:**
- `regionKey()` - Region key generation
- `toColumnType()` - Column type conversion
- `clamp()` - Value clamping
- `convertToPixels()` - Unit conversion
- `computeBasePageDimensions()` - Page dimension calculation

### ✅ 3. Registry Tests

**What:** Test component registry factory functions  
**Why:** Core extensibility mechanism  
**Status:** ✅ Created (`src/__tests__/registry.test.ts`)

**Tests:**
- Registry creation
- Entry retrieval
- Type validation
- Multiple registries

### ✅ 4. Smoke Tests

**What:** Basic end-to-end tests with mocks  
**Why:** Verify system works without real statblock data  
**Status:** ✅ Created (`src/__tests__/smoke.test.ts`)

**Tests:**
- Registry creation
- Page variable creation
- Template creation
- Component instance creation

### ✅ 5. Existing Test Updates

**What:** Fix existing tests to use generic types  
**Why:** Verify extraction didn't break existing functionality  
**Status:** 🚧 In Progress

**Files to Update:**
- `layout/__tests__/paginate.test.ts` - ✅ Started (needs completion)
- `layout/__tests__/state.test.ts` - Needs import updates
- `layout/__tests__/home-regions.test.ts` - Needs import updates
- `layout/__tests__/measurement.test.ts` - Should work as-is
- `layout/__tests__/measurementLayer.test.tsx` - Should work as-is

---

## Test Utilities Created

### `src/__tests__/test-utils.ts`

Provides generic test helpers that don't depend on statblock types:

- `createTestInstance()` - Generic component instance
- `createTestEntry()` - Generic layout entry
- `createTestListEntry()` - Generic list entry with items
- `createMockItem()` - Mock list item
- `createTestPageVariables()` - Test page configuration
- `createTestTemplate()` - Test template config

**Why:** Allows writing tests without statblock dependencies

---

## Test Setup

### Jest Configuration (`jest.config.js`)
- TypeScript support via ts-jest
- jsdom environment for React components
- Coverage reporting
- Setup file for mocks

### Setup File (`src/setupTests.ts`)
- ResizeObserver mock
- requestIdleCallback mock
- getBoundingClientRect mock

---

## Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Run specific test file
npm test paginate.test.ts

# Run in watch mode
npm test -- --watch

# Type check only
npm run type-check
```

---

## What We CAN Test Now

✅ **Pure Functions**
- Math/utility functions
- Type conversions
- String/array manipulations

✅ **Type System**
- Export verification
- Type correctness

✅ **Registry System**
- Factory functions
- Lookup/validation

✅ **Layout Engine Core**
- Region calculations
- Home region assignments
- Bucket building (with mocks)

✅ **Measurement System**
- Dispatcher logic
- Observer lifecycle
- Cleanup behavior

✅ **State Management**
- Reducer actions
- State transitions

---

## What We CANNOT Test Yet

❌ **Statblock-Specific Functions**
- `buildPageDocument()` - Needs StatBlockDetails type
- `exportToHTML()` - Needs statblock data extraction
- Height estimation - Uses Action type

❌ **Full Integration**
- Complete statblock rendering
- Real component rendering
- Actual pagination with real data

**Why:** These require statblock types/data that aren't generic yet

---

## Testing Strategy for Remaining Dependencies

### For `buildPageDocument()`:
```typescript
// Create generic version that accepts any data type
it('builds page document from generic data', () => {
  const page = buildPageDocument({
    template: mockTemplate,
    data: { name: 'Test' }, // Generic data
    // ...
  });
  expect(page.componentInstances).toBeDefined();
});
```

### For Height Estimation:
```typescript
// Test with mock item type
it('estimates height for generic items', () => {
  const items = [{ name: 'Item 1' }, { name: 'Item 2' }];
  const height = estimateListHeight(items);
  expect(height).toBeGreaterThan(0);
});
```

### For Pagination:
```typescript
// Test with generic list items
it('paginates generic list items', () => {
  const items = createMockItems(10);
  const entry = createTestListEntry('test', items, 100);
  // ... test pagination
});
```

---

## Test Coverage Goals

**Phase 2 (Now):**
- [x] Type exports: 100%
- [x] Pure utilities: 100%
- [x] Registry: 100%
- [x] Smoke tests: Basic scenarios
- [ ] Existing tests: Update to generic types

**Phase 3 (After Genericization):**
- [ ] Data builders: With generic types
- [ ] Export functions: With generic types
- [ ] Height estimation: With generic items

**Phase 4 (Integration):**
- [ ] Full statblock integration (in LandingPage)
- [ ] End-to-end rendering tests
- [ ] Performance benchmarks

---

## Next Steps

1. **Run Type Check**
   ```bash
   npm run type-check
   ```
   This verifies all types compile correctly.

2. **Run Unit Tests**
   ```bash
   npm test
   ```
   Verify pure functions and registry work.

3. **Fix Existing Tests**
   - Update imports in test files
   - Replace Action type with generic items
   - Update test data creation

4. **Add Missing Tests**
   - Test data builder with generic types (once genericized)
   - Test export with generic data (once genericized)

---

## Benefits of This Approach

✅ **Early Validation:** Catch issues before manual testing  
✅ **Regression Prevention:** Tests catch breaking changes  
✅ **Documentation:** Tests document expected behavior  
✅ **Confidence:** Automated verification before integration  
✅ **Speed:** Fast feedback loop vs manual testing  

---

**Last Updated:** 2025-10-27

