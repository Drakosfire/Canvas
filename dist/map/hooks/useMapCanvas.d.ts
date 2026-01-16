/**
 * useMapCanvas Hook
 *
 * Main orchestration hook for map canvas state management.
 * Manages grid config, labels, view state, and dirty tracking.
 */
import { GridConfig, MapLabel, MapViewState, MapEditMode } from '../types/map.types';
export interface UseMapCanvasConfig {
    /** Initial grid configuration */
    initialGridConfig?: GridConfig;
    /** Initial labels */
    initialLabels?: MapLabel[];
    /** Initial view state */
    initialView?: MapViewState;
}
export interface UseMapCanvasResult {
    gridConfig: GridConfig;
    labels: MapLabel[];
    view: MapViewState;
    mode: MapEditMode;
    isDirty: boolean;
    selectedLabelId: string | null;
    setGridConfig: (updates: Partial<GridConfig>) => void;
    addLabel: (label: Omit<MapLabel, 'id' | 'rotation' | 'fontFamily' | 'fontSize' | 'color'> & Partial<MapLabel>) => void;
    updateLabel: (id: string, updates: Partial<MapLabel>) => void;
    removeLabel: (id: string) => void;
    setLabels: (labels: MapLabel[]) => void;
    selectLabel: (id: string | null) => void;
    setView: (view: Partial<MapViewState>) => void;
    resetView: () => void;
    fitToViewport: (imageWidth: number, imageHeight: number, viewportWidth: number, viewportHeight: number) => void;
    setMode: (mode: MapEditMode) => void;
    clearDirty: () => void;
}
/**
 * Hook for managing map canvas state
 */
export declare function useMapCanvas(config?: UseMapCanvasConfig): UseMapCanvasResult;
//# sourceMappingURL=useMapCanvas.d.ts.map