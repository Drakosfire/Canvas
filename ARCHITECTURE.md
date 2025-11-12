# Canvas System Architecture

**Project:** @dungeonmind/canvas  
**Last Updated:** November 11, 2025  
**Purpose:** Comprehensive architecture documentation for the Canvas rendering system

---

## 🎯 Overview

Canvas is a **generic, template-driven rendering engine** for multi-column, multi-page layouts. It provides automatic pagination, measurement-based layout calculation, and component registry management.

**Key Principles:**
- **Generic by Design**: No domain knowledge (statblocks, spells, etc.) - uses Adapter Pattern
- **Measurement-Driven**: Real-time height measurement informs layout decisions
- **Template-Based**: Components placed according to template configurations
- **Multi-Column Pagination**: Automatic overflow handling across pages and columns

---

## 📐 System Architecture

### High-Level Flow

```
┌─────────────────────────────────────────────────────────────┐
│ Application Layer (StatblockGenerator, etc.)               │
│ - Provides domain-specific adapters                        │
│ - Provides component registry                              │
│ - Provides data sources                                    │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────────────────┐
│ Canvas Hook Layer (useCanvasLayout)                        │
│ - Manages component lifecycle                              │
│ - Coordinates state updates                                │
│ - Provides MeasurementLayer                                │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────────────────┐
│ State Management Layer (state.tsx)                        │
│ - Redux-style reducer                                      │
│ - Manages measurements, buckets, layout plan                │
│ - Triggers pagination on changes                           │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────────────────┐
│ Layout Engine Layer                                        │
│ ├── Bucket Builder (utils.ts)                             │
│ │   - Groups components by region                           │
│ │   - Creates measurement entries                          │
│ ├── Planner (planner.ts)                                  │
│ │   - Determines segment placement                        │
│ │   - Handles overflow routing                             │
│ └── Paginator (paginate.ts)                               │
│     - Places components in pages/columns                   │
│     - Handles splits and continuations                     │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────────────────┐
│ Measurement Layer (measurement.tsx)                        │
│ - Offscreen rendering                                      │
│ - Height measurement                                       │
│ - Measurement coordination                                 │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────────────────┐
│ Rendering Layer (CanvasPage.tsx)                           │
│ - Renders pages and columns                                │
│ - Calls renderEntry for each component                     │
└─────────────────────────────────────────────────────────────┘
```

---

## 🧩 Core Components

### 1. Component Registry (`registry/ComponentRegistry.ts`)

**Purpose:** Factory system for component registration and lookup.

**Key Functions:**
- `createComponentRegistry()` - Create registry from entries
- `getComponentEntry()` - Lookup component by type
- `isValidComponentType()` - Validate component type

**Usage:**
```typescript
const registry = createComponentRegistry({
  'action-section': {
    type: 'action-section',
    displayName: 'Actions',
    component: ActionSectionComponent,
    defaults: { ... }
  }
});
```

---

### 2. State Management (`layout/state.tsx`)

**Purpose:** Centralized state management using React Context + useReducer.

**State Structure:**
```typescript
interface CanvasLayoutState {
  // Inputs
  components: ComponentInstance[];
  template: TemplateConfig | null;
  dataSources: ComponentDataSource[];
  componentRegistry: Record<string, ComponentRegistryEntry>;
  pageVariables: PageVariables | null;
  adapters: CanvasAdapters;
  
  // Layout computation
  buckets: Map<string, RegionBuckets>;
  measurementEntries: MeasurementEntry[];
  measurements: Map<MeasurementKey, MeasurementRecord>;
  measurementVersion: number;
  
  // Output
  layoutPlan: LayoutPlan | null;
  pendingLayout: LayoutPlan | null;
  
  // Status flags
  isLayoutDirty: boolean;
  allComponentsMeasured: boolean;
  waitingForInitialMeasurements: boolean;
  requiredMeasurementKeys: Set<MeasurementKey>;
  missingMeasurementKeys: Set<MeasurementKey>;
  
  // Region tracking
  assignedRegions: Map<string, SlotAssignment>;
  homeRegions: Map<string, HomeRegionAssignment>;
  segmentRerouteCache: SegmentRerouteCache;
}
```

**Actions:**
- `INITIALIZE` - Set up initial state
- `SET_COMPONENTS` - Update component instances
- `SET_TEMPLATE` - Update template configuration
- `SET_DATA_SOURCES` - Update data sources
- `MEASUREMENTS_UPDATED` - Update measurement records
- `RECALCULATE_LAYOUT` - Trigger pagination
- `COMMIT_LAYOUT` - Commit pending layout to active plan

