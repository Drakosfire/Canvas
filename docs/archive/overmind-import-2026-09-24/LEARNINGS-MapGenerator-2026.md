> **Historical import from DungeonOverMind — 2026-09-24.** This document records implementation learnings from an older Canvas/product state. It is not current Canvas architecture or sequencing authority. Re-anchor against current Canvas code/contracts before applying it.

# Learnings: Map Generator Development
**Date:** 2026-01-15  
**Context:** Spec 003 - Dual-Mode Canvas with Map Rendering  
**Status:** v1 Complete, Mobile + Advanced Features Deferred  
**Last Updated:** 2026-01-15

---

## Overview

This document captures patterns, anti-patterns, and lessons learned during the development of the Map Generator feature (Spec 003). The project expanded the `dungeonmind-canvas` package to support a new Map Mode alongside the existing Document Mode, enabling users to generate AI battle maps, overlay grids, add labels, and export flattened images.

**Project Timeline:** December 2025 - January 2026  
**Total Effort:** ~40 hours across 14 phases  
**Key Outcomes:**
- 9 user stories implemented
- 97.97% test coverage on mask module
- Demo page pattern validated (again)
- TDD methodology applied for grid math and mask drawing

---

## Key Takeaways

### Architecture & Technology Decisions

1. **Konva layer architecture works well** - 3-4 explicit layers (base image, grid, labels, mask) with `listening={false}` on non-interactive layers provides good performance
2. **Cube coordinates for hex math** - Industry standard from Red Blob Games; more intuitive than axial/offset coordinates for distance and neighbor calculations
3. **Pillow for backend compositing** - Already available, handles RGBA alpha compositing correctly, server-side ensures consistent output regardless of browser
4. **FontFace API for web fonts** - Promise-based loading prevents FOUT; wait for fonts before rendering Konva text
5. **GPT Image 1.5 via Fal.ai** - Chosen for quality and unified API access; newer than Flux Pro with better prompt following

### TDD Success Stories

6. **Grid math tests first** - Writing 32 unit tests before implementation made hex math straightforward; 95%+ coverage achieved easily
7. **Mask drawing tests caught edge cases** - TDD for useMaskDrawing identified undo/redo bugs, brush state issues early (97.97% coverage)
8. **Demo page before integration** - FR-042 requirement was wise; caught canvas bugs before main app integration with zero post-integration rework

### State Management Patterns

9. **useRef for drawing state** - `maskDrawingStateRef` avoids stale closures in document-level event listeners; sync with useState changes
10. **Document-level listeners for cross-boundary events** - Allows drawing outside canvas edges; must coordinate with Konva internal handlers
11. **Single source of truth for events** - Multiple handlers calling same function = bugs (squiggle bug)
12. **Generation options persist to localStorage** - Style preferences, model, numImages survive drawer sessions

### API & Backend Patterns

13. **Two-stage prompt compilation** - User input → MapSpec (structured) → optimized prompt; enables style toggles and hard constraints
14. **Mask semantics: transparent = AI generates** - Clear mental model; opaque = preserve existing
15. **Lazy imports for optional dependencies** - `cairosvg` requires system `libcairo`; lazy import prevents server startup failure
16. **Separate endpoint for inpainting** - `/generate-masked` vs `/generate`; different parameters, different workflow

### UX Discoveries

17. **Inline text editing >> sidebar editing** - Double-click to edit on canvas significantly better UX than sidebar input fields
18. **Mask preview toggle in generation drawer** - Shows users what they've drawn before generating; reduces errors
19. **Mode-based UI simplification** - When mask toggle ON, hide style options/examples; focus on inpaint-specific controls
20. **Save status indicator reduces anxiety** - Users need to know their work is safe

### Debugging & Bug Prevention

