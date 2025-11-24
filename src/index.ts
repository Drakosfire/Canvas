/**
 * @dungeonmind/canvas - Main Exports
 * 
 * Centralized exports for the Canvas rendering system.
 */

// Component Registry
export {
    createComponentRegistry,
    getComponentEntry,
    getAllComponentTypes,
    isValidComponentType,
} from './registry';

export type {
    ComponentRegistryEntry,
    CanvasComponentType,
} from './types/canvas.types';

// Data Utilities
export {
    buildPageDocument,
    updatePageDataSources,
    extractCustomData,
} from './data';

export type {
    PageDocument,
} from './types/canvas.types';

// Export Utilities
export {
    exportToHTML,
    downloadHTML,
    exportPageToHTMLFile,
} from './export';

// Layout System
export { CanvasPage } from './components/CanvasPage';
export { useCanvasLayout } from './hooks/useCanvasLayout';
export { CanvasLayoutProvider } from './layout/state';
export { MeasurementLayer, MeasurementCoordinator } from './layout/measurement';
export type { MeasurementLayerProps } from './layout/measurement';

// Layout Utilities
export {
    COMPONENT_VERTICAL_SPACING_PX,
    computeBasePageDimensions,
    buildBuckets,
    regionKey,
} from './layout/utils';
export type { BasePageDimensions } from './layout/utils';
export { isComponentDebugEnabled, paginate } from './layout/paginate';
export { isRegionHeightDebugEnabled } from './layout/regionHeightDebug';
export { SegmentRerouteCache } from './layout/segmentTypes';

// Layout Types
export type {
    CanvasLayoutEntry,
    LayoutPlan,
    PageLayout,
    LayoutColumn,
    MeasurementEntry,
    RegionBuckets,
    MeasurementRecord,
    MeasurementKey,
} from './layout/types';

// Core Types
export type {
    ComponentInstance,
    ComponentDataSource,
    ComponentDataReference,
    ComponentLayoutConfig,
    TemplateConfig,
    TemplateSlot,
    TemplateComponentPlacement,
    PageVariables,
    PageMode,
    PageDimensions,
    ColumnConfig,
    PaginationConfig,
    RegionListContent,
    CanvasComponentProps,
} from './types/canvas.types';

// Adapter System
export {
    createDefaultDataResolver,
    createDefaultListNormalizer,
    createDefaultHeightEstimator,
    createDefaultMetadataExtractor,
    createDefaultAdapters,
} from './types/adapters.types';

export type {
    DataResolver,
    ListNormalizer,
    RegionContentFactory,
    HeightEstimator,
    MetadataExtractor,
    CanvasAdapters,
} from './types/adapters.types';