**State Flow:**
1. Components/template change → `isLayoutDirty = true`
2. Effect triggers → `RECALCULATE_LAYOUT`
3. Pagination runs → `pendingLayout` set
4. Effect commits → `COMMIT_LAYOUT` → `layoutPlan` updated

---

### 3. Measurement System (`layout/measurement.tsx`)

**Purpose:** Measure component heights in offscreen layer before placement.

**Key Concepts:**
- **Measurement Layer**: Offscreen DOM container at (0,0) with no transforms
- **Measurement Keys**: Format `{componentId}:{suffix}` (e.g., `component-1:block`, `component-2:spell-list`)
- **Measurement Records**: `{ key, height, measuredAt }`

**Measurement Flow:**
1. Component renders in MeasurementLayer (offscreen)
2. `MeasurementObserver` watches for height changes
3. Height updates dispatched via `onMeasurements` callback
4. State reducer updates `measurements` Map
5. Layout recalculation triggered if measurements changed

**Measurement Semantics:**
- Measures `getBoundingClientRect().height` (margin box)
- Height is scalar magnitude (not absolute position)
- Pagination uses heights to compute cumulative positions

**Measurement Throttling:**
- Uses `requestIdleCallback` (or setTimeout fallback)
- Throttle: `MEASUREMENT_THROTTLE_MS` (default: 16ms)

---

### 4. Bucket Builder (`layout/utils.ts`)

**Purpose:** Group components by region and create measurement entries.

**Key Functions:**
- `buildBuckets()` - Group components by region key
- `buildCanvasEntries()` - Create layout entries with measurement keys
- `createInitialMeasurementEntries()` - Create entries for measure-first flow

**Bucket Structure:**
```typescript
Map<RegionKey, RegionBuckets> = {
  'page-1:column-1': {
    blocks: [...],
    lists: [...]
  }
}
```

**Entry Creation:**
- Block components → Single entry with `{componentId}:block` key
- List components → Multiple entries (full list + segments) with `{componentId}:{regionKind}` keys

---

### 5. Planner (`layout/planner.ts`)

**Purpose:** Determine optimal placement for segments (list continuations).

**Key Concepts:**
- **Segments**: Portions of list components that may span regions
- **Segment Descriptors**: Metadata about segment (height, startIndex, etc.)
- **Segment Intents**: Placement decision (`place` or `defer`)

**Planner Flow:**
1. Convert entries to segment descriptors
2. For each segment:
   - Check if fits in preferred region
   - If fits → `place` intent
   - If doesn't fit → `defer` intent (route to next region)
3. Return segment plan with placement decisions

**Reroute Cache:**
- Remembers previous defer decisions
- Speeds up subsequent pagination runs
- Cleared when segment successfully placed

---

### 6. Paginator (`layout/paginate.ts`)

**Purpose:** Place components into pages and columns based on measurements.

**Pagination Flow:**
1. Build region sequence (page-1:col-1, page-1:col-2, page-2:col-1, ...)
2. For each component entry:
   - Get height from measurements (or estimate)
   - Find first region with space
   - Place component at cursor position
   - Update cursor
3. Handle overflow:
   - If component doesn't fit → split (for lists) or defer to next region
   - Track overflow warnings

**Height Sources (Priority Order):**
1. **Measured**: From `measurements` Map (most accurate)
2. **Proportional**: Scaled from previous measurement (if available)
3. **Estimated**: From adapters or defaults (fallback)

**Split Logic:**
- Only applies to list components
- Uses `findBestListSplit()` to determine split point
- Creates continuation entries for overflow portion

---

### 7. Adapter Pattern (`types/adapters.types.ts`)

**Purpose:** Decouple Canvas from domain-specific logic.

**Adapter Interfaces:**
- `DataResolver` - Resolve data references to values
- `ListNormalizer` - Normalize list items
- `RegionContentFactory` - Create region list content
- `HeightEstimator` - Estimate component heights
- `MetadataExtractor` - Extract metadata for export

**Why Adapters:**
- Canvas has zero domain knowledge (no statblock imports)
- Applications provide domain-specific behavior
- Enables reuse across different domains (statblocks, character sheets, etc.)

**Default Adapters:**
- Basic implementations provided for testing
- Applications should override with domain-specific logic

---

## 🔍 Debug Logging System

**CRITICAL:** Canvas has a comprehensive component-level debug logging system. **Always check if debug logging is enabled before adding new console.log statements.**

### Debug Channels

**Available Channels** (defined in `debugFlags.ts`):
- `paginate-spellcasting` - Pagination decisions
- `measurement-spellcasting` - Measurement events
- `planner-spellcasting` - Planner segment decisions
- `layout-dirty` - Layout recalculation triggers
- `measure-first` - Measure-first flow diagnostics
- `layout-plan-diff` - Plan comparison on commit

