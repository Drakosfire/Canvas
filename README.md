# @dungeonmind/canvas

For agent pickup, read [AGENTS.md](AGENTS.md). In the standalone repository,
[CI](.github/workflows/ci.yml) uses `npm ci` and runs type checking, lint, tests,
and the package build. When changing a public contract, also verify the affected
consumer in its owning repository.

A React library for measurement-driven document layouts and Konva-based map canvases.

## Installation

```bash
# Within DungeonMind monorepo (workspace)
pnpm add dungeonmind-canvas@workspace:*
```

Peer dependencies for map mode: `konva`, `react-konva`. Layout-only consumers can import from the layout subpath and avoid Konva.

## Imports

```tsx
// Layout engine (StatBlockGenerator, character sheets)
import {
  CanvasPage,
  useCanvasLayout,
  buildPageDocument,
  createDefaultAdapters,
} from 'dungeonmind-canvas/layout';

// Map mode (MapGenerator)
import {
  MapViewport,
  useMapCanvas,
  useMaskDrawing,
  exportMaskToBase64,
} from 'dungeonmind-canvas/map';

// Backward-compatible root barrel (includes layout + map)
import { CanvasPage, MapViewport } from 'dungeonmind-canvas';

// Dev diagnostics (optional)
import { exposeStateDebugger, diagnosePagination } from 'dungeonmind-canvas/dev';
```

## Layout Quick Start

```tsx
import {
  CanvasPage,
  useCanvasLayout,
  buildPageDocument,
  createDefaultAdapters,
} from 'dungeonmind-canvas/layout';

const page = buildPageDocument({
  template: myTemplate,
  statblockData: myData,
});

function MyCanvas({ page, template, registry }) {
  const layout = useCanvasLayout({
    componentInstances: page.componentInstances,
    template,
    dataSources: page.dataSources,
    componentRegistry: registry,
    adapters: createDefaultAdapters(),
    config: { pageVariables: page.pageVariables },
  });

  return (
    <CanvasPage
      layoutPlan={layout.plan}
      renderEntry={(entry) => <MyComponent {...entry.props} />}
    />
  );
}
```

## Map Quick Start

```tsx
import { MapViewport, DEFAULT_GRID_CONFIG } from 'dungeonmind-canvas/map';

<MapViewport
  width={800}
  height={600}
  baseImageUrl={imageUrl}
  gridConfig={DEFAULT_GRID_CONFIG}
  labels={labels}
  onLabelUpdate={handleLabelUpdate}
/>
```

## Architecture

See [ARCHITECTURE.md](ARCHITECTURE.md) for the layout engine pipeline (measurement → pagination → render).

## Status

See [STATUS.md](STATUS.md) for current health and roadmap.

## License

MIT
