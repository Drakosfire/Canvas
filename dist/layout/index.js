/**
 * Layout engine public API — document pagination without map/Konva dependencies.
 */
export { createComponentRegistry, getComponentEntry, getAllComponentTypes, isValidComponentType, } from '../registry';
export { buildPageDocument, updatePageDataSources, extractCustomData, } from '../data';
export { exportToHTML, downloadHTML, exportPageToHTMLFile, } from '../export';
export { CanvasPage } from '../components/CanvasPage';
export { useCanvasLayout } from '../hooks/useCanvasLayout';
export { CanvasLayoutProvider } from './state';
export { MeasurementLayer, MeasurementCoordinator } from './measurement';
export { MeasurementPortal } from './MeasurementPortal';
export { createColumnStructuralStyles, createPageStructuralStyles, createColumnWrapperStructuralStyles, createMeasurementEntryStyles, createMeasurementLayerStyles, widthsMatch, assertWidthsMatch, } from './structuralStyles';
export { selectRequiredMeasurementKeys, selectMissingMeasurementKeys, selectAllComponentsMeasured, selectMeasurementStats, selectNeedsRecalculation, verifySelectorsMatchState, } from './selectors';
export { COMPONENT_VERTICAL_SPACING_PX, COLUMN_PADDING_PX, computeBasePageDimensions, computeCanvasDimensions, createDefaultFrameConfig, buildBuckets, regionKey, } from './utils';
export { isComponentDebugEnabled, paginate } from './paginate';
export { isRegionHeightDebugEnabled } from './regionHeightDebug';
export { SegmentRerouteCache } from './segmentTypes';
export { createDefaultDataResolver, createDefaultListNormalizer, createDefaultHeightEstimator, createDefaultMetadataExtractor, createDefaultAdapters, } from '../types/adapters.types';