### Component Filtering

**Component IDs** can be filtered for targeted debugging:
- Set via `REACT_APP_CANVAS_DEBUG_COMPONENTS` env var
- Set via `localStorage.setItem('canvas-debug:components', 'component-1,component-2')`
- Set via `globalThis.__CANVAS_DEBUG_COMPONENTS = ['component-1']`

**Component filtering applies to:**
- Pagination logs (`debugLog()` in `paginate.ts`)
- Measurement logs (`logSpellcastingEvent()` in `measurement.tsx`)
- Planner logs (`logSegmentDecision()` in `plannerLogs.ts`)

### Enabling Debug Logging

**Method 1: Environment Variables**
```bash
# Enable pagination debug
REACT_APP_CANVAS_DEBUG_PAGINATE=true npm start

# Enable measurement debug
REACT_APP_CANVAS_DEBUG_MEASUREMENT=true npm start

# Enable planner debug
REACT_APP_CANVAS_DEBUG_PLANNER=true npm start

# Filter to specific components
REACT_APP_CANVAS_DEBUG_COMPONENTS="component-1,component-2" npm start
```

**Method 2: Browser Console**
```javascript
// Enable debug flags
localStorage.setItem('canvas-debug:paginate-spellcasting', 'true');
localStorage.setItem('canvas-debug:measurement-spellcasting', 'true');
localStorage.setItem('canvas-debug:planner-spellcasting', 'true');

// Filter to specific components
localStorage.setItem('canvas-debug:components', 'component-1,component-2');

// Reload page
location.reload();
```

**Method 3: Global Flags**
```javascript
globalThis.__CANVAS_DEBUG_FLAGS = {
  'paginate-spellcasting': true,
  'measurement-spellcasting': true,
  'planner-spellcasting': true
};

globalThis.__CANVAS_DEBUG_COMPONENTS = ['component-1', 'component-2'];
```

### Debug Log Format

**Pagination Logs:**
```
🎯 [paginate][Debug] {label} {payload}
```

**Measurement Logs:**
```
🎯 [Measurement][Spellcasting] {label} {payload}
```

**Planner Logs:**
```
🎯 [planner] {label} {payload}
```

**Example Output:**
```
🎯 [Canvas Debug] Active configuration: {
  componentIds: ['component-1'],
  enabledFlags: ['paginate', 'measurement', 'planner'],
  source: { env: null, global: null, storage: 'components' }
}

🎯 [paginate][Debug] component-placed {
  componentId: 'component-1',
  regionKey: 'page-1:column-1',
  heightPx: 245.5
}
```

### Debug Configuration Log

**On module load**, Canvas logs active debug configuration:
```
🎯 [Canvas Debug] Active configuration: {
  componentIds: [...],
  enabledFlags: [...],
  source: { env, global, storage, default },
  envVars: { ... },
  diagnostic: { ... }
}
```

**This log appears automatically** - check browser console on page load to see what's enabled.

---

## 📊 Data Flow

### Initialization Flow

```
1. Application calls useCanvasLayout()
   ↓
2. Hook dispatches INITIALIZE action
   ↓
3. State reducer:
   - Sets template, components, dataSources
   - Calls recomputeEntries()
   - Creates measurement entries
   - Sets isLayoutDirty = true
   ↓
4. Effect detects isLayoutDirty
   ↓
5. Dispatches RECALCULATE_LAYOUT
   ↓
6. Pagination runs (with estimates)
   ↓
7. Pending layout set
   ↓
8. Effect commits layout
   ↓
9. Layout plan available for rendering
```

### Measurement Flow

```
1. MeasurementLayer renders components offscreen
   ↓
2. MeasurementObserver watches DOM
   ↓
3. Height changes detected
   ↓
4. Dispatches MEASUREMENTS_UPDATED action
   ↓
5. State reducer:
   - Updates measurements Map
   - Increments measurementVersion
   - Rebuilds entries (if needed)
   - Sets isLayoutDirty = true
   ↓
6. Layout recalculation triggered
   ↓
7. Pagination uses new measurements
   ↓
8. Layout plan updated
```

### Pagination Flow

```
1. RECALCULATE_LAYOUT action dispatched
   ↓
2. paginate() called with:
   - buckets (grouped components)
   - measurements (height data)
   - regionHeightPx (available space)
   ↓
3. Build region sequence
   ↓
4. For each component entry:
   a. Get height (measured > proportional > estimated)
   b. Find region with space
   c. Place component
   d. Update cursor
   ↓
5. Handle overflow:
   - Split lists if needed
   - Defer to next region
   ↓
6. Return LayoutPlan
   ↓
7. COMMIT_LAYOUT updates layoutPlan
```

