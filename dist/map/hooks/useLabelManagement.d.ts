/**
 * useLabelManagement Hook (T062)
 *
 * Manages label CRUD operations for map labels.
 * Provides functions to add, update, remove, and select labels.
 */
import { MapLabel } from '../types/map.types';
export interface UseLabelManagementConfig {
    /** Initial labels array */
    initialLabels?: MapLabel[];
}
export interface UseLabelManagementResult {
    labels: MapLabel[];
    selectedLabelId: string | null;
    addLabel: (label: Omit<MapLabel, 'id' | 'rotation' | 'fontFamily' | 'fontSize' | 'color'> & Partial<Pick<MapLabel, 'rotation' | 'fontFamily' | 'fontSize' | 'color'>>) => void;
    updateLabel: (id: string, updates: Partial<MapLabel>) => void;
    removeLabel: (id: string) => void;
    setLabels: (labels: MapLabel[]) => void;
    selectLabel: (id: string | null) => void;
    getLabel: (id: string) => MapLabel | null;
}
/**
 * Hook for managing map label CRUD operations.
 *
 * @param config - Configuration options
 * @returns Label management functions and state
 */
export declare function useLabelManagement(config?: UseLabelManagementConfig): UseLabelManagementResult;
//# sourceMappingURL=useLabelManagement.d.ts.map