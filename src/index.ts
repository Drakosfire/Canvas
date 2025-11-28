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
export type { CanvasPageProps } from './components/CanvasPage';
export { useCanvasLayout } from './hooks/useCanvasLayout';
export { CanvasLayoutProvider } from './layout/state';
export { MeasurementLayer, MeasurementCoordinator } from './layout/measurement';
export type { MeasurementLayerProps } from './layout/measurement';

// Structural Styles (Phase 1: Measurement Perfection)
export {
    createColumnStructuralStyles,
    createPageStructuralStyles,
    createColumnWrapperStructuralStyles,
    createMeasurementEntryStyles,
    createMeasurementLayerStyles,
    widthsMatch,
    assertWidthsMatch,
} from './layout/structuralStyles';
export type {
    ColumnStructuralStyles,
    PageStructuralStyles,
    ColumnWrapperStructuralStyles,
    MeasurementEntryStructuralStyles,
    MeasurementStagingMode,
} from './layout/structuralStyles';

// State Debugging (Phase 3: State Simplification)
export { createStateDebugger, exposeStateDebugger } from './layout/stateDebug';
export type { StateSummary, StateWarning, StateDebugger } from './layout/stateDebug';

// State Selectors (Phase 3.3: Derivable state)
export {
    selectRequiredMeasurementKeys,
    selectMissingMeasurementKeys,
    selectAllComponentsMeasured,
    selectMeasurementStats,
    selectNeedsRecalculation,
    verifySelectorsMatchState,
} from './layout/selectors';

// Pagination Diagnostics (Phase 4: Pagination Polish)
export {
    diagnosePagination,
    quickCheck,
    watchOverflow,
    inspectComponent,
    exposePaginationDiagnostics,
} from './layout/paginationDiagnostics';
export type {
    ColumnOverflowReport,
    PaginationDiagnosticReport,
    PaginationDiagnosticsAPI,
} from './layout/paginationDiagnostics';

// Diagnostics (Development)
export { compareLayers, getAllColumnWidths, verifyComponent, checkOverflow } from './layout/diagnostics';
export type { LayerComparison, ColumnInfo, MeasurementDiagnostic, CanvasDebugAPI } from './layout/diagnostics';

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