---

## 🎨 Component Lifecycle

### Component Instance Structure

```typescript
interface ComponentInstance {
  id: string;                    // Unique identifier
  type: CanvasComponentType;      // Component type (from registry)
  dataRef: ComponentDataReference; // Reference to data source
  layout: ComponentLayoutConfig;  // Layout configuration
  variables?: Record<string, unknown>; // Component variables
}
```

### Component Rendering

1. **Template Assignment**: Component assigned to template slot
2. **Home Region**: Preferred region calculated from template
3. **Measurement**: Component measured in offscreen layer
4. **Pagination**: Component placed in layout plan
5. **Rendering**: Component rendered in CanvasPage at calculated position

### List Component Splitting

**List components** can be split across regions:
- Full list measured first
- Split point calculated based on available space
- Continuation entries created for overflow
- Each segment has `isContinuation` flag

---

## 🔧 Key Utilities

### Region Keys

**Format:** `page-{N}:column-{1|2}`

**Examples:**
- `page-1:column-1` - First page, first column
- `page-1:column-2` - First page, second column
- `page-2:column-1` - Second page, first column

### Measurement Keys

**Format:** `{componentId}:{suffix}`

**Suffixes:**
- `block` - Block component measurement
- `{regionKind}` - List component measurement (e.g., `spell-list`, `action-list`)

**Examples:**
- `component-1:block` - Block component
- `component-2:spell-list` - Spell list component

### Height Estimation

**Priority Order:**
1. **Measured**: From `measurements` Map
2. **Proportional**: Scaled from previous measurement
3. **Estimated**: From adapters or defaults

**Fallback Heights:**
- Block components: `DEFAULT_COMPONENT_HEIGHT_PX` (200px)
- List items: From `HeightEstimator` adapter
- Lists: `items.length * itemHeight`

---

## 🚨 Common Patterns

### Measure-First Flow

**When:** No measurements available yet, components exist

**Behavior:**
- Creates measurement entries from raw components
- Sets `waitingForInitialMeasurements = true`
- Skips pagination until all measurements available
- Prevents layout thrashing

### Layout Dirty Flag

**Purpose:** Prevent double pagination

**Flow:**
1. State change → `isLayoutDirty = true`
2. Effect triggers → `RECALCULATE_LAYOUT`
3. Pagination runs → `isLayoutDirty = false` (immediately)
4. Effect won't re-trigger until next state change

### Segment Reroute Cache

**Purpose:** Remember overflow routing decisions

**Behavior:**
- Caches defer decisions (component → segment → target region)
- Speeds up subsequent pagination runs
- Cleared when segment successfully placed
- Prevents infinite defer loops

---

## 📚 Related Files

### Core Layout Files
- `layout/state.tsx` - State management
- `layout/paginate.ts` - Pagination engine
- `layout/planner.ts` - Segment planner
- `layout/measurement.tsx` - Measurement system
- `layout/utils.ts` - Bucket building utilities
- `layout/types.ts` - Type definitions

### Debug Files
- `layout/debugFlags.ts` - Debug flag system
- `layout/debug/plannerLogs.ts` - Planner logging

### Component Files
- `components/CanvasPage.tsx` - Page renderer
- `hooks/useCanvasLayout.ts` - Layout hook
- `registry/ComponentRegistry.ts` - Registry factory

### Type Files
- `types/canvas.types.ts` - Core types
- `types/adapters.types.ts` - Adapter interfaces

---

## 🎯 Design Decisions

### Why Adapter Pattern?

**Problem:** Canvas needs domain-specific behavior (data resolution, height estimation) without domain knowledge.

**Solution:** Adapter interfaces allow applications to provide behavior while Canvas remains generic.

**Benefit:** Canvas can be reused across domains (statblocks, character sheets, spellbooks, etc.).

### Why Measurement-Driven?

**Problem:** Component heights vary based on content, fonts, viewport.

**Solution:** Measure components in offscreen layer before placement.

**Benefit:** Accurate layout without guessing heights.

### Why Template-Based?

**Problem:** Components need preferred placement locations.

**Solution:** Template defines slots and default placements.

**Benefit:** Consistent layout structure, easy to modify.

### Why Multi-Column Pagination?

**Problem:** Long content needs to flow across pages and columns.

**Solution:** Automatic overflow handling with split/continuation support.

**Benefit:** Professional document layout without manual intervention.

---

**Last Updated:** November 11, 2025  
**Status:** Living document - update as architecture evolves

