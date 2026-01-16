/**
 * @dungeonmind/canvas - Main Exports
 *
 * Centralized exports for the Canvas rendering system.
 */
// Component Registry
export { createComponentRegistry, getComponentEntry, getAllComponentTypes, isValidComponentType, } from './registry';
// Data Utilities
export { buildPageDocument, updatePageDataSources, extractCustomData, } from './data';
// Export Utilities
export { exportToHTML, downloadHTML, exportPageToHTMLFile, } from './export';
// Layout System
export { CanvasPage } from './components/CanvasPage';
export { useCanvasLayout } from './hooks/useCanvasLayout';
export { CanvasLayoutProvider } from './layout/state';
export { MeasurementLayer, MeasurementCoordinator } from './layout/measurement';
export { MeasurementPortal } from './layout/MeasurementPortal';
// Structural Styles (Phase 1: Measurement Perfection)
export { createColumnStructuralStyles, createPageStructuralStyles, createColumnWrapperStructuralStyles, createMeasurementEntryStyles, createMeasurementLayerStyles, widthsMatch, assertWidthsMatch, } from './layout/structuralStyles';
// State Debugging (Phase 3: State Simplification)
export { createStateDebugger, exposeStateDebugger } from './layout/stateDebug';
// State Selectors (Phase 3.3: Derivable state)
export { selectRequiredMeasurementKeys, selectMissingMeasurementKeys, selectAllComponentsMeasured, selectMeasurementStats, selectNeedsRecalculation, verifySelectorsMatchState, } from './layout/selectors';
// Pagination Diagnostics (Phase 4: Pagination Polish)
export { diagnosePagination, quickCheck, watchOverflow, inspectComponent, exposePaginationDiagnostics, } from './layout/paginationDiagnostics';
// Diagnostics (Development)
export { compareLayers, getAllColumnWidths, verifyComponent, checkOverflow } from './layout/diagnostics';
// Layout Utilities
export { COMPONENT_VERTICAL_SPACING_PX, computeBasePageDimensions, computeCanvasDimensions, createDefaultFrameConfig, buildBuckets, regionKey, } from './layout/utils';
export { isComponentDebugEnabled, paginate } from './layout/paginate';
export { isRegionHeightDebugEnabled } from './layout/regionHeightDebug';
export { SegmentRerouteCache } from './layout/segmentTypes';
// Adapter System
export { createDefaultDataResolver, createDefaultListNormalizer, createDefaultHeightEstimator, createDefaultMetadataExtractor, createDefaultAdapters, } from './types/adapters.types';
// Map Mode (Konva-based map canvas)
export * from './map';
