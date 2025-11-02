# Canvas Layout Modes: Parallel Evolution Strategy

**Date:** November 2, 2025  
**Status:** Architectural Vision  
**Key Insight:** Layout modes coexist with comparison toggles, not sequential replacement

---

## 🎯 Core Strategy

**Don't replace modes - add them in parallel with comparison capabilities.**

```
Flow Mode (MVP) ─────────┐
                         ├─→ User toggles between modes
Grid Mode (Phase 2) ─────┤    Compares layouts side-by-side
                         │    Learns which fits their needs
Freeform (Phase 3) ──────┘
```

**Benefits:**
- ✅ Empirical validation (compare modes with real data)
- ✅ Gradual migration (no forced changes)
- ✅ User choice (different needs prefer different modes)
- ✅ Learning opportunity (each mode informs the next)

---

## 📊 Evolution Timeline

### Phase 1: Flow Only (Current MVP)

**Status:** ✅ Implementing now (Sessions 1-5)

**Features:**
- Automatic pagination
- Height-based overflow
- Multi-page documents
- Component splitting

**Best For:**
- Documents (statblocks, reports)
- Unknown content length
- Print output with page breaks
- Reading flow (top-to-bottom)

**Implementation:**
- Package: `@dungeonmind/canvas` (current work)
- Mode: `layout.mode: 'flow'`
- Engine: `paginateFlowLayout()`

---

### Phase 2: Parallel Modes (Flow + Grid)

**Status:** 🎯 Planned (after MVP complete)

**Add Grid Mode Alongside Flow:**
```typescript
// Template specifies layout mode
const template: TemplateConfig = {
  layout: {
    mode: 'grid',  // NEW: Grid mode option
    gridSize: { columns: 12, rows: 8 },
    cellSize: { width: 80, height: 60 },
    allowModeSwitch: true,  // NEW: User can toggle to flow
  },
  // ... rest of template
};
```

**Key Feature: Mode Toggle UI**
```typescript
const [layoutMode, setLayoutMode] = useState<'flow' | 'grid'>('flow');

<SegmentedControl 
  value={layoutMode}
  onChange={setLayoutMode}
  data={[
    { label: 'Flow (Auto)', value: 'flow', icon: <IconLayoutList /> },
    { label: 'Grid (Fixed)', value: 'grid', icon: <IconLayoutGrid /> },
  ]}
/>

// Same data, different layout
const layout = useCanvasLayout({
  template: { ...template, layout: { mode: layoutMode } },
  components,
  adapters,
});
```

**Grid Mode Features:**
- Explicit XY positioning (no estimation needed!)
- Fixed component locations
- Single canvas (no pagination)
- Predictable layout

**Best For:**
- Dashboards
- Character sheets
- Fixed layouts
- Visual design

**Implementation Effort:** ~12-16 hours
- Add `GridLayoutConfig` type
- Implement `layoutGridComponents()` function
- Create `GridRenderer` component
- Add grid examples

---

### Phase 3: Triple Parallel (Flow + Grid + Freeform)

**Status:** 🔮 Vision (future)

**Add Freeform Mode:**
```typescript
<SegmentedControl 
  data={[
    { label: 'Flow', value: 'flow' },       // Documents
    { label: 'Grid', value: 'grid' },       // Dashboards
    { label: 'Freeform', value: 'freeform' },  // Design
  ]}
/>
```

**Freeform Mode Features:**
- Pixel-perfect positioning
- Rotation and scaling
- Z-index layering
- Snap-to-grid (optional)
- Alignment guides

**Best For:**
- Visual design
- Custom spell cards
- Artistic layouts
- Figma-like editing

**All Three Modes Coexist:**
- Flow for documents (automatic layout)
- Grid for dashboards (fixed positions)
- Freeform for design (total freedom)

---

## 🔧 Why This Architecture Supports Parallel Modes

### 1. Adapter Pattern is Layout-Agnostic ✅

**Same adapters work for all modes:**
```typescript
const adapters: CanvasAdapters = {
  dataResolver: statblockDataResolver,     // ✅ All modes
  listNormalizer: defaultNormalizer,       // ✅ All modes
  metadataExtractor: statblockExtractor,   // ✅ All modes
  
  heightEstimator: statblockEstimator,     // ✅ Flow only (grid/freeform skip)
  regionContentFactory: defaultFactory,    // ✅ Flow only (grid/freeform skip)
};

// Flow mode uses all adapters
const flowLayout = calculateLayout(components, flowTemplate, adapters);

// Grid mode uses subset (no height estimation needed!)
const gridLayout = calculateLayout(components, gridTemplate, adapters);
```

**Why it works:**
- Data resolution needed for all modes
- Metadata extraction needed for all modes
- Height estimation OPTIONAL (grid/freeform have explicit sizes)

---

