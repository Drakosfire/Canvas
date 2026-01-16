import React from 'react';
import type { MeasurementEntry, MeasurementRecord } from './types';
type MeasurementDispatcher = (updates: MeasurementRecord[]) => void;
export declare const useIdleMeasurementDispatcher: (dispatch: (entries: MeasurementRecord[]) => void) => (key: string, height: number | null) => void;
/**
 * Phase 1: Coordinator for managing measurement locks across multiple observers
 * Provides a central interface for components to lock/unlock their measurements
 */
export declare class MeasurementCoordinator {
    private observers;
    registerObserver(key: string, observer: MeasurementObserver): void;
    unregisterObserver(key: string): void;
    lockComponent(componentId: string): void;
    unlockComponent(componentId: string): void;
}
declare class MeasurementObserver {
    private key;
    private node;
    private onMeasure;
    private observer;
    private rafHandle;
    private imageCleanup;
    private hasLogged;
    private isLocked;
    private pendingMeasurement;
    constructor(key: string, node: HTMLDivElement, onMeasure: (key: string, height: number) => void);
    private trackMeasurementConsistency;
    /**
     * Lock this observer - measurements will be stored but not dispatched
     * Used during component editing to prevent layout thrashing
     */
    lock(): void;
    /**
     * Unlock this observer - dispatch any pending measurement
     * Called after editing completes to trigger layout update
     */
    unlock(): void;
    attach(): void;
    detach(): void;
    private measure;
    private attachResizeObserver;
    private attachImageListeners;
    private scheduleRAF;
}
export declare const createMeasurementEntry: (overrides?: Partial<MeasurementEntry>) => MeasurementEntry;
type MeasurementStagingMode = 'fixed-offscreen' | 'embedded';
export interface MeasurementLayerProps {
    entries: MeasurementEntry[];
    renderComponent: (entry: MeasurementEntry) => React.ReactNode;
    onMeasurements: MeasurementDispatcher;
    onMeasurementComplete?: (measurementVersion: number) => void;
    coordinator?: MeasurementCoordinator;
    measuredColumnWidth?: number | null;
    publishOnce?: boolean;
    stagingMode?: MeasurementStagingMode;
    /**
     * Phase 4 A2: Gate measurements until host confirms CSS/fonts are loaded.
     * When `ready` is false, MeasurementLayer renders but does NOT start measuring.
     * This prevents capturing incorrect heights before theme CSS is applied.
     * Default: true (for backward compatibility)
     */
    ready?: boolean;
}
export declare const MeasurementLayer: React.FC<MeasurementLayerProps>;
export {};
//# sourceMappingURL=measurement.d.ts.map