21. **Duplicate event handlers = squiggle lines** - Three handlers calling `continueMaskStroke()` caused each to add points → jagged lines
22. **Konva event propagation is tricky** - `onMouseLeave` on Stage can interfere with child Layer handlers
23. **Shape drawing vs brush drawing** - Different internal state tracking; what works for brush may not work for shapes
24. **Transformer scaling requires fontSize conversion** - Not obvious; Konva scale != font size

### Process & Project Management

25. **Spec structure works** - spec.md → plan.md → tasks.md → tasks-completed.md pattern kept project organized
26. **Handoff documents for debugging** - Separate handoffs for different bugs enabled parallel investigation
27. **Phase-based development** - 2-4 hour phases with clear deliverables prevented scope creep
28. **Mobile deferred correctly** - Desktop-first for v1 was right choice; mobile requires touch gesture refactoring

---

## 1. TDD for Math-Heavy Modules

**Problem:** Grid calculations (square and hex) have many edge cases. Manual testing is tedious and incomplete.

**Solution:** Write unit tests BEFORE implementation.

```typescript
// Canvas/src/map/utils/__tests__/gridMath.test.ts
describe('calculateSquareGridLines', () => {
  it('generates correct number of lines for 100x100 canvas with 50px cells', () => {
    const lines = calculateSquareGridLines(100, 100, 50, 0, 0);
    // 3 horizontal (0, 50, 100) + 3 vertical (0, 50, 100)
    expect(lines.length).toBe(6);
  });

  it('respects offset for grid alignment', () => {
    const lines = calculateSquareGridLines(100, 100, 50, 10, 10);
    // Lines should start at offset, not origin
    expect(lines[0].start.x).toBe(10);
  });
});
```

**Why It Works:**
- Tests define expected behavior clearly
- Implementation becomes "make tests pass"
- Refactoring is safe with passing tests
- Edge cases are explicit, not forgotten

**Lesson:** For pure functions (grid math, hex coordinates, mask export), TDD is highly effective. Tests are easy to write and provide confidence.

---

## 2. Document-Level Event Listeners for Drawing

**Problem:** When users draw a mask and drag outside the canvas boundary, the stroke should continue, not cancel.

**Solution:** Use document-level event listeners that remain active even when mouse leaves canvas.

```typescript
// LandingPage/src/components/MapGenerator/MapGenerator.tsx

// Sync state to ref to avoid stale closures
const maskDrawingStateRef = useRef(maskDrawingState);
useEffect(() => {
  maskDrawingStateRef.current = maskDrawingState;
}, [maskDrawingState]);

// Document listeners active when in mask mode
useEffect(() => {
  if (mode !== 'mask') return;

  const handleGlobalMouseMove = (e: MouseEvent) => {
    if (!maskDrawingStateRef.current.isDrawing) return;
    
    const canvasRect = canvasRef.current?.getBoundingClientRect();
    if (!canvasRect) return;
    
    // Calculate canvas-relative coordinates
    const canvasX = e.clientX - canvasRect.left;
    const canvasY = e.clientY - canvasRect.top;
    
    continueMaskStroke(canvasX, canvasY);
  };

  const handleGlobalMouseUp = () => {
    if (maskDrawingStateRef.current.isDrawing) {
      endMaskStroke();
    }
  };

  document.addEventListener('mousemove', handleGlobalMouseMove);
  document.addEventListener('mouseup', handleGlobalMouseUp);
  
  return () => {
    document.removeEventListener('mousemove', handleGlobalMouseMove);
    document.removeEventListener('mouseup', handleGlobalMouseUp);
  };
}, [mode, continueMaskStroke, endMaskStroke]);
```

**Critical Pattern:** Use `useRef` to sync with `useState` to avoid stale closures:

```typescript
// ❌ BAD: useState in closure = stale value
const [isDrawing, setIsDrawing] = useState(false);
// This sees OLD isDrawing value in event listener

// ✅ GOOD: useRef synced with useState
const isDrawingRef = useRef(false);
useEffect(() => {
  isDrawingRef.current = isDrawing;
}, [isDrawing]);
// This sees CURRENT value in event listener
```