### 2. Layout Plan is Discriminated Union ✅

**Each mode has its own plan structure:**
```typescript
type LayoutPlan = FlowLayoutPlan | GridLayoutPlan | FreeformLayoutPlan;

interface FlowLayoutPlan {
  mode: 'flow';
  pages: PageLayout[];  // Multi-page structure
}

interface GridLayoutPlan {
  mode: 'grid';
  components: Array<{
    instance: ComponentInstance;
    position: { x: number; y: number; width: number; height: number };
  }>;
}

interface FreeformLayoutPlan {
  mode: 'freeform';
  components: Array<{
    instance: ComponentInstance;
    transform: {
      x: number;
      y: number;
      width: number;
      height: number;
      rotation: number;
      scale: number;
      zIndex: number;
    };
  }>;
}
```

**Renderer dispatches based on mode:**
```typescript
function renderLayout(plan: LayoutPlan) {
  switch (plan.mode) {
    case 'flow':
      return <FlowRenderer pages={plan.pages} />;
    case 'grid':
      return <GridRenderer components={plan.components} />;
    case 'freeform':
      return <FreeformRenderer components={plan.components} />;
  }
}
```

---

### 3. Template System Controls Mode ✅

**Templates specify default mode:**
```typescript
// Flow template (statblocks)
const classicStatblock: TemplateConfig = {
  layout: { mode: 'flow', columns: 2 },
  slots: [...],
};

// Grid template (character sheet)
const characterSheet: TemplateConfig = {
  layout: { 
    mode: 'grid', 
    gridSize: { columns: 12, rows: 8 },
    allowModeSwitch: true,  // User can try flow mode
  },
  slots: [...],
};

// Freeform template (spell card designer)
const spellCardDesigner: TemplateConfig = {
  layout: { 
    mode: 'freeform',
    allowModeSwitch: false,  // Freeform-only
  },
  slots: [...],
};
```

**User can override (if allowed):**
```typescript
const effectiveMode = userPreference ?? template.layout.mode;
```

---

### 4. Layout Engines Are Parallel ✅

**Each mode has its own engine:**
```typescript
function calculateLayout(
  components: ComponentInstance[],
  template: TemplateConfig,
  adapters: CanvasAdapters,
  measurements?: Map<string, MeasurementRecord>
): LayoutPlan {
  switch (template.layout.mode) {
    case 'flow':
      // Complex pagination algorithm
      return paginateFlowLayout(components, template, adapters, measurements);
    
    case 'grid':
      // Simple XY positioning (NO measurements needed!)
      return layoutGridComponents(components, template.layout, adapters);
    
    case 'freeform':
      // Pixel-perfect positioning
      return layoutFreeformComponents(components, template.layout, adapters);
  }
}
```

**Engines are independent:**
- ✅ Flow engine uses measurements for overflow
- ✅ Grid engine uses explicit positions (no measurements!)
- ✅ Freeform engine uses transforms (rotation, scale)
- ✅ Changing one engine doesn't affect others

---

## 📊 Comparison Mode Implementation

### Side-by-Side Comparison

```typescript
const ComparisonView: React.FC<{ components, adapters }> = () => {
  const flowLayout = useCanvasLayout({
    template: flowTemplate,
    components,
    adapters,
  });
  
  const gridLayout = useCanvasLayout({
    template: gridTemplate,
    components,
    adapters,
  });
  
  return (
    <SimpleGrid cols={2}>
      <Stack>
        <Title order={4}>Flow Mode (Auto)</Title>
        <Text size="sm" color="dimmed">
          Automatic pagination, {flowLayout.plan.pages.length} pages
        </Text>
        <CanvasRenderer layoutPlan={flowLayout.plan} />
      </Stack>
      
      <Stack>
        <Title order={4}>Grid Mode (Fixed)</Title>
        <Text size="sm" color="dimmed">
          Fixed positions, 1 canvas
        </Text>
        <CanvasRenderer layoutPlan={gridLayout.plan} />
      </Stack>
    </SimpleGrid>
  );
};
```

**Use Cases:**
- 🎯 **Development:** Validate grid against flow baseline
- 🎯 **User Testing:** Which mode do users prefer?
- 🎯 **Migration:** Prove new mode before removing old
- 🎯 **Documentation:** Show examples of each mode

---

### Metrics Collection

```typescript
interface LayoutMetrics {
  mode: 'flow' | 'grid' | 'freeform';
  
  // Performance
  layoutCalculationTime: number;  // ms
  renderTime: number;  // ms
  
  // Layout Quality
  pageCount?: number;  // Flow only
  whiteSpaceRatio: number;  // Efficiency
  
  // User Behavior
  modeSwitch: number;  // How often they toggle
  timeInMode: number;  // Seconds
  editCount: number;  // Manual adjustments
}

// Track automatically
useEffect(() => {
  trackMetrics({
    mode: layoutMode,
    layoutCalculationTime: performance.now() - startTime,
    // ...
  });
}, [layoutPlan]);
```

