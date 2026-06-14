# Running Canvas Tests

**Quick Start:** Run tests to verify extraction correctness before manual testing.

---

## Prerequisites

```bash
cd Canvas
npm install
```

---

## Test Commands

### 1. Type Check (Fastest - No Runtime)

```bash
npm run type-check
```

**What it does:** Verifies TypeScript compiles without errors  
**Time:** ~5 seconds  
**Why first:** Catches type errors immediately

### 2. Run All Tests

```bash
npm test
```

**What it runs:**
- Type export tests
- Registry tests
- Utility function tests
- Smoke tests
- Updated existing tests (paginate, state, etc.)

**Expected:** All tests should pass (once imports fixed)

### 3. Run Specific Test Suite

```bash
# Registry tests
npm test registry.test.ts

# Utility tests
npm test utils.test.ts

# Pagination tests
npm test paginate.test.ts
```

### 4. Watch Mode (During Development)

```bash
npm test -- --watch
```

**When to use:** Making changes to tests or code

### 5. Coverage Report

```bash
npm test -- --coverage
```

**What it shows:** Which code is tested, which isn't

---

## What to Expect

### ✅ Should Pass Immediately

- `type-exports.test.ts` - Verifies API exports
- `registry.test.ts` - Registry factory functions
- `utils.test.ts` - Pure utility functions
- `smoke.test.ts` - Basic functionality

### 🚧 May Need Fixes

- `paginate.test.ts` - Should work after our updates
- `state.test.ts` - May need import updates
- `home-regions.test.ts` - May need import updates

### ⚠️ Won't Work Yet

- Tests that use `buildPageDocument()` with StatBlockDetails
- Tests that use statblock-specific height estimation
- Full integration tests

---

## Troubleshooting

### Error: "Cannot find module '../types/canvas.types'"

**Fix:** Run `npm install` first, or check that types file exists at `src/types/canvas.types.ts`

### Error: "Type 'Action' is not assignable"

**Fix:** Test file still uses old Action type. Update to use generic MockItem type.

### Error: "ResizeObserver is not defined"

**Fix:** Check that `setupTests.ts` mocks ResizeObserver correctly.

---

## Test Results Interpretation

### ✅ All Passing
Great! Core functionality extracted correctly.

### ⚠️ Some Failing
- Check error messages
- Update imports in failing tests
- Verify test data creation uses generic types

### ❌ Many Failing
- Run `npm run type-check` first to find type errors
- Check that all imports point to correct locations
- Verify test utilities work correctly

---

## Next Steps After Tests Pass

1. ✅ Type check passes
2. ✅ Unit tests pass
3. → Continue genericizing remaining dependencies
4. → Create LandingPage integration branch
5. → Manual testing with statblock

---

**Last Updated:** 2025-10-27