**Lesson:** Document-level listeners are powerful but require careful state synchronization. Always use refs for values accessed inside listeners.

---

## 3. The Squiggle Bug: Duplicate Event Handlers

**Problem:** Mask brush drew squiggly lines instead of smooth strokes.

**Symptom:** Drawing a straight line produced a wavy/jagged output.

**Root Cause:** THREE places were calling `continueMaskStroke()` simultaneously:
1. Document listener (`document.addEventListener('mousemove')`)
2. Paper container (`onMouseMove` prop)
3. MapViewport internal handler (`onMaskStrokeContinue` prop)

Each handler calculated coordinates slightly differently (timing, rounding), causing multiple points to be added per frame.

**Solution:** Remove redundant handlers; keep only ONE source of truth.

```typescript
// REMOVE redundant handlers:
// - Paper onMouseMove handler
// - Paper onMouseUp handler
// - MapViewport onMaskStrokeContinue (only used for internal events)

// KEEP: Document-level listener as single source of truth
```

**Debug Approach:**

```typescript
// Add emoji-coded logs to identify duplicate calls
console.log('🔵 [Global] continueMaskStroke', canvasX, canvasY);
console.log('🟢 [Paper] continueMaskStroke', canvasX, canvasY);
console.log('🔴 [MapViewport] continueMaskStroke', canvasX, canvasY);

// Expected: 1 log per mouse move
// Bug: 2-3 logs per mouse move = duplicate handlers
```

**Lesson:** When adding new event handlers, audit ALL existing handlers that might fire for the same event. Multiple handlers for the same action = bugs.

---

## 4. Lazy Imports for Optional System Dependencies

**Problem:** `cairosvg` (for SVG → PNG rendering) requires system library `libcairo`. When not installed, the import fails and crashes the server at startup.

**Solution:** Lazy import inside the function, with graceful error handling.

```python
# ❌ BAD: Top-level import crashes server if Cairo missing
from mapgenerator.svg_mask import generate_mask_from_description

@router.post("/generate-svg-mask")
async def generate_svg_mask(...):
    # If we get here, import already failed at startup
    pass

# ✅ GOOD: Lazy import with error handling
@router.post("/generate-svg-mask")
async def generate_svg_mask(...):
    # Lazy import to avoid requiring Cairo library at server startup
    try:
        from mapgenerator.svg_mask import generate_mask_from_description
    except ImportError as e:
        if "cairo" in str(e).lower() or "cairosvg" in str(e).lower():
            raise HTTPException(
                status_code=503,
                detail="SVG mask generation not available: Cairo library not installed."
            )
        raise
    
    # Function is available, proceed...
```

**When to Use:**
- Optional features with system dependencies
- Features that may not be available in all deployment environments
- Deferred features that shouldn't block core functionality

**Lesson:** For optional dependencies, especially those requiring system libraries, use lazy imports with clear error messages.

---

## 5. Two-Stage Prompt Compilation

**Problem:** User descriptions are vague; AI image models need specific, structured prompts with style constraints.

**Solution:** Two-stage pipeline: Text model structures the input, then template compiles final prompt.

```
Stage 1: User Input → LLM → MapSpec (structured)
Stage 2: MapSpec + Style Options → Template → Image Prompt

User: "A dungeon with a river and three chambers"
     ↓ (GPT-4 call)
MapSpec: {
  "map_type": "dungeon",
  "features": ["river", "chambers"],
  "chamber_count": 3,
  "terrain": "stone",
  "lighting": "torchlit"
}
     ↓ (template)
Final Prompt: "Top-down battle map, dungeon interior, torchlit stone chambers, 
              flowing river, three distinct rooms, fantasy TTRPG style, 
              no grid lines, no text, no characters"
```

**Backend Implementation:**

