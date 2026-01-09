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
export type { UseMapCanvasConfig, UseMapCanvasResult } from './hooks/useMapCanvas';
export { useGridCalculation } from './hooks/useGridCalculation';
export type { UseGridCalculationParams, UseGridCalculationResult } from './hooks/useGridCalculation';
export { useLabelManagement } from './hooks/useLabelManagement';
export type { UseLabelManagementConfig, UseLabelManagementResult } from './hooks/useLabelManagement';
export { useMapFonts } from './hooks/useMapFonts';
export type { UseMapFontsResult } from './hooks/useMapFonts';
export { useMapExport } from './hooks/useMapExport';
export type { ExportMapParams, ExportMapResponse } from './hooks/useMapExport';
export { useMaskDrawing } from './hooks/useMaskDrawing';
export type { UseMaskDrawingResult } from './hooks/useMaskDrawing';

// Components
export { MapViewport } from './components/MapViewport';
export type { MapViewportProps } from './components/MapViewport';
// export { BaseImageLayer } from './components/BaseImageLayer';
export { GridOverlay } from './components/GridOverlay';
export type { GridOverlayProps } from './components/GridOverlay';
export { LabelLayer } from './components/LabelLayer';
export type { LabelLayerProps, LabelEditInfo } from './components/LabelLayer';
export { MaskDrawingLayer } from './components/MaskDrawingLayer';
export type { MaskDrawingLayerProps } from './components/MaskDrawingLayer';
export { MaskPreviewLayer } from './components/MaskPreviewLayer';
export type { MaskPreviewLayerProps } from './components/MaskPreviewLayer';
export { BrushCursor } from './components/BrushCursor';
export type { BrushCursorProps } from './components/BrushCursor';

// State
export { mapStateReducer, createInitialState } from './state/mapState';
export type { MapStateAction } from './state/mapState';
