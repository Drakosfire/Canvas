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

import React, { useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';

import type { CanvasConfig, CanvasDimensions, FrameConfig } from '../types/canvas.types';
import type { MeasurementEntry, MeasurementRecord } from './types';
import { MeasurementLayer } from './measurement';

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
 * Hook to create and manage the measurement portal DOM node.
 */
const useMeasurementPortalNode = (): HTMLDivElement | null => {
    const portalRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        // Create portal container
        const portalNode = document.createElement('div');
        portalNode.className = 'dm-canvas-measurement-portal';
        portalNode.setAttribute('data-canvas-portal', 'measurement');
        document.body.appendChild(portalNode);
        portalRef.current = portalNode;

        return () => {
            // Cleanup on unmount
            if (portalRef.current && document.body.contains(portalRef.current)) {
                document.body.removeChild(portalRef.current);
            }
            portalRef.current = null;
        };
    }, []);

    return portalRef.current;
};

/**
 * Get CSS class names from frameConfig or use defaults.
 */
const getPortalClassNames = (frameConfig?: FrameConfig) => {
    return {
        page: frameConfig?.portalClassNames?.page ?? 'page phb',
        frame: frameConfig?.portalClassNames?.frame ?? 'monster frame wide',
        column: frameConfig?.portalClassNames?.column ?? 'canvas-column',
    };
};

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
export const MeasurementPortal: React.FC<MeasurementPortalProps> = ({
    config,
    dimensions,
    entries,
    renderComponent,
    onMeasurements,
    onMeasurementComplete,
}) => {
    const portalNode = useMeasurementPortalNode();
    const { frameConfig } = config;
    const classNames = getPortalClassNames(frameConfig);

    // Container styles - offscreen, invisible
    const containerStyle = useMemo<React.CSSProperties>(() => ({
        position: 'absolute',
        left: '-9999px',
        top: '0px',
        width: '0px',
        height: '0px',
        overflow: 'hidden',
        visibility: 'hidden',
        pointerEvents: 'none',
    }), []);

    // Page container styles
    const pageStyle = useMemo<React.CSSProperties>(() => ({
        width: `${dimensions.pageWidthPx}px`,
        // Apply font-size from frameConfig if provided
        fontSize: frameConfig?.pageFontSizePx ? `${frameConfig.pageFontSizePx}px` : undefined,
    }), [dimensions.pageWidthPx, frameConfig?.pageFontSizePx]);

    // Frame container styles
    const frameStyle = useMemo<React.CSSProperties>(() => ({
        // Apply font-size from frameConfig if provided
        fontSize: frameConfig?.frameFontSizePx ? `${frameConfig.frameFontSizePx}px` : undefined,
    }), [frameConfig?.frameFontSizePx]);

    // Column container styles
    const columnStyle = useMemo<React.CSSProperties>(() => {
        const columnPadding = frameConfig?.columnPaddingPx ?? 0;
        const verticalPadding = frameConfig?.columnVerticalPaddingPx ?? 0;
        const componentGap = frameConfig?.componentGapPx ?? 12;

        return {
            width: `${dimensions.columnWidthPx}px`,
            padding: `${verticalPadding / 2}px ${columnPadding / 2}px`,
            gap: `${componentGap}px`,
            display: 'flex',
            flexDirection: 'column',
            boxSizing: 'border-box',
        };
    }, [
        dimensions.columnWidthPx,
        frameConfig?.columnPaddingPx,
        frameConfig?.columnVerticalPaddingPx,
        frameConfig?.componentGapPx,
    ]);

    // Don't render if not ready or no portal node
    if (!config.ready || !portalNode) {
        return null;
    }

    // Don't render if no entries
    if (entries.length === 0) {
        return null;
    }

    return createPortal(
        <div className="dm-canvas-measurement-layer" style={containerStyle}>
            <div className={classNames.page} style={pageStyle}>
                <div className={classNames.frame} style={frameStyle}>
                    <div className={classNames.column} style={columnStyle}>
                        <MeasurementLayer
                            entries={entries}
                            renderComponent={renderComponent}
                            onMeasurements={onMeasurements}
                            onMeasurementComplete={onMeasurementComplete}
                            measuredColumnWidth={dimensions.entryWidthPx}
                            ready={config.ready}
                        />
                    </div>
                </div>
            </div>
        </div>,
        portalNode
    );
};

export default MeasurementPortal;