```python
# Stage 1: Generate structured MapSpec
async def generate_mapspec(user_input: str, style_options: MapStyleOptions) -> MapSpec:
    system_prompt = MAPSPEC_SYSTEM_PROMPT
    response = await text_service.generate_structured(
        system_prompt=system_prompt,
        user_message=user_input,
        response_schema=MapSpec.model_json_schema()
    )
    return MapSpec(**response)

# Stage 2: Compile image prompt
def compile_image_prompt(spec: MapSpec, style_options: MapStyleOptions) -> str:
    base = f"Top-down battle map, {spec.map_type}"
    
    # Add features
    if spec.features:
        base += f", with {', '.join(spec.features)}"
    
    # Add style modifiers
    if style_options.rendering:
        base += f", {style_options.rendering} style"
    
    # ALWAYS append constraints
    base += ", no grid lines, no text labels, no character figures"
    
    return base
```

**Hard Constraints (always applied):**
- `no grid lines` - Users add their own grid
- `no text labels` - Users add their own labels
- `no character figures` - Maps are for VTT overlay

**Lesson:** Structured intermediate representation enables style toggles, constraint enforcement, and prompt optimization independent of user input.

---

## 6. Mode-Based UI Simplification

**Problem:** The generation drawer has many options (examples bar, style toggles, model selector). In inpaint mode, most of these are irrelevant and create clutter.

**Solution:** Conditionally render UI based on current mode.

```tsx
// MapGenerationDrawer.tsx

{/* Gallery always visible */}
<ProjectGallery images={generatedImages} />

{/* Only show in generate mode */}
{!maskEnabled && (
  <>
    <ExamplesBar examples={MAP_EXAMPLES} />
    <MapStyleToggles options={styleOptions} onChange={setStyleOptions} />
    <ModelSelector model={model} onChange={setModel} />
  </>
)}

{/* Inpaint mode: simplified UI */}
{maskEnabled && (
  <>
    <MaskPreview mask={currentMask} />
    <TextInput
      label="What should appear in the masked area?"
      placeholder="e.g., 'a treasure chest' or 'pool of lava'"
      value={inpaintPrompt}
      onChange={setInpaintPrompt}
    />
    <Button onClick={exitMaskMode}>Exit Mask Mode</Button>
  </>
)}

<Button onClick={handleGenerate}>
  {maskEnabled ? 'Generate in Masked Area' : 'Generate Map'}
</Button>
```

**UX Benefits:**
- Focused interface for current task
- Reduced cognitive load
- Clear mode indicators
- Easy escape hatch (exit button)

**Lesson:** Don't show everything all the time. Contextual UI based on current mode improves usability.

---

## 7. Inline Text Editing on Canvas

**Problem:** Editing label text through sidebar inputs is disconnected from the visual result. Users have to look back and forth.

**Solution:** Double-click to edit text directly on canvas with HTML input overlay.

```tsx
// MapGenerator.tsx - Inline edit state
const [editingLabel, setEditingLabel] = useState<LabelEditInfo | null>(null);

// Position HTML input over Konva text
{editingLabel && (
  <input
    ref={inputRef}
    style={{
      position: 'absolute',
      left: editingLabel.screenX,
      top: editingLabel.screenY,
      fontSize: editingLabel.fontSize * scale,
      fontFamily: editingLabel.fontFamily,
      transform: `rotate(${editingLabel.rotation}deg)`,
      border: 'none',
      outline: '2px solid var(--primary-blue)',
      background: 'white',
      zIndex: 100,
    }}
    value={editingLabel.text}
    onChange={(e) => handleTextChange(e.target.value)}
    onKeyDown={(e) => {
      if (e.key === 'Enter') finishEditing();
      if (e.key === 'Escape') cancelEditing();
    }}
    onBlur={finishEditing}
    autoFocus
  />
)}
```

**Integration with LabelLayer:**

```tsx
// LabelLayer receives callback for starting edit
<LabelLayer
  labels={labels}
  editingLabelId={editingLabel?.id}  // Hide Konva text during edit
  onStartEditing={(info) => setEditingLabel(info)}
  mode={mode}
/>
```

