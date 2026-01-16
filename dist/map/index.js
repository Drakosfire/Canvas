/**
 * Map Mode - Canvas Package
 *
 * This module provides Konva-based map canvas rendering with:
 * - Pannable/zoomable viewport
 * - Square and hex grid overlays
 * - Draggable text labels
 * - Export compositing support
 */
// Types
export * from './types/map.types';
export * from './types/mask.types';
// Utils - Pure grid calculation functions
export * from './utils/gridMath';
export * from './utils/hexMath';
export { exportMaskToBase64 } from './utils/maskExport';
// Hooks
export { useMapCanvas } from './hooks/useMapCanvas';
export { useGridCalculation } from './hooks/useGridCalculation';
export { useLabelManagement } from './hooks/useLabelManagement';
export { useMapFonts } from './hooks/useMapFonts';
export { useMapExport } from './hooks/useMapExport';
export { useMaskDrawing } from './hooks/useMaskDrawing';
// Components
export { MapViewport } from './components/MapViewport';
// export { BaseImageLayer } from './components/BaseImageLayer';
export { GridOverlay } from './components/GridOverlay';
export { LabelLayer } from './components/LabelLayer';
export { MaskDrawingLayer } from './components/MaskDrawingLayer';
export { MaskPreviewLayer } from './components/MaskPreviewLayer';
export { BrushCursor } from './components/BrushCursor';
// State
export { mapStateReducer, createInitialState } from './state/mapState';
