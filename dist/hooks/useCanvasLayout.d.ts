import type { ComponentDataSource, ComponentInstance, ComponentRegistryEntry, PageVariables, TemplateConfig, CanvasConfig, CanvasDimensions } from '../types/canvas.types';
import type { CanvasAdapters } from '../types/adapters.types';
import type { MeasurementEntry } from '../layout/types';
import { MeasurementLayer } from '../layout/measurement';
/**
 * Arguments for useCanvasLayout hook.
 *
 * Phase 5 Architecture: Supports both legacy and new config patterns.
 * - Legacy: Pass pageVariables + initialRegionHeightPx separately
 * - New: Pass config object with pageVariables, frameConfig, and ready signal
 */
interface UseCanvasLayoutArgs {
    componentInstances: ComponentInstance[];
    template: TemplateConfig;
    dataSources: ComponentDataSource[];
    componentRegistry: Record<string, ComponentRegistryEntry>;
    adapters: CanvasAdapters;
    /**
     * NEW (Phase 5): Unified configuration object.
     * When provided, Canvas calculates all dimensions internally.
     * Consumer just provides config, Canvas calculates everything.
     */
    config?: CanvasConfig;
    /**
     * LEGACY: Page variables (use config.pageVariables instead).
     * @deprecated Use config.pageVariables instead
     */
    pageVariables?: PageVariables;
    /**
     * LEGACY: Initial region height (use config.frameConfig instead).
     * @deprecated Use config.frameConfig.verticalBorderPx instead
     */
    initialRegionHeightPx?: number;
}
/**
 * Return type for useCanvasLayout hook.
 */
interface UseCanvasLayoutReturn {
    /** Current layout plan with paginated components */
    plan: import('../layout/types').LayoutPlan | null;
    /** Entries that need measurement */
    measurementEntries: MeasurementEntry[];
    /** Callback to receive measurement updates */
    onMeasurements: (updates: import('../layout/types').MeasurementRecord[]) => void;
    /** Callback when measurement cycle completes */
    onMeasurementComplete: (version: number) => void;
    /** Set region height (LEGACY - prefer using config.frameConfig) */
    setRegionHeight: (height: number) => void;
    /** MeasurementLayer component */
    MeasurementLayer: typeof MeasurementLayer;
    /** Base page dimensions */
    baseDimensions: import('../layout/utils').BasePageDimensions;
    /** Whether a layout update is pending */
    hasPendingLayout: boolean;
    /** Number of pages in pending layout */
    pendingLayoutPageCount: number;
    /** Current measurement status */
    measurementStatus: import('../layout/types').MeasurementStatus | undefined;
    /**
     * NEW (Phase 5): Calculated dimensions.
     * All values derived from config - consumer should NOT calculate these.
     */
    dimensions: CanvasDimensions | null;
    /**
     * NEW (Phase 5): Whether Canvas is ready to measure.
     * True when config.ready is true.
     */
    ready: boolean;
}
export declare const useCanvasLayout: ({ componentInstances, template, dataSources, componentRegistry, config, pageVariables: legacyPageVariables, adapters, initialRegionHeightPx: legacyInitialRegionHeightPx, }: UseCanvasLayoutArgs) => UseCanvasLayoutReturn;
export {};
//# sourceMappingURL=useCanvasLayout.d.ts.map