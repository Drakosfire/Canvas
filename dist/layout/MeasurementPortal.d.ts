/**
 * MeasurementPortal - Canvas-owned measurement portal component
 *
 * Phase 5 Architecture: Canvas owns the entire measurement portal DOM structure.
 * Consumer just renders <MeasurementPortal /> - that's it.
 *
 * This component:
 * 1. Creates a portal to document.body
 * 2. Sets up the correct CSS context (font-size, classes) from frameConfig
 * 3. Renders MeasurementLayer with correct dimensions
 * 4. Handles all timing/gating internally
 */
import React from 'react';
import type { CanvasConfig, CanvasDimensions } from '../types/canvas.types';
import type { MeasurementEntry, MeasurementRecord } from './types';
export interface MeasurementPortalProps {
    /**
     * Configuration from consumer.
     * Must include ready: true for measurements to occur.
     */
    config: CanvasConfig;
    /**
     * Calculated dimensions from useCanvasLayout.
     */
    dimensions: CanvasDimensions;
    /**
     * Measurement entries to render.
     */
    entries: MeasurementEntry[];
    /**
     * Render function for components.
     */
    renderComponent: (entry: MeasurementEntry) => React.ReactNode;
    /**
     * Callback when measurements are updated.
     */
    onMeasurements: (updates: MeasurementRecord[]) => void;
    /**
     * Callback when measurement cycle completes.
     */
    onMeasurementComplete: (version: number) => void;
}
/**
 * MeasurementPortal - Renders measurement layer in a portal with correct CSS context.
 *
 * Usage:
 * ```tsx
 * <MeasurementPortal
 *     config={config}
 *     dimensions={layout.dimensions}
 *     entries={layout.measurementEntries}
 *     renderComponent={renderComponent}
 *     onMeasurements={layout.onMeasurements}
 *     onMeasurementComplete={layout.onMeasurementComplete}
 * />
 * ```
 */
export declare const MeasurementPortal: React.FC<MeasurementPortalProps>;
export default MeasurementPortal;
//# sourceMappingURL=MeasurementPortal.d.ts.map