# Spec: Add 'character' DataReference Type to Canvas

**Date:** December 4, 2025  
**Author:** PCG Canvas Integration  
**Status:** Ready for Implementation  
**Estimated Effort:** 1-2 hours

---

## Problem Statement

The Canvas package currently only supports two data reference types in `ComponentDataReference`:

```typescript
export type ComponentDataReference =
    | { type: 'statblock'; path: string; sourceId?: string }
    | { type: 'custom'; key: string; sourceId?: string };
```

The PlayerCharacterGenerator needs to use Canvas for character sheet rendering, but there's no `'character'` type. This causes TypeScript errors when trying to use `dataRef.type === 'character'`.

---

## Solution

Add `'character'` as a first-class data reference type in Canvas.

---

## Files to Modify

### 1. `Canvas/src/types/canvas.types.ts`

**Location:** Line ~122-124

**Current:**
```typescript
export type ComponentDataReference =
    | { type: 'statblock'; path: string; sourceId?: string }
    | { type: 'custom'; key: string; sourceId?: string };
```

**Change to:**
```typescript
export type ComponentDataReference =
    | { type: 'statblock'; path: string; sourceId?: string }
    | { type: 'character'; path: string; sourceId?: string }
    | { type: 'custom'; key: string; sourceId?: string };
```

**Rationale:** The `'character'` type follows the same pattern as `'statblock'`:
- Uses `path` for property access (e.g., `'abilityScores'`, `'dnd5eData.race'`)
- Optional `sourceId` for multi-source scenarios

---

### 2. `Canvas/src/types/adapters.types.ts`

**Location:** Lines ~143-168 (createDefaultDataResolver function)

**Current:**
```typescript
export const createDefaultDataResolver = (): DataResolver => ({
    resolveDataReference<T = unknown>(
        dataSources: ComponentDataSource[],
        dataRef: ComponentDataReference
    ): T | undefined {
        if (dataRef.type === 'statblock') {
            const source = dataSources.find((s) => s.type === 'statblock');
            if (source && typeof source.payload === 'object' && source.payload !== null) {
                const payload = source.payload as Record<string, unknown>;
                return payload[dataRef.path] as T | undefined;
            }
        } else if (dataRef.type === 'custom') {
            const source = dataSources.find((s) => s.type === 'custom');
            if (source && typeof source.payload === 'object' && source.payload !== null) {
                const payload = source.payload as Record<string, unknown>;
                return payload[dataRef.key] as T | undefined;
            }
        }
        return undefined;
    },
    // ...
});
```

**Change to:**
```typescript
export const createDefaultDataResolver = (): DataResolver => ({
    resolveDataReference<T = unknown>(
        dataSources: ComponentDataSource[],
        dataRef: ComponentDataReference
    ): T | undefined {
        if (dataRef.type === 'statblock') {
            const source = dataSources.find((s) => s.type === 'statblock');
            if (source && typeof source.payload === 'object' && source.payload !== null) {
                const payload = source.payload as Record<string, unknown>;
                return payload[dataRef.path] as T | undefined;
            }
        } else if (dataRef.type === 'character') {
            const source = dataSources.find((s) => s.type === 'character');
            if (source && typeof source.payload === 'object' && source.payload !== null) {
                const payload = source.payload as Record<string, unknown>;
                // Support nested paths like 'dnd5eData.abilityScores'
                return resolvePath(payload, dataRef.path) as T | undefined;
            }
        } else if (dataRef.type === 'custom') {
            const source = dataSources.find((s) => s.type === 'custom');
            if (source && typeof source.payload === 'object' && source.payload !== null) {
                const payload = source.payload as Record<string, unknown>;
                return payload[dataRef.key] as T | undefined;
            }
        }
        return undefined;
    },
    // ...
});

/**
 * Resolve a dot-separated path in an object
 * e.g., resolvePath(obj, 'dnd5eData.abilityScores') -> obj.dnd5eData.abilityScores
 */
function resolvePath(obj: Record<string, unknown>, path: string): unknown {
    return path.split('.').reduce((current, key) => {
        if (current && typeof current === 'object' && key in current) {
            return (current as Record<string, unknown>)[key];
        }
        return undefined;
    }, obj as unknown);
}
```

**Rationale:** 
- Character data often has nested structure (`character.dnd5eData.abilityScores`)
- The `resolvePath` helper enables dot-notation for nested access
- Statblock could also use this in future, but we're keeping backward compatibility

---

### 3. `Canvas/src/data/PageDocumentBuilder.ts` (Optional Enhancement)

**Current:** Only has `statblockData` option

**Option A: Add separate `characterData` option**
```typescript
interface BuildPageDocumentOptions<T = unknown, C = unknown> {
    template: TemplateConfig;
    statblockData?: T;
    characterData?: C;  // NEW
    customData?: Record<string, unknown>;
    projectId?: string;
    ownerId?: string;
}
```

