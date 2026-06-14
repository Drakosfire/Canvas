# Canvas Package Status

**Last updated:** 2026-06-13  
**Version:** 0.2.1  
**Health:** Tests, type-check, and build passing locally

---

## What This Package Is

`@dungeonmind/canvas` (`dungeonmind-canvas` in LandingPage) is a React library with two subsystems:

| Subsystem | Entry (target) | Used by |
|-----------|----------------|---------|
| **Layout engine** | `dungeonmind-canvas/layout` | StatBlockGenerator |
| **Map mode** | `dungeonmind-canvas/map` | MapGenerator |

The layout engine provides measurement-driven, multi-column pagination. Map mode provides Konva-based map rendering (grids, labels, masks).

---

## Current State

### Complete and stable

- Adapter-based domain decoupling (`CanvasAdapters`)
- Layout pipeline: measure → paginate → render
- Map mode: viewport, grid, labels, mask export
- LandingPage integration via workspace dependency
- 313 unit/integration tests passing

### Package structure (in progress)

- Subpath exports for `layout` and `map` (backward-compatible root barrel retained)
- Dev diagnostics moved to optional `dungeonmind-canvas/dev` entry
- Core file decomposition (`paginate.ts`, `state.tsx`, `measurement.tsx`)

---

## Verification

```bash
npm test          # 313 tests
npm run type-check
npm run build
./node_modules/.bin/eslint src --ext .ts,.tsx
```

---

## Documentation

| File | Purpose |
|------|---------|
| [README.md](README.md) | Install, imports, quick start |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Layout engine design |
| [docs/archive/](docs/archive/) | Historical extraction/session docs |

---

## Known Follow-ups

- Grid/freeform layout modes (see `docs/archive/PARALLEL_EVOLUTION_STRATEGY.md`) — deferred until flow engine is fully stable
- npm publish — workspace git dependency is sufficient for now
- Remaining statblock naming in HTML export defaults (being genericized)
