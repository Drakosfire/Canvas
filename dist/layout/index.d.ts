/**
 * Layout engine public API — document pagination without map/Konva dependencies.
 */
export { createComponentRegistry, getComponentEntry, getAllComponentTypes, isValidComponentType, } from '../registry';
export type { ComponentRegistryEntry, CanvasComponentType, } from '../types/canvas.types';
export { buildPageDocument, updatePageDataSources, extractCustomData, } from '../data';
export type { PageDocument } from '../types/canvas.types';
export { exportToHTML, downloadHTML, exportPageToHTMLFile, } from '../export';
export { CanvasPage } from '../components/CanvasPage';
export type { CanvasPageProps } from '../components/CanvasPage';
export { useCanvasLayout } from '../hooks/useCanvasLayout';
export { CanvasLayoutProvider } from './state';
export { MeasurementLayer, MeasurementCoordinator } from './measurement';
export type { MeasurementLayerProps } from './measurement';
export { MeasurementPortal } from './MeasurementPortal';
export type { MeasurementPortalProps } from './MeasurementPortal';
export { createColumnStructuralStyles, createPageStructuralStyles, createColumnWrapperStructuralStyles, createMeasurementEntryStyles, createMeasurementLayerStyles, widthsMatch, assertWidthsMatch, } from './structuralStyles';
export type { ColumnStructuralStyles, PageStructuralStyles, ColumnWrapperStructuralStyles, MeasurementEntryStructuralStyles, MeasurementStagingMode, } from './structuralStyles';
export { selectRequiredMeasurementKeys, selectMissingMeasurementKeys, selectAllComponentsMeasured, selectMeasurementStats, selectNeedsRecalculation, verifySelectorsMatchState, } from './selectors';
export { COMPONENT_VERTICAL_SPACING_PX, COLUMN_PADDING_PX, computeBasePageDimensions, computeCanvasDimensions, createDefaultFrameConfig, buildBuckets, regionKey, } from './utils';
export type { BasePageDimensions } from './utils';
export { isComponentDebugEnabled, paginate } from './paginate';
export { isRegionHeightDebugEnabled } from './regionHeightDebug';
export { SegmentRerouteCache } from './segmentTypes';
export type { CanvasLayoutEntry, LayoutPlan, PageLayout, LayoutColumn, MeasurementEntry, RegionBuckets, MeasurementRecord, MeasurementKey, } from './types';
export type { ComponentInstance, ComponentDataSource, ComponentDataReference, ComponentLayoutConfig, TemplateConfig, TemplateSlot, TemplateComponentPlacement, PageVariables, PageMode, PageDimensions, ColumnConfig, PaginationConfig, RegionListContent, CanvasComponentProps, CanvasConfig, FrameConfig, CanvasDimensions, CanvasDebugConfig, } from '../types/canvas.types';
export { createDefaultDataResolver, createDefaultListNormalizer, createDefaultHeightEstimator, createDefaultMetadataExtractor, createDefaultAdapters, } from '../types/adapters.types';
export type { DataResolver, ListNormalizer, RegionContentFactory, HeightEstimator, MetadataExtractor, CanvasAdapters, } from '../types/adapters.types';
//# sourceMappingURL=index.d.ts.map