**Decisions from data:**
- Which mode performs better?
- Which mode users prefer?
- When to make grid the default?
- When flow can be deprecated (if ever)?

---

## 🎓 Learning Cycle

### Flow → Grid Lessons

**What flow teaches us:**
- ✅ Automatic layout is valuable
- ✅ Measurement works well
- ⚠️ Pagination can be unpredictable
- ⚠️ Fixed columns limit flexibility

**Apply to grid:**
- Keep measurement for responsive grids
- Add auto-flow (fill cells automatically)
- Skip pagination (grid is single-canvas)
- Add flexible column widths

---

### Grid → Freeform Lessons

**What grid teaches us:**
- ✅ Explicit positioning gives control
- ✅ Visual layout is intuitive
- ⚠️ Fixed grids limit creativity
- ⚠️ Manual positioning is tedious

**Apply to freeform:**
- Keep explicit positioning (pixel-perfect)
- Add rotation/scale for creativity
- Keep snap-to-grid as OPTION
- Add constraints for easier alignment

---

### Freeform → Enhanced Flow/Grid

**What freeform teaches us (future):**
- ✅ Rotation enables creative layouts
- ✅ Z-index opens new possibilities
- ⚠️ Total freedom can be overwhelming

**Apply back to flow/grid:**
- Add rotation support to flow/grid
- Add z-index to flow/grid
- Add "guided freeform" (constraints)
- Hybrid: "grid with freeform overrides"

---

## 📅 Implementation Timeline

### Now: Phase 1 (Flow Mode MVP)

**Sessions 1-5:** Complete flow mode genericization
- Update Canvas core with adapters
- Update tests with mocks
- Create statblock adapters
- Integration testing
- **Time:** 7-11 hours

**Result:** Flow mode working with StatblockGenerator

---

### Phase 2a: Grid Mode (Experimental)

**After MVP complete**
- Implement grid layout engine (~8 hours)
- Add grid renderer (~4 hours)
- Create grid examples (~2 hours)
- Add mode toggle UI (~2 hours)
- **Time:** ~16 hours

**Result:** Both modes available, grid is "beta"

---

### Phase 2b: Grid Mode (Stable)

**After user testing**
- Collect metrics (~1 month usage)
- Fix grid mode bugs
- Achieve feature parity
- Remove "beta" label

**Result:** Both modes production-ready

---

### Phase 2c: Grid Mode (Preferred?)

**Based on metrics**
- If grid outperforms flow → make grid default
- If flow still needed → keep both
- If use cases split → keep both for different templates

**Result:** Data-driven decision

---

### Phase 3: Freeform Mode

**Future (6+ months)**
- Add freeform layout engine (~16 hours)
- Add drag-and-drop UI (~12 hours)
- Add rotation/scale (~8 hours)
- Add constraints/guides (~8 hours)
- **Time:** ~44 hours

**Result:** All three modes coexist

---

## ✅ Why This Works

**The architecture is fundamentally layout-agnostic:**

| Component | Flow | Grid | Freeform | Why It Works |
|-----------|------|------|----------|--------------|
| **Adapters** | ✅ | ✅ | ✅ | Data resolution is universal |
| **Component Registry** | ✅ | ✅ | ✅ | Registry doesn't care about layout |
| **Templates** | ✅ | ✅ | ✅ | Template specifies mode |
| **Measurement** | ✅ | Optional | Optional | Grid/freeform have explicit sizes |
| **Layout Engine** | Pagination | XY positioning | Transform | Separate engines, same inputs |
| **Renderer** | Pages/columns | Canvas | Canvas | Dispatch based on plan.mode |

**No fundamental conflicts - modes are parallel implementations of the same abstraction!**

---

## 🎯 Key Takeaways

1. **Modes coexist** - Don't replace, add alongside
2. **Comparison enables learning** - Side-by-side validation
3. **Metrics drive decisions** - Which mode for which use case?
4. **Architecture supports it** - Adapters are layout-agnostic
5. **User choice** - Template or user preference determines mode

**The design is flexible because it separates:**
- Data (adapters handle it)
- Layout (engines calculate it)
- Rendering (renderers display it)

**Adding new layout modes doesn't require changing data or rendering!**

---

**Next Actions:**

1. ✅ Complete flow mode MVP (Sessions 1-5)
2. 🎯 Add grid mode in parallel (Phase 2a)
3. 📊 Collect metrics on both modes
4. 🔮 Add freeform when needed (Phase 3)

**All modes eventually coexist, serving different needs.**

---

**Created:** November 2, 2025  
**Purpose:** Document parallel evolution strategy for layout modes  
**Status:** Vision document - guides future development