**Key Details:**
- Hide Konva Text when HTML input is visible (`editingLabelId` prop)
- Match font size and family for WYSIWYG feel
- Handle Enter (confirm), Escape (cancel), blur (confirm)
- Restrict to Labels mode only (double-click in pan mode = accidental)

**Lesson:** WYSIWYG editing on the actual canvas is significantly better UX than sidebar controls for positional elements.

---

## 8. Transformer Scaling to Font Size

**Problem:** Konva Transformer scales nodes by changing `scaleX`/`scaleY`. But for Text nodes, we want to change `fontSize`, not `scale`.

**Solution:** On transform end, convert scale back to fontSize and reset scale to 1.

```tsx
// LabelLayer.tsx
const handleTransformEnd = useCallback((label: MapLabel) => {
  const node = labelRefs.current.get(label.id);
  if (!node) return;

  // Get current scale
  const scaleX = node.scaleX();
  const scaleY = node.scaleY();
  
  // Calculate new font size (use average of scaleX and scaleY)
  const avgScale = (Math.abs(scaleX) + Math.abs(scaleY)) / 2;
  const newFontSize = Math.round(label.fontSize * avgScale);
  
  // Clamp to reasonable range
  const clampedFontSize = Math.max(8, Math.min(200, newFontSize));
  
  // Reset scale to 1, update fontSize
  node.scaleX(1);
  node.scaleY(1);
  
  updateLabel(label.id, { fontSize: clampedFontSize });
}, [updateLabel]);
```

**Also Handle Rotation:**

```tsx
// Rotation from Transformer is in degrees
const newRotation = node.rotation();
updateLabel(label.id, { 
  rotation: Math.round(newRotation), 
  fontSize: clampedFontSize 
});
```

**Lesson:** Transformers work on scale/rotation, but your data model may want different representations. Convert on transform end.

---

## 9. Demo Page Checklist Pattern (Validated Again)

**Problem:** How do you systematically verify 50+ behaviors in a feature?

**Solution:** Interactive checklist with localStorage persistence.

```typescript
// MapCanvasDemo.tsx
const CHECKLIST_ITEMS: ChecklistItem[] = [
  // Canvas Viewport
  { id: 'viewport-pan', label: 'Pan canvas by dragging', category: 'Canvas Viewport' },
  { id: 'viewport-zoom', label: 'Zoom with scroll wheel', category: 'Canvas Viewport' },
  { id: 'viewport-fit', label: 'Fit-to-viewport on image load', category: 'Canvas Viewport' },
  
  // Grid Overlay
  { id: 'grid-toggle', label: 'Toggle grid visibility', category: 'Grid Overlay' },
  { id: 'grid-type-switch', label: 'Switch square/hex grid', category: 'Grid Overlay' },
  { id: 'grid-cell-resize', label: 'Resize grid cells', category: 'Grid Overlay' },
  
  // Mask Drawing
  { id: 'mask-brush', label: 'Draw with brush tool', category: 'Mask Drawing' },
  { id: 'mask-eraser', label: 'Erase with eraser', category: 'Mask Drawing' },
  { id: 'mask-shapes', label: 'Draw rect/circle shapes', category: 'Mask Drawing' },
  { id: 'mask-undo-redo', label: 'Undo/redo mask operations', category: 'Mask Drawing' },
  
  // ... 40+ more items
];

// Persist to localStorage
const STORAGE_KEY = 'mapCanvasDemo_checklist';
const [checkedItems, setCheckedItems] = useState<Set<string>>(() => 
  loadFromStorage(STORAGE_KEY)
);
```

**Key Benefits:**
- **Progress tracking:** 0/56 → 56/56 as you test
- **Regression catching:** Re-run after changes
- **Documentation:** Checklist IS the feature specification
- **Onboarding:** New devs learn by testing

**Lesson:** Demo page checklists are living documentation. Update them when features change.

