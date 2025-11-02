# @dungeonmind/canvas

A flexible, template-driven rendering engine for multi-column, multi-page layouts.

## Overview

Canvas is a React-based layout system that provides:
- Template-based component placement
- Automatic multi-column pagination with overflow handling
- Real-time measurement-based layout calculation
- Component registry system for extensibility
- Data source abstraction

## Installation

```bash
npm install @dungeonmind/canvas
# or
pnpm add @dungeonmind/canvas
```

## Usage

```tsx
import { CanvasPage, useCanvasLayout, buildPageDocument } from '@dungeonmind/canvas';

// Build a page document from template and data
const page = buildPageDocument({
  template: myTemplate,
  dataSources: [
    { id: 'main', type: 'custom', payload: myData }
  ]
});

// Use in your component
function MyCanvas({ page, template }) {
  const layout = useCanvasLayout({
    componentInstances: page.componentInstances,
    template,
    dataSources: page.dataSources,
    componentRegistry: myRegistry,
    pageVariables: page.pageVariables,
  });

  return (
    <CanvasPage
      layoutPlan={layout.plan}
      renderEntry={(entry) => <MyComponent {...entry.props} />}
    />
  );
}
```

## Status

🚧 **This package is currently under active extraction from the DungeonMind LandingPage repository.**

This is a work-in-progress. See `EXTRACTION_PLAN.md` for details.

## License

MIT