**Option B: Make more generic**
```typescript
interface BuildPageDocumentOptions {
    template: TemplateConfig;
    data: {
        type: 'statblock' | 'character';
        payload: unknown;
    };
    customData?: Record<string, unknown>;
    projectId?: string;
    ownerId?: string;
}
```

**Recommendation:** Option A for backward compatibility. StatblockGenerator continues to work unchanged.

---

## Test Cases

### Unit Tests (`Canvas/src/__tests__/character-data.test.ts`)

```typescript
describe('Character data reference type', () => {
    it('should resolve simple character path', () => {
        const dataSources: ComponentDataSource[] = [{
            id: 'char-1',
            type: 'character',
            payload: { name: 'Marcus', level: 5 },
            updatedAt: new Date().toISOString(),
        }];
        
        const resolver = createDefaultDataResolver();
        const name = resolver.resolveDataReference<string>(
            dataSources,
            { type: 'character', path: 'name' }
        );
        
        expect(name).toBe('Marcus');
    });
    
    it('should resolve nested character path', () => {
        const dataSources: ComponentDataSource[] = [{
            id: 'char-1',
            type: 'character',
            payload: {
                name: 'Marcus',
                dnd5eData: {
                    abilityScores: { strength: 16, dexterity: 14 }
                }
            },
            updatedAt: new Date().toISOString(),
        }];
        
        const resolver = createDefaultDataResolver();
        const abilityScores = resolver.resolveDataReference<{ strength: number }>(
            dataSources,
            { type: 'character', path: 'dnd5eData.abilityScores' }
        );
        
        expect(abilityScores?.strength).toBe(16);
    });
    
    it('should return undefined for missing character path', () => {
        const dataSources: ComponentDataSource[] = [{
            id: 'char-1',
            type: 'character',
            payload: { name: 'Marcus' },
            updatedAt: new Date().toISOString(),
        }];
        
        const resolver = createDefaultDataResolver();
        const missing = resolver.resolveDataReference(
            dataSources,
            { type: 'character', path: 'nonexistent' }
        );
        
        expect(missing).toBeUndefined();
    });
});
```

### Type Tests

```typescript
// Should compile without error
const characterRef: ComponentDataReference = {
    type: 'character',
    path: 'dnd5eData.abilityScores',
};

// ComponentInstance with character data ref
const instance: ComponentInstance = {
    id: 'ability-scores-1',
    type: 'ability-scores',
    dataRef: { type: 'character', path: 'dnd5eData.abilityScores' },
    layout: { isVisible: true },
};
```

---

## Migration Notes

### For StatblockGenerator

**No changes required.** The `'statblock'` type continues to work exactly as before.

### For PlayerCharacterGenerator

After this change, update `characterAdapters.ts`:

```typescript
// BEFORE: Workaround using 'statblock' type
const characterDataResolver: DataResolver = {
    resolveDataReference<T = unknown>(
        dataSources: ComponentDataSource[],
        dataRef: ComponentDataReference
    ): T | undefined {
        // Awkward workaround...
    }
};

// AFTER: Use native 'character' type
const characterDataResolver: DataResolver = {
    resolveDataReference<T = unknown>(
        dataSources: ComponentDataSource[],
        dataRef: ComponentDataReference
    ): T | undefined {
        if (dataRef.type === 'character') {
            const source = dataSources.find((s) => s.type === 'character');
            // Clean, native handling
        }
        // ...
    }
};
```

---

## Implementation Checklist

- [ ] Update `ComponentDataReference` type in `canvas.types.ts`
- [ ] Add `resolvePath` helper function in `adapters.types.ts`
- [ ] Update `createDefaultDataResolver` to handle `'character'` type
- [ ] Add unit tests for character data resolution
- [ ] (Optional) Update `PageDocumentBuilder.ts` to support `characterData`
- [ ] Run all Canvas tests to ensure no regressions
- [ ] Update `Canvas/src/index.ts` exports if needed

---

## Future Considerations

### Generic Data Types

If more domain types are needed (e.g., `'spell'`, `'item'`, `'encounter'`), consider:

1. **Registry Pattern**: Allow applications to register custom data types
2. **Generic Resolver**: Replace union type with generic resolver pattern

```typescript
// Future possibility - not for this PR
export type ComponentDataReference<T extends string = 'statblock' | 'character' | 'custom'> = {
    type: T;
    path: string;
    sourceId?: string;
};
```

For now, explicit union types provide better type safety and IDE support.

---

## Related Files

### Canvas Package
- `Canvas/src/types/canvas.types.ts` - Main type definitions
- `Canvas/src/types/adapters.types.ts` - Adapter interfaces and defaults
- `Canvas/src/data/PageDocumentBuilder.ts` - Page document creation

### PlayerCharacterGenerator (Consumer)
- `LandingPage/src/components/PlayerCharacterGenerator/characterAdapters.ts`
- `LandingPage/src/components/PlayerCharacterGenerator/characterTemplates.ts`
- `LandingPage/src/components/PlayerCharacterGenerator/characterPageDocument.ts`

---

**End of Spec**