---

## 10. GitHub Dependencies for Docker Builds

**Problem:** Local path dependencies (`{ path = "../GenerationEngine", editable = true }`) work in development but fail in Docker where the monorepo structure doesn't exist.

**Solution:** Use git-based dependencies for production, local paths for development.

```toml
# pyproject.toml

# Production (uncomment for deployment)
generationengine = { git = "https://github.com/Drakosfire/GenerationEngine.git" }

# Development (uncomment for local work)
# generationengine = { path = "../GenerationEngine", editable = true }
```

**Frontend equivalent:**

```json
// package.json

// Production (for server builds)
"dungeonmind-canvas": "git+https://github.com/Drakosfire/Canvas.git"

// Development (pnpm workspace)
// "dungeonmind-canvas": "workspace:*"
```

**Deployment Script Consideration:**

```bash
# buildDM.sh - Install dependencies before build
if [ -d "LandingPage" ]; then
    cd LandingPage
    
    # Ensure git is available for git dependencies
    if ! command -v git &> /dev/null; then
        echo "WARNING: git not found. Git dependencies may fail to install."
    fi
    
    pnpm install || { echo "ERROR: pnpm install failed!"; exit 1; }
    
    # Verify git dependency is installed
    if [ ! -d "node_modules/dungeonmind-canvas" ]; then
        echo "ERROR: dungeonmind-canvas not found!"
        pnpm install --force
    fi
fi
```

**Lesson:** Have a clear toggle mechanism for dev vs production dependencies. Document which to use when.

---

## Anti-Patterns to Avoid

### ❌ Multiple Event Handlers for Same Action

```typescript
// ❌ BAD: Three handlers call continueMaskStroke
document.addEventListener('mousemove', () => continueMaskStroke(...));
<Paper onMouseMove={() => continueMaskStroke(...)} />
<MapViewport onMaskStrokeContinue={() => continueMaskStroke(...)} />

// ✅ GOOD: Single source of truth
document.addEventListener('mousemove', () => continueMaskStroke(...));
// Remove other handlers
```

### ❌ Top-Level Imports for Optional Dependencies

```python
# ❌ BAD: Crashes server if library missing
from mapgenerator.svg_mask import generate_mask_from_description

# ✅ GOOD: Lazy import with error handling
def generate_svg_mask():
    try:
        from mapgenerator.svg_mask import generate_mask_from_description
    except ImportError:
        raise HTTPException(503, "Feature not available")
```

### ❌ useState in Event Listener Closures

```typescript
// ❌ BAD: Stale closure
const [isDrawing, setIsDrawing] = useState(false);
useEffect(() => {
  document.addEventListener('mousemove', () => {
    if (isDrawing) {...} // Always sees initial value!
  });
}, []); // Empty deps = closure captures initial state

// ✅ GOOD: useRef for current value
const isDrawingRef = useRef(false);
useEffect(() => { isDrawingRef.current = isDrawing; }, [isDrawing]);
useEffect(() => {
  document.addEventListener('mousemove', () => {
    if (isDrawingRef.current) {...} // Always current!
  });
}, []);
```

### ❌ Workspace Protocol in Production

```json
// ❌ BAD: Only works in pnpm workspace
"dungeonmind-canvas": "workspace:*"

// ✅ GOOD: Works in any environment
"dungeonmind-canvas": "git+https://github.com/Drakosfire/Canvas.git"
```

### ❌ Hardcoded Prompt Constraints

```python
# ❌ BAD: Constraints can be forgotten
prompt = f"Generate a map of {user_input}"

# ✅ GOOD: Always append constraints
prompt = f"Generate a map of {user_input}"
prompt += ", no grid lines, no text labels, no character figures"  # ALWAYS
```

---

## Patterns Worth Reusing

### 1. Layered Canvas Architecture (Konva)

