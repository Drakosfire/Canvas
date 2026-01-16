/**
 * @dungeonmind/canvas - Main Exports
 *
 * Centralized exports for the Canvas rendering system.
 */
export { createComponentRegistry, getComponentEntry, getAllComponentTypes, isValidComponentType, } from './registry';
export type { ComponentRegistryEntry, CanvasComponentType, } from './types/canvas.types';
export { buildPageDocument, updatePageDataSources, extractCustomData, } from './data';
export type { PageDocument, } from './types/canvas.types';
export { exportToHTML, downloadHTML, exportPageToHTMLFile, } from './export';
export { CanvasPage } from './components/CanvasPage';
export type { CanvasPageProps } from './components/CanvasPage';
export { useCanvasLayout } from './hooks/useCanvasLayout';
export { CanvasLayoutProvider } from './layout/state';
export { MeasurementLayer, MeasurementCoordinator } from './layout/measurement';
export type { MeasurementLayerProps } from './layout/measurement';
export { MeasurementPortal } from './layout/MeasurementPortal';
export type { MeasurementPortalProps } from './layout/MeasurementPortal';
export { createColumnStructuralStyles, createPageStructuralStyles, createColumnWrapperStructuralStyles, createMeasurementEntryStyles, createMeasurementLayerStyles, widthsMatch, assertWidthsMatch, } from './layout/structuralStyles';
export type { ColumnStructuralStyles, PageStructuralStyles, ColumnWrapperStructuralStyles, MeasurementEntryStructuralStyles, MeasurementStagingMode, } from './layout/structuralStyles';
export { createStateDebugger, exposeStateDebugger } from './layout/stateDebug';
export type { StateSummary, StateWarning, StateDebugger } from './layout/stateDebug';
export { selectRequiredMeasurementKeys, selectMissingMeasurementKeys, selectAllComponentsMeasured, selectMeasurementStats, selectNeedsRecalculation, verifySelectorsMatchState, } from './layout/selectors';
export { diagnosePagination, quickCheck, watchOverflow, inspectComponent, exposePaginationDiagnostics, } from './layout/paginationDiagnostics';
export type { ColumnOverflowReport, PaginationDiagnosticReport, PaginationDiagnosticsAPI, } from './layout/paginationDiagnostics';
export { compareLayers, getAllColumnWidths, verifyComponent, checkOverflow } from './layout/diagnostics';
export type { LayerComparison, ColumnInfo, MeasurementDiagnostic, CanvasDebugAPI } from './layout/diagnostics';
export { COMPONENT_VERTICAL_SPACING_PX, computeBasePageDimensions, computeCanvasDimensions, createDefaultFrameConfig, buildBuckets, regionKey, } from './layout/utils';
export type { BasePageDimensions } from './layout/utils';
export { isComponentDebugEnabled, paginate } from './layout/paginate';
export { isRegionHeightDebugEnabled } from './layout/regionHeightDebug';
export { SegmentRerouteCache } from './layout/segmentTypes';
export type { CanvasLayoutEntry, LayoutPlan, PageLayout, LayoutColumn, MeasurementEntry, RegionBuckets, MeasurementRecord, MeasurementKey, } from './layout/types';
export type { ComponentInstance, ComponentDataSource, ComponentDataReference, ComponentLayoutConfig, TemplateConfig, TemplateSlot, TemplateComponentPlacement, PageVariables, PageMode, PageDimensions, ColumnConfig, PaginationConfig, RegionListContent, CanvasComponentProps, CanvasConfig, FrameConfig, CanvasDimensions, CanvasDebugConfig, } from './types/canvas.types';
export { createDefaultDataResolver, createDefaultListNormalizer, createDefaultHeightEstimator, createDefaultMetadataExtractor, createDefaultAdapters, } from './types/adapters.types';
export type { DataResolver, ListNormalizer, RegionContentFactory, HeightEstimator, MetadataExtractor, CanvasAdapters, } from './types/adapters.types';
export * from './map';
//# sourceMappingURL=index.d.ts.map