```typescript
<Stage>
  <Layer listening={false}>{/* Base image */}</Layer>
  <Layer listening={false}>{/* Grid overlay */}</Layer>
  <Layer>{/* Interactive labels */}</Layer>
  <Layer>{/* Mask drawing (optional) */}</Layer>
</Stage>
```

### 2. Mask Drawing Hook Pattern

```typescript
// useMaskDrawing.ts
export function useMaskDrawing(config: MaskConfig) {
  const [isDrawing, setIsDrawing] = useState(false);
  const [tool, setTool] = useState<'brush' | 'eraser' | 'rect' | 'circle'>('brush');
  const [brushSize, setBrushSize] = useState(30);
  const [undoStack, setUndoStack] = useState<MaskOperation[]>([]);
  const [redoStack, setRedoStack] = useState<MaskOperation[]>([]);
  
  const startStroke = useCallback((x: number, y: number) => {...}, []);
  const continueStroke = useCallback((x: number, y: number) => {...}, []);
  const endStroke = useCallback(() => {...}, []);
  const undo = useCallback(() => {...}, []);
  const redo = useCallback(() => {...}, []);
  const clear = useCallback(() => {...}, []);
  
  return {
    isDrawing,
    tool, setTool,
    brushSize, setBrushSize,
    startStroke, continueStroke, endStroke,
    undo, redo, clear,
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
  };
}
```

### 3. Two-Stage Prompt Pipeline

```python
async def generate_image(user_input: str, options: StyleOptions) -> ImageResult:
    # Stage 1: Structure
    spec = await generate_structured_spec(user_input, options)
    
    # Stage 2: Compile
    prompt = compile_optimized_prompt(spec, options)
    
    # Stage 3: Generate
    return await image_service.generate(prompt)
```

### 4. Grid Math Utilities

```typescript
// Reusable for any grid-based system
export function calculateSquareGridLines(
  width: number, height: number, cellSize: number, 
  offsetX: number, offsetY: number
): Line[];

export function calculateHexGridLines(
  width: number, height: number, hexSize: number,
  offsetX: number, offsetY: number
): Line[];

export function pixelToCube(px: number, py: number, size: number): CubeCoord;
export function cubeToPixel(cube: CubeCoord, size: number): { px: number; py: number };
```

---

## Metrics & Outcomes

| Metric | Value | Notes |
|--------|-------|-------|
| User Stories Implemented | 9/9 | US1-US9 complete |
| Test Coverage (Mask Module) | 97.97% | TDD worked |
| Grid Math Coverage | 95%+ | 32 tests |
| Demo Page Bugs Caught | 15+ | Before integration |
| Post-Integration Rework | 0 | Demo page pattern validated |
| Total Development Phases | 14 | Each 2-4 hours |
| Deferred for v2 | Mobile, SVG masks, history | Correct prioritization |

---

## Future Considerations

### Mobile Touch Support (Deferred)
- Pinch-to-zoom requires different gesture handling
- Touch targets need 44px minimum
- Virtual keyboard affects layout
- Estimated: 53 tasks in Phase 2

### SVG Mask Generation (Deferred)
- Backend ready (`/generate-svg-mask` with lazy import)
- Requires `libcairo` system dependency
- UI tab removed for v1

### Iterative Refinement (Deferred)
- Undo/redo image history
- Estimated: 47 tasks in Phase 4

---

## Related Documents

- **Spec:** `specs/003-map-canvas/spec.md`
- **Plan:** `specs/003-map-canvas/plan.md`
- **Tasks:** `specs/003-map-canvas/tasks.md`, `tasks-completed.md`
- **Architecture:** `Docs/architecture/MapGenerator_Architecture.md`
- **Bug Handoffs:** `specs/003-map-canvas/HANDOFF-Mask-Drawing-Squiggle-Bug.md`
- **Pattern Reference:** `LEARNINGS-Demo-Page-Pattern-2025.md`

---

**Last Updated:** 2026-01-15  
**Author:** Agent + User collaboration  
**Status:** ✅ COMPLETE for v1
